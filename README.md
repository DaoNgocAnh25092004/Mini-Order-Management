<p align="center">
  <img src="https://img.icons8.com/fluency/96/shopping-cart.png" width="88" alt="Biểu tượng Mini Order Management" />
</p>

<h1 align="center">Mini Order Management</h1>

<p align="center">
  API quản lý sản phẩm và đơn hàng bằng NestJS, PostgreSQL, TypeORM, BullMQ và Redis.
  Hệ thống có xử lý đơn nền, quản lý tồn kho trong transaction và tự xử lý đơn quá hạn.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-CSDL-4169E1?logo=postgresql&logoColor=white" alt="Cơ sở dữ liệu PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeORM-ORM-FE0803?logo=typeorm&logoColor=white" alt="TypeORM ORM" />
  <img src="https://img.shields.io/badge/BullMQ-Hàng%20đợi-CB2B35" alt="BullMQ xử lý hàng đợi" />
  <img src="https://img.shields.io/badge/Redis-Lưu%20queue-DC382D?logo=redis&logoColor=white" alt="Redis lưu hàng đợi" />
  <img src="https://img.shields.io/badge/Swagger-Tài%20liệu%20API-85EA2D?logo=swagger&logoColor=black" alt="Tài liệu API Swagger" />
  <img src="https://img.shields.io/badge/Jest-Kiểm%20thử-C21325?logo=jest&logoColor=white" alt="Kiểm thử Jest" />
</p>

## Mục lục

1. [Cách chạy local](#1-cách-chạy-local)
2. [Mô tả bảng dữ liệu](#2-mô-tả-bảng-dữ-liệu)
3. [Luồng xử lý đơn hàng và job](#3-luồng-xử-lý-đơn-hàng-và-job)
    - [3.1 Luồng nghiệp vụ](#31-luồng-nghiệp-vụ)
    - [3.2 Idempotency: chống job chạy lặp](#32-idempotency-chống-job-chạy-lặp)
    - [3.3 Kiểm tra xử lý thành công](#33-kiểm-tra-xử-lý-thành-công)
    - [3.4 Kiểm tra retry, hết lượt và hoàn kho](#34-kiểm-tra-retry-hết-lượt-và-hoàn-kho)
    - [3.5 Chạy unit test cho job](#35-chạy-unit-test-cho-job)
    - [3.6 Kiểm tra scheduler tự hủy đơn quá hạn](#36-kiểm-tra-scheduler-tự-hủy-đơn-quá-hạn)
4. [Cách chống bán vượt tồn kho](#4-cách-chống-bán-vượt-tồn-kho)
5. [Nền tảng triển khai](#5-nền-tảng-triển-khai)

## 1. Cách chạy local

### Yêu cầu

- Node.js từ phiên bản 20.6 và npm.
- Docker Desktop đang chạy để khởi động PostgreSQL và Redis.
- Git để tải mã nguồn.

### Chạy ứng dụng trực tiếp bằng Node.js

Các lệnh dưới đây dùng PowerShell, chạy tại thư mục chứa `package.json`.

**Bước 1 — Tải mã nguồn và cài thư viện:**

```powershell
git clone https://github.com/DaoNgocAnh25092004/Mini-Order-Management.git
cd Mini-Order-Management
npm ci
```

`npm ci` cài đúng phiên bản đã khóa trong `package-lock.json`, giúp môi trường local khớp với môi trường build.

**Bước 2 — Tạo file cấu hình môi trường:**

```powershell
Copy-Item .env.example .env
```

Mở `.env` và đặt các giá trị cho PostgreSQL, Redis và API local:

```dotenv
DATABASE_URL=postgresql://mini_order:mini_order_dev@localhost:5432/mini_order_management
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
API_URL=http://localhost:3001/api
```

`DATABASE_URL` và `REDIS_URL` phải trỏ đến dịch vụ đang chạy. Không dùng mật khẩu mẫu này trong môi trường thật.

**Bước 3 — Khởi động PostgreSQL và Redis:**

```powershell
docker compose up -d postgres redis
```

`-d` chạy các dịch vụ ở nền. Khi chạy API bằng Node.js trên máy host, dùng `localhost` như cấu hình `.env`; bên trong Docker Compose, các container dùng hostname `postgres` và `redis`.

**Bước 4 — Tạo/cập nhật cấu trúc database:**

```powershell
npm run migration
```

Lệnh này chạy TypeORM migrations để tạo bảng và constraint; dự án không tự đồng bộ schema khi khởi động.

**Bước 5 — Nạp dữ liệu mẫu:**

```powershell
npm run seed:products
npm run seed:orders
```

Lệnh sản phẩm nạp tối đa 100 sản phẩm từ CSV. Lệnh đơn hàng là tùy chọn, tạo tối đa 10 đơn và trừ tồn kho tương ứng; chỉ chạy sau khi đã nạp sản phẩm.

**Bước 6 — Chạy API và worker riêng:**

Mở hai terminal tại thư mục dự án. Terminal thứ nhất chạy API:

```powershell
npm run dev
```

Terminal thứ hai chạy worker:

```powershell
npm run dev:worker
```

Hai tiến trình dùng chung PostgreSQL và Redis. API nhận request, ghi đơn/outbox và đọc trạng thái job; worker gửi outbox vào BullMQ, xử lý job và đăng ký lịch quét đơn quá hạn.

- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`
- Kiểm tra API: `http://localhost:3001/api/health`

### Chạy API và worker cùng PostgreSQL, Redis bằng Docker Compose

Nếu muốn toàn bộ hệ thống chạy trong Docker, thực hiện lần lượt:

```powershell
docker compose build api
docker compose up -d postgres redis
docker compose --profile tools run --rm migrate
docker compose up -d api worker
```

- `build api`: tạo image ứng dụng dùng chung cho API, worker và tác vụ migration.
- `up -d postgres redis`: khởi động database và Redis trước.
- `--profile tools run --rm migrate`: chạy migration một lần rồi xóa container tác vụ.
- `up -d api worker`: chạy hai tiến trình riêng; Compose chờ PostgreSQL và Redis khỏe mạnh trước khi khởi động.

Nạp dữ liệu mẫu sau khi API đã chạy:

```powershell
docker compose exec api node dist/database/seeds/products/seed-products.js
docker compose exec api node dist/database/seeds/orders/seed-orders.js
```

Lệnh `exec` chạy seed bên trong container API. File CSV sản phẩm được mount từ thư mục mã nguồn vào container để script đọc được.

Kiểm tra trạng thái và log:

```powershell
docker compose ps
docker compose logs -f api worker
```

Log `api` dùng để theo dõi HTTP; log `worker` dùng để theo dõi publisher, xử lý job và scheduler. Dừng container nhưng giữ dữ liệu database/Redis bằng:

```powershell
docker compose down
```

### Chạy kiểm thử

```powershell
npm test -- --runInBand
```

Lệnh chạy toàn bộ Jest test tuần tự. Các test đơn vị dùng mock; chúng kiểm tra logic nhưng không thay thế kiểm thử với PostgreSQL thật khi có nhiều request đồng thời.

## 2. Mô tả bảng dữ liệu

Schema được tạo bằng TypeORM migrations. Khóa chính dùng UUID; giá tiền dùng `numeric(12, 2)` và được giữ dạng chuỗi trong TypeScript để tránh sai số số thực.

### `products` — sản phẩm và tồn kho

| Cột                        | Ý nghĩa                                                   |
| -------------------------- | --------------------------------------------------------- |
| `id`                       | UUID định danh sản phẩm.                                  |
| `sku`                      | Mã sản phẩm duy nhất, bắt buộc và không được để trống.    |
| `name`                     | Tên sản phẩm.                                             |
| `price`                    | Giá hiện tại, không âm.                                   |
| `stock`                    | Tồn kho hiện tại, PostgreSQL không cho phép nhỏ hơn 0.    |
| `created_at`, `updated_at` | Thời điểm tạo và cập nhật.                                |
| `deleted_at`               | Đánh dấu xóa mềm; `NULL` nghĩa là sản phẩm còn hoạt động. |

Sản phẩm xóa mềm không xuất hiện trong truy vấn thông thường và không thể dùng để tạo đơn. SKU vẫn duy nhất kể cả với sản phẩm đã xóa mềm, nên SKU cũ hiện chưa thể dùng lại.

### `orders` — thông tin đơn hàng

| Cột                               | Ý nghĩa                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| `id`                              | UUID định danh đơn.                                            |
| `customer_name`, `customer_email` | Thông tin khách hàng tại lúc đặt.                              |
| `status`                          | Trạng thái: `PENDING`, `CONFIRMED`, `CANCELLED` hoặc `FAILED`. |
| `created_at`, `updated_at`        | Thời điểm tạo và cập nhật; có index hỗ trợ lọc/truy vấn đơn.   |

### `order_items` — các dòng hàng và ảnh chụp lúc mua

| Cột                           | Ý nghĩa                                       |
| ----------------------------- | --------------------------------------------- |
| `id`                          | UUID định danh dòng hàng.                     |
| `order_id`                    | Đơn sở hữu dòng hàng; tham chiếu `orders`.    |
| `product_id`                  | Sản phẩm được mua; tham chiếu `products`.     |
| `product_sku`, `product_name` | SKU và tên được chụp lại lúc mua.             |
| `quantity`                    | Số lượng, phải lớn hơn 0.                     |
| `unit_price`                  | Giá mỗi sản phẩm tại thời điểm mua, không âm. |

Snapshot giữ nguyên lịch sử đơn ngay cả khi tên, SKU hoặc giá sản phẩm hiện tại thay đổi.

### `notification_logs` — nhật ký sự kiện đơn hàng

| Cột          | Ý nghĩa                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| `id`         | UUID định danh log.                                                         |
| `order_id`   | Đơn phát sinh sự kiện.                                                      |
| `event_type` | Loại sự kiện hiện dùng: `ORDER_CONFIRMED`, `ORDER_FAILED`, `ORDER_EXPIRED`. |
| `payload`    | Chi tiết sự kiện dạng JSON, có thể chứa trạng thái hoặc lý do lỗi.          |
| `created_at` | Thời điểm ghi nhận.                                                         |

Unique index `(order_id, event_type)` ngăn ghi lặp cùng một loại sự kiện cho cùng đơn. Đây là log thay cho email; ứng dụng chưa gửi email thật.

### `outbox_events` — yêu cầu chuyển từ database sang queue

| Cột                        | Ý nghĩa                                                  |
| -------------------------- | -------------------------------------------------------- |
| `id`                       | UUID định danh event outbox.                             |
| `order_id`                 | Đơn cần xử lý nền.                                       |
| `event_type`               | Hiện là `ORDER_PROCESSING_REQUESTED`.                    |
| `dedupe_key`               | Khóa duy nhất để tránh tạo yêu cầu dispatch trùng.       |
| `payload`                  | Dữ liệu tối thiểu, chỉ cần `orderId`.                    |
| `attempts`, `available_at` | Số lần publisher thử và thời điểm được phép thử tiếp.    |
| `published_at`             | Thời điểm gửi thành công vào Redis; `NULL` nếu chưa gửi. |
| `last_error`               | Lỗi gửi gần nhất, nếu có.                                |
| `created_at`               | Thời điểm tạo event.                                     |

Đơn, tồn kho, order items và outbox event được lưu trong cùng transaction. Nếu Redis tạm lỗi, event vẫn ở PostgreSQL để publisher thử gửi lại, tránh mất yêu cầu xử lý.

## 3. Luồng xử lý đơn hàng và job

### 3.1 Luồng nghiệp vụ

1. API kiểm tra dữ liệu đầu vào. `CreateOrderService` gộp các dòng có cùng `productId` và từ chối tổng số lượng vượt giới hạn kiểu `integer` của PostgreSQL.
2. Repository mở transaction, khóa các dòng sản phẩm còn hoạt động theo thứ tự ID cố định, kiểm tra sản phẩm và số lượng tồn.
3. Nếu đủ hàng, hệ thống tạo đơn `PENDING`, lưu snapshot vào `order_items`, trừ tồn kho và ghi event outbox. Các thay đổi cùng commit; lỗi ở bất kỳ bước nào thì rollback toàn bộ.
4. Outbox publisher quét event chưa gửi và thêm job vào queue BullMQ `order-processing`. Job tên `process-order`, payload chỉ gồm `{ orderId }`, ID ổn định là `order-processing-<orderId>`.
5. Worker chờ giả lập 3–5 giây. Mỗi lần xử lý có xác suất lỗi khoảng 30% để kiểm tra retry.
6. Nếu thành công, repository khóa đơn và chỉ chuyển `PENDING` thành `CONFIRMED`; trạng thái và log `ORDER_CONFIRMED` được ghi cùng transaction.
7. Nếu lỗi trước lần cuối, processor ném lỗi lại để BullMQ retry. Tối đa 3 lần chạy tổng cộng, với exponential backoff từ khoảng 1 giây.
8. Nếu cả 3 lần đều lỗi, repository chỉ xử lý khi đơn vẫn `PENDING`: hoàn đúng số lượng từ `order_items`, đổi trạng thái thành `FAILED` và ghi `ORDER_FAILED` cùng lý do lỗi trong transaction. Job sau đó có trạng thái `failed`.
9. `GET /api/orders/:id/jobs` đọc trạng thái job trong Redis và trả `orderId`, `jobId`, `state`, `attempts`, `maxAttempts`, `failureReason`. Nếu job chưa được publisher đưa vào Redis hoặc không còn trong queue thì endpoint trả `404`.
10. Scheduler dùng repeatable job chạy mỗi 5 phút. Mỗi lượt tìm tối đa 100 đơn `PENDING` đã tạo quá 30 phút, hoàn kho, đổi thành `CANCELLED` và ghi `ORDER_EXPIRED` trong transaction.

**Lưu ý tồn kho:** tồn kho đã bị trừ khi tạo đơn. Worker xác nhận không trừ lần nữa; chỉ luồng thất bại cuối cùng hoặc hết hạn mới cộng trả kho.

### 3.2 Idempotency: chống job chạy lặp

**Yêu cầu idempotency của job đã được triển khai ở tầng database.** Nếu BullMQ retry hoặc cùng job được gửi lại, logic dựa trên trạng thái đơn và transaction để không xử lý tác động nghiệp vụ lần thứ hai:

- **Xác nhận đơn:** `confirmPendingOrder()` khóa dòng order và chỉ chuyển `PENDING` sang `CONFIRMED`. Nếu job chạy lại sau khi đã xác nhận, trạng thái không còn `PENDING` nên hàm dừng, không cập nhật đơn hay ghi log xác nhận lần nữa.
- **Job hết lượt và hoàn kho:** `failPendingOrder()` khóa order và chỉ hoàn kho khi trạng thái còn `PENDING`. Sau khi cộng lại số lượng trong `order_items`, nó đổi trạng thái sang `FAILED` và ghi log trong cùng transaction. Job lặp sau đó gặp `FAILED`, nên không cộng kho lần hai.
- **Đơn quá hạn:** scheduler chỉ lấy các order còn `PENDING` và khóa chúng. Lượt quét tiếp theo không chọn lại order đã đổi thành `CANCELLED`, nên không hoàn kho lần nữa.
- **Thông báo:** unique index `(order_id, event_type)` kết hợp `orIgnore()` chặn log trùng cho cùng loại sự kiện của một order.
- **Trừ tồn kho:** chỉ transaction tạo order gọi logic trừ kho. Worker xác nhận không trừ lại; retry job không quay lại transaction tạo đơn.

Job ID ổn định `order-processing-<orderId>` giúp BullMQ chặn enqueue trùng khi job cùng ID còn tồn tại trong Redis. Tuy nhiên đây không phải lớp đảm bảo duy nhất vì job có thể được thêm lại sau khi bị xóa; các kiểm tra trạng thái/transaction trong database mới bảo vệ tác động nghiệp vụ.

Điều này **khác** idempotency của HTTP request: API chưa hỗ trợ `Idempotency-Key` cho `POST /api/orders`. Nếu client gửi lại request tạo đơn sau timeout, hệ thống có thể tạo order mới và trừ kho thêm lần nữa nếu tồn kho còn đủ. Việc chống job chạy lặp đã có; việc gộp request tạo đơn bị gửi lặp thì chưa có.

### 3.3 Kiểm tra xử lý thành công

Các bước sau tạo một đơn thật trong database và làm thay đổi tồn kho. Chỉ chạy trên môi trường local; không dùng database production. Mở một cửa sổ PowerShell tại thư mục dự án và giữ cửa sổ đó mở để dùng lại biến `$orderId` ở các bước sau.

**Bước 1 — Tìm sản phẩm còn hàng:**

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT id, sku, stock FROM products WHERE deleted_at IS NULL AND stock > 0 ORDER BY sku LIMIT 10;"
```

Chọn một dòng và ghi lại `id`, `sku`, `stock`. `stock` là mốc để lát nữa xác nhận đơn chỉ trừ kho một lần.

**Bước 2 — Chuẩn bị request tạo đơn:**

```powershell
$baseUrl = 'http://localhost:3001/api'
$productId = 'PASTE-PRODUCT-UUID-HERE'
$body = @{
    customerName = 'Queue Test'
    customerEmail = "queue-test-$([guid]::NewGuid())@example.com"
    items = @(@{ productId = $productId; quantity = 1 })
} | ConvertTo-Json -Depth 5

$order = Invoke-RestMethod -Method Post `
    -Uri "$baseUrl/orders" `
    -ContentType 'application/json' `
    -Body $body

$orderId = $order.id
$order | Format-List id, status, createdAt
```

Thay placeholder bằng ID sản phẩm đã chọn. Lệnh gửi một đơn có một sản phẩm, số lượng 1; email ngẫu nhiên tránh trùng dữ liệu thử. Lưu ID đơn do response trả về.

**Bước 3 — Xem job trong BullMQ:**

```powershell
Invoke-RestMethod -Method Get -Uri "$baseUrl/orders/$orderId/jobs" |
    Format-List orderId, jobId, state, attempts, maxAttempts, failureReason
```

Nếu nhận `404`, chờ khoảng một giây rồi chạy lại lệnh: publisher quét outbox theo chu kỳ nên job có thể chưa được đưa vào Redis. Các trạng thái `waiting`, `active` hoặc `delayed` là trung gian, không phải lỗi cuối.

**Bước 4 — Đợi job kết thúc:**

Chạy lại lệnh GET ở bước 3 sau vài giây. Khi xử lý thành công, `state` là `completed`, `attempts` thường bằng `1`, và order chuyển từ `PENDING` sang `CONFIRMED`. Request tạo đơn trả `PENDING` trước vì HTTP không chờ worker xử lý xong.

**Bước 5 — Đối chiếu dữ liệu đã lưu:**

Thay placeholder bằng order ID ở bước 2 và product ID ở bước 1:

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT id, status FROM orders WHERE id = 'PASTE-ORDER-UUID-HERE';"
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT event_type, payload FROM notification_logs WHERE order_id = 'PASTE-ORDER-UUID-HERE' ORDER BY created_at;"
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT id, sku, stock FROM products WHERE id = 'PASTE-PRODUCT-UUID-HERE';"
```

Kết quả mong đợi: order `CONFIRMED`, đúng một log `ORDER_CONFIRMED`, và stock giảm đúng 1 so với mốc bước 1. SQL xác nhận dữ liệu trong PostgreSQL; endpoint `/jobs` cho biết trạng thái riêng của queue.

### 3.4 Kiểm tra retry, hết lượt và hoàn kho

Phần này dùng xác suất lỗi ngẫu nhiên nên không đảm bảo mọi đơn đều retry hoặc thất bại. Dùng một đơn thử mới ở bước 3.3, rồi giữ nguyên `$orderId` trong cùng cửa sổ PowerShell.

**Bước 1 — Theo dõi trạng thái job:**

```powershell
for ($i = 0; $i -lt 20; $i++) {
    try {
        $job = Invoke-RestMethod -Method Get -Uri "$baseUrl/orders/$orderId/jobs"
        Write-Host "state=$($job.state); attempts=$($job.attempts)/$($job.maxAttempts); reason=$($job.failureReason)"
        if ($job.state -in @('completed', 'failed')) { break }
    }
    catch {
        Write-Host 'Job chưa xuất hiện trong Redis; publisher có thể chưa dispatch.'
    }

    Start-Sleep -Seconds 2
}
```

Vòng lặp hỏi trạng thái tối đa 20 lần, cách nhau 2 giây. `delayed` cùng số lượt tăng cho biết BullMQ đang chờ retry; `completed` hoặc `failed` là trạng thái kết thúc.

**Bước 2 — Đọc trạng thái cuối cùng của order:**

```powershell
Invoke-RestMethod -Method Get -Uri "$baseUrl/orders/$orderId" |
    Format-List id, status
```

Nếu job thành công ở lượt nào đó, order sẽ là `CONFIRMED`. Nếu cả ba lượt đều lỗi, order phải là `FAILED`.

**Bước 3 — Nếu order là `FAILED`, kiểm tra log và stock:**

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT event_type, payload FROM notification_logs WHERE order_id = '$orderId' ORDER BY created_at;"
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT id, sku, stock FROM products WHERE id = '$productId';"
```

Khi thất bại cuối cùng, job phải có `state=failed`, `attempts=3` và `failureReason`; database có log `ORDER_FAILED` và stock được hoàn về mốc trước khi tạo đơn. Khi đơn `CONFIRMED`, kho không được hoàn vì đơn đã bán thành công.

Ba lần lỗi liên tiếp chỉ có xác suất khoảng `0.3 × 0.3 × 0.3 = 2.7%`. Vì vậy không nên tạo nhiều đơn để cố ép lỗi: đơn thành công vẫn tiêu thụ stock. Để kiểm tra nhánh lỗi cuối một cách lặp lại được, chạy test ở mục 3.5.

### 3.5 Chạy unit test cho job

Các bước này kiểm tra những nhánh có tính ngẫu nhiên bằng mock, để kết quả luôn lặp lại được mà không cần tạo nhiều đơn thật.

**Bước 1 — Chạy test processor và repository:**

```powershell
npx jest --runInBand `
    src/modules/orders/infrastructure/queue/processors/order-processing.processor.spec.ts `
    src/modules/orders/infrastructure/repositories/write/order-processing/typeorm-order-processing.repository.spec.ts
```

Processor spec kiểm tra lỗi trước lần cuối được retry và chỉ lần cuối mới gọi nhánh đánh dấu `FAILED`. Repository spec kiểm tra transaction hoàn kho, không hoàn lại cho order đã kết thúc, xác nhận lặp không ghi notification lặp và scheduler không hoàn stock lần thứ hai. Đây là hai suite quan trọng nhất để kiểm chứng yêu cầu idempotency của job.

**Bước 2 — Chạy test publisher:**

```powershell
npx jest --runInBand src/modules/orders/infrastructure/queue/publishers/typeorm-order-processing.publisher.spec.ts
```

Kiểm tra publisher gửi payload tối thiểu `{ orderId }`, dùng job ID ổn định, và giữ event outbox để gửi lại khi Redis lỗi.

**Bước 3 — Chạy test API đọc trạng thái job:**

```powershell
npx jest --runInBand src/modules/orders/infrastructure/queue/readers/bullmq-order-job-status.reader.spec.ts
```

Kiểm tra các giá trị `state`, `attempts`, `maxAttempts`, `failureReason` và trường hợp job không tồn tại.

**Bước 4 — Chạy test simulator và lịch định kỳ:**

```powershell
npx jest --runInBand `
    src/modules/orders/infrastructure/queue/simulators/order-processing.simulator.spec.ts `
    src/modules/orders/infrastructure/queue/schedulers/order-expiration.scheduler.spec.ts
```

Các test này xác nhận thời gian giả lập 3–5 giây, lỗi ngẫu nhiên, và scheduler được đăng ký chạy mỗi 5 phút.

**Bước 5 — Chạy tất cả test trong repository:**

```powershell
npm test -- --runInBand
```

Unit test dùng mock nên chứng minh nhánh logic được gọi đúng; chúng không tự khởi động Redis/PostgreSQL và không thay thế phép thử API/SQL thực tế ở mục 3.3, 3.4 và 3.6.

### 3.6 Kiểm tra scheduler tự hủy đơn quá hạn

Scheduler chạy mỗi 5 phút, nên sau khi chuẩn bị dữ liệu có thể phải đợi tối đa 5 phút. Các lệnh dưới đây sửa dữ liệu trực tiếp; chỉ dùng trong database local và chọn một order có thể bỏ.

**Bước 1 — Chọn order thử nghiệm đã xử lý xong:**

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT id, created_at FROM orders WHERE status = 'CONFIRMED' ORDER BY created_at DESC LIMIT 10;"
```

Chọn một order `CONFIRMED` dùng riêng cho test. Job xử lý ban đầu đã xong nên không còn retry để chuyển nó về `CONFIRMED` trong lúc scheduler chạy. Ghi lại order ID.

**Bước 2 — Ghi lại stock hiện tại của các sản phẩm trong order:**

Thay placeholder bằng ID đã chọn. Lưu `stock` và `quantity` để so sánh sau khi scheduler hoàn kho:

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT p.id, p.sku, p.stock, oi.quantity FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = 'PASTE-DISPOSABLE-ORDER-UUID-HERE' ORDER BY p.sku;"
```

**Bước 3 — Làm order quá hạn để không phải chờ 30 phút:**

Lệnh chỉ sửa `status` và `created_at`; nó không hoàn kho. Scheduler mới là phần cần được kiểm tra. Điều kiện `AND status = 'CONFIRMED'` giúp tránh sửa nhầm order đã đổi trạng thái:

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "UPDATE orders SET status = 'PENDING', created_at = NOW() - INTERVAL '31 minutes' WHERE id = 'PASTE-DISPOSABLE-ORDER-UUID-HERE' AND status = 'CONFIRMED';"
```

Chỉ tiếp tục nếu kết quả là `UPDATE 1`. Nếu nhận `UPDATE 0`, hãy chọn order khác; không bỏ điều kiện trạng thái. Giờ order đủ điều kiện `PENDING` và cũ hơn 30 phút.

**Bước 4 — Chờ scheduler và kiểm tra kết quả:**

Đợi tối đa 5 phút, sau đó chạy các truy vấn dưới đây với cùng order ID:

```powershell
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT id, status, created_at FROM orders WHERE id = 'PASTE-DISPOSABLE-ORDER-UUID-HERE';"
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT event_type, payload FROM notification_logs WHERE order_id = 'PASTE-DISPOSABLE-ORDER-UUID-HERE' ORDER BY created_at;"
docker compose exec postgres psql -U mini_order -d mini_order_management -c "SELECT p.sku, p.stock, oi.quantity FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = 'PASTE-DISPOSABLE-ORDER-UUID-HERE' ORDER BY p.sku;"
```

Kết quả đúng là order `CANCELLED`, có log `ORDER_EXPIRED`, và stock sau test bằng stock đã ghi ở bước 2 cộng `quantity`. Log `ORDER_CONFIRMED` cũ có thể còn vì test chỉ sửa trực tiếp bảng `orders`; đó là lịch sử cũ, không phải scheduler tạo log xác nhận mới. Nếu chưa thấy kết quả, kiểm tra `docker compose logs -f worker` để xác nhận scheduler đang chạy.

## 4. Cách chống bán vượt tồn kho

Khi tạo đơn, repository bảo vệ tồn kho bằng nhiều lớp:

1. **Khóa dòng sản phẩm (`pessimistic_write` / `FOR UPDATE`):** transaction khóa các sản phẩm trước khi đọc và kiểm tra tồn. Request khác mua cùng sản phẩm phải đợi transaction đang giữ khóa hoàn tất.
2. **Thứ tự khóa cố định:** nếu đơn có nhiều sản phẩm, hệ thống xử lý theo thứ tự `productId` để giảm nguy cơ hai transaction khóa chéo nhau.
3. **Trừ có điều kiện:** câu lệnh cập nhật chỉ trừ nếu `stock >= quantity`. Nếu không cập nhật đúng một dòng, repository báo thiếu hàng và transaction rollback.
4. **Constraint ở PostgreSQL:** `CHK_products_stock_non_negative` cấm lưu `stock < 0`, kể cả khi có lỗi ngoài dự kiến ở ứng dụng.
5. **Transaction nguyên tử:** tạo đơn, tạo `order_items`, trừ kho và ghi outbox cùng thành công hoặc cùng rollback; không để lại đơn nửa chừng.

Ví dụ còn đúng 1 sản phẩm nhưng có 2 khách đặt đồng thời: request lấy khóa trước trừ stock về 0 và commit. Request còn lại đợi, sau đó đọc stock đã commit và bị từ chối `409 Conflict`. Không có hai đơn cùng bán một đơn vị cuối và stock không âm.

**Giới hạn cần phân biệt:** cơ chế trên chống hai giao dịch cạnh tranh bán vượt số lượng tồn. API chưa hỗ trợ header `Idempotency-Key` cho request tạo đơn; nếu client gửi lại `POST /api/orders`, hệ thống có thể tạo một đơn khác nếu kho vẫn đủ. Đây là chống gửi request trùng, khác với idempotency của job nền đã mô tả ở mục 3.

Test repository tạo đơn có thể chạy riêng bằng:

```powershell
npx jest --runInBand src/modules/orders/infrastructure/repositories/write/order-write/typeorm-order-write.create.spec.ts
```

Test này kiểm tra logic khóa/trừ kho với mock. Chưa có bài kiểm thử tích hợp tạo hai HTTP request đồng thời trên PostgreSQL thật; muốn kiểm chứng race thực tế cần chạy bài test riêng với database test và tồn kho được cô lập.

## 5. Nền tảng triển khai

Kiến trúc tách API HTTP và worker nền thành hai tiến trình độc lập. Neon lưu dữ liệu nghiệp vụ và outbox; worker Railway đọc outbox, đưa công việc vào hàng đợi BullMQ trên Upstash rồi xử lý. API và worker cần được cấu hình để cùng truy cập các dịch vụ dùng chung.

| Thành phần | Nền tảng | Vai trò | Lý do lựa chọn | Kết nối |
| --- | --- | --- | --- | --- |
| HTTP API | Vercel | Cung cấp các endpoint REST và tài liệu Swagger thông qua NestJS Function. Entrypoint `main.js` nạp ứng dụng đã biên dịch trong `dist/`. | Phù hợp với mô hình serverless cho API HTTP; xem [tài liệu NestJS trên Vercel](https://vercel.com/docs/frameworks/backend/nestjs). | Cần `DATABASE_URL` để truy cập dữ liệu và `REDIS_URL` để tra cứu trạng thái job. |
| Worker nền | Railway | Chạy tiến trình NestJS liên tục; đọc outbox từ PostgreSQL, đưa công việc vào hàng đợi BullMQ và xử lý job. | Phù hợp với tác vụ nền cần hoạt động liên tục, độc lập với vòng đời request HTTP; xem [hướng dẫn triển khai worker trên Railway](https://docs.railway.com/guides/saas-backend). | Dùng cùng `DATABASE_URL` và `REDIS_URL` với API; cấu hình Start Command riêng, ví dụ `npm run start:worker`. Không cần public domain. |
| Cơ sở dữ liệu | Neon PostgreSQL | Lưu sản phẩm, đơn hàng, tồn kho và sự kiện outbox để API và worker phối hợp xử lý. | Cung cấp PostgreSQL được quản lý, dùng chung được từ hai nền tảng triển khai. | Cấu hình cùng `DATABASE_URL` cho Vercel và Railway. |
| Hàng đợi | Upstash Redis | BullMQ lưu và phân phối job; worker nhận job để xử lý, API đọc trạng thái job khi cần. | Cung cấp Redis được quản lý mà không cần tự vận hành máy chủ hàng đợi. | Cấu hình cùng `REDIS_URL` dạng Redis TCP. Nếu endpoint yêu cầu TLS, dùng scheme `rediss://`; không dùng REST URL hoặc REST token. |

Các biến môi trường phải được khai báo riêng trong Vercel và Railway, nhưng trỏ tới cùng database Neon và cùng Redis database Upstash. Không commit giá trị bí mật vào repository.
