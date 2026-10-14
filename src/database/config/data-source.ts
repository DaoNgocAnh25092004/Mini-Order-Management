import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { postgresDataSourceOptions } from '@/database/config/typeorm-options';

// Mục đích của file này là để TypeORM CLI có thể import và lấy cấu hình DataSource từ DATABASE_URL.
export const AppDataSource = new DataSource(postgresDataSourceOptions);
