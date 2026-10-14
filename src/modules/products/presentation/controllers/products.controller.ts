import {
    Body,
    ConflictException,
    Controller,
    Get,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import type {
    ProductListItem,
    ProductListPage,
} from '@/modules/products/application/contracts/product-read-repository';
import { ProductSkuConflictError } from '@/modules/products/application/errors/product-sku-conflict.error';
import { CreateProductService } from '@/modules/products/application/services/create-product.service';
import { GetProductsService } from '@/modules/products/application/services/get-products.service';
import { CreateProductDto } from '@/modules/products/presentation/dto/create-product.dto';
import { GetProductsQueryDto } from '@/modules/products/presentation/dto/get-products-query.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
    // Nhận hai use case độc lập: đọc danh sách và tạo sản phẩm.
    constructor(
        private readonly getProductsService: GetProductsService,
        private readonly createProductService: CreateProductService,
    ) {}

    // Lấy danh sách sản phẩm có phân trang và bộ lọc
    @Get()
    @ApiOperation({ summary: 'Lấy danh sách sản phẩm có phân trang và bộ lọc' })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'minPrice', required: false, type: Number })
    @ApiQuery({ name: 'maxPrice', required: false, type: Number })
    @ApiOkResponse({ description: 'Danh sách và thông tin phân trang.' })
    @ApiBadRequestResponse({
        description: 'Query không đúng định dạng hoặc giới hạn.',
    })
    getProducts(@Query() query: GetProductsQueryDto): Promise<ProductListPage> {
        return this.getProductsService.execute(query);
    }

    // Tạo sản phẩm mới
    @Post()
    @ApiOperation({ summary: 'Tạo sản phẩm mới' })
    @ApiCreatedResponse({ description: 'Sản phẩm đã được tạo.' })
    @ApiBadRequestResponse({
        description: 'Dữ liệu sản phẩm không đúng định dạng hoặc giới hạn.',
    })
    @ApiConflictResponse({ description: 'SKU đã tồn tại.' })
    // Ánh xạ lỗi SKU trùng thành HTTP 409; lỗi ngoài dự kiến chuyển tới handler chung.
    async createProduct(
        @Body() body: CreateProductDto,
    ): Promise<ProductListItem> {
        try {
            return await this.createProductService.execute(body);
        } catch (error: unknown) {
            if (error instanceof ProductSkuConflictError) {
                throw new ConflictException(error.message);
            }

            throw error;
        }
    }
}
