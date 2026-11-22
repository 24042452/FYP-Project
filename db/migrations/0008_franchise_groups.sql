-- Franchises: three tiers of owners (NETS feedback, mock meeting 2026-11-22).
--   Group (franchisor / HQ)  ->  Merchant (franchisee company, has a MID)  ->  Outlet (shop)
-- An HQ owner is linked to a group (group_users) and can view every franchisee in it, read-only.
-- A merchant owner is linked to one merchant (merchant_users, outlet_id NULL), as before.
-- An outlet manager is linked to one merchant AND one of its outlets (merchant_users.outlet_id).

CREATE TABLE merchant_groups (
  group_id   CHAR(36)     NOT NULL,
  name       VARCHAR(200) NOT NULL COMMENT 'the brand, e.g. Kopi Corner',
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NULL = an independent merchant (not part of a franchise).
ALTER TABLE merchants
  ADD COLUMN group_id CHAR(36) NULL AFTER mid,
  ADD KEY idx_merchants_group (group_id),
  ADD CONSTRAINT fk_merchants_group FOREIGN KEY (group_id) REFERENCES merchant_groups (group_id) ON DELETE SET NULL;

CREATE TABLE group_users (
  group_id CHAR(36) NOT NULL,
  user_id  CHAR(36) NOT NULL,
  role     ENUM('hq_owner') NOT NULL DEFAULT 'hq_owner',
  PRIMARY KEY (group_id, user_id),
  KEY idx_group_users_user (user_id),
  CONSTRAINT fk_gu_group FOREIGN KEY (group_id) REFERENCES merchant_groups (group_id) ON DELETE CASCADE,
  CONSTRAINT fk_gu_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Outlet managers: the one outlet they may see. The composite key makes sure it is an outlet of that merchant.
ALTER TABLE merchant_users
  MODIFY COLUMN role ENUM('owner','manager','cashier','accountant','outlet_manager') NOT NULL,
  ADD COLUMN outlet_id CHAR(36) NULL AFTER role,
  ADD KEY idx_merchant_users_outlet (outlet_id, merchant_id),
  ADD CONSTRAINT fk_mu_outlet FOREIGN KEY (outlet_id, merchant_id) REFERENCES outlets (outlet_id, merchant_id) ON DELETE CASCADE;
