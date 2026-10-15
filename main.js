// Vercel cần thấy NestJS được import trực tiếp để nhận diện framework; ứng dụng chạy từ dist đã build.
require('@nestjs/core');
require('./dist/bootstrap/api/main.js');
