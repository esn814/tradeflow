// server/db/postgres.js — PostgreSQL client module using node-postgres (pg)
// Drop-in replacement for the SQLite db.js module. Same export names, same query patterns.
//
// Usage: import { getDb, resetDb, upsertUser } from './db/postgres.js';
// The getDb() returns a pg Pool with helper methods that mirror better-sqlite3's API.

import pg from 'pg';
import { runMigrations } from './migrate.js';

const { Pool } = pg;

let _pool = null;

/**
 * Get or create the PostgreSQL connection pool.
 * Returns a pool augmented with SQLite-compatible helper methods:
 *   pool.prepare(sql) → { all(...params), get(...params), run(...params) }
 *   pool.exec(sql)    → run raw SQL (no params, no return)
 *   pool.transaction(fn) → BEGIN/COMMIT/ROLLBACK wrapper
 */
export function getDb() {
  if (_pool) return _pool;

  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Allow individual env vars as fallback
    host:     process.env.PGHOST     || undefined,
    port:     process.env.PGPORT     ? parseInt(process.env.PGPORT, 10) : undefined,
    database: process.env.PGDATABASE || undefined,
    user:     process.env.PGUSER     || undefined,
    password: process.env.PGPASSWORD || undefined,
    ssl:      process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
    max:      parseInt(process.env.PG_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Attach helper methods so route code can use the same patterns as better-sqlite3
  _pool.prepare = prepare.bind(null, _pool);
  _pool.exec    = execSql.bind(null, _pool);
  _pool.transaction = transaction.bind(null, _pool);

  // Run migrations on first connect
  runMigrations(_pool);

  return _pool;
}

/**
 * Reset the cached pool (for tests or graceful shutdown).
 * Calls pool.end() to drain connections.
 */
export async function resetDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

/**
 * Upsert a user by wallet address, returning the user row.
 * Mirrors the SQLite upsertUser from db.js.
 */
export async function upsertUser(address) {
  const pool = getDb();
  const addr = address.toLowerCase();
  // INSERT ... ON CONFLICT DO NOTHING, then SELECT
  await pool.query(
    `INSERT INTO users (address) VALUES ($1) ON CONFLICT (address) DO NOTHING`,
    [addr]
  );
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE address = $1`,
    [addr]
  );
  return rows[0] || null;
}

export default getDb;

// ── Internal helpers ──────────────────────────────────────────

/**
 * Convert positional ? placeholders to $1, $2, ... for pg.
 * Also handles JSON serialization for objects/arrays in params.
 */
function convertPlaceholders(sql) {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return converted;
}

/**
 * Serialize params: convert JS objects/arrays to JSON strings for JSONB columns,
 * convert booleans to integers where needed, etc.
 */
function serializeParams(params) {
  return params.map(p => {
    if (p === undefined) return null;
    if (p !== null && typeof p === 'object' && !(p instanceof Date)) {
      return JSON.stringify(p);
    }
    return p;
  });
}

/**
 * SQLite-compatible prepare() — returns an object with .all(), .get(), .run()
 * that work with positional ? placeholders (auto-converted to $1, $2, ...).
 */
function prepare(pool, sql) {
  const pgSql = convertPlaceholders(sql);

  return {
    /**
     * .all(...params) → returns array of row objects
     * Equivalent to db.prepare(sql).all(...params)
     */
    async all(...params) {
      const { rows } = await pool.query(pgSql, serializeParams(params));
      return rows;
    },

    /**
     * .get(...params) → returns first row or undefined
     * Equivalent to db.prepare(sql).get(...params)
     */
    async get(...params) {
      const { rows } = await pool.query(pgSql, serializeParams(params));
      return rows[0] || undefined;
    },

    /**
     * .run(...params) → returns { changes, lastInsertRowid }
     * Equivalent to db.prepare(sql).run(...params)
     *
     * For INSERT statements, appends RETURNING id to capture lastInsertRowid.
     * For UPDATE/DELETE, uses rowCount as changes.
     */
    async run(...params) {
      // Try to append RETURNING id for INSERT statements to get lastInsertRowid
      let runSql = pgSql;
      const isInsert = /^\s*INSERT/i.test(sql);
      if (isInsert && !/RETURNING/i.test(sql)) {
        runSql += ' RETURNING id';
      }

      const { rows, rowCount } = await pool.query(runSql, serializeParams(params));
      return {
        changes: rowCount || 0,
        lastInsertRowid: rows[0]?.id ?? null,
      };
    },
  };
}

/**
 * Execute raw SQL (no params, no return value).
 * Equivalent to db.exec(sql) in better-sqlite3.
 */
async function execSql(pool, sql) {
  await pool.query(sql);
}

/**
 * Transaction wrapper.
 * Usage: await pool.transaction(async (client) => { ... })();
 * The inner function receives a pg Client with the same .query() interface.
 *
 * For SQLite compatibility, also accepts a sync function:
 *   pool.transaction(() => { ... })()
 */
function transaction(pool, fn) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Attach prepare/exec helpers to the client so migration code works
      client.prepare = prepare.bind(null, client);
      client.exec    = execSql.bind(null, client);
      const result = await fn(client, ...args);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };
}
