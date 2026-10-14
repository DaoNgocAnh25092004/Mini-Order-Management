import type { DataSourceOptions } from 'typeorm';
import { ProductEntity } from '@/database/entities/product.entity';
import { CreateProductsTable1760460000000 } from '@/database/migrations/1760460000000-CreateProductsTable';

// Giữ mức xác minh TLS hiện tại của pg nhưng tránh các alias sẽ đổi nghĩa ở phiên bản major tới.
function normalizePostgresSslMode(
    databaseUrl: string | undefined,
): string | undefined {
    if (!databaseUrl) {
        return databaseUrl;
    }

    // Chỉ thay sslmode cũ trong query; giữ nguyên credentials và các tham số kết nối còn lại.
    return databaseUrl.replace(
        /([?&]sslmode=)(?:prefer|require|verify-ca)(?=[&#]|$)/i,
        '$1verify-full',
    );
}

// Dùng chung cấu hình cho NestJS và TypeORM CLI; schema chỉ thay đổi qua migration.
export const postgresDataSourceOptions: Extract<
    DataSourceOptions,
    { type: 'postgres' }
> = {
    type: 'postgres',
    url: normalizePostgresSslMode(process.env.DATABASE_URL),
    entities: [ProductEntity],
    migrations: [CreateProductsTable1760460000000],
    synchronize: false,
    migrationsRun: false,
};
