// Nhóm unit test cho BullMqOrderJobStatusReader: kiểm tra ánh xạ trạng thái và số lượt chạy từ BullMQ.
// | STT | Test case       | Mục đích                           | Các bước làm                          | Kết quả mong đợi                              |
// |-----|-----------------|------------------------------------|---------------------------------------|-----------------------------------------------|
// | 1   | Job chưa có     | Phát hiện job không còn trong queue| Queue trả null                        | Reader trả null                               |
// | 2   | Job đang chạy   | Tính cả lượt chạy hiện tại         | Job active, attemptsMade = 1          | attempts = 2, trả state và maxAttempts         |
// | 3   | Job hoàn tất    | Tính lượt chạy thành công          | Job completed, attemptsMade = 0       | attempts = 1, failureReason là null           |
// | 4   | Job thất bại    | Giữ số lượt lỗi và lý do cuối      | Job failed, attemptsMade = 3          | attempts = 3, trả đúng failureReason          |

import type { Queue } from 'bullmq';
import { BullMqOrderJobStatusReader } from '@/modules/orders/infrastructure/queue/readers/bullmq-order-job-status.reader';

// Mock decorator Nest để unit test không cần khởi động Redis hoặc worker thật.
jest.mock('@nestjs/bullmq', () => ({
    InjectQueue: () => () => undefined,
}));

describe('BullMqOrderJobStatusReader', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    const jobId = `order-processing-${orderId}`;
    let target: BullMqOrderJobStatusReader;
    let queue: Queue<{ orderId: string }>;
    let getJob: jest.Mock;

    // Dùng queue/job mock để chỉ kiểm tra cách adapter chuyển dữ liệu BullMQ.
    beforeEach(() => {
        getJob = jest.fn();
        queue = { getJob } as unknown as Queue<{ orderId: string }>;
        target = new BullMqOrderJobStatusReader(queue);
    });

    // TEST 1: không còn job trong queue thì reader trả null để application báo 404.
    it('should return null when the queue has no job for the order', async () => {
        // 1.1 Arrange: BullMQ không tìm thấy job theo ID ổn định.
        getJob.mockResolvedValue(null);

        // 1.2 Act: đọc trạng thái job theo orderId.
        const result = await target.findByOrderId(orderId);

        // 1.3 Assert: dùng đúng job ID và báo không có dữ liệu.
        expect(getJob).toHaveBeenCalledWith(jobId);
        expect(result).toBeNull();
    });

    // TEST 2: job active phải tính cả lượt đang chạy chưa được BullMQ ghi vào attemptsMade.
    it('should include the active attempt in the attempt count', async () => {
        // 2.1 Arrange: job đã lỗi một lần và hiện đang chạy lượt thứ hai.
        getJob.mockResolvedValue({
            attemptsMade: 1,
            opts: { attempts: 3 },
            failedReason: 'Previous failure',
            getState: jest.fn().mockResolvedValue('active'),
        });

        // 2.2 Act: lấy trạng thái job.
        const result = await target.findByOrderId(orderId);

        // 2.3 Assert: phản ánh lượt thứ hai đang thực thi, không chỉ đếm lỗi trước đó.
        expect(result).toEqual({
            orderId,
            jobId,
            state: 'active',
            attempts: 2,
            maxAttempts: 3,
            failureReason: 'Previous failure',
        });
    });

    // TEST 3: job completed có một lượt chạy thành công dù attemptsMade chỉ đếm lỗi.
    it('should count the successful run for a completed job', async () => {
        // 3.1 Arrange: job thành công ngay lần đầu, chưa có lượt lỗi nào.
        getJob.mockResolvedValue({
            attemptsMade: 0,
            opts: { attempts: 3 },
            failedReason: '',
            getState: jest.fn().mockResolvedValue('completed'),
        });

        // 3.2 Act: đọc trạng thái job đã hoàn tất.
        const result = await target.findByOrderId(orderId);

        // 3.3 Assert: tính lượt thành công và không trả chuỗi lỗi rỗng như một lỗi thật.
        expect(result).toEqual({
            orderId,
            jobId,
            state: 'completed',
            attempts: 1,
            maxAttempts: 3,
            failureReason: null,
        });
    });

    // TEST 4: job failed đã qua đủ ba lượt thì giữ nguyên số lượt và lý do lỗi cuối.
    it('should return the final attempt count and failure reason', async () => {
        // 4.1 Arrange: BullMQ giữ job thất bại sau khi dùng hết retry.
        getJob.mockResolvedValue({
            attemptsMade: 3,
            opts: { attempts: 3 },
            failedReason: 'Final processing failure',
            getState: jest.fn().mockResolvedValue('failed'),
        });

        // 4.2 Act: đọc trạng thái job thất bại.
        const result = await target.findByOrderId(orderId);

        // 4.3 Assert: trả đúng tổng lượt đã chạy và lý do thất bại gần nhất.
        expect(result).toEqual({
            orderId,
            jobId,
            state: 'failed',
            attempts: 3,
            maxAttempts: 3,
            failureReason: 'Final processing failure',
        });
    });
});
