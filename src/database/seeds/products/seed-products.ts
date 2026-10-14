import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppDataSource } from '@/database/config/data-source';

// Đọc CSV seed và chèn các sản phẩm hợp lệ vào PostgreSQL theo SKU duy nhất.
async function seedProducts(): Promise<void> {
    const csvPath = resolve(
        process.cwd(),
        'src/database/seeds/products/products-100.csv',
    );
    const csvContent = await readFile(csvPath, 'utf8');
    const [header, ...rawRows] = csvContent.trim().split(/\r?\n/);

    // Chỉ nhận đúng thứ tự cột để tránh âm thầm gán nhầm dữ liệu khi CSV đổi mẫu.
    if (header !== 'sku,name,price,stock') {
        throw new Error('CSV phải có header: sku,name,price,stock.');
    }

    // Từ chối dòng sai cấu trúc trước khi mở kết nối để tránh import dở dang.
    const products = rawRows
        .filter((row) => row.length > 0)
        .map((row, index) => {
            const columns = row.split(',').map((value) => value.trim());

            if (columns.length !== 4) {
                throw new Error(`Dòng ${index + 2} phải có đúng 4 cột.`);
            }

            const [sku, name, price, stock] = columns;
            const stockValue = Number(stock);

            // Giữ giá ở dạng chuỗi để PostgreSQL nhận chính xác kiểu numeric(12,2).
            if (!sku || !name || !/^\d+(\.\d{1,2})?$/.test(price)) {
                throw new Error(
                    `Dòng ${index + 2} có SKU, tên hoặc giá không hợp lệ.`,
                );
            }

            // Tồn kho phải là số nguyên không âm trước khi chuyển thành number.
            if (!Number.isSafeInteger(stockValue) || stockValue < 0) {
                throw new Error(`Dòng ${index + 2} có tồn kho không hợp lệ.`);
            }

            return { sku, name, price, stock: stockValue };
        });

    // Không kết nối DB khi file rỗng để tránh báo thành công cho lần seed không dữ liệu.
    if (products.length === 0) {
        throw new Error('CSV không có sản phẩm để seed.');
    }

    // SKU trùng ngay trong CSV là lỗi dữ liệu; SKU đã có trong DB sẽ được bỏ qua.
    const uniqueSkus = new Set(products.map((product) => product.sku));
    if (uniqueSkus.size !== products.length) {
        throw new Error('CSV chứa SKU bị trùng.');
    }

    const placeholders = products
        .map((_, index) => {
            const firstParameter = index * 4 + 1;
            return `($${firstParameter}, $${firstParameter + 1}, $${firstParameter + 2}, $${firstParameter + 3})`;
        })
        .join(', ');
    const parameters = products.flatMap((product) => [
        product.sku,
        product.name,
        product.price,
        product.stock,
    ]);

    // Chỉ ghép chỉ số placeholder do chương trình tạo; dữ liệu luôn được bind riêng.
    await AppDataSource.initialize();
    try {
        const inserted = await AppDataSource.query<Array<{ id: string }>>(
            `INSERT INTO "products" ("sku", "name", "price", "stock") VALUES ${placeholders} ON CONFLICT ("sku") DO NOTHING RETURNING "id"`,
            parameters,
        );
        console.log(
            `Đã thêm ${inserted.length}/${products.length} sản phẩm mới; SKU có sẵn được bỏ qua.`,
        );
    } finally {
        // Đóng pool kể cả khi câu lệnh insert lỗi để tiến trình CLI thoát gọn.
        await AppDataSource.destroy();
    }
}

// Báo lỗi seed với exit code khác 0 để terminal/CI nhận biết lệnh thất bại.
void seedProducts().catch((error: unknown) => {
    console.error('Seed sản phẩm thất bại:', error);
    process.exitCode = 1;
});
