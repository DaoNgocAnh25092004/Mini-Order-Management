import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsEmail,
    IsInt,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from 'class-validator';

// Chuẩn hóa khoảng trắng bên ngoài nhưng không biến kiểu dữ liệu sai thành chuỗi hợp lệ.
function trimString({ value }: TransformFnParams): unknown {
    return typeof value === 'string' ? value.trim() : value;
}

// Mỗi dòng chỉ nhận UUID hợp lệ và số lượng nguyên dương vừa với cột integer.
export class CreateOrderItemDto {
    @ApiProperty({
        format: 'uuid',
        example: '124f6fd1-9de3-4ad7-9408-729fccfe0fa0',
    })
    @IsUUID()
    productId!: string;

    @ApiProperty({ example: 2, minimum: 1, maximum: 2_147_483_647 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(2_147_483_647) // PostgreSQL integer limit
    quantity!: number;
}

// DTO đơn hàng giới hạn số dòng để request không thể tạo transaction quá lớn.
export class CreateOrderDto {
    @ApiProperty({ example: 'Nguyễn Văn An', minLength: 1, maxLength: 200 })
    @Transform(trimString)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    @Matches(/\S/, { message: 'customerName không được để trống.' })
    customerName!: string;

    @ApiProperty({ example: 'customer@example.com', maxLength: 254 })
    @Transform(trimString)
    @IsEmail()
    @MaxLength(254)
    customerEmail!: string;

    @ApiProperty({ type: [CreateOrderItemDto], minItems: 1, maxItems: 100 })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => CreateOrderItemDto)
    items!: CreateOrderItemDto[];
}
