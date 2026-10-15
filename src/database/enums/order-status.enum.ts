// Trạng thái được lưu cho vòng đời đơn hàng; chỉ migration và entity sở hữu cách lưu trữ.
export enum OrderStatus {
    PENDING = 'PENDING',
    CONFIRMED = 'CONFIRMED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
}
