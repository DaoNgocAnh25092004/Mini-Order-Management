import { Inject, Injectable } from '@nestjs/common';
import type { ProductListItem } from '@/modules/products/application/contracts/product-read-repository';
import { PRODUCT_WRITE_REPOSITORY } from '@/modules/products/application/contracts/product-write-repository';
import type {
    ProductWriteRepository,
    UpdateProductInput,
} from '@/modules/products/application/contracts/product-write-repository';
import { ProductNotFoundError } from '@/modules/products/application/errors/product-not-found.error';

@Injectable()
export class UpdateProductService {
    // Inject hợp đồng ghi để use case không biết adapter persistence cụ thể.
    constructor(
        @Inject(PRODUCT_WRITE_REPOSITORY)
        private readonly productWriteRepository: ProductWriteRepository,
    ) {}

    // Trả sản phẩm sau cập nhật; null từ repository được chuyển thành lỗi not-found.
    async execute(
        id: string,
        input: UpdateProductInput,
    ): Promise<ProductListItem> {
        const product = await this.productWriteRepository.update(id, input);

        if (!product) {
            throw new ProductNotFoundError();
        }

        return product;
    }
}
