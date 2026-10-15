import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { NotificationLogEntity } from '@/database/entities/notification-log.entity';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { NotificationEventType } from '@/database/enums/notification-event-type.enum';
import { OrderStatus } from '@/database/enums/order-status.enum';
import type { OrderProcessingRepository } from '@/modules/orders/application/contracts/order-processing-repository';
import { OrderProductNotFoundError } from '@/modules/orders/application/errors/order-product-not-found.error';

const EXPIRED_ORDER_BATCH_SIZE = 100; // Giới hạn số lượng đơn quá hạn được xử lý trong một transaction để tránh khóa quá nhiều dòng và giảm nguy cơ deadlock.

@Injectable()
export class TypeOrmOrderProcessingRepository implements OrderProcessingRepository {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    // Xác nhận đơn còn PENDING; nếu job đã chạy trước đó hoặc đơn đã bị hủy thì không ghi đè trạng thái.
    async confirmPendingOrder(orderId: string): Promise<void> {
        // Mọi lần đọc/đổi trạng thái và ghi notification nằm trong cùng transaction.
        await this.dataSource.transaction(async (manager) => {
            // Bước 1: khóa dòng đơn để job xác nhận và request hủy không cùng xử lý một trạng thái cũ.
            const order = await this.lockOrder(manager, orderId);

            // Bước 2: chỉ đơn PENDING được chuyển tiếp; đơn không tồn tại hoặc đã đổi trạng thái thì kết thúc an toàn.
            // Nhánh này làm job gửi trùng/retry không lưu lại đơn hay tạo thêm notification.
            if (!order || order.status !== OrderStatus.PENDING) {
                return;
            }

            // Bước 3: lưu CONFIRMED và notification cùng transaction; lỗi khi ghi một trong hai sẽ rollback cả hai.
            order.status = OrderStatus.CONFIRMED;
            await manager.save(OrderEntity, order);
            await this.insertNotification(
                manager,
                orderId,
                NotificationEventType.ORDER_CONFIRMED,
                { orderId, status: OrderStatus.CONFIRMED },
            );
        });
    }

    // Chốt đơn FAILED sau khi worker dùng hết lượt thử; chỉ đơn còn PENDING mới được hoàn kho.
    // Trả stock, đổi trạng thái và ghi lý do thất bại cùng transaction để không tạo ra kết quả dở dang.
    async failPendingOrder(
        orderId: string,
        failureReason: string,
    ): Promise<void> {
        // Toàn bộ thao tác bên dưới commit hoặc rollback cùng nhau.
        await this.dataSource.transaction(async (manager) => {
            // Bước 1: khóa đơn trước để các job lỗi trùng nhau chỉ có một job được phép hoàn kho.
            const order = await this.lockOrder(manager, orderId);

            // Bước 2: chỉ đơn PENDING còn giữ hàng mới được hoàn.
            // Đơn đã hủy, xác nhận, thất bại hoặc không tồn tại thì dừng, tránh cộng kho lần hai.
            if (!order || order.status !== OrderStatus.PENDING) {
                return;
            }

            // Bước 3: lấy quantity đã lưu trong order_items; đây là lượng đã trừ khỏi kho lúc tạo đơn.
            const items = await manager
                .getRepository(OrderItemEntity)
                .findBy({ orderId });

            // Mọi transaction hoàn nhiều sản phẩm đều xử lý theo cùng thứ tự để giảm nguy cơ khóa chéo.
            const itemsInLockOrder = [...items].sort(
                (left, right) =>
                    left.productId.localeCompare(right.productId) ||
                    left.id.localeCompare(right.id),
            );

            // Bước 4: cộng lại đúng quantity cho từng sản phẩm; vẫn hoàn kho nếu sản phẩm đã bị xóa mềm.
            for (const item of itemsInLockOrder) {
                const result = await manager.increment(
                    ProductEntity,
                    { id: item.productId },
                    'stock',
                    item.quantity,
                );

                // Không cập nhật được đúng một sản phẩm nghĩa là dữ liệu tham chiếu đang lỗi.
                // Ném lỗi để transaction rollback cả những sản phẩm đã được cộng kho ở vòng trước.
                if (result.affected !== 1) {
                    throw new OrderProductNotFoundError(item.productId);
                }
            }

            // Bước 5: chỉ đánh dấu FAILED sau khi hoàn hết kho; notification được lưu cùng transaction.
            // Nếu lưu trạng thái hoặc notification lỗi, transaction cũng rollback phần kho đã hoàn.
            order.status = OrderStatus.FAILED;
            await manager.save(OrderEntity, order);
            await this.insertNotification(
                manager,
                orderId,
                NotificationEventType.ORDER_FAILED,
                {
                    orderId,
                    status: OrderStatus.FAILED,
                    // Giới hạn nội dung lỗi trước khi lưu để notification không chứa chuỗi lỗi quá dài.
                    reason: failureReason.slice(0, 4000),
                },
            );
        });
    }

    // Hủy tối đa 100 đơn quá hạn mỗi lượt; khóa order, hoàn kho, đổi trạng thái và ghi notification cùng transaction.
    async expireOverduePendingOrders(expiredBefore: Date): Promise<number> {
        // Toàn bộ thao tác bên dưới commit hoặc rollback cùng nhau; nếu lỗi ở bất kỳ đơn nào thì lô sẽ rollback.
        return this.dataSource.transaction(async (manager) => {
            // Bước 1: khóa một lô đơn PENDING cũ nhất; skip_locked cho phép nhiều instance chia nhau xử lý.
            const orders = await manager
                .getRepository(OrderEntity)
                .createQueryBuilder('order')
                .setLock('pessimistic_write') // Khóa từng dòng để các transaction khác phải chờ commit/rollback trước khi đọc.
                .setOnLocked('skip_locked') // Nếu dòng đang bị khóa bởi transaction khác thì bỏ qua, tránh deadlock.
                .where('order.status = :status', {
                    status: OrderStatus.PENDING,
                })
                .andWhere('order.createdAt < :expiredBefore', {
                    expiredBefore,
                })
                .orderBy('order.createdAt', 'ASC')
                .addOrderBy('order.id', 'ASC')
                .take(EXPIRED_ORDER_BATCH_SIZE) // Giới hạn số lượng đơn quá hạn được xử lý trong một transaction để tránh khóa quá nhiều dòng và giảm nguy cơ deadlock.
                .getMany();

            if (orders.length === 0) {
                return 0;
            }

            const orderIds = orders.map((order) => order.id);
            const items = await manager
                .getRepository(OrderItemEntity)
                .findBy({ orderId: In(orderIds) });

            // Gom các item của cả lô theo productId để mọi transaction khóa/cộng kho theo cùng thứ tự.
            const itemsInLockOrder = [...items].sort(
                (left, right) =>
                    left.productId.localeCompare(right.productId) ||
                    left.id.localeCompare(right.id),
            );

            // Bước 2: hoàn từng lượng đã lưu trong order_items; lỗi ở bất kỳ item nào sẽ rollback toàn bộ lô.
            for (const item of itemsInLockOrder) {
                const result = await manager.increment(
                    ProductEntity,
                    { id: item.productId },
                    'stock',
                    item.quantity,
                );

                // Không cập nhật được đúng một sản phẩm nghĩa là dữ liệu tham chiếu đang lỗi.
                if (result.affected !== 1) {
                    throw new OrderProductNotFoundError(item.productId);
                }
            }

            // Bước 3: chỉ sau khi hoàn kho xong mới đổi từng đơn sang CANCELLED và ghi dấu lý do ORDER_EXPIRED.
            for (const order of orders) {
                order.status = OrderStatus.CANCELLED;
                await manager.save(OrderEntity, order);
                await this.insertNotification(
                    manager,
                    order.id,
                    NotificationEventType.ORDER_EXPIRED,
                    {
                        orderId: order.id,
                        status: OrderStatus.CANCELLED,
                    },
                );
            }

            return orders.length;
        });
    }

    // Lấy đơn theo ID và khóa dòng đến hết transaction để job/request cạnh tranh phải chờ trạng thái mới nhất.
    private async lockOrder(
        manager: EntityManager,
        orderId: string,
    ): Promise<OrderEntity | null> {
        return manager
            .getRepository(OrderEntity)
            .createQueryBuilder('order')
            .setLock('pessimistic_write') // Khóa dòng để các transaction khác phải chờ commit/rollback trước khi đọc.
            .where('order.id = :orderId', { orderId })
            .getOne();
    }

    // Thêm notification trong transaction của đơn.
    // Ràng buộc unique theo order/event kết hợp orIgnore để retry không tạo thêm bản ghi cho cùng một sự kiện.
    private async insertNotification(
        manager: EntityManager,
        orderId: string,
        eventType: NotificationEventType,
        payload: {
            orderId: string;
            status: OrderStatus;
            reason?: string;
        },
    ): Promise<void> {
        await manager
            .createQueryBuilder()
            .insert()
            .into(NotificationLogEntity)
            .values({ orderId, eventType, payload })
            .orIgnore()
            .execute();
    }
}
