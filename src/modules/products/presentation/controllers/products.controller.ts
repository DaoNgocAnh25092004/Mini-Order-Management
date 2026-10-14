import { Controller, Get, Query } from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import type { ProductListPage } from '@/modules/products/application/contracts/product-read-repository';
import { GetProductsService } from '@/modules/products/application/services/get-products.service';
import { GetProductsQueryDto } from '@/modules/products/presentation/dto/get-products-query.dto';

// Tiếp nhận và mô tả HTTP contract cho API đọc danh sách sản phẩm.
@ApiTags('Products')
@Controller('products')
export class ProductsController {
    constructor(private readonly getProductsService: GetProductsService) {}

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
    // Chuyển query đã qua ValidationPipe cho use case; lỗi đầu vào bị chặn trước bước này.
    getProducts(@Query() query: GetProductsQueryDto): Promise<ProductListPage> {
        return this.getProductsService.execute(query);
    }
}
