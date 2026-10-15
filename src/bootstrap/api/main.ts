import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Bootstrap API chung cho Nest CLI, Docker và entrypoint CommonJS của Vercel.
async function bootstrap() {
    // Tạo NestJS app từ module gốc.
    const app = await NestFactory.create(AppModule);

    // Cho phép Nest gọi lifecycle hook để đóng queue/Redis khi process dừng.
    app.enableShutdownHooks();

    // Chuẩn hóa endpoint HTTP dưới /api để URL công khai có một tiền tố nhất quán.
    app.setGlobalPrefix('api');

    // Chuyển query string sang kiểu DTO và từ chối field ngoài whitelist.
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Tạo tài liệu OpenAPI và công khai Swagger UI dưới /api/docs.
    const swaggerConfig = new DocumentBuilder()
        .setTitle('Products API')
        .setDescription('API quản lý sản phẩm')
        .setVersion('1.0')
        .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, swaggerDocument);

    // Dùng PORT do nền tảng cấp; local fallback giữ cổng cũ cho phát triển.
    const port = process.env.PORT ?? 3001;
    const environment = process.env.NODE_ENV ?? 'development';
    await app.listen(port);

    // Dùng URL thực tế sau listen để log khớp bind address và cấu hình công khai.
    const appUrl = await app.getUrl();
    const apiBaseUrl = (process.env.API_URL ?? `${appUrl}/api`).replace(
        /\/+$/,
        '',
    );

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
