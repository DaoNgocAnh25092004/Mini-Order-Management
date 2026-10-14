import type { MigrationInterface, QueryRunner } from 'typeorm';

// Tạo bảng sản phẩm cùng các ràng buộc bền vững, không phụ thuộc synchronize.
export class CreateProductsTable1760460000000 implements MigrationInterface {
    name = 'CreateProductsTable1760460000000';

    // Tạo UUID, timestamp tự sinh và constraint để dữ liệu ngoài API vẫn hợp lệ.
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "products" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "sku" character varying(64) NOT NULL,
                "name" character varying(200) NOT NULL,
                "price" numeric(12, 2) NOT NULL,
                "stock" integer NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_products_sku_not_blank" CHECK (length(trim("sku")) > 0),
                CONSTRAINT "CHK_products_name_not_blank" CHECK (length(trim("name")) > 0),
                CONSTRAINT "CHK_products_price_non_negative" CHECK ("price" >= 0),
                CONSTRAINT "CHK_products_stock_non_negative" CHECK ("stock" >= 0)
            )
        `);

        await queryRunner.query(
            'CREATE UNIQUE INDEX "UQ_products_sku" ON "products" ("sku")',
        );
    }

    // Xóa index trước bảng để migration có thể được hoàn tác an toàn.
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "UQ_products_sku"');
        await queryRunner.query('DROP TABLE "products"');
    }
}
