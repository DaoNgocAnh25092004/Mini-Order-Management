import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresDataSourceOptions } from '@/database/config/typeorm-options';
import { HealthModule } from '@/modules/health/health.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { ProductsModule } from '@/modules/products/products.module';
import { getRedisConnectionOptions } from '@/modules/orders/infrastructure/queue/config/redis-connection-options';

// Module gốc đăng ký các provider dùng ở phạm vi toàn ứng dụng.
@Module({
    imports: [
        // Cấu hình TypeORM
        TypeOrmModule.forRoot(postgresDataSourceOptions),
        // Cấu hình BullMQ
        BullModule.forRootAsync({
            useFactory: () => ({
                connection: getRedisConnectionOptions(),
            }),
        }),
        HealthModule,
        ProductsModule,
        // Chỉ đăng ký controller và provider cần cho HTTP; tiến trình nền nằm trong module worker riêng.
        OrdersModule,
    ],
})
export class AppModule {}
