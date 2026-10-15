import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    ParseUUIDPipe,
    Patch,
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
    OrderDetail,
    OrderListPage,
} from '@/modules/orders/application/contracts/order-read-repository';
import type { CreatedOrder } from '@/modules/orders/application/contracts/order-write-repository';
import { OrderStatus } from '@/database/enums/order-status.enum';
import { CancelOrderService } from '@/modules/orders/application/services/cancel-order/cancel-order.service';
import { InsufficientStockError } from '@/modules/orders/application/errors/insufficient-stock.error';
import { InvalidOrderError } from '@/modules/orders/application/errors/invalid-order.error';
import { OrderCancellationNotAllowedError } from '@/modules/orders/application/errors/order-cancellation-not-allowed.error';
import { OrderNotFoundError } from '@/modules/orders/application/errors/order-not-found.error';
import { OrderProductNotFoundError } from '@/modules/orders/application/errors/order-product-not-found.error';
import { CreateOrderService } from '@/modules/orders/application/services/create-order/create-order.service';
import { GetOrderByIdService } from '@/modules/orders/application/services/get-order-by-id/get-order-by-id.service';
import { ListOrdersService } from '@/modules/orders/application/services/list-orders/list-orders.service';
import { CreateOrderDto } from '@/modules/orders/presentation/dto/create-order.dto';
import { GetOrdersQueryDto } from '@/modules/orders/presentation/dto/get-orders-query.dto';
import { GetOrderJobStatusService } from '@/modules/orders/application/services/get-order-job-status/get-order-job-status.service';
import { OrderProcessingJobNotFoundError } from '@/modules/orders/application/errors/order-processing-job-not-found.error';
import { OrderJobStatusDto } from '@/modules/orders/presentation/dto/order-job-status.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
    // Controller chỉ chuyển DTO vào use case và ánh xạ lỗi đã biết sang HTTP status.
    constructor(
        private readonly createOrderService: CreateOrderService,
        private readonly getOrderByIdService: GetOrderByIdService,
        private readonly listOrdersService: ListOrdersService,
        private readonly cancelOrderService: CancelOrderService,
        private readonly getOrderJobStatusService: GetOrderJobStatusService,
    ) {}

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

    // Tìm danh sách đơn hàng có phân trang và lọc trạng thái
    @Get()
    @ApiOperation({
        summary: 'Lấy danh sách đơn hàng có phân trang và lọc trạng thái',
    })
    @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
    @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
    @ApiQuery({
        name: 'status',
        required: false,
        enum: OrderStatus,
        enumName: 'OrderStatus',
    })
    @ApiOkResponse({
        description: 'Danh sách đơn hàng và metadata phân trang.',
    })
    @ApiBadRequestResponse({
        description: 'Page, limit hoặc status không hợp lệ.',
    })
    getOrders(@Query() query: GetOrdersQueryDto): Promise<OrderListPage> {
        return this.listOrdersService.execute(query);
    }

    // Hủy đơn hàng và hoàn lại tồn kho
    @Patch(':id/cancel')
    @ApiOperation({
        summary: 'Hủy đơn hàng và hoàn lại tồn kho',
    })
    @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid' })
    @ApiOkResponse({ description: 'Đơn hàng đã hủy và được hoàn tồn kho.' })
    @ApiBadRequestResponse({
        description: 'ID đơn hàng không đúng định dạng UUID.',
    })
    @ApiNotFoundResponse({ description: 'Không tìm thấy đơn hàng.' })
    @ApiConflictResponse({
        description: 'Đơn hàng không ở trạng thái có thể hủy.',
    })
    async cancelOrder(
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<OrderDetail> {
        try {
            return await this.cancelOrderService.execute(id);
        } catch (error: unknown) {
            // Không tìm thấy đơn hàng → 404 Not Found.
            if (error instanceof OrderNotFoundError) {
                throw new NotFoundException(error.message);
            }

            // Đơn hàng không ở trạng thái có thể hủy → 409 Conflict.
            if (error instanceof OrderCancellationNotAllowedError) {
                throw new ConflictException(error.message);
            }

            throw error;
        }
    }

    // Tra trạng thái job BullMQ của đơn, gồm trạng thái, số lượt chạy và lý do lỗi gần nhất.
    @Get(':id/jobs')
    @ApiOperation({ summary: 'Lấy trạng thái job xử lý đơn hàng' })
    @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid' })
    @ApiOkResponse({
        description: 'Trạng thái và thông tin retry của job xử lý đơn.',
        type: OrderJobStatusDto,
    })
    @ApiBadRequestResponse({
        description: 'ID đơn hàng không đúng định dạng UUID.',
    })
    @ApiNotFoundResponse({
        description: 'Không tìm thấy job xử lý cho đơn hàng này.',
    })
    async getOrderJobStatus(
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<OrderJobStatusDto> {
        try {
            return await this.getOrderJobStatusService.execute(id);
        } catch (error: unknown) {
            // Job không còn trong queue thì trả 404
            if (error instanceof OrderProcessingJobNotFoundError) {
                throw new NotFoundException(error.message);
            }

            throw error;
        }
    }

    // Tìm đơn hàng theo ID
    @Get(':id')
    @ApiOperation({ summary: 'Lấy chi tiết đơn hàng kèm các sản phẩm' })
    @ApiParam({ name: 'id', description: 'UUID của đơn hàng', format: 'uuid' })
    @ApiOkResponse({ description: 'Chi tiết đơn hàng và danh sách sản phẩm.' })
    @ApiBadRequestResponse({
        description: 'ID đơn hàng không đúng định dạng UUID.',
    })
    @ApiNotFoundResponse({ description: 'Không tìm thấy đơn hàng.' })
    async getOrderById(
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<OrderDetail> {
        try {
            return await this.getOrderByIdService.execute(id);
        } catch (error: unknown) {
            // Không tìm thấy đơn hàng → 404 Not Found.
            if (error instanceof OrderNotFoundError) {
                throw new NotFoundException(error.message);
            }

            throw error;
        }
    }
}
