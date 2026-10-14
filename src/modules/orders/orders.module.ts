import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderItemEntity } from '@/database/entities/order-item.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { ORDER_WRITE_REPOSITORY } from '@/modules/orders/application/contracts/order-write-repository';
import { CreateOrderService } from '@/modules/orders/application/services/create-order.service';
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/typeorm-order-write.repository';
import { OrdersController } from '@/modules/orders/presentation/controllers/orders.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, ProductEntity]),
    ],
    controllers: [OrdersController],
    providers: [
        CreateOrderService,
        TypeOrmOrderWriteRepository,
        {
            provide: ORDER_WRITE_REPOSITORY,
            useExisting: TypeOrmOrderWriteRepository,
        },
    ],
})
export class OrdersModule {}
