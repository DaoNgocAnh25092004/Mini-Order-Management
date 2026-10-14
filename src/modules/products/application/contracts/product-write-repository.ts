// Hợp đồng ghi Products cho application, không để lộ entity hoặc API TypeORM.
import type { ProductListItem } from '@/modules/products/application/contracts/product-read-repository';

export const PRODUCT_WRITE_REPOSITORY = Symbol('PRODUCT_WRITE_REPOSITORY');

// Hợp đồng đầu vào của thao tác tạo sản phẩm, không phụ thuộc entity hoặc TypeORM.
export interface CreateProductInput {
    sku: string;
    name: string;
    price: string;
    stock: number;
}

// Input PATCH chỉ chứa các trường sản phẩm được phép thay đổi.
export type UpdateProductInput = Partial<CreateProductInput>;

// Hợp đồng ghi Products cho application
export interface ProductWriteRepository {
    create(input: CreateProductInput): Promise<ProductListItem>;
    update(
        id: string,
        input: UpdateProductInput,
    ): Promise<ProductListItem | null>;
    softDelete(id: string): Promise<boolean>;
}
