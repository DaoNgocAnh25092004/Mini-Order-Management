import { Inject, Injectable } from '@nestjs/common';
import type { ProductListItem } from '@/modules/products/application/contracts/product-read-repository';
import { PRODUCT_WRITE_REPOSITORY } from '@/modules/products/application/contracts/product-write-repository';
import type { CreateProductInput } from '@/modules/products/application/contracts/product-write-repository';
import type { ProductWriteRepository } from '@/modules/products/application/contracts/product-write-repository';

// Điều phối use case tạo sản phẩm qua write port mà không phụ thuộc persistence adapter.
@Injectable()
export class CreateProductService {
    // Inject write port để application không phụ thuộc repository TypeORM cụ thể.
    constructor(
        @Inject(PRODUCT_WRITE_REPOSITORY)
        private readonly productWriteRepository: ProductWriteRepository,
    ) {}

    // Lưu dữ liệu đã qua DTO và trả representation sản phẩm do repository tạo.
    execute(input: CreateProductInput): Promise<ProductListItem> {
        return this.productWriteRepository.create(input);
    }
}
