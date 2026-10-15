import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresDataSourceOptions } from '@/database/config/typeorm-options';
import { getRedisConnectionOptions } from '@/modules/orders/infrastructure/queue/config/redis-connection-options';
import { OrderProcessingWorkerModule } from '@/modules/orders/infrastructure/queue/order-processing-worker.module';

// Composition root của worker: kết nối database/Redis rồi khởi tạo riêng các tác vụ nền, không mở HTTP.
@Module({
    imports: [
        TypeOrmModule.forRoot(postgresDataSourceOptions),
        BullModule.forRootAsync({
            useFactory: () => ({
                connection: getRedisConnectionOptions(),
            }),
        }),
        OrderProcessingWorkerModule,
    ],
})
export class WorkerAppModule {}
