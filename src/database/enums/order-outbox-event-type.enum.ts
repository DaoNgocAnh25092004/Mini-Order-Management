// Các loại sự kiện đơn hàng được lưu trong transactional outbox.
export enum OrderOutboxEventType {
    // Khi đơn hàng được tạo, gửi sự kiện để các hệ thống khác (ví dụ: hệ thống thanh toán, kho hàng) xử lý.
    ORDER_PROCESSING_REQUESTED = 'ORDER_PROCESSING_REQUESTED',
}
