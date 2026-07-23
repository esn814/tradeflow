import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Set env vars BEFORE importing server modules
process.env.JWT_SECRET = 'test-secret-key-for-ci';
process.env.DB_PATH = ':memory:';
process.env.SIWE_DOMAIN = 'localhost';

let getDb, upsertUser, runMigrations;

beforeAll(async () => {
  // Dynamic import so env vars are set first
  const dbMod = await import('../db.js');
  getDb = dbMod.getDb;
  upsertUser = dbMod.upsertUser;
});

describe('Database', () => {
  it('getDb() returns a database instance', () => {
    const db = getDb();
    expect(db).toBeTruthy();
    expect(typeof db.prepare).toBe('function');
  });

  it('getDb() returns the same instance on subsequent calls (singleton)', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it('upsertUser creates a new user', () => {
    const user = upsertUser('0x1234567890abcdef1234567890abcdef12345678');
    expect(user).toBeTruthy();
    expect(user.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(user.id).toBeDefined();
  });

  it('upsertUser is idempotent (same address returns same user)', () => {
    const user1 = upsertUser('0xaaaa');
    const user2 = upsertUser('0xaaaa');
    expect(user1.id).toBe(user2.id);
  });

  it('upsertUser normalizes address to lowercase', () => {
    const user = upsertUser('0xABCD');
    expect(user.address).toBe('0xabcd');
  });

  it('users table has expected columns', () => {
    const db = getDb();
    const info = db.prepare("PRAGMA table_info('users')").all();
    const colNames = info.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('address');
    expect(colNames).toContain('created_at');
  });

  it('bots table has expected columns', () => {
    const db = getDb();
    const info = db.prepare("PRAGMA table_info('bots')").all();
    const colNames = info.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('type');
    expect(colNames).toContain('coin');
    expect(colNames).toContain('status');
  });

  it('trades table has expected columns', () => {
    const db = getDb();
    const info = db.prepare("PRAGMA table_info('trades')").all();
    const colNames = info.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('pair');
    expect(colNames).toContain('side');
    expect(colNames).toContain('price');
    expect(colNames).toContain('qty');
  });

  it('alerts table has expected columns', () => {
    const db = getDb();
    const info = db.prepare("PRAGMA table_info('alerts')").all();
    const colNames = info.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('user_id');
    expect(colNames).toContain('type');
    expect(colNames).toContain('asset');
    expect(colNames).toContain('condition');
  });

  it('shared_strategies table has expected columns', () => {
    const db = getDb();
    const info = db.prepare("PRAGMA table_info('shared_strategies')").all();
    const colNames = info.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('author_id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('strategy_type');
    expect(colNames).toContain('likes');
    expect(colNames).toContain('forks');
  });

  it('refresh_tokens table exists', () => {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    expect(tables).toContain('refresh_tokens');
  });
});
