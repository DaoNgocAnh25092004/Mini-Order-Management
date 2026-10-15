// Nhóm unit test cho OrderExpirationScheduler: xác nhận lịch quét được đăng ký một lần theo ID ổn định.
// | STT | Test case       | Mục đích                       | Các bước làm                         | Kết quả mong đợi                                      |
// |-----|-----------------|--------------------------------|--------------------------------------|-------------------------------------------------------|
// | 1   | Đăng ký lịch    | Quét đơn hết hạn mỗi 5 phút    | Gọi onModuleInit với queue mock      | Upsert đúng scheduler ID, job name, payload và retry  |

import type { Queue } from 'bullmq';
import {
    EXPIRE_PENDING_ORDERS_INTERVAL_MS,
    EXPIRE_PENDING_ORDERS_JOB,
    EXPIRE_PENDING_ORDERS_SCHEDULER_ID,
    ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import type { OrderQueueJobData } from '@/modules/orders/application/contracts/order-queue-job-data';
import { OrderExpirationScheduler } from '@/modules/orders/infrastructure/queue/schedulers/order-expiration.scheduler';

// Mock decorator Nest để kiểm tra cấu hình mà không kết nối Redis thật.
jest.mock('@nestjs/bullmq', () => ({
    InjectQueue: () => () => undefined,
}));

describe('OrderExpirationScheduler', () => {
    let target: OrderExpirationScheduler;
    let queue: Queue<OrderQueueJobData>;
    let upsertJobScheduler: jest.Mock;

    // Dùng queue mock để xác nhận scheduler được đăng ký với cấu hình đúng.
    beforeEach(() => {
        upsertJobScheduler = jest.fn().mockResolvedValue({});
        queue = { upsertJobScheduler } as unknown as Queue<OrderQueueJobData>;
        target = new OrderExpirationScheduler(queue);
    });

    // TEST 1: lúc module khởi động, tạo/cập nhật lịch lặp duy nhất trong Redis.
    it('should upsert the pending-order expiration scheduler', async () => {
        // 1.1 Arrange: beforeEach đã chuẩn bị queue có upsertJobScheduler mock.

        // 1.2 Act: chạy lifecycle hook khi Nest khởi động module.
        await target.onModuleInit();

        // 1.3 Assert: lịch chạy 5 phút/lần và tạo đúng loại job có retry mặc định.
        expect(upsertJobScheduler).toHaveBeenCalledWith(
            EXPIRE_PENDING_ORDERS_SCHEDULER_ID,
            { every: EXPIRE_PENDING_ORDERS_INTERVAL_MS },
            {
                name: EXPIRE_PENDING_ORDERS_JOB,
                data: { task: 'expire-pending-orders' },
                opts: ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
            },
        );
    });
});
