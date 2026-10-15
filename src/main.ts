import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/app.module';

// Khởi tạo API, validation và Swagger; chỉ báo sẵn sàng sau khi cổng lắng nghe thành công.
async function bootstrap() {
    // Tạo NestJS app từ module gốc.
    const app = await NestFactory.create(AppModule);

    // Cho phép Nest gọi lifecycle hook để đóng queue/Redis khi process nhận SIGINT hoặc SIGTERM.
    app.enableShutdownHooks();

    // Chuẩn hóa toàn bộ endpoint HTTP dưới /api để URL công khai có một tiền tố nhất quán.
    app.setGlobalPrefix('api');

    // Transform query string sang kiểu DTO; từ chối field ngoài whitelist để tránh input thừa.
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Cấu hình Swagger để có thể test API trực tiếp từ trình duyệt.
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Products API')
        .setDescription('API quản lý sản phẩm')
        .setVersion('1.0')
        .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);

    // Lắng nghe cổng từ biến môi trường hoặc mặc định 3001; log trạng thái và URL truy cập.
    const port = process.env.PORT ?? 3001;
    const environment = process.env.NODE_ENV ?? 'development';
    await app.listen(port);

    // Dùng URL thực tế sau khi listen thành công để thông tin truy cập khớp cấu hình runtime.
    const appUrl = await app.getUrl();

    // API_URL cho phép cấu hình địa chỉ công khai khác URL bind nội bộ, nhất là khi deploy.
    const apiBaseUrl = (process.env.API_URL ?? `${appUrl}/api`).replace(
        /\/+$/,
        '',
    );

    // Gom trạng thái và các đường dẫn vào một khung để dễ nhận ra giữa log khởi động của Nest.
    console.log(`
╭─ PRODUCTS API ──────────────────────────────────────────
│  STATUS       RUNNING
│  ENVIRONMENT  ${environment.toUpperCase()}
│  API          ${apiBaseUrl}
│  SWAGGER      ${apiBaseUrl}/docs
│  HEALTH       ${apiBaseUrl}/health
│  PORT         ${port}
╰─────────────────────────────────────────────────────────

`);
}

void bootstrap();
