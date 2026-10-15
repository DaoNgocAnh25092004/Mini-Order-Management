// Import tĩnh để Vercel đóng gói các peer dependency mà TypeORM chỉ nạp động.
require('@nestjs/core');
require('pg');

const { createApiApp } = require('./dist/bootstrap/api/create-api-app.js');

let handlerPromise;

// Khởi tạo Nest một lần cho instance serverless và chuyển từng request vào Express.
module.exports = async function handler(request, response) {
    // Tái sử dụng app đã khởi tạo giữa các request trên instance còn ấm.
    if (!handlerPromise) {
        handlerPromise = createApiApp()
            .then(async (app) => {
                await app.init();
                return app.getHttpAdapter().getInstance();
            })
            .catch((error) => {
                // Cho phép lần gọi sau thử khởi tạo lại nếu DB hoặc dịch vụ phụ trợ tạm lỗi.
                handlerPromise = undefined;
                throw error;
            });
    }

    const expressHandler = await handlerPromise;
    return expressHandler(request, response);
};
