import { Inject, Injectable } from '@nestjs/common';
import {
    ORDER_PROCESSING_REPOSITORY,
    type OrderProcessingRepository,
} from '@/modules/orders/application/contracts/order-processing-repository';

@Injectable()
export class ProcessOrderService {
    constructor(
        @Inject(ORDER_PROCESSING_REPOSITORY)
        private readonly repository: OrderProcessingRepository,
    ) {}

    // Đưa đơn sang trạng thái thành công; repository tự bỏ qua đơn đã kết thúc để job lặp không ghi trùng.
    async confirm(orderId: string): Promise<void> {
        await this.repository.confirmPendingOrder(orderId);
    }

    // Chốt thất bại sau lần thử cuối; việc đổi trạng thái, hoàn kho và ghi log phải nguyên tử.
    async fail(orderId: string, failureReason: string): Promise<void> {
        await this.repository.failPendingOrder(orderId, failureReason);
    }
}
