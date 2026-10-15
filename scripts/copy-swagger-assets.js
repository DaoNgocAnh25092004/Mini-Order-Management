// Đóng gói asset Swagger thành manifest để Vercel đưa chúng vào function Node.
// Thư mục public không được triển khai thành static riêng trong Nest single-function.
const fs = require('node:fs');
const path = require('node:path');

const swaggerAssetsDirectory = path.resolve(
    __dirname,
    '../public/swagger-ui-assets',
);
const apiOutputDirectory = path.resolve(__dirname, '../dist/bootstrap/api');
const manifestPath = path.join(apiOutputDirectory, 'swagger-assets.json');
const swaggerAssetFiles = [
    'favicon-16x16.png',
    'favicon-32x32.png',
    'oauth2-redirect.html',
    'oauth2-redirect.js',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
    'swagger-ui.css',
];

// Đưa nội dung base64 vào JSON mà main.js require tĩnh, để Vercel truy vết asset trong function.
function writeSwaggerAssetManifest() {
    const manifest = {};

    for (const fileName of swaggerAssetFiles) {
        const sourcePath = path.join(swaggerAssetsDirectory, fileName);
        manifest[fileName] = fs.readFileSync(sourcePath).toString('base64');
    }

    fs.mkdirSync(apiOutputDirectory, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
}

writeSwaggerAssetManifest();
