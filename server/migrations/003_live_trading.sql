-- 003: Live trading tables for AutoTrader
-- live_bots, live_trades, live_positions, daily_pnl, exchange_keys

CREATE TABLE IF NOT EXISTS live_bots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  coin TEXT NOT NULL,
  strategy TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  risk_config TEXT DEFAULT '{}',
  status TEXT DEFAULT 'stopped',
  interval_ms INTEGER DEFAULT 60000,
  total_trades INTEGER DEFAULT 0,
  total_pnl REAL DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  strategy_state TEXT DEFAULT '{}',
  price_history TEXT DEFAULT '[]',
  last_tick_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS live_trades (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  coin TEXT NOT NULL,
  price REAL NOT NULL,
  qty REAL NOT NULL,
  value REAL NOT NULL,
  pnl REAL DEFAULT 0,
  reason TEXT,
  order_id TEXT,
  status TEXT DEFAULT 'filled',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (bot_id) REFERENCES live_bots(id)
);

CREATE TABLE IF NOT EXISTS live_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  coin TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  avg_entry_price REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  current_price REAL DEFAULT 0,
  unrealized_pnl REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (bot_id) REFERENCES live_bots(id)
);

CREATE TABLE IF NOT EXISTS daily_pnl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  date TEXT NOT NULL,
  realized_pnl REAL DEFAULT 0,
  trade_count INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  loss_count INTEGER DEFAULT 0,
  UNIQUE(user_id, bot_id, date)
);

CREATE TABLE IF NOT EXISTS exchange_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  exchange TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  environment TEXT DEFAULT 'testnet',
  key_preview TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, exchange, environment),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
