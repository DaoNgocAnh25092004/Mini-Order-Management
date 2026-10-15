// Lỗi ứng dụng khi queue không còn job xử lý tương ứng với order được yêu cầu.
export class OrderProcessingJobNotFoundError extends Error {
    // Giữ orderId trong thông báo để client biết job nào không được tìm thấy.
    constructor(orderId: string) {
        super(`Không tìm thấy job xử lý cho đơn hàng ${orderId}.`);
        this.name = OrderProcessingJobNotFoundError.name;
    }
}
