// Cổng cập nhật vòng đời đơn từ worker; application không phụ thuộc TypeORM hay entity lưu trữ.
export const ORDER_PROCESSING_REPOSITORY = Symbol(
    'ORDER_PROCESSING_REPOSITORY',
);

export interface OrderProcessingRepository {
    // Chỉ chuyển đơn PENDING sang CONFIRMED và ghi notification một lần.
    confirmPendingOrder(orderId: string): Promise<void>;

    // Chỉ chuyển đơn PENDING sang FAILED; hoàn kho và ghi notification cùng transaction.
    failPendingOrder(orderId: string, failureReason: string): Promise<void>;

    // Hủy các đơn PENDING có createdAt trước mốc thời gian; hoàn kho và ghi notification nguyên tử.
    expireOverduePendingOrders(expiredBefore: Date): Promise<number>;
}
