// Nhóm unit test cho publisher: xác nhận cách chuyển outbox event thành job và xử lý lỗi enqueue.
// | STT | Test case             | Mục đích                         | Các bước làm                                 | Kết quả mong đợi                                      |
// |-----|-----------------------|----------------------------------|----------------------------------------------|-------------------------------------------------------|
// | 1   | Enqueue thành công    | Gửi job gọn và chống trùng       | Outbox có event; gọi dispatch                 | Job chỉ có orderId, ID ổn định; event được đánh dấu gửi |
// | 2   | Enqueue thất bại      | Giữ event để thử gửi lại         | Queue lỗi; gọi dispatch                       | Chưa đánh dấu gửi; tăng attempts và hẹn retry          |

import type { Queue } from 'bullmq';
import type { DataSource } from 'typeorm';
import { OrderOutboxEventEntity } from '@/database/entities/order-outbox-event.entity';
import { OrderOutboxEventType } from '@/database/enums/order-outbox-event-type.enum';
import {
    ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
    ORDER_PROCESSING_JOB,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { TypeOrmOrderProcessingPublisher } from '@/modules/orders/infrastructure/queue/publishers/typeorm-order-processing.publisher';

// Mock decorator Nest để Jest CommonJS không cần nạp package BullMQ dạng ESM trong unit test.
jest.mock('@nestjs/bullmq', () => ({
    InjectQueue: () => () => undefined,
}));

describe('TypeOrmOrderProcessingPublisher', () => {
    let target: TypeOrmOrderProcessingPublisher;
    let dataSource: DataSource;
    let queue: Queue;
    let queueAdd: jest.Mock;
    let event: OrderOutboxEventEntity;
    let queryBuilder: Record<string, jest.Mock>;
    let transactionManager: {
        getRepository: jest.Mock;
        save: jest.Mock;
    };

    // Tạo mock transaction và query builder để unit test không cần kết nối PostgreSQL hoặc Redis thật.
    beforeEach(() => {
        event = {
            id: 'outbox-event-1',
            orderId: 'order-123',
            eventType: OrderOutboxEventType.ORDER_PROCESSING_REQUESTED,
            attempts: 0,
            availableAt: new Date(),
            publishedAt: null,
            lastError: null,
        } as OrderOutboxEventEntity;

        queryBuilder = {
            setLock: jest.fn().mockReturnThis(),
            setOnLocked: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([event]),
        };
        transactionManager = {
            getRepository: jest.fn().mockReturnValue({
                createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            }),
            save: jest.fn().mockResolvedValue([event]),
        };
        dataSource = {
            transaction: jest.fn((work: (manager: never) => unknown) =>
                Promise.resolve(work(transactionManager as never)),
            ),
        } as unknown as DataSource;
        queueAdd = jest.fn().mockResolvedValue({});
        queue = { add: queueAdd } as unknown as Queue;
        target = new TypeOrmOrderProcessingPublisher(dataSource, queue);
    });

    // TEST 1: enqueue thành công thì job chỉ chứa orderId và outbox event được đánh dấu đã gửi.
    it('should enqueue only the order ID using a stable job ID', async () => {
        // 1.1 Arrange: mock một outbox event đang chờ; queue mặc định nhận job thành công.
        // beforeEach đã dựng event và queue mock, nên test chỉ cần gọi publisher.

        // 1.2 Act: publisher lấy event chờ, thêm job vào queue rồi cập nhật outbox.
        await target.dispatchPendingEvents();

        // 1.3 Assert: payload/jobId ổn định, event được đánh dấu published và khóa skip_locked được dùng.
        expect(queueAdd).toHaveBeenCalledWith(
            ORDER_PROCESSING_JOB,
            { orderId: event.orderId },
            {
                jobId: `order-processing-${event.orderId}`,
                ...ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
            },
        );
        expect(event.attempts).toBe(1);
        expect(event.publishedAt).toBeInstanceOf(Date);
        expect(event.lastError).toBeNull();
        const setOnLocked = queryBuilder.setOnLocked;
        expect(setOnLocked).toHaveBeenCalledWith('skip_locked');
        expect(transactionManager.save).toHaveBeenCalledWith(
            OrderOutboxEventEntity,
            [event],
        );
    });

    // TEST 2: queue lỗi thì event vẫn chưa published và được lên lịch thử gửi lại.
    it('should keep an event unpublished and schedule a retry when enqueue fails', async () => {
        // 2.1 Arrange: queue từ chối enqueue để mô phỏng Redis tạm thời không khả dụng.
        queueAdd.mockRejectedValue(new Error('Redis unavailable'));
        const beforeDispatch = Date.now();

        // 2.2 Act: publisher bắt lỗi enqueue và cập nhật thời điểm retry cho outbox event.
        await target.dispatchPendingEvents();

        // 2.3 Assert: lưu attempts/lỗi, không đặt publishedAt và availableAt nằm sau thời điểm hiện tại.
        expect(event.attempts).toBe(1);
        expect(event.publishedAt).toBeNull();
        expect(event.lastError).toBe('Redis unavailable');
        expect(event.availableAt.getTime()).toBeGreaterThan(beforeDispatch);
        expect(transactionManager.save).toHaveBeenCalledWith(
            OrderOutboxEventEntity,
            [event],
        );
    });
});
