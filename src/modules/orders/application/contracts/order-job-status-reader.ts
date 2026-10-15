// Cổng đọc trạng thái job; application nhận dữ liệu đơn giản, không phụ thuộc BullMQ.
export const ORDER_JOB_STATUS_READER = Symbol('ORDER_JOB_STATUS_READER');

// Trạng thái xử lý job trả về cho endpoint theo dõi đơn hàng.
export interface OrderProcessingJobStatus {
    orderId: string;
    jobId: string;
    state: string;
    attempts: number; // Số lần retry hiện tại của job.
    maxAttempts: number; // Số lần retry tối đa của job.
    failureReason: string | null; // Lý do thất bại của job, nếu có.
}

// Adapter trả null nếu job không còn tồn tại trong queue.
export interface OrderJobStatusReader {
    findByOrderId(orderId: string): Promise<OrderProcessingJobStatus | null>;
}
