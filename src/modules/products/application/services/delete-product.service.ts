// Điều phối xóa mềm sản phẩm qua write port và quy đổi kết quả không có bản ghi thành lỗi ứng dụng.
import { Inject, Injectable } from '@nestjs/common';
import { PRODUCT_WRITE_REPOSITORY } from '@/modules/products/application/contracts/product-write-repository';
import type { ProductWriteRepository } from '@/modules/products/application/contracts/product-write-repository';
import { ProductNotFoundError } from '@/modules/products/application/errors/product-not-found.error';

// Use case xóa mềm; không phụ thuộc TypeORM và giữ nguyên contract not-found của Products.
@Injectable()
export class DeleteProductService {
    // Inject write port để application chỉ phụ thuộc hợp đồng bền vững.
    constructor(
        @Inject(PRODUCT_WRITE_REPOSITORY)
        private readonly productWriteRepository: ProductWriteRepository,
    ) {}

    // Đánh dấu sản phẩm đã xóa; false có nghĩa ID không còn sản phẩm đang hoạt động.
    async execute(id: string): Promise<void> {
        const wasDeleted = await this.productWriteRepository.softDelete(id);

        if (!wasDeleted) {
            throw new ProductNotFoundError();
        }
    }
}
