import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProductEntity } from '@/database/entities/product.entity';
import type { ProductListItem } from '@/modules/products/application/contracts/product-read-repository';
import type {
    CreateProductInput,
    ProductWriteRepository,
    UpdateProductInput,
} from '@/modules/products/application/contracts/product-write-repository';
import { ProductSkuConflictError } from '@/modules/products/application/errors/product-sku-conflict.error';

// Chỉ nhận đúng unique violation trên SKU; các lỗi database khác phải giữ nguyên.
function isSkuUniqueViolation(error: unknown): boolean {
    // Kiểm tra lỗi TypeORM và PostgreSQL unique violation trên cột SKU.
    if (!(error instanceof QueryFailedError)) {
        return false;
    }

    // driverError là lỗi gốc từ PostgreSQL, có thể có code và constraint.
    const driverError = error.driverError as Error & {
        code?: string;
        constraint?: string;
    };

    // Mã lỗi 23505 là unique_violation, constraint là tên index/constraint.
    return (
        driverError.code === '23505' &&
        driverError.constraint === 'UQ_products_sku'
    );
}

// Adapter TypeORM ghi sản phẩm và chuyển lỗi unique PostgreSQL thành lỗi ứng dụng.
@Injectable()
export class TypeOrmProductWriteRepository implements ProductWriteRepository {
    // Nhận TypeORM repository đã được đăng ký trong ProductsModule.
    constructor(
        @InjectRepository(ProductEntity)
        private readonly products: Repository<ProductEntity>,
    ) {}

    // Dựa vào unique index để chặn SKU trùng an toàn kể cả khi hai request chạy đồng thời.
    async create(input: CreateProductInput): Promise<ProductListItem> {
        // Tạo entity từ input; không cần set id, createdAt, updatedAt vì TypeORM tự động.
        const product = this.products.create(input);

        try {
            // Lưu entity vào database; TypeORM sẽ ném lỗi nếu SKU trùng.
            const savedProduct = await this.products.save(product);

            // Chuyển entity thành representation đồng nhất với API đọc danh sách.
            return this.toProductItem(savedProduct);
        } catch (error: unknown) {
            // Chỉ đổi lỗi unique SKU thành conflict; lỗi kết nối/schema tiếp tục được ném nguyên trạng.
            if (isSkuUniqueViolation(error)) {
                throw new ProductSkuConflictError();
            }

            throw error;
        }
    }

    // Cập nhật một phần sản phẩm còn hoạt động và giữ nguyên lỗi SKU trùng từ PostgreSQL.
    async update(
        id: string,
        input: UpdateProductInput,
    ): Promise<ProductListItem | null> {
        // findOneBy tự loại sản phẩm đã soft-delete; null giúp application ánh xạ thành 404.
        const product = await this.products.findOneBy({ id });

        if (!product) {
            return null;
        }

        // Chỉ ghi đè các thuộc tính DTO gửi lên, giữ nguyên những trường bị bỏ qua.
        Object.assign(product, input);

        try {
            const savedProduct = await this.products.save(product);
            return this.toProductItem(savedProduct);
        } catch (error: unknown) {
            // Chỉ chuyển đúng unique violation của SKU thành lỗi nghiệp vụ 409.
            if (isSkuUniqueViolation(error)) {
                throw new ProductSkuConflictError();
            }

            throw error;
        }
    }

    // Không đưa cột deletedAt hoặc chi tiết persistence vào response API.
    private toProductItem(entity: ProductEntity): ProductListItem {
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
