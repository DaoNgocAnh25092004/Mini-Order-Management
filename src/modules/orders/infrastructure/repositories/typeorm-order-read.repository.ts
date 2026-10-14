// Adapter TypeORM tải đơn cùng order_items và ánh xạ sang contract đọc của application.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import type {
    OrderDetail,
    OrderReadRepository,
} from '@/modules/orders/application/contracts/order-read-repository';

@Injectable()
export class TypeOrmOrderReadRepository implements OrderReadRepository {
    constructor(
        @InjectRepository(OrderEntity)
        private readonly orders: Repository<OrderEntity>,
    ) {}

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
}
