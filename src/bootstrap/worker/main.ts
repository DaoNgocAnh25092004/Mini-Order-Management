import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from '@/bootstrap/worker/worker.module';

// Khởi chạy Nest application context để chạy publisher, consumer và scheduler mà không tạo HTTP server.
async function bootstrap(): Promise<void> {
    const app = await NestFactory.createApplicationContext(WorkerAppModule);

    // Cho phép SIGINT/SIGTERM gọi lifecycle hook để publisher dừng polling và kết nối được đóng an toàn.
    app.enableShutdownHooks();

    Logger.log('Order-processing worker is running', 'Worker');
}

// Báo lỗi khởi động ra stderr và đặt mã thoát khác 0 để nền tảng deploy nhận biết worker không chạy được.
void bootstrap().catch((error: unknown) => {
    const logger = new Logger('Worker');
    logger.error(
        'Could not start order-processing worker',
        error instanceof Error ? error.stack : String(error),
    );
    process.exitCode = 1;
});
