# Database guide (MySQL 8)

Decision record: [ADR-001](../adr/001-mysql-database.md). Data model: [Technical Design section 4](../02-technical-design.md).

## 1. Local setup

1. Install MySQL Community Server 8 (or run Docker `mysql:8`).
2. As the MySQL root user, create the databases and the two users (change the passwords):

```sql
CREATE DATABASE nets_portal CHARACTER SET utf8mb4;
CREATE DATABASE nets_portal_test CHARACTER SET utf8mb4;

-- Admin: runs migrations and seeding. Never used by the running app.
-- Three host names, because "localhost" in the connection string can resolve to 127.0.0.1 or ::1 (IPv6).
CREATE USER 'portal_admin'@'localhost' IDENTIFIED BY 'change-me';
CREATE USER 'portal_admin'@'127.0.0.1' IDENTIFIED BY 'change-me';
CREATE USER 'portal_admin'@'::1' IDENTIFIED BY 'change-me';
GRANT ALL ON nets_portal.* TO 'portal_admin'@'localhost';
GRANT ALL ON nets_portal_test.* TO 'portal_admin'@'localhost';
GRANT ALL ON nets_portal.* TO 'portal_admin'@'127.0.0.1';
GRANT ALL ON nets_portal_test.* TO 'portal_admin'@'127.0.0.1';
GRANT ALL ON nets_portal.* TO 'portal_admin'@'::1';
GRANT ALL ON nets_portal_test.* TO 'portal_admin'@'::1';

-- App: what the running app (and the data functions under test) use.
CREATE USER 'portal_app'@'localhost' IDENTIFIED BY 'change-me';
CREATE USER 'portal_app'@'127.0.0.1' IDENTIFIED BY 'change-me';
CREATE USER 'portal_app'@'::1' IDENTIFIED BY 'change-me';
GRANT SELECT, INSERT, UPDATE, DELETE ON nets_portal.* TO 'portal_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON nets_portal_test.* TO 'portal_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON nets_portal.* TO 'portal_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON nets_portal_test.* TO 'portal_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON nets_portal.* TO 'portal_app'@'::1';
GRANT SELECT, INSERT, UPDATE, DELETE ON nets_portal_test.* TO 'portal_app'@'::1';
```

3. Copy `.env.example` to `.env.local` and fill in the connection strings:

| Variable | Used by |
|---|---|
| `DATABASE_URL` | the app (user `portal_app`, database `nets_portal`) |
| `DATABASE_ADMIN_URL` | `npm run migrate` and the seed (user `portal_admin`) |
| `DATABASE_SSL` | `true` for a hosted database (TLS), `false` locally |
| `TEST_DATABASE_URL` | integration tests, data functions (user `portal_app`, database `nets_portal_test`) |
| `TEST_DATABASE_ADMIN_URL` | integration tests: migrations and clearing tables (user `portal_admin`, `nets_portal_test`) |

## 2. Migrations

```
npm run migrate
```

Applies each `db/migrations/*.sql` file that is not yet listed in `schema_migrations`, in name order, and prints what it applied. Running it again applies nothing. To change the schema, add a new numbered file (never edit one that has been applied). MySQL commits DDL statements immediately, so a file that fails halfway can leave a partial schema: fix the file, drop what it created, and run again.

## 3. Tests

`npm run test:integration` runs `tests/integration/` against `nets_portal_test`. It runs the migrations first, and each test file clears the tables it uses. It only runs when `TEST_DATABASE_URL` is set. `npm test` runs the unit tests only and needs no database. Plain `npx vitest run` runs both projects when `TEST_DATABASE_URL` is set (so it then needs MySQL).

## 4. The isolation rule

Every query on a merchant-owned table has `WHERE merchant_id = ?`, uses `?` placeholders (never string-joined SQL), and lives in `lib/data/`. Every data function takes `merchantId` first and gets one line in the table in `tests/integration/isolation.test.js`.

## 5. Table dictionary

Ids are `CHAR(36)` UUIDs. Money is `BIGINT` cents. Times are `DATETIME(3)` in UTC (Singapore days: `CONVERT_TZ(col, '+00:00', '+08:00')`). Channel values: `nets_qr`, `nets_click`, `enets`, `card`, `sgqr`. Every child table cascades on delete from `merchants`. `DATE` columns are returned by the app pool as `'YYYY-MM-DD'` strings (`dateStrings: ['DATE']`).

**Composite foreign keys.** Parents `outlets`, `terminals`, `settlements`, `invoices` and `recon_runs` have `UNIQUE (id, merchant_id)`, and child foreign keys include `merchant_id`: `terminals`, `transactions` (outlet, terminal, settlement), `invoice_lines` (invoice) and `recon_exceptions` (run). The database therefore rejects a child row whose `merchant_id` differs from its parent's. All of these composite foreign keys are `ON DELETE CASCADE`, including `transactions` to outlets, terminals and settlements. This is required, not a choice of convenience: with RESTRICT, deleting a merchant fails (error 1451) because InnoDB can reach the outlet or terminal before its transactions. The test `tests/integration/schema.test.js` proves that `DELETE FROM merchants WHERE id = ?` (as the admin user, as the seeder does) removes the merchant's outlets, terminals, settlements, transactions, invoices, invoice lines, recon runs and recon exceptions, and leaves another merchant's rows untouched. Side effect: deleting a single outlet, terminal or settlement also deletes the transactions linked to it, so the app must never delete those rows. `recon_exceptions.settlement_id` and `transaction_id` are loose references with no foreign keys.

| Table | Columns |
|---|---|
| `merchants` | id, legal_name, trading_name, uen, category, gst_registered, created_at |
| `outlets` | id, merchant_id, name, address |
| `terminals` | id, merchant_id, outlet_id, serial_no, model, status |
| `transactions` | id, merchant_id, outlet_id, terminal_id, channel, status (success/failed/refunded), amount_cents, fee_cents, customer_ref, failure_code, settlement_id, created_at |
| `settlements` | id, merchant_id, business_date (DATE), channel, gross_cents, fee_cents, net_cents, status (pending/paid/delayed), expected_date, paid_date, bank_ref |
| `invoices` | id, merchant_id, period (DATE, first of month), total_cents, status (unpaid/paid/overdue), due_date, pdf_path |
| `invoice_lines` | id, merchant_id, invoice_id, charge_type, channel (set for MDR lines, NULL for terminal rental / portal fee; migration 0003), description, qty, unit_price_cents, amount_cents |
| `recon_runs` | id, merchant_id, period, run_at, matched_count, exception_count |
| `recon_exceptions` | id, merchant_id, run_id, type (amount_mismatch/missing_settlement/settlement_delay/failed_payment/fee_mismatch), settlement_id, transaction_id, day, channel, message (plain-English sentence; migration 0004), expected_cents, actual_cents, status (open/resolved), note |
| `notifications` | id, merchant_id, kind, title, body, link, created_at, read_at |
| `users` | id, email (unique), password_hash, name, created_at, last_login_at |
| `sessions` | id, user_id, token_hash (SHA-256, unique), expires_at, created_at |
| `merchant_users` | merchant_id, user_id, role (owner/manager/cashier/accountant); primary key (merchant_id, user_id) |
| `schema_migrations` | name, applied_at (maintained by `npm run migrate`) |

Indexes: `transactions(merchant_id, created_at)`, `transactions(merchant_id, status, created_at)`, `settlements(merchant_id, business_date)`, `invoices(merchant_id, period)`.

`invoice_lines` and `recon_exceptions` carry their own `merchant_id` (not in the Technical Design table) so every query on them can filter by merchant directly.

## Importing the schema into a hosted database (e.g. the school Azure server)

If you can't run `npm run migrate` against a server (for example you only have MySQL Workbench access), import a single SQL file instead:

```bash
node scripts/export-schema.mjs <schema-name>              # writes db/export/<schema-name>.sql
node scripts/export-schema.mjs <schema-name> --no-create  # same, without CREATE DATABASE / USE
```

The file creates every table from `db/migrations/` and fills `schema_migrations`, so a later `npm run migrate` against that schema applies nothing. It contains no data and no users; load the demo data with `npm run seed` (pointing `DATABASE_ADMIN_URL` at the server). Regenerate the file whenever a migration is added. `db/export/SOI-2026-0021-sherwin.sql` is the export for the school server.
