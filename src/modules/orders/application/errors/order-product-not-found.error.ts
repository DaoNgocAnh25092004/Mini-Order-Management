// Lỗi nghiệp vụ cho sản phẩm không tồn tại, đã xóa mềm hoặc không còn bán.
export class OrderProductNotFoundError extends Error {
    // Gắn productId để HTTP layer trả thông báo cụ thể mà không lộ chi tiết database.
    constructor(productId: string) {
        super(`Sản phẩm ${productId} không tồn tại hoặc không còn kinh doanh.`);
        this.name = OrderProductNotFoundError.name;
    }
}
