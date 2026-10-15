import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { ORDER_READ_REPOSITORY } from '@/modules/orders/application/contracts/order-read-repository';
import { ORDER_WRITE_REPOSITORY } from '@/modules/orders/application/contracts/order-write-repository';
import { CreateOrderService } from '@/modules/orders/application/services/create-order/create-order.service';
import { CancelOrderService } from '@/modules/orders/application/services/cancel-order/cancel-order.service';
import { GetOrderByIdService } from '@/modules/orders/application/services/get-order-by-id/get-order-by-id.service';
import { ListOrdersService } from '@/modules/orders/application/services/list-orders/list-orders.service';
import { TypeOrmOrderReadRepository } from '@/modules/orders/infrastructure/repositories/read/typeorm-order-read.repository';
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/write/order-write/typeorm-order-write.repository';
import { OrdersController } from '@/modules/orders/presentation/controllers/orders.controller';
import {
    ORDER_PROCESSING_DEFAULT_JOB_OPTIONS,
    ORDER_PROCESSING_QUEUE,
} from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { GetOrderJobStatusService } from '@/modules/orders/application/services/get-order-job-status/get-order-job-status.service';
import { ORDER_JOB_STATUS_READER } from '@/modules/orders/application/contracts/order-job-status-reader';
import { BullMqOrderJobStatusReader } from '@/modules/orders/infrastructure/queue/readers/bullmq-order-job-status.reader';

// Module HTTP của orders; chỉ giữ controller và adapter đọc trạng thái queue, không khởi chạy worker nền.
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
        GetOrderJobStatusService,
        TypeOrmOrderReadRepository,
        TypeOrmOrderWriteRepository,
        BullMqOrderJobStatusReader,
        {
            provide: ORDER_READ_REPOSITORY,
            useExisting: TypeOrmOrderReadRepository,
        },
        {
            provide: ORDER_WRITE_REPOSITORY,
            useExisting: TypeOrmOrderWriteRepository,
        },
        {
            provide: ORDER_JOB_STATUS_READER,
            useExisting: BullMqOrderJobStatusReader,
        },
    ],
})
export class OrdersModule {}
