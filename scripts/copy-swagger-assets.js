// Sao chép tài nguyên Swagger UI vào public để Vercel CDN phục vụ thay cho express.static.
// Script chỉ đưa các file runtime cần thiết vào bản deploy, không copy source map hay tài liệu gói.
const fs = require('node:fs');
const path = require('node:path');

const swaggerAssetsDirectory = path.resolve(
    __dirname,
    '../node_modules/swagger-ui-dist',
);
const publicSwaggerAssetsDirectory = path.resolve(
    __dirname,
    '../public/swagger-ui-assets',
);
const swaggerAssetFiles = [
    'favicon-16x16.png',
    'favicon-32x32.png',
    'oauth2-redirect.html',
    'oauth2-redirect.js',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
];

// Đặt asset ở ngoài /api để Vercel không chuyển request tĩnh vào Nest function.
// CSS được giữ riêng vì dự án có theme tùy chỉnh và đã được quản lý trong Git.
function copySwaggerAssets() {
    fs.mkdirSync(publicSwaggerAssetsDirectory, { recursive: true });

    for (const fileName of swaggerAssetFiles) {
        const sourcePath = path.join(swaggerAssetsDirectory, fileName);
        const destinationPath = path.join(
            publicSwaggerAssetsDirectory,
            fileName,
        );

        fs.copyFileSync(sourcePath, destinationPath);
    }
}

copySwaggerAssets();
