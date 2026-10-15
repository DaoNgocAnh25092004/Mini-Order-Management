// Adapter đọc thông tin job từ BullMQ và chuyển thành response model của application.
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type {
    OrderJobStatusReader,
    OrderProcessingJobStatus,
} from '@/modules/orders/application/contracts/order-job-status-reader';
import { ORDER_PROCESSING_QUEUE } from '@/modules/orders/infrastructure/queue/config/order-processing.constants';

interface OrderProcessingJobData {
    orderId: string;
}

@Injectable()
export class BullMqOrderJobStatusReader implements OrderJobStatusReader {
    // Inject queue order-processing để adapter chỉ đọc job, không xử lý nghiệp vụ đơn hàng.
    constructor(
        @InjectQueue(ORDER_PROCESSING_QUEUE)
        private readonly queue: Queue<OrderProcessingJobData>,
    ) {}

    // Tìm job theo ID ổn định do publisher tạo; null nghĩa là queue không còn lưu job đó.
    async findByOrderId(
        orderId: string,
    ): Promise<OrderProcessingJobStatus | null> {
        // Tạo jobId ổn định để tìm job trong queue, tránh trùng lặp với các job khác.
        const jobId = `order-processing-${orderId}`;

        // Lấy job từ queue theo jobId; nếu không tìm thấy, trả về null.
        const job = await this.queue.getJob(jobId);

        if (!job) {
            return null;
        }

        // Lấy trạng thái hiện tại của job từ BullMQ; có thể là 'waiting', 'active', 'delayed', 'completed', 'failed', 'waiting-children', 'prioritized', hoặc 'unknown'.
        const state = await job.getState();

        // Tính số lượt job đã chạy tính đến hiện tại, kể cả lượt đang chạy chưa được BullMQ ghi vào attemptsMade.
        const attempts =
            job.attemptsMade +
            (state === 'active' || state === 'completed' ? 1 : 0);

        return {
            orderId,
            jobId,
            state,
            attempts,
            maxAttempts: job.opts.attempts ?? 1,
            failureReason: job.failedReason || null,
        };
    }
}
