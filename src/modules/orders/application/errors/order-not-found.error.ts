// Lỗi ứng dụng khi không tìm thấy đơn hàng theo ID được yêu cầu.
export class OrderNotFoundError extends Error {
    // Giữ ID trong thông báo để client xác định đơn nào không tồn tại.
    constructor(orderId: string) {
        super(`Không tìm thấy đơn hàng ${orderId}.`);
        this.name = OrderNotFoundError.name;
    }
}
