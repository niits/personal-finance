-- Finance schema: categories, budgets, transactions

CREATE TABLE IF NOT EXISTS category (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  parent_id  INTEGER REFERENCES category(id) ON DELETE RESTRICT,
  level      INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_category_user_parent ON category(user_id, parent_id);

CREATE TABLE IF NOT EXISTS monthly_budget (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  month      TEXT    NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_budget_user_month ON monthly_budget(user_id, month);

CREATE TABLE IF NOT EXISTS budget_adjustment (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  monthly_budget_id INTEGER NOT NULL REFERENCES monthly_budget(id) ON DELETE CASCADE,
  delta             INTEGER NOT NULL,
  note              TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_budget_adj_monthly_budget ON budget_adjustment(monthly_budget_id);

CREATE TABLE IF NOT EXISTS custom_budget (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  amount     INTEGER NOT NULL CHECK (amount > 0),
  is_active  INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_custom_budget_user ON custom_budget(user_id, is_active);

CREATE TABLE IF NOT EXISTS `transaction` (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  type              TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
  category_id       INTEGER NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  note              TEXT,
  date              TEXT    NOT NULL,
  monthly_budget_id INTEGER REFERENCES monthly_budget(id) ON DELETE RESTRICT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (
    (type = 'income'  AND monthly_budget_id IS NULL) OR
    (type = 'expense' AND monthly_budget_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_transaction_user_date     ON `transaction`(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transaction_user_category ON `transaction`(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_monthly_budget ON `transaction`(monthly_budget_id);

CREATE TABLE IF NOT EXISTS transaction_custom_budget (
  transaction_id   INTEGER NOT NULL REFERENCES `transaction`(id) ON DELETE CASCADE,
  custom_budget_id INTEGER NOT NULL REFERENCES custom_budget(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, custom_budget_id)
);

CREATE INDEX IF NOT EXISTS idx_tcb_budget ON transaction_custom_budget(custom_budget_id);

CREATE TABLE IF NOT EXISTS budget_config (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                TEXT    NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  default_monthly_amount INTEGER NOT NULL DEFAULT 10000000 CHECK (default_monthly_amount > 0),
  updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
);
