// Hợp đồng truy vấn đơn hàng; application chỉ nhận representation, không phụ thuộc TypeORM.
import type { OrderStatus } from '@/database/enums/order-status.enum';

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

// Bộ lọc và giới hạn trang đã được DTO xác thực trước khi vào application.
export interface OrderListQuery {
    page: number;
    limit: number;
    status?: OrderStatus;
}

// Dòng danh sách chỉ gồm thông tin tóm tắt; chi tiết item dành cho endpoint theo ID.
export interface OrderListItem {
    id: string;
    customerName: string;
    customerEmail: string;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
}

// Trang danh sách gồm các đơn phù hợp bộ lọc và metadata phân trang.
export interface OrderListPage {
    items: OrderListItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// Port đọc danh sách và chi tiết đơn; null biểu thị không có đơn tương ứng.
export interface OrderReadRepository {
    list(query: OrderListQuery): Promise<OrderListPage>;
    findById(id: string): Promise<OrderDetail | null>;
}
