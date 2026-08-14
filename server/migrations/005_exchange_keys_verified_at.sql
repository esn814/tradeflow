-- Add verified_at column to exchange_keys
ALTER TABLE exchange_keys ADD COLUMN verified_at TEXT;
