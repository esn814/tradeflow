import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'tradeflow.db');

let _db = null;

export function getDb() {
  if (_db) return _db;

  mkdirSync(dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT UNIQUE NOT NULL COLLATE NOCASE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT,
      type TEXT,
      coin TEXT,
      invested REAL DEFAULT 0,
      current_value REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      strategy TEXT,
      config TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bot_id TEXT,
      pair TEXT,
      side TEXT,
      price REAL,
      qty REAL,
      pnl REAL DEFAULT 0,
      status TEXT DEFAULT 'filled',
      sl REAL,
      tp REAL,
      strategy TEXT,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT,
      asset TEXT,
      condition TEXT,
      value REAL,
      active INTEGER DEFAULT 1,
      triggered INTEGER DEFAULT 0,
      meta TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT,
      cron TEXT,
      params TEXT,
      active INTEGER DEFAULT 1,
      last_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      risk_tolerance TEXT DEFAULT 'moderate',
      notifications INTEGER DEFAULT 1,
      dark_mode INTEGER DEFAULT 1,
      demo_mode INTEGER DEFAULT 1,
      virtual_balance REAL DEFAULT 10000,
      selected_plan TEXT DEFAULT 'free',
      has_completed_onboarding INTEGER DEFAULT 0,
      anti_phishing_code TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_trades (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pair TEXT,
      side TEXT,
      price REAL,
      qty REAL,
      pnl REAL,
      strategy TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS followed_traders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trader_id TEXT NOT NULL,
      followed_at TEXT DEFAULT (datetime('now')),
      copy_settings TEXT,
      UNIQUE(user_id, trader_id)
    );

    CREATE TABLE IF NOT EXISTS copy_trade_history (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trader_id TEXT,
      pair TEXT,
      side TEXT,
      price REAL,
      qty REAL,
      pnl REAL,
      timestamp INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_bots_user ON bots(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_trades_bot ON trades(user_id, bot_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);
    CREATE INDEX IF NOT EXISTS idx_demo_trades_user ON demo_trades(user_id);
    CREATE INDEX IF NOT EXISTS idx_followed_traders_user ON followed_traders(user_id);
    CREATE INDEX IF NOT EXISTS idx_copy_trade_history_user ON copy_trade_history(user_id);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, endpoint)
    );

    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS shared_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      strategy_type TEXT DEFAULT 'custom',
      params TEXT DEFAULT '{}',
      risk_level TEXT DEFAULT 'moderate',
      tags TEXT DEFAULT '',
      likes INTEGER DEFAULT 0,
      forks INTEGER DEFAULT 0,
      published_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(author_id, name)
    );

    CREATE TABLE IF NOT EXISTS strategy_forks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER NOT NULL REFERENCES shared_strategies(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      forked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(strategy_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS strategy_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_id INTEGER NOT NULL REFERENCES shared_strategies(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(strategy_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_shared_strategies_author ON shared_strategies(author_id);
    CREATE INDEX IF NOT EXISTS idx_shared_strategies_type ON shared_strategies(strategy_type);
    CREATE INDEX IF NOT EXISTS idx_strategy_forks_strategy ON strategy_forks(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_strategy_forks_user ON strategy_forks(user_id);
    CREATE INDEX IF NOT EXISTS idx_strategy_likes_strategy ON strategy_likes(strategy_id);
    CREATE INDEX IF NOT EXISTS idx_strategy_likes_user ON strategy_likes(user_id);
  `);

  return _db;
}

// Upsert a user by wallet address, returning the user row
export function upsertUser(address) {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO users (address) VALUES (?)`).run(address.toLowerCase());
  return db.prepare(`SELECT * FROM users WHERE address = ?`).get(address.toLowerCase());
}

export default getDb;
