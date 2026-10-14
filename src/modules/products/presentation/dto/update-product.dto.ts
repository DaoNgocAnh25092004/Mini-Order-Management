import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from '@/modules/products/presentation/dto/create-product.dto';

// Cho phép PATCH từng trường, giữ nguyên validator và từ chối giá trị null.
export class UpdateProductDto extends PartialType(CreateProductDto, {
    skipNullProperties: false, // Không bỏ qua null, để validator từ chối null.
}) {}
