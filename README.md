<p align="center">
  <img src="https://img.icons8.com/fluency/96/shopping-cart.png" width="88" alt="Mini Order Management shopping cart icon" />
</p>

<h1 align="center">Mini Order Management</h1>

<p align="center">
  A NestJS REST API backed by PostgreSQL and TypeORM. The current implementation
  focuses on product listing, database migrations, seed data, and an application
  health endpoint. Order processing and workers are planned, not implemented.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS 11" />
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeORM-ORM-FE0803?logo=typeorm&logoColor=white" alt="TypeORM" />
  <img src="https://img.shields.io/badge/Swagger-OpenAPI-85EA2D?logo=swagger&logoColor=black" alt="Swagger OpenAPI" />
</p>

## Table of Contents

- [Implemented Features](#implemented-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Run Locally](#run-locally)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Product Request Flow](#product-request-flow)
- [Orders and Background Jobs](#orders-and-background-jobs)
- [Preventing Overselling](#preventing-overselling)
- [Deployment](#deployment)
- [Worker Deployment](#worker-deployment)
- [Remaining Work](#remaining-work)

## Implemented Features

- `GET /api/products` with pagination, name search, and minimum/maximum price
  filters.
- DTO-based request validation and transformation.
- PostgreSQL persistence through TypeORM.
- A versioned TypeORM migration; schema synchronization is disabled.
- A CSV seed command for 100 sample products. Existing SKUs are skipped.
- `GET /api/health`, which reports process liveness, timestamp, and uptime.
- Swagger UI at `/api/docs`.

The product API currently implements listing only. Product creation, single-item
read, update, and soft-delete endpoints are not implemented yet.

## Technology Stack

- Node.js and TypeScript
- NestJS 11
- PostgreSQL with TypeORM
- Swagger / OpenAPI
- Jest and Supertest dependencies are present, but E2E test files are currently
  not included in the repository.

BullMQ and Redis are **not integrated yet**. Order processing and a background
worker described below are plans, not existing runtime features.

## Project Structure

```text
src/
├── app.module.ts                 # Root module and application-wide wiring
├── main.ts                       # Bootstrap, global API prefix, validation, Swagger
├── database/
│   ├── config/
│   │   ├── data-source.ts        # TypeORM CLI DataSource
│   │   └── typeorm-options.ts    # Shared PostgreSQL options; synchronize is off
│   ├── entities/                 # TypeORM persistence entities
│   ├── migrations/               # Explicit schema changes
│   └── seeds/products/           # Product CSV and seed command
└── modules/
    ├── health/                   # Liveness endpoint
    └── products/
        ├── application/          # Use case and repository contract
        ├── infrastructure/       # TypeORM repository implementation
        └── presentation/         # Controller and request DTO
```

The product listing request flows through the HTTP controller and validated
DTO, then the application service, repository contract, and TypeORM repository.
Database query construction stays in the infrastructure layer.

## Run Locally

### Prerequisites

- Node.js 20.6 or later and npm (`--env-file` was added in
  [Node.js 20.6](https://nodejs.org/download/release/v20.6.0/docs/api/cli.html#--env-fileconfig))
- A PostgreSQL database, for example a Neon project

Redis is not required for the features currently implemented.

### Install and configure

```bash
npm ci
```

Create `.env` from `.env.example` (PowerShell users can run
`Copy-Item .env.example .env`) and set the PostgreSQL connection string:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=verify-full
PORT=3001
NODE_ENV=development
API_URL=http://localhost:3001/api
```

Use the connection string supplied by your database provider and URL-encode
special characters in credentials when required. `API_URL` is the public API
base URL used in the startup summary; it should include `/api`. `PORT` controls
the listening port.

### Create the database schema and seed sample data

Run migrations explicitly; TypeORM `synchronize` is disabled:

```bash
npm run migration
```

Optionally import the 100 sample products from the CSV:

```bash
npm run seed:products
```

The seed command inserts products whose SKUs do not already exist and leaves
existing rows unchanged.

### Start the API

```bash
npm run dev
```

The development command loads `.env` and starts NestJS in watch mode. With the
example configuration, the main URLs are:

- API base: `http://localhost:3001/api`
- Products: `http://localhost:3001/api/products`
- Health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api/docs`

## Database Schema

The current migration creates one table, `products`:

| Column       | PostgreSQL type         | Meaning / constraints                                                                             |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `id`         | `uuid`                  | Primary key generated by PostgreSQL                                                               |
| `sku`        | `varchar(64)`           | Required, unique, and not blank                                                                   |
| `name`       | `varchar(200)`          | Required and not blank                                                                            |
| `price`      | `numeric(12, 2)`        | Required and non-negative; exposed as a string by the read contract to preserve decimal precision |
| `stock`      | `integer`               | Required and non-negative                                                                         |
| `created_at` | `timestamptz`           | Creation timestamp, generated by PostgreSQL                                                       |
| `updated_at` | `timestamptz`           | Last-update timestamp, managed by TypeORM                                                         |
| `deleted_at` | `timestamptz`, nullable | Soft-delete marker; deleted rows are excluded by the current listing query                        |

The schema is represented by `ProductEntity` and the migration in
`src/database/migrations`. Apply changes through migrations rather than
`synchronize`.

TypeORM also maintains a migration-history table (named `migrations` by
default). It records which migrations have been applied; it is infrastructure
metadata, not an e-commerce entity.

## API Endpoints

### `GET /api/products`

Implemented query parameters:

| Parameter  | Description                             | Default / limits                                                        |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `page`     | Page number                             | `1`; integer greater than or equal to 1                                 |
| `limit`    | Items per page                          | `10`; integer from 1 to 100                                             |
| `search`   | Case-insensitive search by product name | Optional; maximum 200 characters                                        |
| `minPrice` | Inclusive minimum price                 | Optional; non-negative, up to 2 decimal places                          |
| `maxPrice` | Inclusive maximum price                 | Optional; non-negative, up to 2 decimal places and not below `minPrice` |

The response contains `items`, `page`, `limit`, `total`, and `totalPages`.

Example:

```http
GET /api/products?page=1&limit=10&search=phone&minPrice=100&maxPrice=500
```

### `GET /api/health`

Returns a lightweight liveness response containing `status`, `timestamp`, and
`uptimeSeconds`. This endpoint reports that the API process is responding; it
does not verify database or Redis connectivity.

### Swagger

OpenAPI documentation is served at `/api/docs`.

## Product Request Flow

For the implemented listing endpoint:

1. `ProductsController` receives the HTTP query.
2. `GetProductsQueryDto` transforms and validates the query values.
3. `GetProductsService` delegates the use case through the
   `ProductReadRepository` contract.
4. `TypeOrmProductReadRepository` builds the parameterized PostgreSQL query,
   applies filters and pagination, and maps persistence entities to response
   items.

## Orders and Background Jobs

**Status: not implemented.** There is no order table or order endpoint, and the
repository currently has no BullMQ queue, Redis configuration, job producer, or
worker process.

The intended flow when these features are added is:

1. Validate the order request and product quantities.
2. In one PostgreSQL transaction, verify and reserve/decrement stock and create
   the order and its items.
3. Commit the transaction before dispatching asynchronous follow-up work.
4. Enqueue post-order work such as notifications or invoice generation in
   BullMQ. A transactional outbox should be considered so a database commit
   cannot silently lose its corresponding job if Redis is unavailable.
5. Let a separate worker consume jobs with retries and idempotent handlers.

This describes a proposed design; none of these order/job steps are currently
implemented.

## Preventing Overselling

**Status: not implemented for orders.** The products table prevents negative
stock values, but there is no order flow that reserves or decrements stock yet.
The database check constraint alone is not a complete overselling strategy.

When order creation is implemented, stock must be checked and changed atomically
inside the same transaction as the order write. One suitable pattern is a
conditional update:

```sql
UPDATE products
SET stock = stock - $1
WHERE id = $2
  AND deleted_at IS NULL
  AND stock >= $1
RETURNING id, stock;
```

If the update returns no row, the product is missing, deleted, or has
insufficient stock; reject the order and roll back the transaction. For an
order with multiple products, all reservations and order rows must commit or
roll back together. Idempotency should also be enforced so retries do not
decrement stock twice.

## Deployment

The API can be built with:

```bash
npm ci
npm run build
```

Configure the deployment environment with:

- `DATABASE_URL`: production PostgreSQL connection string; use
  `sslmode=verify-full` when supported by the provider ([PostgreSQL SSL modes](https://www.postgresql.org/docs/current/libpq-ssl.html)).
- `PORT`: the port assigned by the hosting platform.
- `NODE_ENV=production`.
- `API_URL`: the externally reachable API base URL, including `/api`, for
  example `https://api.example.com/api`.

Apply migrations as a one-off release/deployment step before serving traffic.
The existing `npm run migration` command reads `.env`, so the migration runner
must have that file populated with the production `DATABASE_URL` (or the script
must be adapted to the hosting platform's injected environment variables).
Do not run `migration:revert` as a routine deploy step; the current migration's
`down` method drops the products table.

After building, the production entry point is `dist/main.js`. The existing
`npm run start:prod` script also loads `.env`; on platforms that inject
environment variables and do not provide a `.env` file, use `node dist/main.js`
as the start command or adapt the script accordingly.

No hosting-provider-specific deployment configuration, Docker image, or CI/CD
pipeline is included in the repository yet.

## Worker Deployment

**Status: not deployable yet.** There is no worker entry point or start script,
and BullMQ/Redis are not dependencies. Once implemented, deploy the worker as a
separate long-running process/service from the same codebase or release image.
Configure its Redis connection and queue settings through environment variables,
and scale worker concurrency independently from the HTTP API. The worker must
be idempotent and safe to retry; do not deploy a placeholder worker command
until the consumer and entry point exist.

## Remaining Work

- Implement `POST /api/products`, `GET /api/products/:id`,
  `PATCH /api/products/:id`, and soft-delete `DELETE /api/products/:id`.
- Implement order persistence and order endpoints.
- Add transactional inventory reservation/decrement and idempotency controls.
- Integrate BullMQ and Redis, then implement job producers and a worker.
- Decide and implement reliable post-commit job delivery, such as a transactional
  outbox.
- Add automated tests if/when the project scope requires them. E2E spec files
  are currently not present.
- Add provider-specific deployment, migration-release, and worker configuration.
