import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { ORDER_READ_REPOSITORY } from '@/modules/orders/application/contracts/order-read-repository';
import { ORDER_PROCESSING_REPOSITORY } from '@/modules/orders/application/contracts/order-processing-repository';
import { ORDER_WRITE_REPOSITORY } from '@/modules/orders/application/contracts/order-write-repository';
import { CreateOrderService } from '@/modules/orders/application/services/create-order/create-order.service';
import { CancelOrderService } from '@/modules/orders/application/services/cancel-order/cancel-order.service';
import { GetOrderByIdService } from '@/modules/orders/application/services/get-order-by-id/get-order-by-id.service';
import { ListOrdersService } from '@/modules/orders/application/services/list-orders/list-orders.service';
import { ProcessOrderService } from '@/modules/orders/application/services/process-order/process-order.service';
import { TypeOrmOrderReadRepository } from '@/modules/orders/infrastructure/repositories/read/typeorm-order-read.repository';
import { TypeOrmOrderProcessingRepository } from '@/modules/orders/infrastructure/repositories/write/order-processing/typeorm-order-processing.repository';
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/write/order-write/typeorm-order-write.repository';
import { OrdersController } from '@/modules/orders/presentation/controllers/orders.controller';
import {
    ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
    ORDER_PROCESSING_QUEUE,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { TypeOrmOrderProcessingPublisher } from '@/modules/orders/infrastructure/queue/publishers/typeorm-order-processing.publisher';
import { OrderProcessingProcessor } from '@/modules/orders/infrastructure/queue/processors/order-processing.processor';
import { OrderProcessingSimulator } from '@/modules/orders/infrastructure/queue/simulators/order-processing.simulator';

@Module({
    imports: [
        BullModule.registerQueue({
            name: ORDER_PROCESSING_QUEUE,
            defaultJobOptions: ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
        }),
        TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, ProductEntity]),
    ],
    controllers: [OrdersController],
    providers: [
        CreateOrderService,
        CancelOrderService,
        GetOrderByIdService,
        ListOrdersService,
        ProcessOrderService,
        TypeOrmOrderReadRepository,
        TypeOrmOrderProcessingRepository,
        TypeOrmOrderWriteRepository,
        TypeOrmOrderProcessingPublisher,
        OrderProcessingProcessor,
        OrderProcessingSimulator,
        {
            provide: ORDER_READ_REPOSITORY,
            useExisting: TypeOrmOrderReadRepository,
        },
        {
            provide: ORDER_PROCESSING_REPOSITORY,
            useExisting: TypeOrmOrderProcessingRepository,
        },
        {
            provide: ORDER_WRITE_REPOSITORY,
            useExisting: TypeOrmOrderWriteRepository,
        },
    ],
})
export class OrdersModule {}
