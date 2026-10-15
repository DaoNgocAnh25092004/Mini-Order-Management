// Nhóm unit test cho repository xử lý nền: kiểm tra chuyển trạng thái, hoàn kho và chạy lại an toàn.
// | STT | Test case                     | Mục đích                         | Các bước làm                                    | Kết quả mong đợi                                      |
// |-----|-------------------------------|----------------------------------|-------------------------------------------------|-------------------------------------------------------|
// | 1   | Xác nhận đơn PENDING           | Chốt đơn thành công              | Gọi confirm với đơn PENDING                     | Lưu CONFIRMED và thêm notification chống trùng         |
// | 2   | Xác nhận lặp                   | Bảo đảm idempotent               | Gọi confirm với đơn không còn PENDING           | Không lưu lại đơn hoặc notification                    |
// | 3   | Xử lý hết retry               | Hoàn kho và chốt FAILED          | Có item; gọi fail với lý do                      | Tăng stock, lưu FAILED và notification kèm lý do       |
// | 4   | Đơn đã kết thúc                | Ngăn hoàn kho/notification lặp   | Gọi fail với CANCELLED/CONFIRMED/FAILED          | Không cập nhật kho, đơn hoặc notification              |
// | 5   | Hoàn kho thất bại              | Giữ transaction nguyên tử        | Product update không tác động dòng nào           | Ném lỗi; không lưu FAILED hoặc notification            |
// | 6   | Không có đơn quá hạn           | Không gây side effect            | Truy vấn trả về danh sách rỗng                   | Trả 0; không đọc item hay cập nhật dữ liệu              |
// | 7   | Có đơn PENDING quá hạn         | Hủy đơn và hoàn kho              | Trả order cùng item; gọi expireOverdue           | Hoàn stock, lưu CANCELLED và notification ORDER_EXPIRED|
// | 8   | Quét lại sau khi đã hủy        | Không hoàn kho lần hai           | Lượt đầu có order; lượt sau không có order        | Chỉ tăng stock và ghi notification một lần              |

import type { DataSource, EntityManager } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { NotificationEventType } from '@/database/enums/notification-event-type.enum';
import { OrderStatus } from '@/database/enums/order-status.enum';
import { OrderProductNotFoundError } from '@/modules/orders/application/errors/order-product-not-found.error';
import { TypeOrmOrderProcessingRepository } from '@/modules/orders/infrastructure/repositories/write/order-processing/typeorm-order-processing.repository';

describe('TypeOrmOrderProcessingRepository', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    let target: TypeOrmOrderProcessingRepository;
    let order: OrderEntity;
    let orderQueryBuilder: Record<string, jest.Mock>;
    let orderItemsRepository: { findBy: jest.Mock };
    let notificationQueryBuilder: Record<string, jest.Mock>;
    let transactionManager: {
        getRepository: jest.Mock;
        createQueryBuilder: jest.Mock;
        increment: jest.Mock;
        save: jest.Mock;
    };

    // Dựng manager giả để test transaction mà không mở kết nối PostgreSQL thật.
    beforeEach(() => {
        order = {
            id: orderId,
            status: OrderStatus.PENDING,
        } as OrderEntity;
        orderQueryBuilder = {
            setLock: jest.fn().mockReturnThis(),
            setOnLocked: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(order),
            getMany: jest.fn().mockResolvedValue([]),
        };
        orderItemsRepository = { findBy: jest.fn().mockResolvedValue([]) };
        notificationQueryBuilder = {
            insert: jest.fn().mockReturnThis(),
            into: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            orIgnore: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({}),
        };
        transactionManager = {
            getRepository: jest.fn((entity: unknown) =>
                entity === OrderEntity
                    ? {
                          createQueryBuilder: jest
                              .fn()
                              .mockReturnValue(orderQueryBuilder),
                      }
                    : orderItemsRepository,
            ),
            createQueryBuilder: jest
                .fn()
                .mockReturnValue(notificationQueryBuilder),
            increment: jest.fn().mockResolvedValue({ affected: 1 }),
            save: jest.fn((_entity: unknown, value: OrderEntity) => value),
        };

        const dataSource = {
            transaction: jest.fn(
                async (work: (manager: EntityManager) => Promise<void>) =>
                    work(transactionManager as unknown as EntityManager),
            ),
        } as unknown as DataSource;
        target = new TypeOrmOrderProcessingRepository(dataSource);
    });

    // TEST 1: chỉ xác nhận đơn PENDING và ghi notification trong cùng transaction.
    it('should confirm a pending order and insert a deduplicated notification', async () => {
        // 1.1 Arrange: beforeEach dựng order PENDING cùng transaction manager/query builder giả.

        // 1.2 Act: chuyển đơn sang CONFIRMED qua repository.
        await target.confirmPendingOrder(orderId);

        // 1.3 Assert: khóa đơn, lưu trạng thái mới và dùng insert-ignore để không tạo notification trùng.
        expect(orderQueryBuilder.setLock).toHaveBeenCalledWith(
            'pessimistic_write',
        );
        expect(order.status).toBe(OrderStatus.CONFIRMED);
        expect(transactionManager.save).toHaveBeenCalledWith(
            OrderEntity,
            order,
        );
        expect(notificationQueryBuilder.values).toHaveBeenCalledWith({
            orderId,
            eventType: NotificationEventType.ORDER_CONFIRMED,
            payload: { orderId, status: OrderStatus.CONFIRMED },
        });
        expect(notificationQueryBuilder.orIgnore).toHaveBeenCalled();
    });

    // TEST 2: job xác nhận chạy lặp không được ghi lại đơn đã CONFIRMED hay notification.
    it('should ignore a duplicate confirmation for an order that is no longer pending', async () => {
        // 2.1 Arrange: giả lập job trước đó đã chuyển đơn sang CONFIRMED.
        order.status = OrderStatus.CONFIRMED;

        // 2.2 Act: gửi lại yêu cầu xác nhận cùng orderId.
        await target.confirmPendingOrder(orderId);

        // 2.3 Assert: repository dừng theo trạng thái, không save hoặc thực thi insert notification.
        expect(transactionManager.save).not.toHaveBeenCalled();
        expect(notificationQueryBuilder.execute).not.toHaveBeenCalled();
    });

    // TEST 3: hết retry thì hoàn đúng từng item, đổi FAILED và lưu notification có lý do.
    it('should restore stock and mark a pending order failed', async () => {
        // 3.1 Arrange: cung cấp item theo thứ tự ngược productId để kiểm tra thứ tự hoàn kho ổn định.
        orderItemsRepository.findBy.mockResolvedValue([
            {
                id: 'item-b',
                productId: 'product-b',
                quantity: 2,
            },
            {
                id: 'item-a',
                productId: 'product-a',
                quantity: 3,
            },
        ] as OrderItemEntity[]);

        // 3.2 Act: yêu cầu chốt thất bại sau khi xử lý nền hết lượt retry.
        await target.failPendingOrder(orderId, 'processing exhausted');

        // 3.3 Assert: tăng stock theo productId đã sắp xếp, lưu FAILED và ghi nguyên nhân vào notification.
        expect(transactionManager.increment.mock.calls).toEqual([
            [ProductEntity, { id: 'product-a' }, 'stock', 3],
            [ProductEntity, { id: 'product-b' }, 'stock', 2],
        ]);
        expect(order.status).toBe(OrderStatus.FAILED);
        expect(transactionManager.save).toHaveBeenCalledWith(
            OrderEntity,
            order,
        );
        expect(notificationQueryBuilder.values).toHaveBeenCalledWith({
            orderId,
            eventType: NotificationEventType.ORDER_FAILED,
            payload: {
                orderId,
                status: OrderStatus.FAILED,
                reason: 'processing exhausted',
            },
        });
    });

    // TEST 4: các trạng thái đã kết thúc phải bỏ qua job lỗi để tránh hoàn kho hoặc ghi notification lặp.
    it.each([OrderStatus.CANCELLED, OrderStatus.CONFIRMED, OrderStatus.FAILED])(
        'should not restore stock again for a terminal %s order',
        async (status) => {
            // 4.1 Arrange: thay trạng thái đơn bằng một trạng thái không còn được phép chuyển tiếp.
            order.status = status;

            // 4.2 Act: giả lập job cũ bị giao lại sau khi đơn đã kết thúc.
            await target.failPendingOrder(orderId, 'late job failure');

            // 4.3 Assert: không đọc order_items, không hoàn kho và không ghi thay đổi/notification.
            expect(orderItemsRepository.findBy).not.toHaveBeenCalled();
            expect(transactionManager.increment).not.toHaveBeenCalled();
            expect(transactionManager.save).not.toHaveBeenCalled();
            expect(notificationQueryBuilder.execute).not.toHaveBeenCalled();
        },
    );

    // TEST 5: nếu hoàn stock thất bại thì không được lưu FAILED như thể transaction đã hoàn tất.
    it('should rollback the failure transition when a product cannot be restored', async () => {
        // 5.1 Arrange: order có item tham chiếu product không được database cập nhật.
        orderItemsRepository.findBy.mockResolvedValue([
            {
                id: 'item-a',
                productId: 'missing-product',
                quantity: 1,
            },
        ] as OrderItemEntity[]);
        transactionManager.increment.mockResolvedValue({ affected: 0 });

        // 5.2 Act & Assert: repository ném lỗi để transaction rollback toàn bộ thao tác.
        await expect(
            target.failPendingOrder(orderId, 'processing exhausted'),
        ).rejects.toBeInstanceOf(OrderProductNotFoundError);

        expect(transactionManager.save).not.toHaveBeenCalled();
        expect(notificationQueryBuilder.execute).not.toHaveBeenCalled();
    });

    // TEST 6: không có order nào quá hạn thì lượt quét kết thúc mà không đọc item hoặc thay đổi dữ liệu.
    it('should do nothing when no pending orders are overdue', async () => {
        // 6.1 Arrange: query builder mặc định trả danh sách order rỗng.
        const expiredBefore = new Date('2026-10-15T00:00:00.000Z');

        // 6.2 Act: yêu cầu repository tìm và hủy các order cũ hơn cutoff.
        const expiredCount =
            await target.expireOverduePendingOrders(expiredBefore);

        // 6.3 Assert: trả 0 và không đọc item, hoàn kho, lưu order hay ghi notification.
        expect(expiredCount).toBe(0);
        expect(orderQueryBuilder.setOnLocked).toHaveBeenCalledWith(
            'skip_locked',
        );
        expect(orderQueryBuilder.andWhere).toHaveBeenCalledWith(
            'order.createdAt < :expiredBefore',
            { expiredBefore },
        );
        expect(orderItemsRepository.findBy).not.toHaveBeenCalled();
        expect(transactionManager.increment).not.toHaveBeenCalled();
        expect(transactionManager.save).not.toHaveBeenCalled();
        expect(notificationQueryBuilder.execute).not.toHaveBeenCalled();
    });

    // TEST 7: order quá hạn được hoàn đủ stock, chuyển CANCELLED và ghi dấu ORDER_EXPIRED nguyên tử.
    it('should cancel overdue pending orders and restore their stock', async () => {
        // 7.1 Arrange: query tìm được một order PENDING có một dòng hàng đã trừ khỏi kho.
        const expiredBefore = new Date('2026-10-15T00:00:00.000Z');
        const item = {
            id: 'item-a',
            orderId,
            productId: 'product-a',
            quantity: 2,
        } as OrderItemEntity;
        orderQueryBuilder.getMany.mockResolvedValue([order]);
        orderItemsRepository.findBy.mockResolvedValue([item]);

        // 7.2 Act: quét đơn cũ hơn cutoff và thực hiện hoàn kho trong transaction.
        const expiredCount =
            await target.expireOverduePendingOrders(expiredBefore);

        // 7.3 Assert: chỉ hủy order PENDING; hoàn đúng quantity và ghi một notification hết hạn.
        expect(expiredCount).toBe(1);
        expect(orderQueryBuilder.setLock).toHaveBeenCalledWith(
            'pessimistic_write',
        );
        expect(orderQueryBuilder.setOnLocked).toHaveBeenCalledWith(
            'skip_locked',
        );
        expect(orderItemsRepository.findBy).toHaveBeenCalledTimes(1);
        expect(transactionManager.increment).toHaveBeenCalledWith(
            ProductEntity,
            { id: 'product-a' },
            'stock',
            2,
        );
        expect(order.status).toBe(OrderStatus.CANCELLED);
        expect(transactionManager.save).toHaveBeenCalledWith(
            OrderEntity,
            order,
        );
        expect(notificationQueryBuilder.values).toHaveBeenLastCalledWith({
            orderId,
            eventType: NotificationEventType.ORDER_EXPIRED,
            payload: { orderId, status: OrderStatus.CANCELLED },
        });
        expect(notificationQueryBuilder.orIgnore).toHaveBeenCalled();
    });

    // TEST 8: lượt quét sau không hoàn kho lại vì query chỉ chọn order còn PENDING.
    it('should not restore stock again after an order has been expired', async () => {
        // 8.1 Arrange: lượt đầu lấy được order; lượt tiếp theo không thấy order đã chuyển CANCELLED.
        const item = {
            id: 'item-a',
            orderId,
            productId: 'product-a',
            quantity: 2,
        } as OrderItemEntity;
        orderQueryBuilder.getMany
            .mockResolvedValueOnce([order])
            .mockResolvedValueOnce([]);
        orderItemsRepository.findBy.mockResolvedValue([item]);

        // 8.2 Act: scheduler chạy lại liên tiếp để kiểm tra tính idempotent của nghiệp vụ hết hạn.
        await target.expireOverduePendingOrders(
            new Date('2026-10-15T00:00:00.000Z'),
        );
        const secondExpiredCount = await target.expireOverduePendingOrders(
            new Date('2026-10-15T00:05:00.000Z'),
        );

        // 8.3 Assert: lượt hai không đụng order_items, stock hoặc notification lần nữa.
        expect(secondExpiredCount).toBe(0);
        expect(transactionManager.increment).toHaveBeenCalledTimes(1);
        expect(notificationQueryBuilder.execute).toHaveBeenCalledTimes(1);
    });
});
