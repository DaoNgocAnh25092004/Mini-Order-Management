// | STT | Test case             | Mục đích                         | Các bước làm                         | Kết quả mong đợi                           |
// |-----|-----------------------|----------------------------------|--------------------------------------|--------------------------------------------|
// | 1   | Tạo order và outbox   | Bảo đảm event không tách transaction | Mock transaction manager; tạo order | Lưu outbox event cùng transaction, đúng key |
// Unit test cho adapter ghi; xác nhận yêu cầu xử lý được lưu cùng transaction tạo đơn.
import type { DataSource, EntityManager } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { OrderOutboxEventEntity } from '@/database/entities/order-outbox-event.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { OrderOutboxEventType } from '@/database/enums/order-outbox-event-type.enum';
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/write/typeorm-order-write.repository';

describe('TypeOrmOrderWriteRepository.create', () => {
    const orderId = '124f6fd1-9de3-4ad7-9408-729fccfe0fa0';
    const productId = '225f6fd1-9de3-4ad7-9408-729fccfe0fa1';
    let target: TypeOrmOrderWriteRepository;
    let manager: {
        getRepository: jest.Mock;
        create: jest.Mock;
        save: jest.Mock;
        decrement: jest.Mock;
    };
    let productQueryBuilder: {
        setLock: jest.Mock;
        where: jest.Mock;
        andWhere: jest.Mock;
        orderBy: jest.Mock;
        getMany: jest.Mock;
    };

    // Mô phỏng transaction manager và một sản phẩm đủ hàng; không cần kết nối PostgreSQL thật.
    beforeEach(() => {
        const product = {
            id: productId,
            sku: 'SKU-1',
            name: 'Keyboard',
            price: '125.40',
            stock: 5,
        } as ProductEntity;
        productQueryBuilder = {
            setLock: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([product]),
        };
        const productRepository = {
            createQueryBuilder: jest.fn().mockReturnValue(productQueryBuilder),
        };
        manager = {
            getRepository: jest.fn().mockReturnValue(productRepository),
            create: jest.fn((entity: unknown, values: unknown) => {
                if (entity === OrderEntity) {
                    return {
                        ...(values as object),
                        id: orderId,
                        createdAt: new Date('2026-10-15T00:00:00.000Z'),
                        updatedAt: new Date('2026-10-15T00:00:00.000Z'),
                    };
                }

                if (entity === OrderItemEntity) {
                    return { ...(values as object), id: 'order-item-1' };
                }

                if (entity === OrderOutboxEventEntity) {
                    return { ...(values as object), id: 'outbox-event-1' };
                }

                throw new Error('Unexpected entity passed to manager.create');
            }),
            save: jest.fn((_entity: unknown, value: unknown) => value),
            decrement: jest.fn().mockResolvedValue({ affected: 1 }),
        };

        const dataSource = {
            transaction: jest.fn(
                async (
                    work: (
                        transactionManager: EntityManager,
                    ) => Promise<unknown>,
                ) => work(manager as unknown as EntityManager),
            ),
        } as unknown as DataSource;
        target = new TypeOrmOrderWriteRepository(dataSource);
    });

    // TEST 1: outbox event phải được lưu bằng cùng manager sau khi order và order_items được tạo.
    it('should persist a deduplicated processing event in the order transaction', async () => {
        // 1.1 Arrange: một đơn hợp lệ có một sản phẩm đang hoạt động và còn tồn kho.
        const input = {
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            items: [{ productId, quantity: 2 }],
        };

        // 1.2 Act: gọi repository; callback transaction dùng manager giả ở trên.
        const result = await target.create(input);

        // 1.3 Assert: outbox lưu đúng order/event/key/payload và là lần ghi cuối trước khi transaction trả kết quả.
        expect(manager.save).toHaveBeenNthCalledWith(
            3,
            OrderOutboxEventEntity,
            expect.objectContaining({
                orderId,
                eventType: OrderOutboxEventType.ORDER_PROCESSING_REQUESTED,
                dedupeKey: `order-processing-${orderId}`,
                payload: { orderId },
            }),
        );
        expect(manager.save).toHaveBeenNthCalledWith(
            1,
            OrderEntity,
            expect.anything(),
        );
        expect(manager.save).toHaveBeenNthCalledWith(
            2,
            OrderItemEntity,
            expect.anything(),
        );
        expect(result.id).toBe(orderId);
    });
});
