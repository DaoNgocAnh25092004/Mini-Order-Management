// Tính mốc hết hạn 30 phút và yêu cầu repository hủy/hoàn kho các đơn đã quá mốc.
import { Inject, Injectable } from '@nestjs/common';
import {
    ORDER_PROCESSING_REPOSITORY,
    type OrderProcessingRepository,
} from '@/modules/orders/application/contracts/order-processing-repository';

const PENDING_ORDER_EXPIRATION_AGE_MS = 30 * 60 * 1000; // 30 phút

@Injectable()
export class ExpirePendingOrdersService {
    constructor(
        @Inject(ORDER_PROCESSING_REPOSITORY)
        private readonly repository: OrderProcessingRepository,
    ) {}

    // Mỗi lượt scheduler chỉ gửi cutoff; repository xử lý điều kiện trạng thái và transaction hoàn kho.
    async execute(): Promise<number> {
        const expiredBefore = new Date(
            Date.now() - PENDING_ORDER_EXPIRATION_AGE_MS,
        );

        return this.repository.expireOverduePendingOrders(expiredBefore);
    }
}
