// Adapter TypeORM tải đơn cùng order_items và ánh xạ sang contract đọc của application.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import type {
    OrderDetail,
    OrderListItem,
    OrderListPage,
    OrderListQuery,
    OrderReadRepository,
} from '@/modules/orders/application/contracts/order-read-repository';

@Injectable()
export class TypeOrmOrderReadRepository implements OrderReadRepository {
    constructor(
        @InjectRepository(OrderEntity)
        private readonly orders: Repository<OrderEntity>,
    ) {}

    // Lọc status nếu có, phân trang ổn định theo ngày tạo và ID để các trang không xáo trộn tùy ý.
    async list(query: OrderListQuery): Promise<OrderListPage> {
        const orderQuery = this.orders.createQueryBuilder('order');

        // Lọc theo status
        if (query.status !== undefined) {
            orderQuery.andWhere('order.status = :status', {
                status: query.status,
            });
        }

        // Sắp xếp xác định trước khi skip/take; getManyAndCount đếm toàn bộ kết quả đã lọc.
        const [entities, total] = await orderQuery
            .orderBy('order.createdAt', 'DESC')
            .addOrderBy('order.id', 'ASC')
            .skip((query.page - 1) * query.limit)
            .take(query.limit)
            .getManyAndCount();

        return {
            items: entities.map((entity) => this.toListItem(entity)),
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        };
    }

    // Tải đúng một đơn cùng order_items; không join products vì item phải trả snapshot lịch sử đã lưu.
    async findById(id: string): Promise<OrderDetail | null> {
        // Tìm đơn theo ID, join order_items để trả về danh sách item snapshot.
        const order = await this.orders.findOne({
            where: { id },
            relations: { items: true }, // join order_items để trả về danh sách item snapshot.
        });

        if (!order) {
            return null;
        }

        // Chỉ trả các trường API công khai, không đưa entity/quan hệ TypeORM thô ra ngoài.
        return {
            id: order.id,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            status: order.status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            items: order.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                productSku: item.productSku,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
        };
    }

    // Chỉ trả trường tóm tắt của đơn; endpoint theo ID mới tải quan hệ order_items.
    private toListItem(entity: OrderEntity): OrderListItem {
        return {
            id: entity.id,
            customerName: entity.customerName,
            customerEmail: entity.customerEmail,
            status: entity.status,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}
