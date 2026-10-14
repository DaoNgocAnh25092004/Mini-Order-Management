// Lỗi ứng dụng dùng khi không có sản phẩm đang hoạt động với UUID được yêu cầu.
export class ProductNotFoundError extends Error {
    // Giữ định danh riêng để presentation chỉ chuyển lỗi không tìm thấy thành HTTP 404.
    constructor() {
        super('Không tìm thấy sản phẩm.');
        this.name = ProductNotFoundError.name;
    }
}
