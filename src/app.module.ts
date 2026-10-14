import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresDataSourceOptions } from '@/database/config/typeorm-options';
import { HealthModule } from '@/modules/health/health.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { ProductsModule } from '@/modules/products/products.module';

// Module gốc đăng ký các provider dùng ở phạm vi toàn ứng dụng.
@Module({
    imports: [
        TypeOrmModule.forRoot(postgresDataSourceOptions),
        HealthModule,
        ProductsModule,
        OrdersModule,
    ],
})
export class AppModule {}
