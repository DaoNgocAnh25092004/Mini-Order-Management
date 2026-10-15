import type { Queue } from 'bullmq';
import type { DataSource } from 'typeorm';
import { OrderOutboxEventEntity } from '@/database/entities/order-outbox-event.entity';
import { OrderOutboxEventType } from '@/database/enums/order-outbox-event-type.enum';
import { ORDER_PROCESSING_JOB } from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { TypeOrmOrderProcessingPublisher } from '@/modules/orders/infrastructure/queue/publishers/typeorm-order-processing.publisher';

// Mock decorator Nest để Jest CommonJS không cần nạp package BullMQ dạng ESM trong unit test.
jest.mock('@nestjs/bullmq', () => ({
    InjectQueue: () => () => undefined,
}));

// Unit test cho publisher: kiểm tra job chỉ mang orderId, dùng ID ổn định và event lỗi vẫn được giữ để retry.
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

    // Xác nhận event đã enqueue được đánh dấu published và job không mang snapshot đơn hàng dư thừa.
    it('should enqueue only the order ID using a stable job ID', async () => {
        await target.dispatchPendingEvents();

        expect(queueAdd).toHaveBeenCalledWith(
            ORDER_PROCESSING_JOB,
            { orderId: event.orderId },
            { jobId: `order-processing-${event.orderId}` },
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

    // Xác nhận lỗi Redis không đánh dấu event đã gửi và lưu lịch thử lại cùng nguyên nhân lỗi.
    it('should keep an event unpublished and schedule a retry when enqueue fails', async () => {
        queueAdd.mockRejectedValue(new Error('Redis unavailable'));
        const beforeDispatch = Date.now();

        await target.dispatchPendingEvents();

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
