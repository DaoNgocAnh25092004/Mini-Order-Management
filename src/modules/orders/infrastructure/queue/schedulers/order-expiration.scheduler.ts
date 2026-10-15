// Đăng ký lịch quét đơn hết hạn trong Redis; cùng scheduler ID giúp nhiều lần khởi động không tạo lịch trùng.
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
    EXPIRE_PENDING_ORDERS_INTERVAL_MS,
    EXPIRE_PENDING_ORDERS_JOB,
    EXPIRE_PENDING_ORDERS_SCHEDULER_ID,
    ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
    ORDER_PROCESSING_QUEUE,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import type { OrderQueueJobData } from '@/modules/orders/application/contracts/order-queue-job-data';

@Injectable()
export class OrderExpirationScheduler implements OnModuleInit {
    // Inject queue để lưu lịch lặp bền vững trong Redis thay vì dùng setInterval trong từng API instance.
    constructor(
        @InjectQueue(ORDER_PROCESSING_QUEUE)
        private readonly queue: Queue<OrderQueueJobData>,
    ) {}

    // Đăng ký hoặc cập nhật một scheduler duy nhất; BullMQ sẽ tự tạo từng job theo chu kỳ 5 phút.
    async onModuleInit(): Promise<void> {
        await this.queue.upsertJobScheduler(
            EXPIRE_PENDING_ORDERS_SCHEDULER_ID,
            { every: EXPIRE_PENDING_ORDERS_INTERVAL_MS },
            {
                name: EXPIRE_PENDING_ORDERS_JOB,
                data: { task: 'expire-pending-orders' },
                opts: ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
            },
        );
    }
}
