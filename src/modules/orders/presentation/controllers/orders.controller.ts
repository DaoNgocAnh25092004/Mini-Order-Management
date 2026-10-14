// HTTP boundary cho POST /orders; DTO xác thực input và lỗi nghiệp vụ thành status REST.
import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Post,
} from '@nestjs/common';
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import type { CreatedOrder } from '@/modules/orders/application/contracts/order-write-repository';
import { InsufficientStockError } from '@/modules/orders/application/errors/insufficient-stock.error';
import { InvalidOrderError } from '@/modules/orders/application/errors/invalid-order.error';
import { OrderProductNotFoundError } from '@/modules/orders/application/errors/order-product-not-found.error';
import { CreateOrderService } from '@/modules/orders/application/services/create-order.service';
import { CreateOrderDto } from '@/modules/orders/presentation/dto/create-order.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
    // Controller chỉ chuyển DTO vào use case và ánh xạ lỗi đã biết sang HTTP status.
    constructor(private readonly createOrderService: CreateOrderService) {}

    // Tạo đơn hàng mới
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Tạo đơn hàng và trừ tồn kho nguyên tử' })
    @ApiCreatedResponse({ description: 'Đơn hàng được tạo thành công.' })
    @ApiBadRequestResponse({ description: 'Body đơn hàng không hợp lệ.' })
    @ApiNotFoundResponse({
        description: 'Sản phẩm không tồn tại hoặc đã ngừng bán.',
    })
    @ApiConflictResponse({ description: 'Sản phẩm không đủ tồn kho.' })
    async createOrder(@Body() body: CreateOrderDto): Promise<CreatedOrder> {
        try {
            return await this.createOrderService.execute(body);
        } catch (error: unknown) {
            // ID sản phẩm không tồn tại hoặc sản phẩm đã bị xóa mềm/ngừng bán → 404 Not Found.
            if (error instanceof OrderProductNotFoundError) {
                throw new NotFoundException(error.message);
            }

            // Sản phẩm có tồn tại nhưng số lượng còn lại không đủ → 409 Conflict.
            if (error instanceof InsufficientStockError) {
                throw new ConflictException(error.message);
            }

            // Dữ liệu đơn vượt giới hạn nghiệp vụ, ví dụ tổng quantity sau khi gộp item trùng vượt kiểu integer → 400 Bad Request.
            if (error instanceof InvalidOrderError) {
                throw new BadRequestException(error.message);
            }

            // Lỗi không thuộc các trường hợp đã dự kiến được chuyển tiếp để Nest xử lý như lỗi server.
            throw error;
        }
    }
}
