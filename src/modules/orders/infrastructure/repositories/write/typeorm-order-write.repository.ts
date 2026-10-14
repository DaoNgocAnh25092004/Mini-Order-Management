import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThanOrEqual } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { OrderStatus } from '@/database/enums/order-status.enum';
import type {
    CreatedOrder,
    CreateOrderInput,
    OrderWriteRepository,
} from '@/modules/orders/application/contracts/order-write-repository';
import type { OrderDetail } from '@/modules/orders/application/contracts/order-read-repository';
import { InsufficientStockError } from '@/modules/orders/application/errors/insufficient-stock.error';
import { OrderCancellationNotAllowedError } from '@/modules/orders/application/errors/order-cancellation-not-allowed.error';
import { OrderNotFoundError } from '@/modules/orders/application/errors/order-not-found.error';
import { OrderProductNotFoundError } from '@/modules/orders/application/errors/order-product-not-found.error';

@Injectable()
export class TypeOrmOrderWriteRepository implements OrderWriteRepository {
    // Transaction boundary giúp thao tác kho và tạo đơn luôn commit hoặc rollback cùng nhau.
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    // Tạo đơn và trừ kho nguyên tử: mọi thay đổi cùng commit, hoặc cùng rollback khi có lỗi.
    // Khóa sản phẩm theo thứ tự cố định để giảm deadlock; request cạnh tranh phải chờ rồi kiểm tra lại tồn kho.
    async create(input: CreateOrderInput): Promise<CreatedOrder> {
        return this.dataSource.transaction(async (manager) => {
            // BƯỚC 1: Chuẩn hóa thứ tự khóa; hai đơn cùng chứa A và B đều khóa A trước B, tránh chờ vòng tròn (deadlock).
            const requestedItems = [...input.items].sort((left, right) =>
                left.productId.localeCompare(right.productId),
            );

            // BƯỚC 2: Chỉ tải sản phẩm còn hoạt động và khóa các dòng tồn kho đến khi transaction kết thúc.
            // Transaction đặt trùng sản phẩm phải chờ khóa này, rồi mới đọc được stock mới nhất.
            const productIds = requestedItems.map((item) => item.productId);
            const products = await manager
                .getRepository(ProductEntity)
                .createQueryBuilder('product')
                .setLock('pessimistic_write') // Khóa các dòng sản phẩm để các transaction khác phải chờ.
                .where('product.id IN (:...productIds)', { productIds })
                .andWhere('product.deletedAt IS NULL')
                .orderBy('product.id', 'ASC')
                .getMany();

            // Lập chỉ mục tra cứu trong bộ nhớ để mỗi item tìm sản phẩm theo ID mà không quét lại cả danh sách.
            const productsById = new Map(
                products.map((product) => [product.id, product]),
            );

            // BƯỚC 3: Xác nhận đủ mọi sản phẩm và tồn kho trước khi ghi dữ liệu để lỗi không tạo đơn dở dang.
            for (const item of requestedItems) {
                const product = productsById.get(item.productId);

                // Truy vấn không có sản phẩm này nghĩa là ID sai hoặc sản phẩm đã soft-delete.
                if (!product) {
                    throw new OrderProductNotFoundError(item.productId);
                }

                // Từ chối sớm khi kho không đủ; transaction tự rollback và chưa có thay đổi nào được commit.
                if (product.stock < item.quantity) {
                    throw new InsufficientStockError(
                        product.id,
                        item.quantity,
                        product.stock,
                    );
                }
            }

            // BƯỚC 4: Tạo đơn PENDING trong cùng transaction với thao tác trừ kho và lưu chi tiết.
            const order = manager.create(OrderEntity, {
                customerName: input.customerName,
                customerEmail: input.customerEmail,
                status: OrderStatus.PENDING,
            });

            // Lưu order trước để có ID cho các order_item liên quan; transaction chưa commit nên chưa hiển thị ra ngoài.
            const savedOrder = await manager.save(OrderEntity, order);

            // BƯỚC 5: Trừ kho có điều kiện stock >= quantity như lớp bảo vệ cuối ngoài row lock.
            // Nếu không cập nhật đúng một dòng, ném lỗi để rollback cả đơn và mọi lần trừ kho trước đó.
            for (const item of requestedItems) {
                // Giảm stock trong cùng transaction; nếu không đủ stock thì affected = 0 và ném lỗi.

                const result = await manager.decrement(
                    ProductEntity,
                    {
                        id: item.productId,
                        deletedAt: IsNull(),
                        stock: MoreThanOrEqual(item.quantity), // Điều kiện để đảm bảo stock >= quantity, tránh trừ kho âm.
                    },
                    'stock',
                    item.quantity,
                );

                // Nếu affected !== 1 nghĩa là sản phẩm không tồn tại hoặc stock < quantity, ném lỗi để rollback.
                if (result.affected !== 1) {
                    const product = productsById.get(item.productId);

                    if (!product) {
                        throw new OrderProductNotFoundError(item.productId);
                    }

                    throw new InsufficientStockError(
                        item.productId,
                        item.quantity,
                        product.stock,
                    );
                }
            }

            // BƯỚC 6: Lưu snapshot tên, SKU và giá hiện tại để lịch sử đơn không đổi khi sản phẩm được sửa sau này.
            const orderItems = requestedItems.map((item) => {
                const product = productsById.get(item.productId);

                if (!product) {
                    throw new OrderProductNotFoundError(item.productId);
                }

                // Tạo order_item snapshot với thông tin sản phẩm tại thời điểm tạo đơn.
                return manager.create(OrderItemEntity, {
                    orderId: savedOrder.id,
                    productId: product.id,
                    productSku: product.sku,
                    productName: product.name,
                    quantity: item.quantity,
                    unitPrice: product.price,
                });
            });

            // Lưu toàn bộ order_items
            const savedItems = await manager.save(OrderItemEntity, orderItems);

            // Chỉ trả kết quả sau khi order và toàn bộ order_items đã được lưu thành công trong transaction.
            return {
                id: savedOrder.id,
                customerName: savedOrder.customerName,
                customerEmail: savedOrder.customerEmail,
                status: savedOrder.status,
                createdAt: savedOrder.createdAt,
                updatedAt: savedOrder.updatedAt,
                items: savedItems.map((item) => ({
                    id: item.id,
                    productId: item.productId,
                    productSku: item.productSku,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                })),
            };
        });
    }

    // Hủy đơn và hoàn kho nguyên tử: mọi thay đổi cùng commit, hoặc cùng rollback khi có lỗi.
    async cancelOrder(orderId: string): Promise<OrderDetail> {
        // Transaction boundary giúp thao tác hoàn kho và hủy đơn luôn commit hoặc rollback cùng nhau.
        return this.dataSource.transaction(async (manager) => {
            // BƯỚC 1: Khóa dòng order trước khi đọc trạng thái; request hủy đồng thời phải chờ transaction này kết thúc.
            // Nhờ vậy request chờ sẽ đọc trạng thái mới, không thể cùng thấy PENDING rồi hoàn kho hai lần.
            const order = await manager
                .getRepository(OrderEntity)
                .createQueryBuilder('order')
                .setLock('pessimistic_write')
                .where('order.id = :orderId', { orderId })
                .getOne();

            // Không có order thì dừng ngay, chưa đọc order item hay thay đổi bất kỳ sản phẩm nào.
            if (!order) {
                throw new OrderNotFoundError(orderId);
            }

            // BƯỚC 2: Chỉ cho hủy đơn PENDING/CONFIRMED; CANCELLED hoặc trạng thái khác bị từ chối trước khi hoàn kho.
            if (
                order.status !== OrderStatus.PENDING &&
                order.status !== OrderStatus.CONFIRMED
            ) {
                throw new OrderCancellationNotAllowedError(
                    orderId,
                    order.status,
                );
            }

            // BƯỚC 3: Đọc các mặt hàng đã lưu trong đơn và sắp xếp ổn định theo productId trước khi cập nhật kho.
            // Các transaction xử lý nhiều sản phẩm cùng thứ tự sẽ giảm nguy cơ khóa chéo gây deadlock.
            const items = await manager
                .getRepository(OrderItemEntity)
                .findBy({ orderId: order.id });
            const itemsInLockOrder = [...items].sort(
                (left, right) =>
                    left.productId.localeCompare(right.productId) ||
                    left.id.localeCompare(right.id),
            );

            // BƯỚC 4: Hoàn lại đúng quantity của từng item; chỉ lọc theo ID để sản phẩm soft-delete vẫn được hoàn kho.
            for (const item of itemsInLockOrder) {
                const result = await manager.increment(
                    ProductEntity,
                    { id: item.productId },
                    'stock',
                    item.quantity,
                );

                // Không cập nhật đúng một product thường báo dữ liệu tham chiếu bị lệch; ném lỗi để rollback toàn bộ transaction.
                if (result.affected !== 1) {
                    throw new OrderProductNotFoundError(item.productId);
                }
            }

            // BƯỚC 5: Chỉ chuyển sang CANCELLED sau khi tất cả sản phẩm đã hoàn kho thành công.
            // Nếu lưu trạng thái thất bại, transaction cũng rollback các lần tăng stock ở bước trước.
            order.status = OrderStatus.CANCELLED;
            const cancelledOrder = await manager.save(OrderEntity, order);

            return {
                id: cancelledOrder.id,
                customerName: cancelledOrder.customerName,
                customerEmail: cancelledOrder.customerEmail,
                status: cancelledOrder.status,
                createdAt: cancelledOrder.createdAt,
                updatedAt: cancelledOrder.updatedAt,
                items: itemsInLockOrder.map((item) => ({
                    id: item.id,
                    productId: item.productId,
                    productSku: item.productSku,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                })),
            };
        });
    }
}
