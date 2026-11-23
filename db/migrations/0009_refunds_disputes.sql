-- Refunds & disputes: refunds a merchant gives, disputes a customer's bank raises, and evidence files.
-- Composite (id, merchant_id) keys keep every row inside one merchant, as in earlier migrations.

ALTER TABLE transactions ADD UNIQUE KEY uq_txn_id_merchant (transaction_id, merchant_id);

ALTER TABLE settlements ADD COLUMN refund_cents BIGINT NOT NULL DEFAULT 0 AFTER fee_cents;

CREATE TABLE refunds (
  refund_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, transaction_id CHAR(36) NOT NULL,
  amount_cents BIGINT NOT NULL,
  reason ENUM('wrong_order','charged_twice','sold_out','changed_mind','other') NOT NULL,
  refunded_at DATETIME(3) NOT NULL, settlement_id CHAR(36) NULL,
  PRIMARY KEY (refund_id), UNIQUE KEY uq_refunds_txn (transaction_id),
  KEY idx_refunds_merchant (merchant_id, refunded_at),
  CONSTRAINT fk_refunds_txn FOREIGN KEY (transaction_id, merchant_id) REFERENCES transactions (transaction_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_settlement FOREIGN KEY (settlement_id) REFERENCES settlements (settlement_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE disputes (
  dispute_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, transaction_id CHAR(36) NOT NULL,
  amount_cents BIGINT NOT NULL,
  reason ENUM('charged_twice','not_received','not_recognised','wrong_amount') NOT NULL,
  opened_at DATETIME(3) NOT NULL, respond_by DATE NOT NULL,
  status ENUM('open','accepted','declined','won','lost') NOT NULL DEFAULT 'open',
  answered_at DATETIME(3) NULL, answered_by CHAR(36) NULL,
  decline_reason VARCHAR(40) NULL, evidence JSON NULL, note VARCHAR(500) NULL,
  decide_by DATE NULL, decided_at DATETIME(3) NULL,
  PRIMARY KEY (dispute_id), UNIQUE KEY uq_disputes_id_merchant (dispute_id, merchant_id),
  KEY idx_disputes_merchant (merchant_id, status, opened_at),
  CONSTRAINT fk_disputes_txn FOREIGN KEY (transaction_id, merchant_id) REFERENCES transactions (transaction_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_disputes_user FOREIGN KEY (answered_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dispute_files (
  dispute_file_id CHAR(36) NOT NULL, dispute_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL,
  file_name VARCHAR(200) NOT NULL, mime_type ENUM('image/jpeg','image/png','application/pdf') NOT NULL,
  size_bytes INT NOT NULL, data MEDIUMBLOB NOT NULL, uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (dispute_file_id), KEY idx_dfiles_dispute (dispute_id, merchant_id),
  CONSTRAINT fk_dfiles_dispute FOREIGN KEY (dispute_id, merchant_id) REFERENCES disputes (dispute_id, merchant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
