import {
    Check,
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from '@/database/entities/product.entity';
import { OrderEntity } from '@/database/entities/order.entity';

@Entity({ name: 'order_items' })
@Index('IDX_order_items_order_id', ['orderId'])
@Index('IDX_order_items_product_id', ['productId'])
@Check('CHK_order_items_quantity_positive', '"quantity" > 0')
@Check('CHK_order_items_unit_price_non_negative', '"unit_price" >= 0')
export class OrderItemEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid', name: 'order_id' })
    orderId!: string;

    @ManyToOne(() => OrderEntity, (order) => order.items, {
        nullable: false,
        onDelete: 'CASCADE', // Khi xóa order thì xóa luôn các order_item liên quan, tránh rác dữ liệu.
    })
    @JoinColumn({ name: 'order_id' }) // Liên kết với cột order_id trong bảng order_items.
    order!: OrderEntity;

    @Column({ type: 'uuid', name: 'product_id' })
    productId!: string;

    @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'product_id' })
    product!: ProductEntity;

    @Column({ type: 'varchar', length: 64, name: 'product_sku' })
    productSku!: string;

    @Column({ type: 'varchar', length: 200, name: 'product_name' })
    productName!: string;

    @Column({ type: 'integer' })
    quantity!: number;

    // Giá numeric giữ chính xác hai chữ số thập phân và driver PostgreSQL trả về dạng chuỗi.
    @Column({
        type: 'numeric',
        precision: 12,
        scale: 2,
        name: 'unit_price',
    })
    unitPrice!: string;
}
