import {
    Body,
    ConflictException,
    Controller,
    Get,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import type {
    ProductListItem,
    ProductListPage,
} from '@/modules/products/application/contracts/product-read-repository';
import { ProductSkuConflictError } from '@/modules/products/application/errors/product-sku-conflict.error';
import { CreateProductService } from '@/modules/products/application/services/create-product.service';
import { GetProductByIdService } from '@/modules/products/application/services/get-product-by-id.service';
import { GetProductsService } from '@/modules/products/application/services/get-products.service';
import { ProductNotFoundError } from '@/modules/products/application/errors/product-not-found.error';
import { CreateProductDto } from '@/modules/products/presentation/dto/create-product.dto';
import { GetProductsQueryDto } from '@/modules/products/presentation/dto/get-products-query.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
    // Nhận các use case độc lập để đọc danh sách, đọc chi tiết và tạo sản phẩm.
    constructor(
        private readonly getProductsService: GetProductsService,
        private readonly getProductByIdService: GetProductByIdService,
        private readonly createProductService: CreateProductService,
    ) {}

    @Get(':id')
    @ApiOperation({ summary: 'Lấy thông tin một sản phẩm theo ID' })
    @ApiParam({
        name: 'id',
        format: 'uuid',
        example: '124f6fd1-9de3-4ad7-9408-729fccfe0fa0',
    })
    @ApiOkResponse({ description: 'Thông tin sản phẩm.' })
    @ApiBadRequestResponse({ description: 'ID phải có định dạng UUID hợp lệ.' })
    @ApiNotFoundResponse({ description: 'Không tìm thấy sản phẩm.' })
    // Kiểm tra UUID trước khi truy vấn và đổi lỗi ứng dụng thành HTTP 404.
    async getProductById(
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<ProductListItem> {
        try {
            return await this.getProductByIdService.execute(id);
        } catch (error: unknown) {
            if (error instanceof ProductNotFoundError) {
                throw new NotFoundException(error.message);
            }

            throw error;
        }
    }

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
