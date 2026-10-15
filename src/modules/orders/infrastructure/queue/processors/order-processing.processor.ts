import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ProcessOrderService } from '@/modules/orders/application/services/process-order/process-order.service';
import {
    ORDER_PROCESSING_BACKOFF_DELAY_MS,
    ORDER_PROCESSING_MAX_ATTEMPTS,
    ORDER_PROCESSING_QUEUE,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { OrderProcessingSimulator } from '@/modules/orders/infrastructure/queue/simulators/order-processing.simulator';

interface OrderProcessingJobData {
    orderId: string;
}

// Worker của queue chỉ nhận orderId và giao xử lý nghiệp vụ cho application service, không truy vấn database trực tiếp.
// Khi xử lý lỗi, worker ném lỗi lại để BullMQ tự retry; hết lượt mới yêu cầu application chốt đơn thất bại và hoàn kho.
@Processor(ORDER_PROCESSING_QUEUE)
export class OrderProcessingProcessor extends WorkerHost {
    constructor(
        private readonly processOrderService: ProcessOrderService,
        private readonly simulator: OrderProcessingSimulator,
    ) {
        super(); // WorkerHost cần gọi super() để khởi tạo.
    }

    // Mô phỏng công việc rồi xác nhận đơn nếu thành công.
    // Khi lỗi, chỉ chốt FAILED ở lượt cuối và vẫn trả lỗi về BullMQ để queue cập nhật trạng thái job.
    async process(job: Job<OrderProcessingJobData>): Promise<void> {
        // Bước 1: bổ sung retry policy cho job cũ trong Redis được tạo trước khi publisher cấu hình retry.
        // Chính sách gồm tối đa 3 lượt chạy và exponential backoff (thời gian chờ tăng dần giữa các lượt).
        this.applyRetryPolicy(job);

        try {
            // Bước 2: giả lập công việc nền mất vài giây; simulator có thể ném lỗi để kiểm tra cơ chế retry.
            await this.simulator.run();

            // Bước 3: chỉ khi mô phỏng thành công mới yêu cầu application xác nhận đơn trong database.
            await this.processOrderService.confirm(job.data.orderId);
        } catch (error: unknown) {
            // attemptsMade chỉ đếm các lượt đã kết thúc; cộng 1 để tính cả lượt hiện tại đang bị lỗi.
            const currentAttempt = job.attemptsMade + 1;
            const configuredAttempts =
                job.opts.attempts ?? ORDER_PROCESSING_MAX_ATTEMPTS;

            if (currentAttempt >= configuredAttempts) {
                // Chỉ lượt cuối mới chốt đơn FAILED.
                // Application/repository sẽ hoàn kho và cập nhật trạng thái trong cùng transaction.
                await this.processOrderService.fail(
                    job.data.orderId,
                    this.toFailureReason(error),
                );
            }

            // Không nuốt lỗi: nếu còn lượt, BullMQ chờ backoff rồi chạy job lại.
            // Hết lượt, đơn đã được chốt FAILED ở trên và BullMQ đánh dấu job là failed.
            throw error;
        }
    }

    // Lấy message nếu lỗi là Error; nếu không, chuyển giá trị lỗi thành chuỗi để lưu được lý do thất bại.
    private toFailureReason(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    // Bổ sung retry policy cho job cũ; không ghi đè backoff đã được publisher cấu hình sẵn.
    private applyRetryPolicy(job: Job<OrderProcessingJobData>): void {
        // attempts tính cả lượt chạy đầu tiên.
        // Nâng giá trị thiếu/thấp lên 3 để job cũ không bị kết thúc ngay khi gặp lỗi đầu tiên.
        if ((job.opts.attempts ?? 0) < ORDER_PROCESSING_MAX_ATTEMPTS) {
            job.opts.attempts = ORDER_PROCESSING_MAX_ATTEMPTS;
        }

        // Chỉ thêm backoff nếu job chưa có cấu hình; exponential nghĩa là mỗi lần retry sẽ chờ lâu hơn lần trước.
        if (!job.opts.backoff) {
            job.opts.backoff = {
                type: 'exponential',
                delay: ORDER_PROCESSING_BACKOFF_DELAY_MS,
            };
        }
    }
}
