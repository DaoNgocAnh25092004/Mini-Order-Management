// | STT | Test case                 | Mục đích                              | Các bước làm                                  | Kết quả mong đợi                                  |
// |-----|---------------------------|---------------------------------------|-----------------------------------------------|--------------------------------------------------|
// | 1   | Hủy PENDING/CONFIRMED     | Hoàn stock và đổi trạng thái nguyên tử | Khóa đơn; hoàn nhiều item theo productId      | Tăng stock đúng lượng; đơn thành CANCELLED       |
// | 2   | Hủy đơn đã CANCELLED      | Chặn hoàn kho lần hai                  | Repository trả đơn CANCELLED; gọi cancel       | Ném lỗi trạng thái; không tăng stock             |
// | 3   | Không tìm thấy đơn        | Phân biệt ID không tồn tại             | Query khóa đơn trả null                        | Ném OrderNotFoundError; không đọc item/hoàn kho   |
// | 4   | Lỗi khi hoàn stock        | Giữ tính nguyên tử                     | Một lần increment không cập nhật được product   | Ném lỗi; không lưu trạng thái CANCELLED          |
// Unit test adapter ghi dùng transaction manager giả; không cần PostgreSQL.
import type { DataSource, EntityManager } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { OrderStatus } from '@/database/enums/order-status.enum';
import { OrderCancellationNotAllowedError } from '@/modules/orders/application/errors/order-cancellation-not-allowed.error';
import { OrderNotFoundError } from '@/modules/orders/application/errors/order-not-found.error';
import { OrderProductNotFoundError } from '@/modules/orders/application/errors/order-product-not-found.error';
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/write/order-write/typeorm-order-write.repository';

describe('TypeOrmOrderWriteRepository.cancelOrder', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    let target: TypeOrmOrderWriteRepository;
    let transactionManager: {
        getRepository: jest.Mock;
        increment: jest.Mock;
        save: jest.Mock;
    };
    let order: OrderEntity;
    let orderQueryBuilder: {
        setLock: jest.Mock;
        where: jest.Mock;
        getOne: jest.Mock;
    };
    let orderItemsRepository: { findBy: jest.Mock };

    // Mỗi test chạy callback trong manager giả để xác minh logic transaction mà không mở kết nối thật.
    beforeEach(() => {
        order = {
            id: orderId,
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            status: OrderStatus.PENDING,
            createdAt: new Date('2026-10-15T00:00:00.000Z'),
            updatedAt: new Date('2026-10-15T00:00:00.000Z'),
        } as OrderEntity;
        orderQueryBuilder = {
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(order),
        };
        orderItemsRepository = { findBy: jest.fn().mockResolvedValue([]) };

        const orderRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(orderQueryBuilder),
        };
        transactionManager = {
            getRepository: jest.fn((entity: unknown) =>
                entity === OrderEntity ? orderRepository : orderItemsRepository,
            ),
            increment: jest.fn().mockResolvedValue({ affected: 1 }),
            save: jest.fn((_entity: unknown, value: OrderEntity) => value),
        };

        const dataSource = {
            transaction: jest.fn(
                async (work: (manager: EntityManager) => Promise<unknown>) =>
                    work(transactionManager as unknown as EntityManager),
            ),
        } as unknown as DataSource;

        target = new TypeOrmOrderWriteRepository(dataSource);
    });

    // TEST 1: cả PENDING và CONFIRMED đều được hủy; stock tăng đúng quantity theo thứ tự productId.
    it.each([OrderStatus.PENDING, OrderStatus.CONFIRMED])(
        'should restore stock and cancel an order in %s status',
        async (status) => {
            // 1.1 Arrange: đơn có hai item được cố ý sắp ngược ID để kiểm tra thứ tự cập nhật tránh deadlock.
            order.status = status;
            const items = [
                {
                    id: 'item-b',
                    orderId,
                    productId: 'product-b',
                    productSku: 'SKU-B',
                    productName: 'Product B',
                    quantity: 1,
                    unitPrice: '20.00',
                },
                {
                    id: 'item-a',
                    orderId,
                    productId: 'product-a',
                    productSku: 'SKU-A',
                    productName: 'Product A',
                    quantity: 3,
                    unitPrice: '10.00',
                },
            ] as OrderItemEntity[];
            orderItemsRepository.findBy.mockResolvedValue(items);

            // 1.2 Act: hủy đơn trong transaction repository.
            const result = await target.cancelOrder(orderId);

            // 1.3 Assert: khóa đơn, hoàn từng lượng stock theo thứ tự ID, rồi lưu CANCELLED.
            expect(orderQueryBuilder.setLock.mock.calls).toEqual([
                ['pessimistic_write'],
            ]);
            expect(transactionManager.increment.mock.calls).toEqual([
                [ProductEntity, { id: 'product-a' }, 'stock', 3],
                [ProductEntity, { id: 'product-b' }, 'stock', 1],
            ]);
            expect(transactionManager.save.mock.calls).toEqual([
                [
                    OrderEntity,
                    expect.objectContaining({ status: OrderStatus.CANCELLED }),
                ],
            ]);
            expect(result.status).toBe(OrderStatus.CANCELLED);
            expect(result.items.map((item) => item.productId)).toEqual([
                'product-a',
                'product-b',
            ]);
        },
    );

    // TEST 2: lần hủy lặp thấy trạng thái CANCELLED và không được tăng stock lần nữa.
    it('should reject an already cancelled order without restoring stock again', async () => {
        // 2.1 Arrange: đơn đã bị hủy từ một request trước đó.
        order.status = OrderStatus.CANCELLED;

        // 2.2 Act & Assert: từ chối trạng thái trước khi đọc item hoặc cập nhật product.
        await expect(target.cancelOrder(orderId)).rejects.toBeInstanceOf(
            OrderCancellationNotAllowedError,
        );
        expect(orderItemsRepository.findBy.mock.calls).toHaveLength(0);
        expect(transactionManager.increment.mock.calls).toHaveLength(0);
        expect(transactionManager.save.mock.calls).toHaveLength(0);
    });

    // TEST 3: ID không tồn tại phải dừng trước khi truy vấn item hoặc đụng tới stock.
    it('should throw OrderNotFoundError when the order does not exist', async () => {
        // 3.1 Arrange: truy vấn có khóa không tìm thấy order row.
        orderQueryBuilder.getOne.mockResolvedValue(null);

        // 3.2 Act & Assert: phát đúng lỗi 404 tầng application và không thực hiện bước hoàn kho.
        await expect(target.cancelOrder(orderId)).rejects.toBeInstanceOf(
            OrderNotFoundError,
        );
        expect(orderItemsRepository.findBy.mock.calls).toHaveLength(0);
        expect(transactionManager.increment.mock.calls).toHaveLength(0);
    });

    // TEST 4: product không cập nhật được thì transaction phải lỗi trước khi trạng thái đơn được lưu.
    it('should fail and avoid saving cancelled status when stock restoration fails', async () => {
        // 4.1 Arrange: đơn có một item nhưng database báo không cập nhật được product tương ứng.
        orderItemsRepository.findBy.mockResolvedValue([
            {
                id: 'item-a',
                orderId,
                productId: 'missing-product',
                productSku: 'SKU-A',
                productName: 'Product A',
                quantity: 1,
                unitPrice: '10.00',
            } as OrderItemEntity,
        ]);
        transactionManager.increment.mockResolvedValue({ affected: 0 });

        // 4.2 Act & Assert: ném lỗi để DataSource transaction rollback thay vì lưu đơn đã hủy nhưng chưa hoàn kho.
        await expect(target.cancelOrder(orderId)).rejects.toBeInstanceOf(
            OrderProductNotFoundError,
        );
        expect(transactionManager.save.mock.calls).toHaveLength(0);
    });
});
