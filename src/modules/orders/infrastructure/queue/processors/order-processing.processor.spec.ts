// Nhóm unit test cho OrderProcessingProcessor: kiểm tra quyết định xác nhận, retry và kết thúc thất bại.
// | STT | Test case                    | Mục đích                         | Các bước làm                                  | Kết quả mong đợi                                      |
// |-----|------------------------------|----------------------------------|-----------------------------------------------|-------------------------------------------------------|
// | 1   | Xử lý thành công             | Chuyển đơn sang bước xác nhận    | Simulator thành công; gọi process             | Gọi confirm với orderId; không gọi fail               |
// | 2   | Lỗi còn lượt retry           | Để BullMQ chạy lại job           | Simulator lỗi; job chưa đến lượt cuối         | Ném lại lỗi; cấu hình retry; chưa gọi fail            |
// | 3   | Lỗi ở lượt cuối              | Chốt đơn thất bại sau retry      | Simulator lỗi; job ở lượt cuối                | Gọi fail với lý do; ném lại lỗi cho BullMQ             |

import type { Job } from 'bullmq';
import { ProcessOrderService } from '@/modules/orders/application/services/process-order/process-order.service';
import { ORDER_PROCESSING_MAX_ATTEMPTS } from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { OrderProcessingProcessor } from '@/modules/orders/infrastructure/queue/processors/order-processing.processor';

// Mock base class/decorator Nest để test processor không cần khởi chạy worker hoặc Redis thật.
jest.mock('@nestjs/bullmq', () => ({
    Processor: () => () => undefined,
    WorkerHost: class WorkerHost {},
}));

describe('OrderProcessingProcessor', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    let target: OrderProcessingProcessor;
    let processOrderService: {
        confirm: jest.Mock;
        fail: jest.Mock;
    };
    let simulator: { run: jest.Mock };

    // Dùng mock cho tầng application và simulator để tập trung kiểm tra quyết định retry của worker.
    beforeEach(() => {
        processOrderService = {
            confirm: jest.fn().mockResolvedValue(undefined),
            fail: jest.fn().mockResolvedValue(undefined),
        };
        simulator = { run: jest.fn().mockResolvedValue(undefined) };
        target = new OrderProcessingProcessor(
            processOrderService as unknown as ProcessOrderService,
            simulator,
        );
    });

    // TEST 1: xử lý mô phỏng thành công thì worker chuyển orderId sang application để xác nhận đơn.
    it('should confirm the order when processing succeeds', async () => {
        // 1.1 Arrange: tạo job hợp lệ ở lần chạy đầu và để simulator mặc định thành công.
        const job = {
            data: { orderId },
            attemptsMade: 0,
            opts: { attempts: ORDER_PROCESSING_MAX_ATTEMPTS },
        } as Job<{ orderId: string }>;

        // 1.2 Act: chạy processor với job xử lý đơn.
        await target.process(job);

        // 1.3 Assert: yêu cầu xác nhận đúng đơn và không đánh dấu đơn thất bại.
        expect(processOrderService.confirm).toHaveBeenCalledWith(orderId);
        expect(processOrderService.fail).not.toHaveBeenCalled();
    });

    // TEST 2: lỗi trước lượt cuối được trả lại BullMQ để retry, chưa chuyển đơn sang FAILED.
    it('should rethrow a retryable failure without failing the order early', async () => {
        // 2.1 Arrange: giả lập lỗi tạm thời và job cũ chưa có cấu hình retry.
        const processingError = new Error('Temporary processing failure');
        simulator.run.mockRejectedValue(processingError);
        const job = {
            data: { orderId },
            attemptsMade: 0,
            opts: { attempts: 0 },
        } as Job<{ orderId: string }>;

        // 2.2 Act: processor chuẩn hóa retry options rồi ném lỗi để BullMQ lên lịch chạy lại.
        await expect(target.process(job)).rejects.toBe(processingError);

        // 2.3 Assert: không xác nhận/đánh dấu thất bại sớm và áp dụng tối đa 3 lần cùng exponential backoff.
        expect(processOrderService.confirm).not.toHaveBeenCalled();
        expect(processOrderService.fail).not.toHaveBeenCalled();
        expect(job.opts.attempts).toBe(ORDER_PROCESSING_MAX_ATTEMPTS);
        expect(job.opts.backoff).toEqual({
            type: 'exponential',
            delay: 1000,
        });
    });

    // TEST 3: lỗi ở lượt cuối được ghi nhận cho đơn trước khi lỗi được trả lại BullMQ.
    it('should mark the order failed on the final attempt and rethrow the error', async () => {
        // 3.1 Arrange: giả lập lỗi khi job đã dùng hết số lượt chạy được cấu hình.
        const processingError = new Error('Final processing failure');
        simulator.run.mockRejectedValue(processingError);
        const job = {
            data: { orderId },
            attemptsMade: ORDER_PROCESSING_MAX_ATTEMPTS - 1,
            opts: { attempts: ORDER_PROCESSING_MAX_ATTEMPTS },
        } as Job<{ orderId: string }>;

        // 3.2 Act: chạy lượt cuối; processor yêu cầu application chốt đơn FAILED rồi ném lỗi.
        await expect(target.process(job)).rejects.toBe(processingError);

        // 3.3 Assert: gửi đúng orderId và lý do lỗi để application hoàn kho/ghi trạng thái.
        expect(processOrderService.fail).toHaveBeenCalledWith(
            orderId,
            'Final processing failure',
        );
        expect(processOrderService.confirm).not.toHaveBeenCalled();
    });
});
