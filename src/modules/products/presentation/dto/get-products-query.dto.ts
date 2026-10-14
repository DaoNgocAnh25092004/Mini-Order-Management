import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    Validate,
    ValidationArguments,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { ProductListQuery } from '@/modules/products/application/contracts/product-read-repository';

// Chuẩn hóa query số; chuỗi rỗng thành NaN để validator từ chối thay vì đổi thành 0.
function transformNonEmptyNumber({ value }: TransformFnParams): unknown {
    if (typeof value !== 'string') {
        return value;
    }

    const normalizedValue = value.trim();
    return normalizedValue === '' ? Number.NaN : Number(normalizedValue);
}

// Bỏ khoảng trắng hai đầu để tìm kiếm nhất quán và không đưa chuỗi rỗng vào SQL.
function normalizeSearch({ value }: TransformFnParams): unknown {
    return typeof value === 'string' ? value.trim() : value;
}

// Chặn khoảng giá ngược ngay ở DTO để client nhận 400 thay vì trang rỗng khó hiểu.
@ValidatorConstraint({ name: 'validPriceRange', async: false })
class ValidPriceRangeConstraint implements ValidatorConstraintInterface {
    // Chỉ so sánh khi cả hai đầu mút có mặt; mỗi đầu mút vẫn được validator riêng kiểm tra.
    validate(maxPrice: unknown, args: ValidationArguments): boolean {
        const query = args.object as GetProductsQueryDto;

        return (
            query.minPrice === undefined ||
            maxPrice === undefined ||
            query.minPrice <= (maxPrice as number)
        );
    }

    // Trả thông báo cụ thể để người dùng biết cần sửa cặp bộ lọc nào.
    defaultMessage(): string {
        return 'minPrice phải nhỏ hơn hoặc bằng maxPrice';
    }
}

// DTO ép kiểu query string và giới hạn kích thước trang trước khi controller chạy.
export class GetProductsQueryDto implements ProductListQuery {
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

    @ApiPropertyOptional({
        maxLength: 200,
        description: 'Tìm theo tên sản phẩm',
    })
    @Transform(normalizeSearch)
    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string;

    @ApiPropertyOptional({ minimum: 0, maximum: 9_999_999_999.99 })
    @Transform(transformNonEmptyNumber)
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
    @Min(0)
    @Max(9_999_999_999.99)
    minPrice?: number;

    @ApiPropertyOptional({ minimum: 0, maximum: 9_999_999_999.99 })
    @Transform(transformNonEmptyNumber)
    @IsOptional()
    @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
    @Min(0)
    @Max(9_999_999_999.99)
    @Validate(ValidPriceRangeConstraint)
    maxPrice?: number;
}
