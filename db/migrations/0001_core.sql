-- Core merchant data. InnoDB, utf8mb4, ids CHAR(36), money BIGINT cents, times DATETIME(3) UTC.

CREATE TABLE merchants (
  id             CHAR(36)     NOT NULL,
  legal_name     VARCHAR(200) NOT NULL,
  trading_name   VARCHAR(200) NOT NULL,
  uen            VARCHAR(20)  NOT NULL,
  category       VARCHAR(60)  NOT NULL,
  gst_registered TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE outlets (
  id          CHAR(36)     NOT NULL,
  merchant_id CHAR(36)     NOT NULL,
  name        VARCHAR(200) NOT NULL,
  address     VARCHAR(300) NULL,
  PRIMARY KEY (id),
  KEY idx_outlets_merchant (merchant_id),
  CONSTRAINT fk_outlets_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE terminals (
  id          CHAR(36)    NOT NULL,
  merchant_id CHAR(36)    NOT NULL,
  outlet_id   CHAR(36)    NOT NULL,
  serial_no   VARCHAR(60) NOT NULL,
  model       VARCHAR(60) NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  KEY idx_terminals_merchant (merchant_id),
  KEY idx_terminals_outlet (outlet_id),
  CONSTRAINT fk_terminals_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
  CONSTRAINT fk_terminals_outlet FOREIGN KEY (outlet_id) REFERENCES outlets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE settlements (
  id            CHAR(36)    NOT NULL,
  merchant_id   CHAR(36)    NOT NULL,
  business_date DATE        NOT NULL,
  channel       ENUM('nets_qr','nets_click','enets','card','sgqr') NOT NULL,
  gross_cents   BIGINT      NOT NULL,
  fee_cents     BIGINT      NOT NULL,
  net_cents     BIGINT      NOT NULL,
  status        ENUM('pending','paid','delayed') NOT NULL DEFAULT 'pending',
  expected_date DATE        NULL,
  paid_date     DATE        NULL,
  bank_ref      VARCHAR(60) NULL,
  PRIMARY KEY (id),
  KEY idx_settlements_merchant_date (merchant_id, business_date),
  CONSTRAINT fk_settlements_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE transactions (
  id            CHAR(36)    NOT NULL,
  merchant_id   CHAR(36)    NOT NULL,
  outlet_id     CHAR(36)    NULL,
  terminal_id   CHAR(36)    NULL,
  channel       ENUM('nets_qr','nets_click','enets','card','sgqr') NOT NULL,
  status        ENUM('success','failed','refunded') NOT NULL,
  amount_cents  BIGINT      NOT NULL,
  fee_cents     BIGINT      NOT NULL DEFAULT 0,
  customer_ref  VARCHAR(64) NULL,
  failure_code  VARCHAR(40) NULL,
  settlement_id CHAR(36)    NULL,
  created_at    DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_txn_merchant_created (merchant_id, created_at),
  KEY idx_txn_merchant_status_created (merchant_id, status, created_at),
  KEY idx_txn_settlement (settlement_id),
  CONSTRAINT fk_txn_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
  CONSTRAINT fk_txn_outlet FOREIGN KEY (outlet_id) REFERENCES outlets (id) ON DELETE SET NULL,
  CONSTRAINT fk_txn_terminal FOREIGN KEY (terminal_id) REFERENCES terminals (id) ON DELETE SET NULL,
  CONSTRAINT fk_txn_settlement FOREIGN KEY (settlement_id) REFERENCES settlements (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoices (
  id          CHAR(36)     NOT NULL,
  merchant_id CHAR(36)     NOT NULL,
  period      DATE         NOT NULL COMMENT 'first day of the billed month',
  total_cents BIGINT       NOT NULL,
  status      ENUM('unpaid','paid','overdue') NOT NULL DEFAULT 'unpaid',
  due_date    DATE         NOT NULL,
  pdf_path    VARCHAR(300) NULL,
  PRIMARY KEY (id),
  KEY idx_invoices_merchant_period (merchant_id, period),
  CONSTRAINT fk_invoices_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE invoice_lines (
  id               CHAR(36)     NOT NULL,
  merchant_id      CHAR(36)     NOT NULL,
  invoice_id       CHAR(36)     NOT NULL,
  charge_type      VARCHAR(40)  NOT NULL,
  description      VARCHAR(200) NOT NULL,
  qty              INT          NOT NULL DEFAULT 1,
  unit_price_cents BIGINT       NULL,
  amount_cents     BIGINT       NOT NULL,
  PRIMARY KEY (id),
  KEY idx_invoice_lines_merchant (merchant_id),
  KEY idx_invoice_lines_invoice (invoice_id),
  CONSTRAINT fk_invoice_lines_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recon_runs (
  id              CHAR(36)    NOT NULL,
  merchant_id     CHAR(36)    NOT NULL,
  period          DATE        NOT NULL,
  run_at          DATETIME(3) NOT NULL,
  matched_count   INT         NOT NULL DEFAULT 0,
  exception_count INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_recon_runs_merchant (merchant_id, run_at),
  CONSTRAINT fk_recon_runs_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recon_exceptions (
  id             CHAR(36)     NOT NULL,
  merchant_id    CHAR(36)     NOT NULL,
  run_id         CHAR(36)     NOT NULL,
  type           ENUM('amount_mismatch','missing_settlement','settlement_delay','failed_payment','fee_mismatch') NOT NULL,
  settlement_id  CHAR(36)     NULL,
  transaction_id CHAR(36)     NULL,
  expected_cents BIGINT       NULL,
  actual_cents   BIGINT       NULL,
  status         ENUM('open','resolved') NOT NULL DEFAULT 'open',
  note           VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_recon_exc_merchant_status (merchant_id, status),
  KEY idx_recon_exc_run (run_id),
  CONSTRAINT fk_recon_exc_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
  CONSTRAINT fk_recon_exc_run FOREIGN KEY (run_id) REFERENCES recon_runs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id          CHAR(36)     NOT NULL,
  merchant_id CHAR(36)     NOT NULL,
  kind        VARCHAR(40)  NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        VARCHAR(500) NULL,
  link        VARCHAR(300) NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at     DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_notifications_merchant (merchant_id, created_at),
  CONSTRAINT fk_notifications_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
