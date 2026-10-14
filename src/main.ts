import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Khởi tạo NestJS, tạo ứng dụng từ AppModule và mở cổng theo cấu hình môi trường.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
