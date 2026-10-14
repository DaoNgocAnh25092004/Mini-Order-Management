// Lỗi ứng dụng để presentation ánh xạ SKU trùng thành HTTP 409 Conflict.
export class ProductSkuConflictError extends Error {
    // Đặt tên lỗi ổn định để controller chỉ chuyển đổi đúng xung đột SKU đã biết.
    constructor() {
        super('SKU đã tồn tại.');
        this.name = ProductSkuConflictError.name;
    }
}
