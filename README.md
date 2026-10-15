<p align="center">
  <img src="https://img.icons8.com/fluency/96/shopping-cart.png" width="88" alt="Mini Order Management shopping cart icon" />
</p>

<h1 align="center">Mini Order Management</h1>

<p align="center">
  A NestJS REST API for product and order management, built with PostgreSQL and TypeORM.
  It includes transactional inventory handling, soft deletion, database migrations,
  seed scripts, request validation, and OpenAPI documentation.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeORM-ORM-FE0803?logo=typeorm&logoColor=white" alt="TypeORM" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI-85EA2D?logo=swagger&logoColor=black" alt="Swagger OpenAPI" />
  <img src="https://img.shields.io/badge/Jest-Tests-C21325?logo=jest&logoColor=white" alt="Jest" />
</p>

## Table of Contents

- [Overview](#overview)
- [Implemented Features](#implemented-features)
- [Technology Stack](#technology-stack)
- [Architecture and Project Structure](#architecture-and-project-structure)
- [Run Locally](#run-locally)
- [Run with Docker Compose](#run-with-docker-compose)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Order Processing Flow](#order-processing-flow)
- [Inventory Concurrency and Overselling](#inventory-concurrency-and-overselling)
- [Tests](#tests)
- [Deployment](#deployment)
- [Background Worker Status](#background-worker-status)
- [Known Limitations and Next Steps](#known-limitations-and-next-steps)

## Overview

Mini Order Management is a backend project for managing products and customer orders.
The API uses a feature-oriented NestJS structure with application contracts separating
business use cases from TypeORM persistence adapters. PostgreSQL constraints provide
additional data-integrity guarantees beyond request validation.

The API listens on port `3001` by default and uses the `/api` global route prefix.

## Implemented Features

- Product CRUD: create, list, get by UUID, partially update, and soft-delete products.
- Product listing with pagination, case-insensitive name search, and inclusive price filters.
- DTO transformation and validation for request bodies, query parameters, and UUID path values.
- SKU uniqueness enforced by PostgreSQL; duplicate SKU errors are returned as HTTP `409`.
- Order creation in a database transaction, including inventory decrement and purchase-time
  product and price snapshots.
- Order listing with pagination and optional status filter, plus order detail with item snapshots.
- Order cancellation for `PENDING` and `CONFIRMED` orders, with stock restoration in a transaction.
- Row locking and conditional stock updates to prevent concurrent orders from overselling.
- Transactional outbox publishing to a BullMQ `order-processing` queue using stable job IDs.
- TypeORM migrations, product and order seed commands, a process liveness endpoint, and Swagger UI.

## Technology Stack

- Node.js 20.6 or later and TypeScript
- NestJS 11
- BullMQ with the NestJS BullMQ integration and Redis
- PostgreSQL and TypeORM
- `class-validator` and `class-transformer`
- Swagger / OpenAPI
- Jest for unit tests

## Architecture and Project Structure

```text
src/
├── app.module.ts
├── main.ts                         # Bootstrap, /api prefix, validation, Swagger, startup URLs
├── database/
│   ├── config/                     # TypeORM application and CLI configuration
│   ├── entities/                   # Product, order, item, notification, and outbox models
│   ├── enums/                     # Persistence-related order status values
│   ├── migrations/                # Explicit PostgreSQL schema changes
│   └── seeds/
│       ├── products/               # 100-product CSV and product seed command
│       └── orders/                 # Order seed command using existing products
└── modules/
    ├── health/
    │   └── presentation/controllers/
    ├── products/
    │   ├── application/            # Use cases, repository contracts, application errors
    │   ├── infrastructure/         # TypeORM read/write adapters
    │   └── presentation/           # HTTP controller and DTOs
    └── orders/
        ├── application/            # Use cases, repository contracts, application errors
        ├── infrastructure/
        │   ├── queue/
        │   │   ├── config/          # Redis connection options and queue/job names
        │   │   └── publishers/      # Outbox publisher and its unit tests
        │   └── repositories/        # TypeORM read/write adapters
        └── presentation/           # HTTP controller and DTOs
```

The presentation layer validates HTTP input and maps application errors to HTTP responses.
Application services coordinate use cases through repository contracts. Infrastructure
adapters own TypeORM queries, transactions, row locks, and persistence mapping.

## Run Locally

### Prerequisites

- Node.js 20.6 or later and npm. The scripts use Node's `--env-file` option.
- A reachable PostgreSQL database. A Neon connection string is supported when configured
  with the SSL settings required by the provider.
- A reachable Redis server, required by the outbox publisher and `order-processing` queue.

The API publishes order-processing jobs, but a worker that consumes and processes them is not
implemented yet.

### Step 1: Clone the repository

```powershell
git clone https://github.com/DaoNgocAnh25092004/Mini-Order-Management.git
```

### Step 2: Open the project directory

```powershell
cd Mini-Order-Management
```

### Step 3: Install dependencies

```powershell
npm ci
```

### Step 4: Create your local environment file

```powershell
Copy-Item .env.example .env
```

### Step 5: Configure PostgreSQL, Redis, and the local API URL

Open `.env` and replace the database placeholder with your PostgreSQL connection string.
Keep the local API settings as shown, or change them if you need a different port:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
API_URL=http://localhost:3001/api
```

`API_URL` is the externally usable API base URL and should include `/api`. If it is not
provided, startup output is derived from the address NestJS is listening on. URL-encode
special characters in database credentials when required by the connection string. Use
`rediss://` for Redis connections that require TLS. `REDIS_URL` supports a Redis database
number and optional username/password.

### Step 6: Create the database schema

Run the migrations after confirming that `DATABASE_URL` points to the database you intend
to use:

```powershell
npm run migration
```

### Step 7: Seed the sample products

This imports up to 100 products from the CSV. Existing SKUs are skipped and their records
are not overwritten.

```powershell
npm run seed:products
```

### Step 8: (Optional) Seed sample orders

Run this only after the products are seeded and when you want sample order data. It creates
up to 10 orders using active products from your database and decrements their stock. Existing
seed orders are skipped when you run the command again.

```powershell
npm run seed:orders
```

### Step 9: Start the API

```powershell
npm run dev
```

The development command starts NestJS in watch mode. With the example environment, the API
uses port `3001` and these URLs:

- API base: `http://localhost:3001/api`
- Swagger UI: `http://localhost:3001/api/docs`
- Health: `http://localhost:3001/api/health`
- Products: `http://localhost:3001/api/products`
- Orders: `http://localhost:3001/api/orders`

### Step 10: Verify the API

Open Swagger to try the endpoints, or request the health endpoint to confirm that the API
process is responding:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

To run the automated tests separately:

```powershell
npm test -- --runInBand
```

## Run with Docker Compose

`Dockerfile` builds a production image in separate build and runtime stages. `docker-compose.yml`
provides the API, PostgreSQL, and Redis for a local environment. The API image runs as the
unprivileged `node` user; the PostgreSQL and Redis ports bind to localhost only.

From the repository root, build the API image and start the local dependencies:

```powershell
docker compose build api
docker compose up -d postgres redis
```

Run migrations as an explicit one-off operation, then start the API:

```powershell
docker compose --profile tools run --rm migrate
docker compose up -d api
```

### Seed sample data with Docker (optional)

After the API is running and migrations have completed, run these commands from the
repository root. The first imports products from the CSV; the second creates up to 10
sample orders using those real products and reduces their stock accordingly. Existing
product SKUs and seed orders are skipped if you run the commands again.

If the API container was created before the CSV mount was added, recreate it once so the
mount becomes available:

```powershell
docker compose up -d --force-recreate api
```

```powershell
docker compose exec api node dist/database/seeds/products/seed-products.js
docker compose exec api node dist/database/seeds/orders/seed-orders.js
```

The API and Swagger UI are available at `http://localhost:3001/api` and
`http://localhost:3001/api/docs`. View service status and logs with:

```powershell
docker compose ps
docker compose logs -f api
```

Stop the services without deleting the persisted PostgreSQL and Redis volumes:

```powershell
docker compose down
```

The Compose credentials are for local development only. Replace them and use managed or
secured PostgreSQL/Redis services for deployment. The `migrate` command uses the compiled
TypeORM data source and does not require a `.env` file inside the image.

## Database Schema

Schema changes are managed by TypeORM migrations; `synchronize` is disabled. UUID primary
keys are generated by PostgreSQL. Prices use `numeric(12, 2)` and are represented as strings
in TypeScript so decimal values are not converted to binary floating-point numbers.

### `products`

| Column       | Type                   | Purpose and constraints                 |
| ------------ | ---------------------- | --------------------------------------- |
| `id`         | `uuid`                 | Primary key                             |
| `sku`        | `varchar(64)`          | Required, non-blank, unique             |
| `name`       | `varchar(200)`         | Required and non-blank                  |
| `price`      | `numeric(12, 2)`       | Required and non-negative               |
| `stock`      | `integer`              | Required and non-negative               |
| `created_at` | `timestamptz`          | Creation timestamp                      |
| `updated_at` | `timestamptz`          | Last-update timestamp                   |
| `deleted_at` | nullable `timestamptz` | Soft-delete marker; `NULL` means active |

Soft-deleted products are omitted from normal product reads and cannot be used to create an
order. The SKU unique index applies to all rows, including soft-deleted products, so a deleted
product's SKU cannot currently be reused.

### `orders`

| Column           | Type           | Purpose and constraints                                   |
| ---------------- | -------------- | --------------------------------------------------------- |
| `id`             | `uuid`         | Primary key                                               |
| `customer_name`  | `varchar(200)` | Required and non-blank                                    |
| `customer_email` | `varchar(254)` | Required                                                  |
| `status`         | `varchar(20)`  | Defaults to `PENDING`; checked against supported statuses |
| `created_at`     | `timestamptz`  | Creation timestamp; indexed for order listing             |
| `updated_at`     | `timestamptz`  | Last-update timestamp                                     |

Supported statuses are `PENDING`, `CONFIRMED`, `CANCELLED`, and `FAILED`. A composite index
on `(status, created_at)` supports status-filtered order listing.

### `order_items`

| Column         | Type             | Purpose and constraints                                       |
| -------------- | ---------------- | ------------------------------------------------------------- |
| `id`           | `uuid`           | Primary key                                                   |
| `order_id`     | `uuid`           | Required foreign key to `orders`; cascades on hard delete     |
| `product_id`   | `uuid`           | Required foreign key to `products`; hard delete is restricted |
| `product_sku`  | `varchar(64)`    | SKU snapshot at purchase time                                 |
| `product_name` | `varchar(200)`   | Product name snapshot at purchase time                        |
| `quantity`     | `integer`        | Must be greater than zero                                     |
| `unit_price`   | `numeric(12, 2)` | Non-negative purchase-time price snapshot                     |

Indexes are defined for `order_items.order_id` and `order_items.product_id`. Products are
soft-deleted rather than hard-deleted, so existing order-item references and purchase history
remain intact.

### `notification_logs`

| Column       | Type          | Purpose and constraints                    |
| ------------ | ------------- | ------------------------------------------ |
| `id`         | `uuid`        | Primary key                                |
| `order_id`   | `uuid`        | Required foreign key to `orders`           |
| `event_type` | `varchar(64)` | Notification event name                    |
| `payload`    | `jsonb`       | Event details; defaults to an empty object |
| `created_at` | `timestamptz` | Log creation time                          |

A unique index on `(order_id, event_type)` is the database-level guard against recording the
same notification event more than once. The worker that writes confirmation notifications is
planned for a later phase.

### `outbox_events`

| Column         | Type                   | Purpose and constraints                                 |
| -------------- | ---------------------- | ------------------------------------------------------- |
| `id`           | `uuid`                 | Primary key                                             |
| `order_id`     | `uuid`                 | Required foreign key to `orders`                        |
| `event_type`   | `varchar(64)`          | Currently `ORDER_PROCESSING_REQUESTED`                  |
| `dedupe_key`   | `varchar(160)`         | Unique key used to prevent duplicate dispatch           |
| `payload`      | `jsonb`                | Minimal event payload containing the order ID           |
| `attempts`     | `integer`              | Non-negative publisher-attempt counter; defaults to `0` |
| `available_at` | `timestamptz`          | Earliest time the publisher may retry the event         |
| `published_at` | nullable `timestamptz` | `NULL` until the event is sent to the queue             |
| `last_error`   | nullable `text`        | Most recent publisher error                             |
| `created_at`   | `timestamptz`          | Event creation time                                     |

Order creation writes this event in the same PostgreSQL transaction as the order, inventory
decrement, and order items. A publisher polls unpublished events, locks each batch with
`SKIP LOCKED`, and sends only the `orderId` to BullMQ. It marks the event published after Redis
accepts the job; Redis errors leave the event available for exponential-backoff retry. This
keeps the processing request in PostgreSQL if Redis is temporarily unavailable.

TypeORM also maintains a migration-history table to record which migrations have been applied.

## API Reference

All routes are under `/api`. Swagger provides the interactive contract at `/api/docs`.

### Products

| Method and route           | Purpose                    | Success response |
| -------------------------- | -------------------------- | ---------------- |
| `POST /api/products`       | Create a product           | `201 Created`    |
| `GET /api/products`        | List and filter products   | `200 OK`         |
| `GET /api/products/:id`    | Get one product by UUID    | `200 OK`         |
| `PATCH /api/products/:id`  | Partially update a product | `200 OK`         |
| `DELETE /api/products/:id` | Soft-delete a product      | `204 No Content` |

`GET /api/products` supports:

| Query parameter | Behavior and validation                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `page`          | 1-based integer; defaults to `1`, maximum `1,000,000`                                         |
| `limit`         | Integer from `1` to `100`; defaults to `10`                                                   |
| `search`        | Optional, case-insensitive substring match on product name; maximum 200 characters            |
| `minPrice`      | Optional inclusive lower bound; non-negative, up to 2 decimal places                          |
| `maxPrice`      | Optional inclusive upper bound; non-negative, up to 2 decimal places and not below `minPrice` |

The paginated response contains `items`, `page`, `limit`, `total`, and `totalPages`. Invalid
input or UUIDs return `400`; missing or soft-deleted products return `404`; duplicate SKUs
return `409`.

Example:

```http
GET /api/products?page=1&limit=10&search=keyboard&minPrice=100&maxPrice=500
```

Product creation body:

```json
{
    "sku": "SKU-1001",
    "name": "Wireless Keyboard",
    "price": "499.99",
    "stock": 25
}
```

### Orders

| Method and route               | Purpose                                                | Success response |
| ------------------------------ | ------------------------------------------------------ | ---------------- |
| `POST /api/orders`             | Create an order and decrement inventory                | `201 Created`    |
| `GET /api/orders`              | List orders with pagination and optional status filter | `200 OK`         |
| `GET /api/orders/:id`          | Get order details and item snapshots by UUID           | `200 OK`         |
| `PATCH /api/orders/:id/cancel` | Cancel an eligible order and restore inventory         | `200 OK`         |

`POST /api/orders` accepts `customerName`, `customerEmail`, and `items`. The request must
contain 1–100 items; each `productId` must be a UUID and each `quantity` must be a positive
integer within the PostgreSQL `integer` range. Repeated product IDs are combined before the
repository creates the order.

```json
{
    "customerName": "Nguyen Van An",
    "customerEmail": "customer@example.com",
    "items": [
        {
            "productId": "124f6fd1-9de3-4ad7-9408-729fccfe0fa0",
            "quantity": 2
        }
    ]
}
```

Order creation returns `400` for invalid input, `404` if a requested product is missing or
soft-deleted, and `409` when available stock is insufficient. The order is created as
`PENDING`; each item stores the product name, SKU, and price used when the order was placed.

`GET /api/orders` supports `page` (default `1`, maximum `1,000,000`), `limit` (default `10`,
maximum `100`), and optional `status` (`PENDING`, `CONFIRMED`, or `CANCELLED`). List results
are summaries; `GET /api/orders/:id` returns the associated item snapshots.

Cancellation is allowed only while an order is `PENDING` or `CONFIRMED`. Successful
cancellation restores inventory and changes the status to `CANCELLED`. Invalid UUIDs return
`400`, unknown orders return `404`, and an order in a non-cancellable status returns `409`.

### Health

`GET /api/health` returns `status`, an ISO timestamp, and `uptimeSeconds`. This is a process
liveness endpoint only; it does not check PostgreSQL or other dependencies.

## Order Processing Flow

1. The controller validates the request DTO, including nested item fields.
2. `CreateOrderService` merges repeated product IDs and rejects a merged quantity that would
   exceed PostgreSQL's `integer` limit.
3. The write repository starts a database transaction and locks active product rows in a
   deterministic ID order.
4. It verifies that every product exists and has enough stock, creates the `PENDING` order,
   and conditionally decrements stock.
5. It stores each order item with purchase-time name, SKU, and unit-price snapshots.
6. The transaction commits only when the order, all items, and all inventory updates succeed;
   any error rolls the entire operation back.
7. The outbox publisher later sends `{ "orderId": "..." }` to BullMQ with a stable
   `order-processing-<orderId>` job ID. Publishing happens after the database transaction and
   retries if Redis is unavailable.

Order listing applies the optional status filter and pagination. Order detail reads the item
snapshots rather than reconstructing historical values from the current product record.

Cancellation locks the order row, verifies its status, restores each item's quantity in a
stable product order, and then saves `CANCELLED`. If any inventory restoration or save fails,
the transaction rolls back. A concurrent second cancellation waits for the first transaction
and then sees the updated status, preventing a second stock restoration.

## Inventory Concurrency and Overselling

The order-creation transaction uses two safeguards:

1. **Pessimistic row lock:** product rows are selected with `FOR UPDATE` semantics and ordered
   by product ID. A competing transaction for the same product waits for the lock, then
   evaluates the committed stock value.
2. **Conditional decrement:** each inventory update includes `stock >= requested quantity`.
   If exactly one row is not updated, the repository raises an application error and the
   transaction rolls back.

For example, if one unit remains and two customers attempt to buy it concurrently, one
transaction can decrement stock and commit. The waiting transaction then observes insufficient
stock and fails with `409 Conflict`; it cannot create a partial order or make stock negative.
Sorting product IDs consistently also reduces deadlocks when orders contain multiple products.

This protects inventory from concurrent overselling, but the API does not yet accept an
idempotency key. A client retry after an uncertain response is not guaranteed to reuse the
original order.

## Tests

Run the test suite with:

```bash
npm test -- --runInBand
```

Run one test file by name:

```bash
npx jest --runInBand create-order.service.spec.ts
```

Current Jest tests cover order-creation service behavior (valid creation, insufficient-stock
error propagation, duplicate-item merging, integer overflow, and unexpected repository
errors), order cancellation repository behavior (eligible statuses, duplicate cancellation,
missing orders, and inventory-restoration failure), order-list query behavior, and order-detail
service behavior.

These are unit tests using mocks; they do not start PostgreSQL or prove real database lock
behavior under concurrent HTTP requests. No HTTP E2E or real-PostgreSQL concurrency test is
currently included.

## Deployment

Build and run the API with:

```bash
npm ci
npm run build
npm run start:prod
```

Configure these environment variables in the deployment environment:

| Variable       | Purpose                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string; use the SSL settings required by the provider |
| `REDIS_URL`    | Redis connection URL (`redis://` or TLS-enabled `rediss://`)                |
| `PORT`         | Listening port assigned by the platform                                     |
| `NODE_ENV`     | Set to `production`                                                         |
| `API_URL`      | Public API base URL including `/api`, such as `https://api.example.com/api` |

Apply migrations as a release step before sending traffic. The current `npm run migration`
script explicitly loads `.env`; platforms that only inject environment variables must provide
that file for the migration command or adapt the script to use the platform environment.
Do not run `npm run migration:revert` as a routine deployment action: the current `down`
migrations drop their corresponding tables.

The production build is emitted to `dist/`; `npm run start:prod` loads `.env` and starts the
compiled NestJS entry point. For a platform that injects environment variables without a
`.env` file, use an appropriate start command such as `node dist/main.js` or adjust the script.
The repository includes a Dockerfile and Compose setup for local API/PostgreSQL/Redis use, but
does not include hosting-provider configuration or a CI/CD deployment pipeline.

## Background Worker Status

The API now connects to Redis and publishes transactional outbox records to the BullMQ
`order-processing` queue. Job data contains only `orderId`, and the stable job ID is
`order-processing-<orderId>`. BullMQ can suppress duplicate adds while a job with that ID still
exists; if the job is removed, the same ID may be accepted again, so database idempotency is
still required in the worker.

A consumer/worker entry point is not implemented yet. Jobs will remain waiting in Redis until a
worker is added. Order confirmation, notification-log creation, simulated failures, worker
retry policy, exhausted-retry stock restoration, and `GET /orders/:id/jobs` are future phases.

## Known Limitations and Next Steps

- No payment integration or order-confirmation endpoint is implemented. `CONFIRMED` is a
  supported persisted status and may be used by other workflows, but this API does not set it.
- Client-request idempotency is not implemented for order creation.
- The queue publisher is integrated, but no worker consumes its jobs yet. Database-level job
  idempotency and worker retry/compensation behavior remain to be implemented.
- Automated tests currently focus on selected order service and repository behavior; product
  endpoint tests, HTTP E2E tests, and tests against a real PostgreSQL instance are not included.
- Deployment automation and worker deployment configuration remain future work; Compose currently targets local development.
