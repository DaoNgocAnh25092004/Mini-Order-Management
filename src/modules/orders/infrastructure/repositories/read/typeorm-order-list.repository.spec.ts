// | STT | Test case                 | Mục đích                          | Các bước làm                              | Kết quả mong đợi                                  |
// |-----|---------------------------|-----------------------------------|-------------------------------------------|--------------------------------------------------|
// | 1   | Lọc và phân trang status  | Đảm bảo query dùng filter và page | Mock query builder; gọi list với PENDING   | Đúng filter, sort, offset, limit và metadata     |
// | 2   | Không truyền status       | Trả mọi trạng thái                | Gọi list không có status; database rỗng    | Không thêm điều kiện status; totalPages bằng 0   |

import type { Repository, SelectQueryBuilder } from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderStatus } from '@/database/enums/order-status.enum';
import type { OrderListQuery } from '@/modules/orders/application/contracts/order-read-repository';
import { TypeOrmOrderReadRepository } from '@/modules/orders/infrastructure/repositories/read/typeorm-order-read.repository';

describe('TypeOrmOrderReadRepository.list', () => {
    let target: TypeOrmOrderReadRepository;
    let queryBuilder: jest.Mocked<
        Pick<
            SelectQueryBuilder<OrderEntity>,
            | 'andWhere'
            | 'orderBy'
            | 'addOrderBy'
            | 'skip'
            | 'take'
            | 'getManyAndCount'
        >
    >;

    // Tạo query builder fluent giả để kiểm tra điều kiện SQL và kết quả ánh xạ mà không cần database.
    beforeEach(() => {
        queryBuilder = {
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn(),
        };

        const orders = {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        } as unknown as Repository<OrderEntity>;

        target = new TypeOrmOrderReadRepository(orders);
    });

    // TEST 1: status phải đi vào điều kiện bind an toàn và page phải tạo offset/limit ổn định.
    it('should filter by status, paginate deterministically, and map summary fields', async () => {
        // 1.1 Arrange: trang 2, mỗi trang 2 dòng; query trả một đơn trong tổng số ba đơn phù hợp.
        const query: OrderListQuery = {
            page: 2,
            limit: 2,
            status: OrderStatus.PENDING,
        };
        const createdAt = new Date('2026-10-15T00:00:00.000Z');
        const order = {
            id: 'order-1',
            customerName: 'Nguyễn Văn An',
            customerEmail: 'an@example.com',
            status: OrderStatus.PENDING,
            createdAt,
            updatedAt: createdAt,
        } as OrderEntity;
        queryBuilder.getManyAndCount.mockResolvedValue([[order], 3]);

        // 1.2 Act: repository truy vấn đơn theo filter và phân trang.
        const result = await target.list(query);

        // 1.3 Assert: điều kiện bind, thứ tự ổn định, offset/limit và metadata đều đúng.
        expect(queryBuilder.andWhere.mock.calls).toEqual([
            ['order.status = :status', { status: OrderStatus.PENDING }],
        ]);
        expect(queryBuilder.orderBy.mock.calls).toEqual([
            ['order.createdAt', 'DESC'],
        ]);
        expect(queryBuilder.addOrderBy.mock.calls).toEqual([
            ['order.id', 'ASC'],
        ]);
        expect(queryBuilder.skip.mock.calls).toEqual([[2]]);
        expect(queryBuilder.take.mock.calls).toEqual([[2]]);
        expect(result).toEqual({
            items: [
                {
                    id: 'order-1',
                    customerName: 'Nguyễn Văn An',
                    customerEmail: 'an@example.com',
                    status: OrderStatus.PENDING,
                    createdAt,
                    updatedAt: createdAt,
                },
            ],
            page: 2,
            limit: 2,
            total: 3,
            totalPages: 2,
        });
    });

    // TEST 2: không có status thì query không lọc trạng thái và trang rỗng có totalPages bằng 0.
    it('should omit the status filter when no status is provided', async () => {
        // 2.1 Arrange: query chỉ phân trang và không có đơn phù hợp trong database.
        const query: OrderListQuery = { page: 1, limit: 10 };
        queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

        // 2.2 Act: lấy trang đầu không lọc trạng thái.
        const result = await target.list(query);

        // 2.3 Assert: không thêm andWhere status, kết quả rỗng nhưng metadata vẫn hợp lệ.
        expect(queryBuilder.andWhere.mock.calls).toHaveLength(0);
        expect(result).toEqual({
            items: [],
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
        });
    });
});
