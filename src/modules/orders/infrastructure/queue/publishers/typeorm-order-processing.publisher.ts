import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderOutboxEventEntity } from '@/database/entities/order-outbox-event.entity';
import { OrderOutboxEventType } from '@/database/enums/order-outbox-event-type.enum';
import {
    ORDER_PROCESSING_JOB,
    ORDER_PROCESSING_QUEUE,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';

// Publisher kiểm tra outbox mỗi giây, mỗi lượt tối đa 25 bản ghi để không giữ khóa DB quá lâu.
const OUTBOX_POLL_INTERVAL_MS = 1000;
const OUTBOX_BATCH_SIZE = 25;
// Tăng dần thời gian chờ khi Redis lỗi, nhưng không chờ quá một phút giữa hai lần thử.
const OUTBOX_MAX_RETRY_DELAY_MS = 60_000;

// Chuyển yêu cầu xử lý đã lưu trong PostgreSQL thành job BullMQ; không xử lý nghiệp vụ đơn hàng tại đây.
@Injectable()
export class TypeOrmOrderProcessingPublisher
    implements OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(TypeOrmOrderProcessingPublisher.name);
    private pollTimer: ReturnType<typeof setTimeout> | undefined;
    private activePoll: Promise<void> | undefined;
    // Cờ này giúp vòng poll không tự chạy lại trong lúc ứng dụng đang tắt.
    private isShuttingDown = false;

    constructor(
        @InjectDataSource() private readonly dataSource: DataSource,
        @InjectQueue(ORDER_PROCESSING_QUEUE)
        private readonly queue: Queue,
    ) {}

    // Bắt đầu gửi outbox ngay khi Nest khởi động; vòng kế tiếp chỉ chạy sau khi vòng hiện tại xong.
    onModuleInit(): void {
        this.activePoll = this.pollAndScheduleNextRun();
    }

    // Ngừng tạo lượt poll mới, hủy timer đang chờ và đợi lượt hiện tại kết thúc trước khi ứng dụng đóng.
    async onModuleDestroy(): Promise<void> {
        this.isShuttingDown = true;

        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
        }

        await this.activePoll;
    }

    // Lấy một lô yêu cầu đến hạn, gửi từng yêu cầu vào BullMQ rồi lưu kết quả ngay trong transaction.
    async dispatchPendingEvents(): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            // Bước 1: Lấy các event chưa gửi và đã đến giờ thử.
            // Khóa từng dòng; nếu instance khác đang giữ khóa thì bỏ qua, tránh hai publisher cùng xử lý một event.
            const events = await manager
                .getRepository(OrderOutboxEventEntity)
                .createQueryBuilder('outbox')
                .setLock('pessimistic_write') // Khóa từng dòng để tránh hai instance cùng gửi một event.
                .setOnLocked('skip_locked') // Nếu dòng đang bị khóa bởi transaction khác thì bỏ qua, tránh deadlock.
                .where('outbox.publishedAt IS NULL')
                .andWhere('outbox.availableAt <= :now', { now: new Date() })
                .orderBy('outbox.createdAt', 'ASC')
                .take(OUTBOX_BATCH_SIZE)
                .getMany();

            for (const event of events) {
                // Bước 2: Ghi nhận thêm một lần thử trước khi gửi event này.
                event.attempts += 1;

                try {
                    // Chỉ gửi loại event hiện đã hỗ trợ; loại khác sẽ được ghi lỗi và giữ lại để điều tra/thử lại.
                    if (
                        event.eventType !==
                        OrderOutboxEventType.ORDER_PROCESSING_REQUESTED
                    ) {
                        throw new Error(
                            `Unsupported outbox event type: ${String(event.eventType)}`,
                        );
                    }

                    // Bước 3: Đưa mã đơn vào queue, không gửi toàn bộ dữ liệu đơn.
                    // Dùng cùng job ID cho một đơn để BullMQ nhận ra lần enqueue lặp khi job cũ vẫn còn trong queue.
                    await this.queue.add(
                        ORDER_PROCESSING_JOB,
                        { orderId: event.orderId },
                        { jobId: `order-processing-${event.orderId}` },
                    );

                    event.publishedAt = new Date();
                    event.lastError = null;
                } catch (error: unknown) {
                    // Nếu gửi thất bại, giữ event ở trạng thái chưa gửi, lưu lý do và đặt thời điểm thử lại.
                    // Bắt lỗi ngay trong vòng lặp để một event lỗi không ngăn các event còn lại được xử lý.
                    event.lastError = this.toErrorMessage(error).slice(0, 4000);
                    event.availableAt = new Date(
                        Date.now() + this.getRetryDelayMs(event.attempts),
                    );
                    this.logger.warn(
                        `Could not publish outbox event ${event.id}: ${event.lastError}`,
                    );
                }
            }

            // Bước 4: Lưu trạng thái gửi thành công hoặc thông tin retry trước khi transaction nhả khóa.
            if (events.length > 0) {
                await manager.save(OrderOutboxEventEntity, events);
            }
        });
    }

    // Chạy một lượt gửi; nếu DB/Redis lỗi thì ghi log, nhưng vẫn hẹn lượt tiếp theo để tự phục hồi.
    private async pollAndScheduleNextRun(): Promise<void> {
        try {
            await this.dispatchPendingEvents();
        } catch (error: unknown) {
            this.logger.error(
                `Outbox polling failed: ${this.toErrorMessage(error)}`,
            );
        } finally {
            // Chỉ hẹn lượt kế tiếp khi ứng dụng còn hoạt động; lúc shutdown thì dừng hẳn vòng lặp.
            if (!this.isShuttingDown) {
                this.pollTimer = setTimeout(() => {
                    this.activePoll = this.pollAndScheduleNextRun();
                }, OUTBOX_POLL_INTERVAL_MS);
            }
        }
    }

    // Mỗi lần lỗi chờ lâu gấp đôi lần trước (1s, 2s, 4s...), tối đa 60s để tránh dồn request vào Redis.
    private getRetryDelayMs(attempts: number): number {
        return Math.min(
            1000 * 2 ** Math.min(Math.max(attempts - 1, 0), 6),
            OUTBOX_MAX_RETRY_DELAY_MS,
        );
    }

    // Lỗi có thể không phải đối tượng Error; đổi mọi kiểu lỗi thành chuỗi để lưu DB và ghi log được.
    private toErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
