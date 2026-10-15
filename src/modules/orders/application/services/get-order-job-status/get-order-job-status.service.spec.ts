// Nhóm unit test cho GetOrderJobStatusService: kiểm tra trả trạng thái job và báo lỗi khi không tìm thấy.
// | STT | Test case          | Mục đích                    | Các bước làm                         | Kết quả mong đợi                       |
// |-----|--------------------|-----------------------------|--------------------------------------|----------------------------------------|
// | 1   | Có job             | Trả thông tin theo orderId  | Reader trả status; gọi execute       | Service trả nguyên trạng thái job      |
// | 2   | Không có job       | Báo tài nguyên không tồn tại| Reader trả null; gọi execute         | Ném OrderProcessingJobNotFoundError   |

import {
    OrderJobStatusReader,
    OrderProcessingJobStatus,
} from '@/modules/orders/application/contracts/order-job-status-reader';
import { OrderProcessingJobNotFoundError } from '@/modules/orders/application/errors/order-processing-job-not-found.error';
import { GetOrderJobStatusService } from '@/modules/orders/application/services/get-order-job-status/get-order-job-status.service';

describe('GetOrderJobStatusService', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    let target: GetOrderJobStatusService;
    let reader: jest.Mocked<OrderJobStatusReader>;

    // Thay port bằng mock để test use case mà không cần Redis hoặc queue thật.
    beforeEach(() => {
        reader = {
            findByOrderId: jest.fn(),
        };
        target = new GetOrderJobStatusService(reader);
    });

    // TEST 1: có job thì use case trả nguyên trạng thái do adapter cung cấp.
    it('should return the job status for an existing order job', async () => {
        // 1.1 Arrange: reader trả trạng thái job đang chờ retry.
        const expectedStatus: OrderProcessingJobStatus = {
            orderId,
            jobId: `order-processing-${orderId}`,
            state: 'delayed',
            attempts: 2,
            maxAttempts: 3,
            failureReason: 'Temporary failure',
        };
        reader.findByOrderId.mockResolvedValue(expectedStatus);

        // 1.2 Act: yêu cầu trạng thái theo orderId.
        const result = await target.execute(orderId);

        // 1.3 Assert: chuyển đúng orderId xuống reader và trả nguyên response.
        expect(reader.findByOrderId.mock.calls).toEqual([[orderId]]);
        expect(result).toEqual(expectedStatus);
    });

    // TEST 2: không có job thì use case báo lỗi để controller chuyển thành HTTP 404.
    it('should throw when no job exists for the order', async () => {
        // 2.1 Arrange: reader xác nhận queue không còn job có ID tương ứng.
        reader.findByOrderId.mockResolvedValue(null);

        // 2.2 Act & Assert: yêu cầu trạng thái phải kết thúc bằng lỗi đúng loại.
        await expect(target.execute(orderId)).rejects.toBeInstanceOf(
            OrderProcessingJobNotFoundError,
        );
    });
});
