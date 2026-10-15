// Chuyển REDIS_URL thành cấu hình ioredis cho BullMQ, hỗ trợ redis:// và rediss://.
export function getRedisConnectionOptions() {
    const redisUrl = process.env.REDIS_URL;

    // Kiểm tra REDIS_URL có tồn tại và hợp lệ, nếu không thì ném lỗi ngay lúc khởi động.
    if (!redisUrl) {
        throw new Error(
            'REDIS_URL must be configured to enable order processing',
        );
    }

    const parsedUrl = new URL(redisUrl);

    // Chỉ chấp nhận hai scheme Redis chuẩn; rediss bật TLS cho kết nối Redis mã hóa.
    if (parsedUrl.protocol !== 'redis:' && parsedUrl.protocol !== 'rediss:') {
        throw new Error(
            'REDIS_URL must use the redis:// or rediss:// protocol',
        );
    }

    const databasePath = parsedUrl.pathname.replace(/^\//, '');
    const database = databasePath ? Number(databasePath) : 0;
    const port = parsedUrl.port ? Number(parsedUrl.port) : 6379;

    // Từ chối port/database sai ngay lúc khởi động thay vì để lỗi khó hiểu lúc enqueue.
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('REDIS_URL contains an invalid port');
    }

    // Database Redis phải là số nguyên không âm
    if (!Number.isInteger(database) || database < 0) {
        throw new Error('REDIS_URL contains an invalid database number');
    }

    // Trả về cấu hình ioredis cho BullMQ, giải mã username/password nếu có.
    return {
        host: parsedUrl.hostname,
        port,
        username: parsedUrl.username
            ? decodeURIComponent(parsedUrl.username)
            : undefined,
        password: parsedUrl.password
            ? decodeURIComponent(parsedUrl.password)
            : undefined,
        db: database,
        ...(parsedUrl.protocol === 'rediss:' ? { tls: {} } : {}),
    };
}
