// | STT | Test case       | Mục đích              | Các bước làm               | Kết quả mong đợi                 |
// |-----|-----------------|-----------------------|----------------------------|----------------------------------|
// | 1   | Tìm thấy đơn    | Trả đủ chi tiết/order_items | Mock repo trả detail; execute | Trả đúng detail; gọi repo đúng ID |
// | 2   | Không tìm thấy  | Chuyển null thành 404 | Mock repo trả null; execute | Ném OrderNotFoundError có ID     |
// Nhóm unit test cho GetOrderByIdService; repository được mock nên không cần PostgreSQL.
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
    OrderDetail,
    OrderReadRepository,
} from '@/modules/orders/application/contracts/order-read-repository';
import { ORDER_READ_REPOSITORY } from '@/modules/orders/application/contracts/order-read-repository';
import { OrderNotFoundError } from '@/modules/orders/application/errors/order-not-found.error';
import { GetOrderByIdService } from '@/modules/orders/application/services/get-order-by-id/get-order-by-id.service';
import { OrderStatus } from '@/database/enums/order-status.enum';

describe('GetOrderByIdService', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    let target: GetOrderByIdService;
    let moduleRef: TestingModule;
    let mockOrderReadRepository: jest.Mocked<OrderReadRepository>;

    // Tạo service với repository mock mới cho từng test để kết quả không rò giữa các case.
    beforeEach(async () => {
        mockOrderReadRepository = {
            findById: jest.fn(),
        };

        moduleRef = await Test.createTestingModule({
            providers: [
                GetOrderByIdService,
                {
                    provide: ORDER_READ_REPOSITORY,
                    useValue: mockOrderReadRepository,
                },
            ],
        })
            .setLogger(new Logger())
            .compile();

        target = moduleRef.get(GetOrderByIdService);
    });

    // Dọn mock và Nest testing resources sau từng test case.
    afterEach(async () => {
        jest.clearAllMocks();
        await moduleRef.close();
    });

    // TEST 1: repository tìm thấy đơn thì service trả nguyên detail, gồm danh sách snapshot item.
    it('should return order details when the order exists', async () => {
        // 1.1 Arrange: giả lập một đơn có một order_item với giá snapshot.
        const expectedOrder: OrderDetail = {
            id: orderId,
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            status: OrderStatus.PENDING,
            createdAt: new Date('2026-10-14T00:00:00.000Z'),
            updatedAt: new Date('2026-10-14T00:00:00.000Z'),
            items: [
                {
                    id: 'order-item-1',
                    productId: 'product-1',
                    productSku: 'SKU-1',
                    productName: 'Keyboard',
                    quantity: 2,
                    unitPrice: '125.40',
                },
            ],
        };
        mockOrderReadRepository.findById.mockResolvedValue(expectedOrder);

        // 1.2 Act: yêu cầu service đọc đơn bằng ID.
        const result = await target.execute(orderId);

        // 1.3 Assert: trả nguyên detail và gọi port đúng ID.
        expect(result).toEqual(expectedOrder);
        expect(mockOrderReadRepository.findById.mock.calls).toEqual([
            [orderId],
        ]);
    });

    // TEST 2: repository trả null thì service phát lỗi nghiệp vụ để controller ánh xạ thành HTTP 404.
    it('should throw OrderNotFoundError when the order does not exist', async () => {
        // 2.1 Arrange: giả lập database không có đơn mang ID yêu cầu.
        mockOrderReadRepository.findById.mockResolvedValue(null);

        // 2.2 Act & Assert: không trả detail rỗng; ném đúng lỗi và giữ ID trong thông báo.
        const result = target.execute(orderId);

        await expect(result).rejects.toBeInstanceOf(OrderNotFoundError);
        await expect(result).rejects.toThrow(orderId);
        expect(mockOrderReadRepository.findById.mock.calls).toHaveLength(1);
    });
});
