import { createApiApp } from './create-api-app';

// Bootstrap API chung cho Nest CLI, Docker và entrypoint CommonJS của Vercel.
async function bootstrap() {
    const app = await createApiApp();

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
