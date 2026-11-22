-- 1) Every primary key is named after its table (merchant_id, transaction_id, ...) instead of a bare `id`,
--    so a column says which table it points at wherever it appears. (NETS feedback, mock meeting 2026-11-22.)
--    MySQL 8 carries foreign keys and indexes over to the renamed columns.
-- 2) NETS' own identifiers, which show the tiering: MID (merchant) -> TID (terminal) -> STAN (payment).
--    STAN replaces our made-up customer reference.

ALTER TABLE merchants        RENAME COLUMN id TO merchant_id;
ALTER TABLE outlets          RENAME COLUMN id TO outlet_id;
ALTER TABLE terminals        RENAME COLUMN id TO terminal_id;
ALTER TABLE settlements      RENAME COLUMN id TO settlement_id;
ALTER TABLE transactions     RENAME COLUMN id TO transaction_id;
ALTER TABLE invoices         RENAME COLUMN id TO invoice_id;
ALTER TABLE invoice_lines    RENAME COLUMN id TO invoice_line_id;
ALTER TABLE recon_runs       RENAME COLUMN id TO recon_run_id;
ALTER TABLE recon_exceptions RENAME COLUMN id TO recon_exception_id,
                             RENAME COLUMN run_id TO recon_run_id;
ALTER TABLE notifications    RENAME COLUMN id TO notification_id;
ALTER TABLE users            RENAME COLUMN id TO user_id;
ALTER TABLE sessions         RENAME COLUMN id TO session_id;
ALTER TABLE kb_chunks        RENAME COLUMN id TO kb_chunk_id;
-- Renaming a column leaves InnoDB's full-text index returning no rows (seen on MySQL 8.0), so rebuild it.
ALTER TABLE kb_chunks DROP INDEX ft_kb_chunks;
ALTER TABLE kb_chunks ADD FULLTEXT KEY ft_kb_chunks (heading, content);

-- MID: NETS merchant ID, one per merchant (business).
ALTER TABLE merchants
  ADD COLUMN mid VARCHAR(15) NULL COMMENT 'NETS merchant ID (MID)' AFTER merchant_id,
  ADD UNIQUE KEY uq_merchants_mid (mid);

-- TID: NETS terminal ID, one per terminal (an online shop has a virtual terminal).
ALTER TABLE terminals
  ADD COLUMN tid VARCHAR(8) NULL COMMENT 'NETS terminal ID (TID)' AFTER terminal_id,
  ADD UNIQUE KEY uq_terminals_tid (tid);

-- STAN: System Trace Audit Number, a 6-digit counter each terminal gives every payment.
-- It restarts after 999999, so on its own it is only unique per terminal; TID + STAN + date identifies a payment.
ALTER TABLE transactions
  ADD COLUMN stan CHAR(6) NULL COMMENT 'System Trace Audit Number, per terminal' AFTER terminal_id,
  DROP COLUMN customer_ref,
  ADD KEY idx_txn_terminal_stan (terminal_id, stan);
