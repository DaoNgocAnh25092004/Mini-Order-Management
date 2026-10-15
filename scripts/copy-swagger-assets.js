// Sao chép tài nguyên Swagger UI vào public để Vercel CDN phục vụ thay cho express.static.
// Script chỉ đưa các file runtime cần thiết vào bản deploy, không copy source map hay tài liệu gói.
const fs = require('node:fs');
const path = require('node:path');

const swaggerAssetsDirectory = path.resolve(
    __dirname,
    '../node_modules/swagger-ui-dist',
);
const publicDocsDirectory = path.resolve(__dirname, '../public/api/docs');
const swaggerAssetFiles = [
    'favicon-16x16.png',
    'favicon-32x32.png',
    'oauth2-redirect.html',
    'oauth2-redirect.js',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
    'swagger-ui.css',
];

// Đặt các file tại /api/docs để giữ nguyên URL asset mà SwaggerModule sinh ra.
// Thiếu asset nguồn phải làm build dừng, tránh deploy trang docs trắng nhưng build xanh.
function copySwaggerAssets() {
    fs.mkdirSync(publicDocsDirectory, { recursive: true });

    for (const fileName of swaggerAssetFiles) {
        const sourcePath = path.join(swaggerAssetsDirectory, fileName);
        const destinationPath = path.join(publicDocsDirectory, fileName);

        fs.copyFileSync(sourcePath, destinationPath);
    }
}

copySwaggerAssets();
