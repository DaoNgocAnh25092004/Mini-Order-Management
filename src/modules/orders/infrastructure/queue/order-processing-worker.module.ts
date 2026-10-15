import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { ORDER_PROCESSING_REPOSITORY } from '@/modules/orders/application/contracts/order-processing-repository';
import { ExpirePendingOrdersService } from '@/modules/orders/application/services/expire-pending-orders/expire-pending-orders.service';
import { ProcessOrderService } from '@/modules/orders/application/services/process-order/process-order.service';
import {
    ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
    ORDER_PROCESSING_QUEUE,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { OrderProcessingProcessor } from '@/modules/orders/infrastructure/queue/processors/order-processing.processor';
import { TypeOrmOrderProcessingPublisher } from '@/modules/orders/infrastructure/queue/publishers/typeorm-order-processing.publisher';
import { OrderProcessingSimulator } from '@/modules/orders/infrastructure/queue/simulators/order-processing.simulator';
import { OrderExpirationScheduler } from '@/modules/orders/infrastructure/queue/schedulers/order-expiration.scheduler';
import { TypeOrmOrderProcessingRepository } from '@/modules/orders/infrastructure/repositories/write/order-processing/typeorm-order-processing.repository';

// Module chỉ chứa các provider nền; không đăng ký controller hay mở cổng HTTP.
@Module({
    imports: [
        BullModule.registerQueue({
            name: ORDER_PROCESSING_QUEUE,
            defaultJobOptions: ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
        }),
        TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, ProductEntity]),
    ],
    providers: [
        ProcessOrderService,
        ExpirePendingOrdersService,
        TypeOrmOrderProcessingRepository,
        TypeOrmOrderProcessingPublisher,
        OrderProcessingProcessor,
        OrderProcessingSimulator,
        OrderExpirationScheduler,
        {
            provide: ORDER_PROCESSING_REPOSITORY,
            useExisting: TypeOrmOrderProcessingRepository,
        },
    ],
})
export class OrderProcessingWorkerModule {}
