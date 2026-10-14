export const PRODUCT_READ_REPOSITORY = Symbol('PRODUCT_READ_REPOSITORY');

// Hợp đồng repository chỉ định các phương thức đọc dữ liệu sản phẩm mà application cần.
export interface ProductListQuery {
    page: number;
    limit: number;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
}

// DTO và entity được ánh xạ thành interface này để trả về cho client; không để lộ chi tiết persistence.
export interface ProductListItem {
    id: string;
    sku: string;
    name: string;
    price: string;
    stock: number;
    createdAt: Date;
    updatedAt: Date;
}

// Trang kết quả phân trang, bao gồm danh sách item và thông tin phân trang.
export interface ProductListPage {
    items: ProductListItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// Dùng để inject repository vào service; service chỉ phụ thuộc vào hợp đồng, không phụ thuộc vào implementation cụ thể.
export interface ProductReadRepository {
    list(query: ProductListQuery): Promise<ProductListPage>;
}
