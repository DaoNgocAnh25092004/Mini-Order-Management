import { Inject, Injectable } from '@nestjs/common';
import type {
    CreatedOrder,
    CreateOrderInput,
    OrderWriteRepository,
} from '@/modules/orders/application/contracts/order-write-repository';
import { ORDER_WRITE_REPOSITORY } from '@/modules/orders/application/contracts/order-write-repository';
import { InvalidOrderError } from '@/modules/orders/application/errors/invalid-order.error';

// Giới hạn cột integer của PostgreSQL; tổng quantity vượt giới hạn này sẽ gây lỗi tràn số.
const MAX_POSTGRES_INTEGER = 2_147_483_647;

@Injectable()
export class CreateOrderService {
    constructor(
        @Inject(ORDER_WRITE_REPOSITORY)
        private readonly orderWriteRepository: OrderWriteRepository,
    ) {}

    // Tạo đơn hàng mới, gộp các dòng trùng productId và validate tổng quantity.
    async execute(input: CreateOrderInput): Promise<CreatedOrder> {
        // Map productId → tổng quantity để gộp các dòng trùng.
        const quantitiesByProduct = new Map<string, number>();

        for (const item of input.items) {
            const totalQuantity =
                (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity;

            // Mỗi dòng riêng lẻ có thể hợp lệ nhưng tổng các dòng trùng vẫn có thể tràn cột integer.
            if (totalQuantity > MAX_POSTGRES_INTEGER) {
                throw new InvalidOrderError(
                    `Tổng số lượng sản phẩm ${item.productId} vượt giới hạn cho phép.`,
                );
            }

            quantitiesByProduct.set(item.productId, totalQuantity);
        }

        // Tạo input đã chuẩn hóa cho tạo đơn, gộp các dòng trùng productId.
        const normalizedInput: CreateOrderInput = {
            ...input,
            items: Array.from(quantitiesByProduct, ([productId, quantity]) => ({
                productId,
                quantity,
            })),
        };

        return this.orderWriteRepository.create(normalizedInput);
    }
}
