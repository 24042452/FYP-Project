-- Offers & Promotions: marketing campaigns a merchant runs (4 weeks, per payment type and outlet)
-- and deals from NETS and its partners that a merchant takes up.
-- Composite (id, merchant_id) keys keep every row inside one merchant, as in earlier migrations.

ALTER TABLE outlets ADD COLUMN is_online TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE promotion_runs (
  promotion_run_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, promotion_key VARCHAR(40) NOT NULL,
  channel ENUM('nets_qr','nets_click','enets','card','sgqr') NOT NULL,
  starts_on DATE NOT NULL, ends_on DATE NOT NULL, stopped_on DATE NULL,
  started_by CHAR(36) NULL, stopped_by CHAR(36) NULL, created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (promotion_run_id), UNIQUE KEY uq_prun_id_merchant (promotion_run_id, merchant_id),
  KEY idx_prun_merchant (merchant_id, channel, ends_on),
  CONSTRAINT fk_prun_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_prun_started FOREIGN KEY (started_by) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_prun_stopped FOREIGN KEY (stopped_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE promotion_run_outlets (
  promotion_run_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, outlet_id CHAR(36) NOT NULL,
  PRIMARY KEY (promotion_run_id, outlet_id),
  CONSTRAINT fk_pro_run FOREIGN KEY (promotion_run_id, merchant_id) REFERENCES promotion_runs (promotion_run_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_outlet FOREIGN KEY (outlet_id, merchant_id) REFERENCES outlets (outlet_id, merchant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE offer_takeups (
  offer_takeup_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, offer_key VARCHAR(40) NOT NULL,
  starts_on DATE NOT NULL, ends_on DATE NOT NULL, taken_by CHAR(36) NULL, created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (offer_takeup_id), UNIQUE KEY uq_otu_id_merchant (offer_takeup_id, merchant_id),
  KEY idx_otu_merchant (merchant_id, offer_key, ends_on),
  CONSTRAINT fk_otu_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_otu_user FOREIGN KEY (taken_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE offer_takeup_outlets (
  offer_takeup_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, outlet_id CHAR(36) NOT NULL,
  PRIMARY KEY (offer_takeup_id, outlet_id),
  CONSTRAINT fk_oto_takeup FOREIGN KEY (offer_takeup_id, merchant_id) REFERENCES offer_takeups (offer_takeup_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_oto_outlet FOREIGN KEY (outlet_id, merchant_id) REFERENCES outlets (outlet_id, merchant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
