-- 001: Initial PostgreSQL schema for TradeFlow
-- Translated from SQLite (better-sqlite3) to PostgreSQL syntax
-- All 14 tables: users, bots, trades, alerts, schedules, settings,
-- demo_trades, followed_traders, copy_trade_history, push_subscriptions,
-- shared_strategies, strategy_forks, strategy_likes, refresh_tokens

BEGIN;

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  address    TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. bots
-- ============================================================
CREATE TABLE IF NOT EXISTS bots (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  type          TEXT,
  coin          TEXT,
  invested      DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',
  strategy      TEXT,
  config        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. trades
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id     TEXT,
  pair       TEXT,
  side       TEXT,
  price      DOUBLE PRECISION,
  qty        DOUBLE PRECISION,
  pnl        DOUBLE PRECISION NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'filled',
  sl         DOUBLE PRECISION,
  tp         DOUBLE PRECISION,
  strategy   TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT,
  asset      TEXT,
  condition  TEXT,
  value      DOUBLE PRECISION,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  triggered  BOOLEAN NOT NULL DEFAULT FALSE,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT,
  cron       TEXT,
  params     JSONB,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_run   TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- ============================================================
-- 6. settings (1:1 with users)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  user_id                 INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  risk_tolerance          TEXT NOT NULL DEFAULT 'moderate',
  notifications           BOOLEAN NOT NULL DEFAULT TRUE,
  dark_mode               BOOLEAN NOT NULL DEFAULT TRUE,
  demo_mode               BOOLEAN NOT NULL DEFAULT TRUE,
  virtual_balance         DOUBLE PRECISION NOT NULL DEFAULT 10000,
  selected_plan           TEXT NOT NULL DEFAULT 'free',
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  anti_phishing_code      TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. demo_trades
-- ============================================================
CREATE TABLE IF NOT EXISTS demo_trades (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pair      TEXT,
  side      TEXT,
  price     DOUBLE PRECISION,
  qty       DOUBLE PRECISION,
  pnl       DOUBLE PRECISION,
  strategy  TEXT,
  timestamp BIGINT
);

-- ============================================================
-- 8. followed_traders
-- ============================================================
CREATE TABLE IF NOT EXISTS followed_traders (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trader_id      TEXT NOT NULL,
  followed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  copy_settings  JSONB,
  UNIQUE(user_id, trader_id)
);

-- ============================================================
-- 9. copy_trade_history
-- ============================================================
CREATE TABLE IF NOT EXISTS copy_trade_history (
  id        TEXT PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trader_id TEXT,
  pair      TEXT,
  side      TEXT,
  price     DOUBLE PRECISION,
  qty       DOUBLE PRECISION,
  pnl       DOUBLE PRECISION,
  timestamp BIGINT
);

-- ============================================================
-- 10. push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- ============================================================
-- 11. shared_strategies
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_strategies (
  id            SERIAL PRIMARY KEY,
  author_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  strategy_type TEXT NOT NULL DEFAULT 'custom',
  params        JSONB NOT NULL DEFAULT '{}',
  risk_level    TEXT NOT NULL DEFAULT 'moderate',
  tags          TEXT NOT NULL DEFAULT '',
  likes         INTEGER NOT NULL DEFAULT 0,
  forks         INTEGER NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(author_id, name)
);

-- ============================================================
-- 12. strategy_forks
-- ============================================================
CREATE TABLE IF NOT EXISTS strategy_forks (
  id          SERIAL PRIMARY KEY,
  strategy_id INTEGER NOT NULL REFERENCES shared_strategies(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  forked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(strategy_id, user_id)
);

-- ============================================================
-- 13. strategy_likes
-- ============================================================
CREATE TABLE IF NOT EXISTS strategy_likes (
  id          SERIAL PRIMARY KEY,
  strategy_id INTEGER NOT NULL REFERENCES shared_strategies(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(strategy_id, user_id)
);

-- ============================================================
-- 14. refresh_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  token      TEXT UNIQUE NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address    TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Basic single-column indexes (from original SQLite schema)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bots_user               ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user             ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user             ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_user          ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_trades_user        ON demo_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_followed_traders_user   ON followed_traders(user_id);
CREATE INDEX IF NOT EXISTS idx_copy_trade_history_user ON copy_trade_history(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user          ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_strategies_author ON shared_strategies(author_id);
CREATE INDEX IF NOT EXISTS idx_strategy_forks_strategy ON strategy_forks(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_forks_user     ON strategy_forks(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_likes_strategy ON strategy_likes(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_likes_user     ON strategy_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);

COMMIT;
