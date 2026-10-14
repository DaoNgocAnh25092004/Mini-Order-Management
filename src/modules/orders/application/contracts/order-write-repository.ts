// Hợp đồng tạo đơn: application chỉ trao đổi dữ liệu đơn hàng, không biết TypeORM.
import type { OrderStatus } from '@/database/enums/order-status.enum';
import type { OrderDetail } from '@/modules/orders/application/contracts/order-read-repository';

export const ORDER_WRITE_REPOSITORY = Symbol('ORDER_WRITE_REPOSITORY');

// Dữ liệu tạo đơn đã được DTO xác thực và gộp các dòng trùng productId.
export interface CreateOrderInput {
    customerName: string;
    customerEmail: string;
    items: Array<{
        productId: string;
        quantity: number;
    }>;
}

// Snapshot được trả về phản ánh đúng thông tin sản phẩm tại thời điểm mua.
export interface CreatedOrderItem {
    id: string;
    productId: string;
    productSku: string;
    productName: string;
    quantity: number;
    unitPrice: string;
}

// Representation của POST /orders, giữ giá numeric ở dạng chuỗi chính xác.
export interface CreatedOrder {
    id: string;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
    items: CreatedOrderItem[];
}

export interface OrderWriteRepository {
    create(input: CreateOrderInput): Promise<CreatedOrder>;
    cancelOrder(id: string): Promise<OrderDetail>;
}
