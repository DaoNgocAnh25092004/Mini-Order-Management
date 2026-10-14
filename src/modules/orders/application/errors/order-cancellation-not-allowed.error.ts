// Lỗi nghiệp vụ khi trạng thái hiện tại không cho phép hủy đơn.
import type { OrderStatus } from '@/database/enums/order-status.enum';

export class OrderCancellationNotAllowedError extends Error {
    // Giữ ID và trạng thái để HTTP boundary trả thông báo xung đột cụ thể.
    constructor(orderId: string, status: OrderStatus) {
        super(
            `Không thể hủy đơn hàng ${orderId} vì đơn đang ở trạng thái ${status}.`,
        );
        this.name = OrderCancellationNotAllowedError.name;
    }
}
