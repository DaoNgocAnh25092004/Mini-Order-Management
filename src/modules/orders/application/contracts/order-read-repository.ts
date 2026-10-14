// Hợp đồng truy vấn đơn hàng; application chỉ nhận representation, không phụ thuộc TypeORM.
import { OrderStatus } from '@/database/enums/order-status.enum';

export const ORDER_READ_REPOSITORY = Symbol('ORDER_READ_REPOSITORY');

// Snapshot một dòng hàng như đã lưu tại thời điểm khách đặt đơn.
export interface OrderDetailItem {
    id: string;
    productId: string;
    productSku: string;
    productName: string;
    quantity: number;
    unitPrice: string;
}

// Chi tiết đơn trả về cho GET /orders/:id, gồm thông tin đơn và các dòng hàng.
export interface OrderDetail {
    id: string;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
    items: OrderDetailItem[];
}

// Port đọc đơn theo ID; null biểu thị không có đơn tương ứng.
export interface OrderReadRepository {
    findById(id: string): Promise<OrderDetail | null>;
}
