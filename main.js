// Import tĩnh để Vercel đóng gói các peer dependency mà TypeORM chỉ nạp động.
require('@nestjs/core');
require('pg');

const { createApiApp } = require('./dist/bootstrap/api/create-api-app.js');
const swaggerAssetManifest = require('./dist/bootstrap/api/swagger-assets.json');
const swaggerAssetContentTypes = {
    'favicon-16x16.png': 'image/png',
    'favicon-32x32.png': 'image/png',
    'oauth2-redirect.html': 'text/html; charset=utf-8',
    'oauth2-redirect.js': 'application/javascript; charset=utf-8',
    'swagger-ui-bundle.js': 'application/javascript; charset=utf-8',
    'swagger-ui-standalone-preset.js': 'application/javascript; charset=utf-8',
    'swagger-ui.css': 'text/css; charset=utf-8',
};

let handlerPromise;

// Phục vụ file Swagger thiếu trong bundle trước khi Nest đăng ký các route API.
function serveBundledSwaggerAsset(request, response, next) {
    const assetName = request.path.slice(1);
    const assetContent = swaggerAssetManifest[assetName];
    const contentType = swaggerAssetContentTypes[assetName];

    // Chỉ trả các tên asset được allowlist; URL lạ tiếp tục qua router Nest bình thường.
    if (!assetContent || !contentType) {
        return next();
    }

    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'public, max-age=300');
    return response.send(Buffer.from(assetContent, 'base64'));
}

// Khởi tạo Nest trước khi đăng ký middleware fallback và cache app cho request kế tiếp.
async function createExpressHandler() {
    const app = await createApiApp();
    const expressApp = app.getHttpAdapter().getInstance();

    // SwaggerModule đã gắn static middleware; fallback này trả asset từ manifest nếu file bị lược khỏi function.
    expressApp.use('/api/docs', serveBundledSwaggerAsset);
    await app.init();

    return expressApp;
}

// Khởi tạo Nest một lần cho instance serverless và chuyển từng request vào Express.
module.exports = async function handler(request, response) {
    // Tái sử dụng app đã khởi tạo giữa các request trên instance còn ấm.
    if (!handlerPromise) {
        handlerPromise = createExpressHandler().catch((error) => {
            // Cho phép lần gọi sau thử khởi tạo lại nếu DB hoặc dịch vụ phụ trợ tạm lỗi.
            handlerPromise = undefined;
            throw error;
        });
    }

    const expressHandler = await handlerPromise;
    return expressHandler(request, response);
};
