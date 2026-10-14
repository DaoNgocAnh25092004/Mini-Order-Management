import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsInt,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

// Cắt khoảng trắng hai đầu trước khi kiểm tra và lưu SKU/tên sản phẩm.
function trimString({ value }: TransformFnParams): unknown {
    return typeof value === 'string' ? value.trim() : value;
}

// Giữ giá dạng chuỗi thập phân để PostgreSQL numeric không mất độ chính xác.
function normalizePrice({ value }: TransformFnParams): unknown {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(value) : value;
    }

    return typeof value === 'string' ? value.trim() : value;
}

// Chuỗi tồn kho rỗng thành NaN để validator từ chối thay vì âm thầm đổi thành 0.
// Có nghĩa là nếu người dùng gửi chuỗi rỗng, validator sẽ báo lỗi thay vì tự động chuyển thành 0.
function normalizeStock({ value }: TransformFnParams): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const normalizedValue = value.trim();
    return normalizedValue === '' ? Number.NaN : Number(normalizedValue);
}

// DTO xác thực mọi field trước khi tạo sản phẩm; các giới hạn khớp kiểu cột PostgreSQL.
export class CreateProductDto {
    @ApiProperty({ example: 'SKU-1001', minLength: 1, maxLength: 64 })
    @Transform(trimString)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    @Matches(/\S/, { message: 'sku không được để trống.' })
    sku!: string;

    @ApiProperty({ example: 'Wireless Keyboard', minLength: 1, maxLength: 200 })
    @Transform(trimString)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    @Matches(/\S/, { message: 'name không được để trống.' })
    name!: string;

    @ApiProperty({
        type: Number,
        example: 499.99,
        minimum: 0,
        maximum: 9_999_999_999.99,
        description: 'Giá không âm, tối đa hai chữ số thập phân.',
    })
    @Transform(normalizePrice)
    @IsString()
    @Matches(/^\d{1,10}(?:\.\d{1,2})?$/, {
        message:
            'price phải từ 0 đến 9999999999.99 và có tối đa 2 số thập phân.',
    })
    price!: string;

    @ApiProperty({ example: 25, minimum: 0, maximum: 2_147_483_647 })
    @Transform(normalizeStock)
    @IsInt()
    @Min(0)
    @Max(2_147_483_647)
    stock!: number;
}
