import { Inject, Injectable } from '@nestjs/common';
import { PRODUCT_READ_REPOSITORY } from '@/modules/products/application/contracts/product-read-repository';
import type {
    ProductListPage,
    ProductListQuery,
    ProductReadRepository,
} from '@/modules/products/application/contracts/product-read-repository';

// Service của application điều phối use case, chỉ phụ thuộc hợp đồng repository.
@Injectable()
export class GetProductsService {
    constructor(
        @Inject(PRODUCT_READ_REPOSITORY)
        private readonly productReadRepository: ProductReadRepository,
    ) {}

    // Chuyển bộ lọc đã được DTO xác thực sang repository và trả nguyên trang kết quả.
    execute(query: ProductListQuery): Promise<ProductListPage> {
        return this.productReadRepository.list(query);
    }
}
