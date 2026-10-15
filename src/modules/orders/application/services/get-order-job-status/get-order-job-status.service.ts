// Use case đọc trạng thái job qua application port, không truy cập BullMQ trực tiếp.
import { Inject, Injectable } from '@nestjs/common';
import {
    ORDER_JOB_STATUS_READER,
    type OrderJobStatusReader,
    type OrderProcessingJobStatus,
} from '@/modules/orders/application/contracts/order-job-status-reader';
import { OrderProcessingJobNotFoundError } from '@/modules/orders/application/errors/order-processing-job-not-found.error';

@Injectable()
export class GetOrderJobStatusService {
    // Inject port để có thể thay adapter queue mà không đổi logic application.
    constructor(
        @Inject(ORDER_JOB_STATUS_READER)
        private readonly jobStatusReader: OrderJobStatusReader,
    ) {}

    // Trả trạng thái job của order; nếu job không còn trong queue thì phát lỗi để controller trả 404.
    async execute(orderId: string): Promise<OrderProcessingJobStatus> {
        const jobStatus = await this.jobStatusReader.findByOrderId(orderId);

        // Nếu không tìm thấy job thì ném lỗi để controller trả HTTP 404.
        if (!jobStatus) {
            throw new OrderProcessingJobNotFoundError(orderId);
        }

        return jobStatus;
    }
}
