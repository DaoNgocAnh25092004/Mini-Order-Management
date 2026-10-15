// Payloads của các loại job thuộc queue order-processing; worker phân biệt bằng job.name.
export interface ProcessOrderJobData {
    orderId: string;
}

// Job định kỳ không cần orderId riêng vì mỗi lượt sẽ tự quét toàn bộ đơn quá hạn.
export interface ExpirePendingOrdersJobData {
    task: 'expire-pending-orders';
}

// Kiểu dữ liệu chung cho queue có cả job xử lý một đơn và job quét hết hạn.
export type OrderQueueJobData =
    ProcessOrderJobData | ExpirePendingOrdersJobData;
