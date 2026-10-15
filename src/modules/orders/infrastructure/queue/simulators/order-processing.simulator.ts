import { Injectable } from '@nestjs/common';

// Mô phỏng công việc nền mất 3–5 giây và phát sinh lỗi ngẫu nhiên khoảng 30% để kiểm tra retry.
@Injectable()
export class OrderProcessingSimulator {
    // Chờ thời gian ngẫu nhiên trong khoảng yêu cầu rồi mới quyết định lần xử lý này thành công hay lỗi.
    async run(): Promise<void> {
        // Thời gian xử lý giả lập: 3–5 giây; dùng Math.random() để mô phỏng độ trễ ngẫu nhiên.
        const processingTimeMs = 3000 + Math.floor(Math.random() * 2001);

        await new Promise<void>((resolve) => {
            setTimeout(resolve, processingTimeMs);
        });

        // Lỗi được ném ra để BullMQ kích hoạt backoff; chỉ lần thử cuối mới chuyển đơn sang FAILED.
        if (Math.random() < 0.3) {
            throw new Error('Lỗi xử lý đơn hàng giả lập.');
        }
    }
}
