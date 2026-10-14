// Use case hủy đơn; transaction đổi trạng thái và hoàn kho do write repository bảo đảm nguyên tử.
import { Inject, Injectable } from '@nestjs/common';
import type { OrderDetail } from '@/modules/orders/application/contracts/order-read-repository';
import { ORDER_WRITE_REPOSITORY } from '@/modules/orders/application/contracts/order-write-repository';
import type { OrderWriteRepository } from '@/modules/orders/application/contracts/order-write-repository';

@Injectable()
export class CancelOrderService {
    // Inject write port để use case không phụ thuộc TypeORM hay transaction implementation cụ thể.
    constructor(
        @Inject(ORDER_WRITE_REPOSITORY)
        private readonly orderWriteRepository: OrderWriteRepository,
    ) {}

    // Yêu cầu repository hủy đơn nguyên tử và trả chi tiết đơn sau khi đã hoàn kho.
    execute(id: string): Promise<OrderDetail> {
        return this.orderWriteRepository.cancelOrder(id);
    }
}
