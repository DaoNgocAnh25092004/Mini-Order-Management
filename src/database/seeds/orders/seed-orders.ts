// Seed 10 đơn demo qua CreateOrderService, dùng product đang hoạt động trong database thật.
import { In, IsNull, MoreThan } from 'typeorm';
import { AppDataSource } from '@/database/config/data-source';
import { OrderEntity } from '@/database/entities/order.entity';
import { ProductEntity } from '@/database/entities/product.entity';
import { CreateOrderService } from '@/modules/orders/application/services/create-order/create-order.service';
import { TypeOrmOrderWriteRepository } from '@/modules/orders/infrastructure/repositories/write/order-write/typeorm-order-write.repository';

const seedCustomers = Array.from({ length: 10 }, (_, index) => {
    const sequence = String(index + 1).padStart(2, '0');

    return {
        customerName: `Khách hàng mẫu ${sequence}`,
        customerEmail: `order-seed-${sequence}@example.com`,
    };
});

// Chia sản phẩm thật cho các đơn, mỗi item lấy ID và số tồn thực tế; không lên kế hoạch bán vượt stock.
function planSeedOrderItems(
    products: ProductEntity[],
    orderCount: number,
): Array<Array<{ productId: string; quantity: number }>> {
    const remainingStockById = new Map(
        products.map((product) => [product.id, product.stock]),
    );
    const plans: Array<Array<{ productId: string; quantity: number }>> = [];
    let productCursor = 0;

    for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
        const orderItems: Array<{ productId: string; quantity: number }> = [];
        const desiredItemCount =
            products.length > 1 && orderIndex % 3 === 0 ? 2 : 1;

        // Mỗi đơn thường có một item, xen kẽ thêm item thứ hai nếu còn sản phẩm khác đủ tồn kho.
        while (orderItems.length < desiredItemCount) {
            let selectedIndex = -1;

            for (let offset = 0; offset < products.length; offset += 1) {
                const candidateIndex =
                    (productCursor + offset) % products.length;
                const candidate = products[candidateIndex];

                if (
                    candidate &&
                    (remainingStockById.get(candidate.id) ?? 0) > 0 &&
                    !orderItems.some((item) => item.productId === candidate.id)
                ) {
                    selectedIndex = candidateIndex;
                    break;
                }
            }

            // Nếu không còn món thứ hai thì vẫn giữ đơn hợp lệ với item đã chọn; nếu chưa chọn được món nào thì dừng.
            if (selectedIndex === -1) {
                if (orderItems.length > 0) {
                    break;
                }

                throw new Error(
                    'Không đủ sản phẩm còn tồn kho để tạo toàn bộ đơn seed.',
                );
            }

            const product = products[selectedIndex];
            if (!product) {
                throw new Error(
                    'Không tìm thấy sản phẩm trong danh sách seed.',
                );
            }

            orderItems.push({ productId: product.id, quantity: 1 });
            remainingStockById.set(
                product.id,
                (remainingStockById.get(product.id) ?? 0) - 1,
            );
            productCursor = (selectedIndex + 1) % products.length;
        }

        plans.push(orderItems);
    }

    return plans;
}

// Bỏ qua đơn seed đã có để chạy lại không nhân đôi; mỗi đơn tạo qua transaction nghiệp vụ nên stock và item đồng bộ.
async function seedOrders(): Promise<void> {
    await AppDataSource.initialize();

    try {
        const orderRepository = AppDataSource.getRepository(OrderEntity);
        const existingOrders = await orderRepository.find({
            select: { customerEmail: true },
            where: {
                customerEmail: In(
                    seedCustomers.map((customer) => customer.customerEmail),
                ),
            },
        });
        const existingEmails = new Set(
            existingOrders.map((order) => order.customerEmail),
        );
        const customersToSeed = seedCustomers.filter(
            (customer) => !existingEmails.has(customer.customerEmail),
        );

        if (customersToSeed.length === 0) {
            console.log('10 đơn seed đã tồn tại; không tạo bản ghi trùng.');
            return;
        }

        // Lấy product ID từ database hiện tại; tên, SKU và giá snapshot sẽ do repository tạo đơn đọc lại dưới row lock.
        const products = await AppDataSource.getRepository(ProductEntity).find({
            select: { id: true, stock: true },
            where: { deletedAt: IsNull(), stock: MoreThan(0) },
            order: { sku: 'ASC' },
        });
        const itemPlans = planSeedOrderItems(products, customersToSeed.length);
        const createOrderService = new CreateOrderService(
            new TypeOrmOrderWriteRepository(AppDataSource),
        );

        // Tạo tuần tự để mỗi đơn sau dùng tồn kho mới nhất; repository tự rollback đơn nếu một item không đủ hàng.
        for (const [index, customer] of customersToSeed.entries()) {
            const order = await createOrderService.execute({
                ...customer,
                items: itemPlans[index] ?? [],
            });

            console.log(
                `Đã tạo đơn ${customer.customerEmail}: ${order.id} (${order.items.length} item).`,
            );
        }

        console.log(
            `Seed hoàn tất: tạo ${customersToSeed.length} đơn mới; các order_items dùng sản phẩm thật và đã trừ tồn kho.`,
        );
    } finally {
        // Đóng pool kể cả khi query hoặc tạo một đơn bất kỳ thất bại.
        await AppDataSource.destroy();
    }
}

// Báo lỗi với exit code khác 0 để terminal/CI không nhầm seed thất bại là thành công.
void seedOrders().catch((error: unknown) => {
    console.error('Seed orders thất bại:', error);
    process.exitCode = 1;
});
