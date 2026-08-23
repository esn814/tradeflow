-- 006: Durable order intents and exchange lifecycle tracking

CREATE TABLE IF NOT EXISTS order_intents (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  coin TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  requested_qty REAL NOT NULL,
  requested_quote REAL,
  signal_price REAL,
  reason TEXT,
  client_order_id TEXT NOT NULL UNIQUE,
  exchange_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'submitted', 'partially_filled', 'filled', 'canceled', 'rejected', 'expired', 'unknown')),
  executed_qty REAL NOT NULL DEFAULT 0,
  remaining_qty REAL,
  avg_fill_price REAL,
  cumulative_quote REAL NOT NULL DEFAULT 0,
  last_error TEXT,
  exchange_payload TEXT,
  submitted_at TEXT,
  completed_at TEXT,
  last_reconciled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (bot_id) REFERENCES live_bots(id)
);

CREATE INDEX IF NOT EXISTS idx_order_intents_bot ON order_intents(bot_id);
CREATE INDEX IF NOT EXISTS idx_order_intents_status ON order_intents(status);
CREATE INDEX IF NOT EXISTS idx_order_intents_exchange_id ON order_intents(exchange_order_id);
CREATE INDEX IF NOT EXISTS idx_order_intents_created ON order_intents(created_at);
