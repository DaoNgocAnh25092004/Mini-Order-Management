import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { OrderStatus } from '@/database/enums/order-status.enum';
import { OrderItemEntity } from '@/database/entities/order-item.entity';

@Entity({ name: 'orders' })
@Index('IDX_orders_created_at', ['createdAt']) // Index theo thời gian tạo để lọc nhanh các đơn hàng mới nhất.
@Index('IDX_orders_status_created_at', ['status', 'createdAt']) // Index theo trang thái và thời gian tạo để lọc nhanh các đơn hàng theo trạng thái.
@Check(
    'CHK_orders_customer_name_not_blank',
    'length(trim("customer_name")) > 0',
)
@Check(
    'CHK_orders_status_valid',
    "\"status\" IN ('PENDING', 'CONFIRMED', 'CANCELLED')",
)
export class OrderEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 200, name: 'customer_name' })
    customerName!: string;

    @Column({ type: 'varchar', length: 254, name: 'customer_email' })
    customerEmail!: string;

    @Column({
        type: 'varchar',
        length: 20,
        default: OrderStatus.PENDING,
    })
    status!: OrderStatus;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt!: Date;

    @OneToMany(() => OrderItemEntity, (item) => item.order)
    items!: OrderItemEntity[];
}
