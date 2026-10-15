// Tên queue Redis chứa các job xử lý đơn; publisher thêm job vào queue này và worker lắng nghe cùng queue.
export const ORDER_PROCESSING_QUEUE = 'order-processing';

// Tên loại công việc được ghi lên từng job để worker biết job đó yêu cầu xử lý đơn hàng.
export const ORDER_PROCESSING_JOB = 'process-order';

// Số lượt xử lý tối đa tính cả lần chạy đầu: 1 lần đầu + tối đa 2 lần retry.
// Khi cả 3 lượt đều lỗi, processor chuyển đơn sang FAILED và hoàn kho; BullMQ đánh dấu job failed.
export const ORDER_PROCESSING_MAX_ATTEMPTS = 3;

// Khoảng chờ cơ sở trước lần retry đầu tiên, tính bằng mili giây.
// Khi dùng exponential backoff, các lần sau tăng theo cấp số nhân (thường 1 giây, rồi 2 giây).
export const ORDER_PROCESSING_BACKOFF_DELAY_MS = 1000;

// Chính sách mặc định gắn vào job mới khi publisher gọi queue.add().
// Job được thử tối đa ORDER_PROCESSING_MAX_ATTEMPTS lần; mỗi lần retry chờ lâu hơn theo exponential backoff.
// Processor cũng bổ sung chính sách này cho job cũ còn nằm trong Redis nhưng chưa có retry options.
export const ORDER_PROCESSING_DEFAULT_JOB_OPTIONS = {
    attempts: ORDER_PROCESSING_MAX_ATTEMPTS, // Tổng số lượt chạy tối đa, tính cả lần đầu.
    // Khi job lỗi, BullMQ sẽ chờ theo backoff rồi chạy lại; nếu hết lượt, job được đánh dấu failed.
    backoff: {
        type: 'exponential' as const, // Tăng thời gian chờ giữa các lần retry theo cấp số nhân.
        delay: ORDER_PROCESSING_BACKOFF_DELAY_MS, // Thời gian chờ cơ sở trước lần retry đầu tiên, tính bằng mili giây.
    },
};
