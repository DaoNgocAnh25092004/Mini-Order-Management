import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { OrderOutboxEventType } from '@/database/enums/order-outbox-event-type.enum';

// Lưu bền vững yêu cầu xử lý đơn trong cùng transaction tạo order để publisher gửi sang queue sau.
@Entity({ name: 'outbox_events' })
@Index('UQ_outbox_events_dedupe_key', ['dedupeKey'], { unique: true }) // Unique constraint để tránh ghi trùng bản ghi outbox cho cùng một dedupeKey.
@Index('IDX_outbox_events_pending', ['availableAt', 'createdAt'], {
    where: '"published_at" IS NULL',
})
@Check('CHK_outbox_events_attempts_non_negative', '"attempts" >= 0')
export class OrderOutboxEventEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', name: 'order_id' })
    orderId!: string;

    @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order!: OrderEntity;

    // Loại sự kiện outbox, ví dụ: ORDER_PROCESSING_REQUESTED.
    // Mục đích: để xác định loại sự kiện và xử lý logic gửi sự kiện tương ứng.
    @Column({ type: 'varchar', length: 64, name: 'event_type' })
    eventType!: OrderOutboxEventType;

    // Dùng để tránh ghi trùng bản ghi outbox cho cùng một order và event type; ví dụ: "orderId:eventType".
    @Column({ type: 'varchar', length: 160, name: 'dedupe_key' })
    dedupeKey!: string;

    @Column({ type: 'jsonb' })
    payload!: Record<string, unknown>;

    // Số lần thử gửi sự kiện; dùng để retry gửi sự kiện nếu thất bại.
    @Column({ type: 'integer', default: 0 })
    attempts!: number;

    // Thời điểm sự kiện outbox có thể được gửi; dùng để delay gửi sự kiện nếu cần.
    @Column({
        type: 'timestamptz',
        name: 'available_at',
        default: () => 'CURRENT_TIMESTAMP',
    })
    availableAt!: Date;

    // Thời điểm sự kiện outbox được gửi thành công; null nếu chưa gửi.
    @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
    publishedAt!: Date | null;

    // Lưu thông tin lỗi nếu gửi sự kiện thất bại; null nếu chưa gửi hoặc gửi thành công.
    @Column({ type: 'text', name: 'last_error', nullable: true })
    lastError!: string | null;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;
}
