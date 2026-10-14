import type { DataSourceOptions } from 'typeorm';
import { ProductEntity } from '@/database/entities/product.entity';
import { CreateProductsTable1760460000000 } from '@/database/migrations/1760460000000-CreateProductsTable';

// Dùng chung cấu hình cho NestJS và TypeORM CLI; schema chỉ thay đổi qua migration.
export const postgresDataSourceOptions: Extract<
    DataSourceOptions,
    { type: 'postgres' }
> = {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [ProductEntity],
    migrations: [CreateProductsTable1760460000000],
    synchronize: false,
    migrationsRun: false,
};
