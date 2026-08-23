-- 007: Track fills already applied to local trade and position state
ALTER TABLE order_intents ADD COLUMN applied_qty REAL NOT NULL DEFAULT 0;
