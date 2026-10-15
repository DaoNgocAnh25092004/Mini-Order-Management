# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-bookworm-slim

# Dùng cùng một phiên bản Node.js cho các stage để tránh khác biệt giữa lúc build và chạy.
FROM node:${NODE_VERSION} AS build

WORKDIR /app

# Chép riêng package manifests trước để Docker có thể dùng lại layer cài dependency
# khi chỉ mã nguồn thay đổi, không phải cài lại toàn bộ package.
COPY package.json package-lock.json ./
# Cài đúng phiên bản trong lockfile, bao gồm TypeScript và các công cụ cần để build.
RUN npm ci --no-audit --no-fund

# Chép mã nguồn rồi biên dịch ứng dụng NestJS thành JavaScript trong thư mục dist/.
COPY . .
RUN npm run build

# Stage riêng chỉ cài dependency cần lúc chạy; nhờ vậy image cuối không mang theo
# compiler, test runner và các package chỉ phục vụ phát triển.
FROM node:${NODE_VERSION} AS production-dependencies

WORKDIR /app

# Dùng lockfile để cài phiên bản nhất quán, đồng thời bỏ các package development.
COPY package.json package-lock.json ./
# Xóa cache npm sau khi cài để không giữ dữ liệu tải xuống không cần thiết.
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Image chạy thật chỉ lấy mã đã biên dịch và dependency production từ hai stage trên.
# Không chép mã nguồn hay công cụ build vào image cuối.
FROM node:${NODE_VERSION} AS runtime

# Bật chế độ production để các thư viện và ứng dụng dùng cấu hình phù hợp môi trường thật.
ENV NODE_ENV=production
WORKDIR /app

# Gán quyền sở hữu cho user node để ứng dụng có thể đọc các file mà không cần chạy bằng root.
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

# Chạy với quyền hạn thấp hơn root để giảm rủi ro nếu ứng dụng bị khai thác.
USER node

# Ghi nhận cổng ứng dụng lắng nghe bên trong container; Docker Compose sẽ ánh xạ ra máy host.
EXPOSE 3001

# Khởi chạy entry point JavaScript đã được biên dịch; không chạy trực tiếp file TypeScript.
CMD ["node", "dist/main.js"]
