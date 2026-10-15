// Nhóm unit test cho ExpirePendingOrdersService: kiểm tra cutoff 30 phút và số order repository xử lý.
// | STT | Test case             | Mục đích                         | Các bước làm                       | Kết quả mong đợi                                |
// |-----|-----------------------|----------------------------------|------------------------------------|-------------------------------------------------|
// | 1   | Có đơn quá hạn        | Tính đúng mốc hết hạn            | Cố định giờ hiện tại; gọi execute | Gửi cutoff bằng hiện tại trừ 30 phút; trả số đơn|

import type { OrderProcessingRepository } from '@/modules/orders/application/contracts/order-processing-repository';
import { ExpirePendingOrdersService } from '@/modules/orders/application/services/expire-pending-orders/expire-pending-orders.service';

describe('ExpirePendingOrdersService', () => {
    let target: ExpirePendingOrdersService;
    let repository: jest.Mocked<OrderProcessingRepository>;

    // Thay repository bằng mock để kiểm tra cutoff mà không cần PostgreSQL.
    beforeEach(() => {
        repository = {
            confirmPendingOrder: jest.fn(),
            failPendingOrder: jest.fn(),
            expireOverduePendingOrders: jest.fn().mockResolvedValue(2),
        };
        target = new ExpirePendingOrdersService(repository);
    });

    // Khôi phục Date.now sau test để không ảnh hưởng các test khác.
    afterEach(() => {
        jest.restoreAllMocks();
    });

    // TEST 1: service gửi mốc 30 phút trước thời điểm hiện tại và trả số đơn repository đã hủy.
    it('should expire orders older than 30 minutes and return the count', async () => {
        // 1.1 Arrange: cố định clock để cutoff có thể kiểm tra chính xác.
        const now = new Date('2026-10-15T12:00:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);

        // 1.2 Act: chạy use case hết hạn đơn.
        const result = await target.execute();

        // 1.3 Assert: repository nhận cutoff đúng 30 phút và kết quả được trả nguyên vẹn.
        expect(repository.expireOverduePendingOrders.mock.calls).toEqual([
            [new Date(now - 30 * 60 * 1000)],
        ]);
        expect(result).toBe(2);
    });
});
