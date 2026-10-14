import { Inject, Injectable } from '@nestjs/common';
import type { ProductListItem } from '@/modules/products/application/contracts/product-read-repository';
import { PRODUCT_READ_REPOSITORY } from '@/modules/products/application/contracts/product-read-repository';
import type { ProductReadRepository } from '@/modules/products/application/contracts/product-read-repository';
import { ProductNotFoundError } from '@/modules/products/application/errors/product-not-found.error';

// Điều phối use case đọc một sản phẩm qua repository port, không phụ thuộc TypeORM.
@Injectable()
export class GetProductByIdService {
    // Inject read port để use case có thể được kiểm thử hoặc thay adapter độc lập.
    constructor(
        @Inject(PRODUCT_READ_REPOSITORY)
        private readonly productReadRepository: ProductReadRepository,
    ) {}

    // Trả sản phẩm nếu còn hoạt động; không tìm thấy hoặc đã soft-delete thì báo lỗi ứng dụng.
    async execute(id: string): Promise<ProductListItem> {
        const product = await this.productReadRepository.findById(id);

        if (!product) {
            throw new ProductNotFoundError();
        }

        return product;
    }
}
