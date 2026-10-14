// Lỗi nghiệp vụ khi tồn kho hiện có không đủ cho số lượng khách yêu cầu.
export class InsufficientStockError extends Error {
    // Trả số lượng yêu cầu và số còn lại để client hiểu rõ nguyên nhân HTTP 409.
    constructor(productId: string, requested: number, available: number) {
        super(
            `Sản phẩm ${productId} không đủ tồn kho: yêu cầu ${requested}, hiện còn ${available}.`,
        );
        this.name = InsufficientStockError.name;
    }
}
