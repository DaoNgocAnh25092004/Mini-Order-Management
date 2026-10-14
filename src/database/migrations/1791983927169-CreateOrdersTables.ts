import type { MigrationInterface, QueryRunner } from 'typeorm';

// Tạo bảng orders và order_items cùng constraint, index và khóa ngoại cho lịch sử đơn.
export class CreateOrdersTables1791983927169 implements MigrationInterface {
    name = 'CreateOrdersTables1791983927169';

    // Tạo bảng cha trước bảng dòng hàng để các khóa ngoại luôn tham chiếu tới bảng đã tồn tại.
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "orders" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "customer_name" character varying(200) NOT NULL,
                "customer_email" character varying(254) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'PENDING',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_orders_customer_name_not_blank"
                    CHECK (length(trim("customer_name")) > 0),
                CONSTRAINT "CHK_orders_status_valid"
                    CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED'))
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "order_items" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "order_id" uuid NOT NULL,
                "product_id" uuid NOT NULL,
                "product_sku" character varying(64) NOT NULL,
                "product_name" character varying(200) NOT NULL,
                "quantity" integer NOT NULL,
                "unit_price" numeric(12, 2) NOT NULL,
                CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_order_items_quantity_positive"
                    CHECK ("quantity" > 0),
                CONSTRAINT "CHK_order_items_unit_price_non_negative"
                    CHECK ("unit_price" >= 0),
                CONSTRAINT "FK_order_items_order_id_orders_id"
                    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "FK_order_items_product_id_products_id"
                    FOREIGN KEY ("product_id") REFERENCES "products"("id")
                    ON DELETE RESTRICT
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_orders_created_at" ON "orders" ("created_at")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_orders_status_created_at" ON "orders" ("status", "created_at")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_order_items_product_id" ON "order_items" ("product_id")',
        );
    }

    // Gỡ bảng con trước để không còn khóa ngoại tham chiếu tới orders hoặc products.
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE "order_items"');
        await queryRunner.query('DROP TABLE "orders"');
    }
}
