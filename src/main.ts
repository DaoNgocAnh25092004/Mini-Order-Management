// Đăng ký alias tường minh trước các import Nest vì Vercel không đóng gói tsconfig.json.
require('tsconfig-paths').register({
    baseUrl: process.cwd(),
    paths: {
        '@/*': ['src/*'],
    },
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Entry point HTTP chuẩn để Vercel nhận diện NestJS và khởi tạo API.
// Bootstrap này cũng được dùng lại qua đường dẫn tương thích với Nest CLI và Docker.
async function bootstrap() {
    // Nạp động sau khi đăng ký alias để Vercel không resolve cây module quá sớm.
    const { AppModule } =
        require('./bootstrap/api/app.module') as typeof import('./bootstrap/api/app.module');

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

    // Lắng nghe cổng từ nền tảng deploy hoặc mặc định 3001 cho môi trường local.
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
