# ADR-001: MySQL as the database (replaces Supabase Postgres)

- **Status:** Accepted
- **Date:** 2026-11-14
- **Deciders:** Project team

## Context

The first technical design (v0.1, 2026-11-11) used Supabase, which runs PostgreSQL. It relied on Supabase Auth, Postgres row-level security (RLS), pg_cron, pgvector, Storage and Realtime.

On 2026-11-14 the project requirements were confirmed as **firm**:

- Web development: JavaScript / Node.js, a framework such as React, and building and consuming REST APIs (front and back end)
- Databases: **MySQL and/or MongoDB** for transactions, invoices and user data

Postgres does not meet the database requirement. No database code had been written yet: only the Next.js scaffold, pure helper functions and part of the synthetic data generator. Switching now therefore costs only documentation and plan changes.

## Decision

1. Use **MySQL 8** (InnoDB, `utf8mb4`) as the only database for the MVP.
2. Connect from Next.js server code (Node.js) with **`mysql2/promise`**, using a connection pool and **prepared statements only** (`?` placeholders). No ORM. Schema changes are plain `.sql` migration files applied by `scripts/migrate.mjs`.
3. Do not use MongoDB. Our data (transactions, settlements, invoices, users, reconciliation results) is relational: reconciliation joins transactions to settlements to invoice lines and needs exact sums. One database is simpler for a 4-person team. If a document store is ever useful (for example, raw webhook payloads or chat logs), that becomes a new ADR.
4. Replace each Supabase feature as follows:

| Supabase feature | Replacement |
|---|---|
| Postgres | MySQL 8. Local: MySQL Community Server or Docker `mysql:8`. Hosted: a managed MySQL 8 service that Vercel can reach (choice recorded at setup; see Technical Design §9) |
| Supabase Auth | Our own email + password login: `bcryptjs` password hashes in `users`, server-side sessions in `sessions` (random token in an httpOnly cookie, only its SHA-256 hash stored) |
| Row-level security | **Tenant scoping in the data layer.** The merchant id always comes from the server session, never from the request. Every query on merchant-owned data includes `WHERE merchant_id = ?`. Integration tests prove merchant A cannot read merchant B's data |
| pg_cron + Edge Functions | **Vercel Cron Jobs** calling `/api/cron/*` route handlers, protected by `CRON_SECRET` |
| Postgres full-text search | MySQL `FULLTEXT` index with `MATCH … AGAINST` |
| pgvector (Phase 2) | Embeddings stored as JSON, with cosine similarity computed in Node. The help centre has only a few hundred chunks, so this is fast enough |
| Storage | **Vercel Blob** |
| Realtime | Polling (the notifications bell refreshes on page load and every 60 s) |
| Vault (OAuth tokens) | AES-256-GCM encryption in app code, with the key in an environment variable |
| pgTAP | **Vitest integration tests** against a test MySQL database (locally and in GitHub Actions) |

## Consequences

**Good**
- Meets the confirmed requirement
- MySQL is widely taught and widely documented, so it is easy for the team to learn
- Writing our own SQL, login and tenant checks shows more back-end work to assessors

**Costs and risks**
- **The hosted MySQL must support InnoDB foreign keys and FULLTEXT indexes.** Our schema uses composite foreign keys (`(merchant_id, id)`) and a FULLTEXT index for help-centre search. Aiven for MySQL and Railway are fine. PlanetScale (Vitess) and TiDB are risky: they handle foreign keys and FULLTEXT differently or not at all, so do not pick them without testing `npm run migrate` first.
- **Serverless connections:** each Vercel instance has its own pool, so the pool is small in production (`DB_CONNECTION_LIMIT`, default 3, one idle connection kept) to stay under the provider's connection limit.
- **Data isolation is no longer enforced by the database.** One missing `WHERE merchant_id = ?` would leak data. Mitigations:
  - All SQL lives in `lib/data/`. Pages, API routes and assistant tools never write SQL.
  - Every data function takes `merchantId` as its first argument.
  - Every data function has a cross-merchant integration test.
  - Code review checks this.
- **More code to write:** login, sessions, migrations and cron routes (estimated 1–2 extra days in the MVP)
- MySQL has no `timestamptz`. All times are stored in UTC as `DATETIME(3)`, with the pool's `timezone` set to `'Z'`. Singapore days are computed with `CONVERT_TZ(created_at, '+00:00', '+08:00')`. Singapore has no daylight saving, so a fixed offset is correct, and the server's time-zone tables do not need to be loaded.
- `SUM()` returns a DECIMAL, which `mysql2` returns as a string by default. The pool sets `decimalNumbers: true` and `supportBigNumbers: true`, so money stays a JavaScript number in cents.
- The Supabase project and the keys in `.env.local` are no longer used. `@supabase/*` packages are removed in plan Task 1b.
- Vercel Hobby cron jobs run at most once a day. That is enough for the nightly check-up. Frequent webhook retries (Phase 1) may need a paid plan or an external scheduler, to be decided then.
