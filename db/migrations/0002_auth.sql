-- Login: users, server-side sessions, and which merchants a user may see.

CREATE TABLE users (
  id            CHAR(36)     NOT NULL,
  email         VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  token_hash CHAR(64)    NOT NULL COMMENT 'SHA-256 of the cookie token',
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE merchant_users (
  merchant_id CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  role        ENUM('owner','manager','cashier','accountant') NOT NULL,
  PRIMARY KEY (merchant_id, user_id),
  KEY idx_merchant_users_user (user_id),
  CONSTRAINT fk_mu_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (id) ON DELETE CASCADE,
  CONSTRAINT fk_mu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
