-- 004: Indexes for live trading performance

CREATE INDEX IF NOT EXISTS idx_live_bots_user ON live_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_live_bots_status ON live_bots(status);
CREATE INDEX IF NOT EXISTS idx_live_trades_bot ON live_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_user ON live_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_live_trades_created ON live_trades(created_at);
CREATE INDEX IF NOT EXISTS idx_live_positions_bot ON live_positions(bot_id);
CREATE INDEX IF NOT EXISTS idx_daily_pnl_user_date ON daily_pnl(user_id, date);
CREATE INDEX IF NOT EXISTS idx_exchange_keys_user ON exchange_keys(user_id, exchange);
