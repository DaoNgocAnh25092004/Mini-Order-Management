import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

// Expose liveness của tiến trình để kiểm tra API mà không phụ thuộc trạng thái PostgreSQL.
@ApiTags('Health')
@Controller('health')
export class HealthController {
    @Get()
    @ApiOperation({ summary: 'Kiểm tra ứng dụng đang hoạt động' })
    @ApiOkResponse({ description: 'Tiến trình API đang hoạt động.' })
    // Trả metadata nhẹ để monitor xác nhận process còn nhận request và biết thời gian chạy.
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
        };
    }
}
