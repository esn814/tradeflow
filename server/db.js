import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'tradeflow.db');

let _db = null;

export function getDb() {
  if (_db) return _db;

  mkdirSync(dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Run migrations instead of inline CREATE TABLE statements
  runMigrations(_db);

  return _db;
}

// Upsert a user by wallet address, returning the user row
export function upsertUser(address) {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO users (address) VALUES (?)`).run(address.toLowerCase());
  return db.prepare(`SELECT * FROM users WHERE address = ?`).get(address.toLowerCase());
}

export default getDb;
