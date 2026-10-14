import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '@/database/entities/product.entity';
import {
    ProductListItem,
    ProductListPage,
    ProductListQuery,
    ProductReadRepository,
} from '@/modules/products/application/contracts/product-read-repository';

@Injectable()
export class TypeOrmProductReadRepository implements ProductReadRepository {
    constructor(
        @InjectRepository(ProductEntity)
        private readonly products: Repository<ProductEntity>,
    ) {}

    // Tìm theo UUID; TypeORM tự loại hàng có deletedAt khác null khỏi truy vấn mặc định.
    async findById(id: string): Promise<ProductListItem | null> {
        const entity = await this.products.findOneBy({ id });

        return entity ? this.toListItem(entity) : null;
    }

    // Áp dụng bộ lọc có tham số, loại sản phẩm đã xóa mềm và giới hạn kết quả theo trang.
    async list(query: ProductListQuery): Promise<ProductListPage> {
        const productQuery = this.products
            .createQueryBuilder('product')
            .where('product.deletedAt IS NULL');

        if (query.search) {
            productQuery.andWhere('product.name ILIKE :search', {
                search: `%${query.search}%`,
            });
        }

        if (query.minPrice !== undefined) {
            productQuery.andWhere('product.price >= :minPrice', {
                minPrice: query.minPrice,
            });
        }

        if (query.maxPrice !== undefined) {
            productQuery.andWhere('product.price <= :maxPrice', {
                maxPrice: query.maxPrice,
            });
        }

        // Sắp xếp theo thời gian tạo mới nhất trước, sau đó theo id để tránh trùng lặp khi phân trang.
        const [entities, total] = await productQuery
            .orderBy('product.createdAt', 'DESC')
            .addOrderBy('product.id', 'ASC')
            .skip((query.page - 1) * query.limit)
            .take(query.limit)
            .getManyAndCount(); // Lấy danh sách entity và tổng số bản ghi phù hợp với bộ lọc.

        return {
            items: entities.map((entity) => this.toListItem(entity)),
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        };
    }

    // Không để lộ cột deletedAt hoặc các chi tiết persistence ra response API.
    private toListItem(entity: ProductEntity): ProductListItem {
        return {
            id: entity.id,
            sku: entity.sku,
            name: entity.name,
            price: entity.price,
            stock: entity.stock,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}
