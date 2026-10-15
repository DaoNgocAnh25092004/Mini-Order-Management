import type { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm FAILED cùng transactional outbox và log thông báo cho xử lý bất đồng bộ đơn hàng.
export class AddOrderProcessingOutboxAndNotificationLogs1792005218000 implements MigrationInterface {
    name = 'AddOrderProcessingOutboxAndNotificationLogs1792005218000';

    // Mở rộng trạng thái và tạo hai bảng trong migration để dữ liệu order/outbox có cùng ranh giới bền vững.
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status_valid"',
        );
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "CHK_orders_status_valid"
            CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED'))
        `);

        await queryRunner.query(`
            CREATE TABLE "notification_logs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "order_id" uuid NOT NULL,
                "event_type" character varying(64) NOT NULL,
                "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notification_logs_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_notification_logs_order_id_orders_id"
                    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
                    ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "UQ_notification_logs_order_event_type"
            ON "notification_logs" ("order_id", "event_type")
        `);

        await queryRunner.query(`
            CREATE TABLE "outbox_events" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "order_id" uuid NOT NULL,
                "event_type" character varying(64) NOT NULL,
                "dedupe_key" character varying(160) NOT NULL,
                "payload" jsonb NOT NULL,
                "attempts" integer NOT NULL DEFAULT 0,
                "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "published_at" TIMESTAMP WITH TIME ZONE,
                "last_error" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_outbox_events_order_id_orders_id"
                    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
                    ON DELETE CASCADE,
                CONSTRAINT "CHK_outbox_events_attempts_non_negative"
                    CHECK ("attempts" >= 0)
            )
        `);
        await queryRunner.query(
            'CREATE UNIQUE INDEX "UQ_outbox_events_dedupe_key" ON "outbox_events" ("dedupe_key")',
        );
        await queryRunner.query(`
            CREATE INDEX "IDX_outbox_events_pending"
            ON "outbox_events" ("available_at", "created_at")
            WHERE "published_at" IS NULL
        `);
    }

    // Gỡ bảng phụ trước; nếu còn order FAILED thì constraint cũ sẽ từ chối rollback thay vì đổi nghĩa dữ liệu.
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM "orders" WHERE "status" = 'FAILED') THEN
                    RAISE EXCEPTION 'Cannot revert order processing migration while FAILED orders exist';
                END IF;
            END
            $$
        `);
        await queryRunner.query('DROP TABLE "outbox_events"');
        await queryRunner.query('DROP TABLE "notification_logs"');
        await queryRunner.query(
            'ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status_valid"',
        );
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "CHK_orders_status_valid"
            CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED'))
        `);
    }
}
