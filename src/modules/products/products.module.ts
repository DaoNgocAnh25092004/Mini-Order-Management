// Module sở hữu toàn bộ DI graph HTTP, application và persistence của Products.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from '@/database/entities/product.entity';
import { PRODUCT_READ_REPOSITORY } from '@/modules/products/application/contracts/product-read-repository';
import { PRODUCT_WRITE_REPOSITORY } from '@/modules/products/application/contracts/product-write-repository';
import { CreateProductService } from '@/modules/products/application/services/create-product.service';
import { DeleteProductService } from '@/modules/products/application/services/delete-product.service';
import { GetProductByIdService } from '@/modules/products/application/services/get-product-by-id.service';
import { GetProductsService } from '@/modules/products/application/services/get-products.service';
import { UpdateProductService } from '@/modules/products/application/services/update-product.service';
import { ProductsController } from '@/modules/products/presentation/controllers/products.controller';
import { TypeOrmProductReadRepository } from '@/modules/products/infrastructure/repositories/typeorm-product-read.repository';
import { TypeOrmProductWriteRepository } from '@/modules/products/infrastructure/repositories/typeorm-product-write.repository';

// Đăng ký các use case và adapter để controller chỉ cần inject các contract của feature.
@Module({
    imports: [TypeOrmModule.forFeature([ProductEntity])],
    controllers: [ProductsController],
    providers: [
        GetProductsService,
        GetProductByIdService,
        CreateProductService,
        UpdateProductService,
        DeleteProductService,
        TypeOrmProductReadRepository,
        TypeOrmProductWriteRepository,
        {
            provide: PRODUCT_READ_REPOSITORY,
            useExisting: TypeOrmProductReadRepository,
        },
        {
            provide: PRODUCT_WRITE_REPOSITORY,
            useExisting: TypeOrmProductWriteRepository,
        },
    ],
})
export class ProductsModule {}
