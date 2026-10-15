// Các mốc vòng đời đơn hàng có thể tạo bản ghi thông báo; unique theo đơn và loại sự kiện để chống ghi lặp.
export enum NotificationEventType {
    // Job xử lý đơn thành công và chuyển đơn sang CONFIRMED.
    ORDER_CONFIRMED = 'ORDER_CONFIRMED',

    // Job hết lượt thử, đơn chuyển sang FAILED và hệ thống hoàn kho.
    ORDER_FAILED = 'ORDER_FAILED',

    // Đơn được khách hoặc hệ thống hủy và tồn kho được hoàn lại.
    ORDER_CANCELLED = 'ORDER_CANCELLED',

    // Đơn PENDING quá thời hạn và bị hệ thống tự hủy, hoàn kho.
    ORDER_EXPIRED = 'ORDER_EXPIRED',
}
