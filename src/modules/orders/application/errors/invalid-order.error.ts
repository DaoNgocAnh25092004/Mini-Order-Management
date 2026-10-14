// Lỗi đầu vào nghiệp vụ vượt giới hạn lưu trữ dù từng dòng đã qua DTO validation.
export class InvalidOrderError extends Error {
    // Dùng cho trường hợp gộp các dòng trùng khiến tổng quantity vượt kiểu integer.
    constructor(message: string) {
        super(message);
        this.name = InvalidOrderError.name;
    }
}
