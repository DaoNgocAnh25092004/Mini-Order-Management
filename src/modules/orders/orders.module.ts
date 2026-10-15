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
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/write/typeorm-order-write.repository';
import { OrdersController } from '@/modules/orders/presentation/controllers/orders.controller';
import { ORDER_PROCESSING_QUEUE } from '@/modules/orders/infrastructure/queue/config/order-processing.constants';
import { TypeOrmOrderProcessingPublisher } from '@/modules/orders/infrastructure/queue/publishers/typeorm-order-processing.publisher';

@Module({
    imports: [
        BullModule.registerQueue({ name: ORDER_PROCESSING_QUEUE }),
        TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, ProductEntity]),
    ],
    controllers: [OrdersController],
    providers: [
        CreateOrderService,
        CancelOrderService,
        GetOrderByIdService,
        ListOrdersService,
        TypeOrmOrderReadRepository,
        TypeOrmOrderWriteRepository,
        TypeOrmOrderProcessingPublisher,
        {
            provide: ORDER_READ_REPOSITORY,
            useExisting: TypeOrmOrderReadRepository,
        },
        {
            provide: ORDER_WRITE_REPOSITORY,
            useExisting: TypeOrmOrderWriteRepository,
        },
    ],
})
export class OrdersModule {}
