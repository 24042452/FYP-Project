# ADR-002: Keys named after their table, and NETS identifiers (MID, TID, STAN)

- **Status:** Accepted
- **Date:** 2026-11-22
- **Deciders:** Project team, after NETS feedback at the first mock meeting

## Context

At the first mock meeting (2026-11-22), NETS reviewed our ERD and said:

- Every table's primary key was called `id`, so in a diagram or a join it was not obvious which table an id belonged to.
- NETS identifies things with its own numbers, in a hierarchy: **MID** (merchant ID) at the top, **TID** (terminal ID) in the middle, and the payment at the bottom. NETS uses the **STAN** (System Trace Audit Number) to identify a payment, not a customer reference.

## Decision

1. **Every primary key is named `<entity>_id`**: `merchant_id`, `outlet_id`, `terminal_id`, `transaction_id`, `settlement_id`, `invoice_id`, `invoice_line_id`, `recon_run_id`, `recon_exception_id`, `notification_id`, `user_id`, `session_id`, `kb_chunk_id`. A foreign key has the same name as the key it points at (`recon_exceptions.run_id` became `recon_run_id`). Migration `0007_clear_ids_and_nets_ids.sql`.
2. **NETS identifiers are stored alongside our internal keys** (the internal UUIDs stay as the primary keys, because NETS numbers are assigned by NETS and can be missing or reused):
   - `merchants.mid` (unique)
   - `terminals.tid` (unique)
   - `transactions.stan`: a 6-digit counter per terminal. It restarts after 999999, so it is unique only per terminal, and **TID + STAN + date** identifies a payment.
3. `transactions.customer_ref` is removed. The payment details and search use the STAN instead.
4. In JavaScript, data functions still return objects with an `id` property (`SELECT transaction_id AS id ...`), so the screens did not need changing. The clear names are in the database, the ERD and SQL.

## Consequences

- SQL and the ERD read clearly: `JOIN settlements s ON s.settlement_id = t.settlement_id`.
- Seeded MIDs and TIDs are synthetic, not real NETS numbers.
- Renaming a column on `kb_chunks` left its FULLTEXT index returning no rows on MySQL 8.0, so the migration rebuilds that index.
