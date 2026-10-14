import type { ProductListItem } from '@/modules/products/application/contracts/product-read-repository';

export const PRODUCT_WRITE_REPOSITORY = Symbol('PRODUCT_WRITE_REPOSITORY');

// Hợp đồng đầu vào của thao tác tạo sản phẩm, không phụ thuộc entity hoặc TypeORM.
export interface CreateProductInput {
    sku: string;
    name: string;
    price: string;
    stock: number;
}

// Cổng ghi sản phẩm trả representation đồng nhất với API đọc danh sách.
export interface ProductWriteRepository {
    create(input: CreateProductInput): Promise<ProductListItem>;
}
