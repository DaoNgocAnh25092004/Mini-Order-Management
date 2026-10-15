import { ApiProperty } from '@nestjs/swagger';
import type { OrderProcessingJobStatus } from '@/modules/orders/application/contracts/order-job-status-reader';

export class OrderJobStatusDto implements OrderProcessingJobStatus {
    @ApiProperty({ example: '124f6fd1-9de3-4ad7-9408-729fccfe0fa0' })
    orderId!: string;

    @ApiProperty({
        example: 'order-processing-124f6fd1-9de3-4ad7-9408-729fccfe0fa0',
    })
    jobId!: string;

    @ApiProperty({
        example: 'delayed',
        enum: [
            'waiting', // Job đang chờ thực thi.
            'active', // Job đang thực thi.
            'delayed', // Job đang chờ retry theo delay.
            'completed', // Job đã thực thi thành công.
            'failed', // Job đã thực thi thất bại, có thể retry nếu attempts < maxAttempts.
            'waiting-children', // Job đang chờ các job con hoàn tất trước khi thực thi.
            'prioritized', // Job đang chờ thực thi nhưng có độ ưu tiên cao hơn các job khác.
            'unknown', // Job không còn tồn tại trong queue, có thể đã hoàn tất hoặc bị xóa.
        ],
    })
    state!: string;

    // Số lượt job đã chạy tính đến hiện tại, kể cả lượt đang chạy chưa được BullMQ ghi vào attemptsMade.
    @ApiProperty({
        example: 2,
        description: 'Số lượt job đã chạy tính đến hiện tại.',
    })
    attempts!: number;

    // Số lượt chạy tối đa của job, nếu attempts < maxAttempts thì job có thể retry.
    @ApiProperty({
        example: 3,
        description: 'Tổng số lượt chạy tối đa của job.',
    })
    maxAttempts!: number;

    // Lý do thất bại của job, nếu có; null nếu job chưa thất bại hoặc đã hoàn tất thành công.
    @ApiProperty({ example: 'Lỗi xử lý tạm thời', nullable: true })
    failureReason!: string | null;
}
