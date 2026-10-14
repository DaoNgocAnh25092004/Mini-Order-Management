import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '@/database/enums/order-status.enum';
import type { OrderListQuery } from '@/modules/orders/application/contracts/order-read-repository';

// Mặc định trả trang đầu 10 đơn; giới hạn page/limit để chặn truy vấn quá lớn.
export class GetOrdersQueryDto implements OrderListQuery {
    @ApiPropertyOptional({ minimum: 1, maximum: 1_000_000, default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(1_000_000)
    page = 1;

    @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit = 10;

    @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
    @IsOptional()
    @IsEnum(OrderStatus)
    status?: OrderStatus;
}
