// Nhóm unit test cho CreateOrderService: repository được mock để tập trung vào logic application.
// | STT | Test case                | Mục đích                | Các bước làm                     | Kết quả mong đợi                      |
// |-----|--------------------------|-------------------------|----------------------------------|---------------------------------------|
// | 1   | Tạo đơn thành công       | Điều phối use case      | Mock repo trả đơn; gọi execute   | Trả đúng đơn; chuyển input đúng       |
// | 2   | Không đủ tồn kho         | Truyền lỗi nghiệp vụ    | Mock repo báo thiếu; gọi execute | InsufficientStockError được truyền ra |
// | 3   | Gộp productId trùng      | Chuẩn hóa giỏ hàng      | Gửi ID lặp; gọi execute          | Repo nhận quantity đã cộng            |
// | 4   | Quantity vượt giới hạn   | Chặn integer overflow   | Tổng > 2,147,483,647; execute    | InvalidOrderError; không gọi repo     |
// | 5   | Repository trả lỗi       | Giữ nguyên lỗi hạ tầng  | Mock repo reject; gọi execute    | Lỗi gốc được truyền ra                |
// Lưu ý: case 2 chỉ kiểm tra service truyền lỗi; repository mới kiểm tra điều kiện stock thực tế.

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
    CreatedOrder,
    CreateOrderInput,
    OrderWriteRepository,
} from '@/modules/orders/application/contracts/order-write-repository';
import { ORDER_WRITE_REPOSITORY } from '@/modules/orders/application/contracts/order-write-repository';
import { InsufficientStockError } from '@/modules/orders/application/errors/insufficient-stock.error';
import { InvalidOrderError } from '@/modules/orders/application/errors/invalid-order.error';
import { CreateOrderService } from '@/modules/orders/application/services/create-order/create-order.service';

describe('CreateOrderService', () => {
    let target: CreateOrderService;
    let moduleRef: TestingModule;
    let mockOrderWriteRepository: jest.Mocked<OrderWriteRepository>;

    // Tạo module DI mới cho mỗi test để repository mock không giữ trạng thái cũ.
    beforeEach(async () => {
        mockOrderWriteRepository = {
            create: jest.fn(),
            cancelOrder: jest.fn(),
        };

        moduleRef = await Test.createTestingModule({
            providers: [
                CreateOrderService,
                {
                    provide: ORDER_WRITE_REPOSITORY,
                    useValue: mockOrderWriteRepository,
                },
            ],
        })
            .setLogger(new Logger())
            .compile();

        target = moduleRef.get(CreateOrderService);
    });

    // Đóng testing module sau mỗi case để không giữ provider hoặc tài nguyên mở.
    afterEach(async () => {
        jest.clearAllMocks();
        await moduleRef.close();
    });

    // TEST 1: Xác nhận use case trả đơn thành công và chuyển nguyên input hợp lệ đến repository.
    it('should create an order when input contains valid items', async () => {
        // 1.1 Arrange: chuẩn bị một sản phẩm hợp lệ và giả lập repository trả về đơn PENDING đã lưu.
        const input: CreateOrderInput = {
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            items: [{ productId: 'product-1', quantity: 2 }],
        };
        const expectedOrder = {
            id: 'order-1',
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            status: 'PENDING',
            createdAt: new Date('2026-10-14T00:00:00.000Z'),
            updatedAt: new Date('2026-10-14T00:00:00.000Z'),
            items: [],
        } as unknown as CreatedOrder;
        mockOrderWriteRepository.create.mockResolvedValue(expectedOrder);

        // 1.2 Act: gọi use case như controller sẽ gọi sau khi DTO đã được validate.
        const result = await target.execute(input);

        // 1.3 Assert: service trả đúng kết quả của repository và không làm sai input gửi xuống.
        expect(result).toEqual(expectedOrder);
        expect(mockOrderWriteRepository.create.mock.calls).toEqual([[input]]);
    });

    // TEST 2: Xác nhận service chuyển nguyên lỗi thiếu tồn kho từ repository lên caller.
    it('should propagate insufficient stock errors from the repository', async () => {
        // 2.1 Arrange: repository giả lập phát hiện yêu cầu 2 sản phẩm nhưng kho chỉ còn 1.
        const input: CreateOrderInput = {
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            items: [{ productId: 'product-1', quantity: 2 }],
        };
        const insufficientStockError = new InsufficientStockError(
            'product-1',
            2,
            1,
        );
        mockOrderWriteRepository.create.mockRejectedValue(
            insufficientStockError,
        );

        // 2.2 Act & Assert: service không nuốt/đổi lỗi và đã chuyển input đến repository.
        await expect(target.execute(input)).rejects.toBe(
            insufficientStockError,
        );
        expect(mockOrderWriteRepository.create.mock.calls).toEqual([[input]]);
    });

    // TEST 3: Xác nhận các dòng cùng productId được gộp trước khi giao trách nhiệm kiểm tra/trừ kho cho repository.
    it('should merge repeated product items before creating the order', async () => {
        // 3.1 Arrange: product-1 xuất hiện hai lần (2 + 3); product-2 xuất hiện một lần (1).
        const input: CreateOrderInput = {
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            items: [
                { productId: 'product-1', quantity: 2 },
                { productId: 'product-2', quantity: 1 },
                { productId: 'product-1', quantity: 3 },
            ],
        };
        mockOrderWriteRepository.create.mockResolvedValue({} as CreatedOrder);

        // 3.2 Act: gọi use case để nó chuẩn hóa danh sách item rồi gọi repository.
        await target.execute(input);

        // 3.3 Assert: repository nhận product-1 đúng một lần với tổng 5, còn product-2 giữ quantity 1.
        expect(mockOrderWriteRepository.create.mock.calls).toEqual([
            [
                {
                    ...input,
                    items: [
                        { productId: 'product-1', quantity: 5 },
                        { productId: 'product-2', quantity: 1 },
                    ],
                },
            ],
        ]);
    });

    // TEST 4: Chặn tổng quantity của các dòng trùng vượt giới hạn cột integer trước khi gọi repository.
    it('should reject a merged quantity above the PostgreSQL integer limit', async () => {
        // 4.1 Arrange: từng quantity hợp lệ riêng, nhưng tổng của cùng productId là 2,147,483,648.
        const input: CreateOrderInput = {
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            items: [
                { productId: 'product-1', quantity: 2_147_483_647 },
                { productId: 'product-1', quantity: 1 },
            ],
        };

        // 4.2 Act & Assert: use case ném InvalidOrderError và không mở luồng ghi qua repository.
        await expect(target.execute(input)).rejects.toBeInstanceOf(
            InvalidOrderError,
        );
        expect(mockOrderWriteRepository.create.mock.calls).toHaveLength(0);
    });

    // TEST 5: Đảm bảo lỗi repository được truyền nguyên trạng để lớp HTTP/error handler xử lý đúng.
    it('should propagate repository failures unchanged', async () => {
        // 5.1 Arrange: cấu hình repository reject bằng một lỗi database cụ thể.
        const input: CreateOrderInput = {
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            items: [{ productId: 'product-1', quantity: 1 }],
        };
        const databaseError = new Error('database unavailable');
        mockOrderWriteRepository.create.mockRejectedValue(databaseError);

        // 5.2 Act & Assert: execute() phải reject bằng chính object lỗi đó, không bọc hoặc đổi loại lỗi.
        await expect(target.execute(input)).rejects.toBe(databaseError);
    });
});
