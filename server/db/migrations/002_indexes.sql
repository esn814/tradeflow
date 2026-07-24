-- 002: Performance indexes for TradeFlow PostgreSQL
-- Derived from actual query patterns in the route files

BEGIN;

-- ============================================================
-- trades: user_id + created_at DESC (trades.js GET /, ORDER BY created_at DESC)
-- Also used by social.js leaderboard with date-range filters
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trades_user_created
  ON trades(user_id, created_at DESC);

-- ============================================================
-- trades: user_id + bot_id (trades.js GET / with ?botId filter, summary)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trades_user_bot
  ON trades(user_id, bot_id);

-- ============================================================
-- alerts: user_id + active (alertChecker.js filters active alerts)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alerts_user_active
  ON alerts(user_id, active);

-- ============================================================
-- alerts: user_id + created_at DESC (alerts.js GET /, ORDER BY created_at DESC)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_alerts_user_created
  ON alerts(user_id, created_at DESC);

-- ============================================================
-- bots: user_id + created_at DESC (bots.js GET /, ORDER BY created_at DESC)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bots_user_created
  ON bots(user_id, created_at DESC);

-- ============================================================
-- schedules: user_id + created_at DESC (schedules.js GET /)
-- Also useful for alertChecker which queries active schedules
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedules_user_created
  ON schedules(user_id, created_at DESC);

-- ============================================================
-- demo_trades: user_id + timestamp DESC (settings.js GET /demo-trades)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_demo_trades_user_ts
  ON demo_trades(user_id, timestamp DESC);

-- ============================================================
-- followed_traders: user_id + followed_at DESC (copy-trading.js GET /)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_followed_traders_user_followed
  ON followed_traders(user_id, followed_at DESC);

-- ============================================================
-- copy_trade_history: user_id + timestamp DESC (copy-trading.js GET /history)
-- Also filtered by trader_id when provided
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_copy_trade_history_user_ts
  ON copy_trade_history(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_copy_trade_history_user_trader
  ON copy_trade_history(user_id, trader_id, timestamp DESC);

-- ============================================================
-- shared_strategies: strategy_type (social.js GET /strategies with ?type filter)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shared_strategies_type
  ON shared_strategies(strategy_type);

-- ============================================================
-- shared_strategies: likes DESC (social.js ORDER BY likes DESC, published_at DESC)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shared_strategies_likes
  ON shared_strategies(likes DESC, published_at DESC);

-- ============================================================
-- shared_strategies: author_id + published_at DESC (social.js GET /strategies/my)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shared_strategies_author_published
  ON shared_strategies(author_id, published_at DESC);

-- ============================================================
-- shared_strategies: risk_level (social.js GET /strategies with ?risk filter)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shared_strategies_risk
  ON shared_strategies(risk_level);

-- ============================================================
-- refresh_tokens: token lookup (auth.js validates refresh tokens)
-- The UNIQUE constraint already covers this, but explicit for clarity
-- ============================================================
-- (covered by UNIQUE(token) from 001)

-- ============================================================
-- push_subscriptions: endpoint lookup for unsubscribe
-- The UNIQUE(user_id, endpoint) already covers this
-- ============================================================
-- (covered by UNIQUE(user_id, endpoint) from 001)

COMMIT;
