// Nhóm unit test cho OrderProcessingSimulator: kiểm tra khoảng chờ giả lập và tỷ lệ phát sinh lỗi.
// | STT | Test case                 | Mục đích                         | Các bước làm                                      | Kết quả mong đợi                                  |
// |-----|---------------------------|----------------------------------|---------------------------------------------------|---------------------------------------------------|
// | 1   | Thời gian chờ nhỏ nhất    | Kiểm tra biên dưới 3 giây        | Math.random = 0; chạy và tiến đồng hồ giả          | Chưa xong sau 2999ms; hoàn tất ở 3000ms            |
// | 2   | Thời gian chờ lớn nhất    | Kiểm tra biên trên 5 giây        | Math.random gần 1; chạy và tiến đồng hồ giả       | Chưa xong sau 4999ms; hoàn tất ở 5000ms            |
// | 3   | Tỷ lệ lỗi 30%             | Tạo lỗi để kiểm tra retry        | Giá trị random thứ hai nhỏ hơn 0.3; chạy simulator | Reject với thông báo lỗi xử lý giả lập             |

import { OrderProcessingSimulator } from '@/modules/orders/infrastructure/queue/simulators/order-processing.simulator';

describe('OrderProcessingSimulator', () => {
    let target: OrderProcessingSimulator;

    // Mỗi test tự điều khiển đồng hồ và giá trị ngẫu nhiên để kết quả lặp lại được.
    beforeEach(() => {
        jest.useFakeTimers();
        target = new OrderProcessingSimulator();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    // TEST 1 và 2: kiểm tra hai biên 3–5 giây mà không phải chờ thời gian thật.
    it.each([
        [0, 3000],
        [0.9999, 5000],
    ])(
        'should wait %i random fraction for %i milliseconds',
        async (random, delay) => {
            // 1.1/2.1 Arrange: cố định random để tạo thời gian chờ tại biên đang kiểm tra;
            // lần random tiếp theo là 0.5 nên không kích hoạt nhánh lỗi.
            jest.spyOn(Math, 'random')
                .mockReturnValueOnce(random)
                .mockReturnValueOnce(0.5);

            const result = target.run();

            // 1.2/2.2 Act: tiến đồng hồ đến ngay trước hạn rồi tiến nốt 1ms.
            await jest.advanceTimersByTimeAsync(delay - 1);
            expect(jest.getTimerCount()).toBe(1);

            await jest.advanceTimersByTimeAsync(1);

            // 1.3/2.3 Assert: simulator chỉ hoàn tất sau đúng khoảng delay đã tính.
            await expect(result).resolves.toBeUndefined();
        },
    );

    // TEST 3: giá trị random lỗi dưới 0.3 phải reject để worker/BullMQ đưa job vào retry.
    it('should fail when the simulated random value is below 30 percent', async () => {
        // 3.1 Arrange: chọn random thứ nhất cho thời gian 4 giây và thứ hai là 0.29 để vào nhánh lỗi.
        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(0.5)
            .mockReturnValueOnce(0.29);

        const result = target.run();
        const expectation = expect(result).rejects.toThrow(
            'Lỗi xử lý đơn hàng giả lập.',
        );

        // 3.2 Act: chạy đủ 4 giây trên đồng hồ giả để simulator tới bước quyết định thành công/thất bại.
        await jest.advanceTimersByTimeAsync(4000);

        // 3.3 Assert: lần xử lý bị từ chối bằng đúng thông báo lỗi nghiệp vụ giả lập.
        await expectation;
    });
});
