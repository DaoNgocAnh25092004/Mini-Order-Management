import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderEntity } from '@/database/entities/order.entity';
import { NotificationEventType } from '@/database/enums/notification-event-type.enum';

// Lưu bản ghi thông báo thay cho gửi email; unique theo order và event để retry không ghi trùng.
@Entity({ name: 'notification_logs' })
@Index('UQ_notification_logs_order_event_type', ['orderId', 'eventType'], {
    unique: true,
}) // Unique constraint để tránh ghi trùng bản ghi thông báo cho cùng một order và event type.
export class NotificationLogEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', name: 'order_id' })
    orderId!: string;

    @ManyToOne(() => OrderEntity, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order!: OrderEntity;

    // Loại sự kiện thông báo, ví dụ: ORDER_CONFIRMED, ORDER_FAILED, ORDER_CANCELLED, ORDER_EXPIRED.
    // Mục đích: để xác định loại thông báo và xử lý logic gửi thông báo tương ứng.
    @Column({ type: 'varchar', length: 64, name: 'event_type' })
    eventType!: NotificationEventType;

    // Định dạng jsonb để lưu payload của thông báo, ví dụ: { "subject": "Order Confirmed", "body": "Your order has been confirmed." }
    @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
    payload!: Record<string, unknown>;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;
}
