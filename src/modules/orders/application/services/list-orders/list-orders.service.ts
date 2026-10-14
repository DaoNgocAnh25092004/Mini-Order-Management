// Use case liệt kê đơn; chỉ chuyển query đã hợp lệ qua read port, không chứa logic TypeORM.
import { Inject, Injectable } from '@nestjs/common';
import type {
    OrderListPage,
    OrderListQuery,
    OrderReadRepository,
} from '@/modules/orders/application/contracts/order-read-repository';
import { ORDER_READ_REPOSITORY } from '@/modules/orders/application/contracts/order-read-repository';

@Injectable()
export class ListOrdersService {
    // Inject read port để use case không phụ thuộc adapter database cụ thể.
    constructor(
        @Inject(ORDER_READ_REPOSITORY)
        private readonly orderReadRepository: OrderReadRepository,
    ) {}

    // Trả trang đơn theo page/limit/status; DTO đã chặn query sai trước khi service được gọi.
    execute(query: OrderListQuery): Promise<OrderListPage> {
        return this.orderReadRepository.list(query);
    }
}
