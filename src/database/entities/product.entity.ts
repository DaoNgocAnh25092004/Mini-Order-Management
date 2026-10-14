import {
    Check,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'products' })
@Index('UQ_products_sku', ['sku'], { unique: true })
@Check('CHK_products_sku_not_blank', 'length(trim("sku")) > 0')
@Check('CHK_products_name_not_blank', 'length(trim("name")) > 0')
@Check('CHK_products_price_non_negative', '"price" >= 0')
@Check('CHK_products_stock_non_negative', '"stock" >= 0')
export class ProductEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 64 })
    sku!: string;

    @Column({ type: 'varchar', length: 200 })
    name!: string;

    // Giá sản phẩm được lưu dưới dạng chuỗi để tránh lỗi làm tròn của số thực, ví dụ 0.1 + 0.2 = 0.30000000000000004.
    @Column({ type: 'numeric', precision: 12, scale: 2 })
    price!: string;

    @Column({ type: 'integer' })
    stock!: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt!: Date;

    // TypeORM dùng cột này cho softDelete và mặc định loại sản phẩm đã xóa khỏi truy vấn.
    @DeleteDateColumn({
        type: 'timestamptz',
        name: 'deleted_at',
        nullable: true,
    })
    deletedAt!: Date | null;
}
