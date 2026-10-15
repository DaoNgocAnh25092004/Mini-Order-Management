import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Cấu hình Nest HTTP app một lần để bootstrap thường và Vercel dùng chung hành vi.
export async function createApiApp() {
    const app = await NestFactory.create(AppModule);

    // Đăng ký lifecycle hooks và tiền tố để giữ nguyên hợp đồng endpoint hiện tại.
    app.enableShutdownHooks();
    app.setGlobalPrefix('api');

    // Chuyển query/body sang DTO và từ chối thuộc tính ngoài hợp đồng đầu vào.
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Cung cấp tài liệu API tại cùng đường dẫn ở cả local lẫn production.
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Products API')
        .setDescription('API quản lý sản phẩm')
        .setVersion('1.0')
        .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);

    return app;
}
