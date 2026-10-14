// Điều phối use case đọc chi tiết đơn qua application port, không chứa truy vấn TypeORM.
import { Inject, Injectable } from '@nestjs/common';
import type {
    OrderDetail,
    OrderReadRepository,
} from '@/modules/orders/application/contracts/order-read-repository';
import { ORDER_READ_REPOSITORY } from '@/modules/orders/application/contracts/order-read-repository';
import { OrderNotFoundError } from '@/modules/orders/application/errors/order-not-found.error';

@Injectable()
export class GetOrderByIdService {
    // Inject read port để use case không phụ thuộc adapter lưu trữ cụ thể.
    constructor(
        @Inject(ORDER_READ_REPOSITORY)
        private readonly orderReadRepository: OrderReadRepository,
    ) {}

    // Trả chi tiết đơn kèm snapshot item; nếu repository không tìm thấy thì phát lỗi ứng dụng để controller trả 404.
    async execute(id: string): Promise<OrderDetail> {
        const order = await this.orderReadRepository.findById(id);

        if (!order) {
            throw new OrderNotFoundError(id);
        }

        return order;
    }
}
