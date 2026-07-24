# TradeFlow: SQLite → PostgreSQL Migration Guide

This document walks through migrating the TradeFlow backend from SQLite (better-sqlite3) to PostgreSQL for production deployment on Render.

## Why PostgreSQL?

- **No spin-down**: Render free-tier SQLite databases live on ephemeral disks; PostgreSQL is a managed service that stays up.
- **Concurrent writes**: SQLite uses a single writer lock; PostgreSQL handles concurrent connections natively.
- **JSONB**: Native JSON indexing and querying for `config`, `meta`, `params`, and `copy_settings` columns.
- **Scaling**: Connection pooling, read replicas, and proper ACID semantics under load.

---

## Prerequisites

1. A PostgreSQL instance (Render PostgreSQL, Supabase, Railway, Neon, or local)
2. Node.js 18+ with ESM support
3. The `pg` package installed (see step 1 below)

---

## Step 1: Install the `pg` dependency

```bash
cd server
npm install pg
```

This adds the `pg` (node-postgres) driver alongside the existing `better-sqlite3`.

---

## Step 2: Set environment variables

Copy the example env file and fill in your PostgreSQL connection details:

```bash
cp .env.postgres.example .env
```

Edit `.env` and set either:
- `DATABASE_URL` — full connection string (preferred for managed services), OR
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` — individual vars

For Render/Supabase/Railway, also set:
```
PGSSLMODE=require
```

---

## Step 3: Run the PostgreSQL migrations

The migration runner creates a `schema_migrations` tracking table and applies SQL files in order.

### Preview what will run (dry-run):
```bash
node server/db/migrate.js --dry-run
```

### Check migration status:
```bash
node server/db/migrate.js --status
```

### Apply all pending migrations:
```bash
node server/db/migrate.js
```

This creates all 14 tables and their indexes:
- `001_initial_schema.sql` — all CREATE TABLE statements (users, bots, trades, alerts, schedules, settings, demo_trades, followed_traders, copy_trade_history, push_subscriptions, shared_strategies, strategy_forks, strategy_likes, refresh_tokens)
- `002_indexes.sql` — composite performance indexes for common query patterns

---

## Step 4: Migrate existing data (if any)

If you have existing data in SQLite that you need to preserve:

### Option A: Export → Import (recommended for small datasets)

```bash
# Export SQLite data as SQL
sqlite3 server/data/tradeflow.db .dump > dump.sql

# Convert SQLite syntax to PostgreSQL syntax
# (manual edits needed: AUTOINCREMENT → SERIAL, datetime() → now(), etc.)
# Then pipe into psql:
psql $DATABASE_URL < dump_converted.sql
```

### Option B: Use the app's own endpoints

If the dataset is small, you can:
1. Start the old SQLite server
2. Call each GET endpoint to export data as JSON
3. Switch to PostgreSQL mode
4. Call each POST endpoint to re-import

### Option C: Write a one-off migration script

Create a script that reads from SQLite and inserts into PostgreSQL using both modules:

```js
import Database from 'better-sqlite3';
import { getDb } from './server/db/postgres.js';

const sqlite = new Database('./server/data/tradeflow.db');
const pg = getDb();

// Example: migrate users
const users = sqlite.prepare('SELECT * FROM users').all();
for (const u of users) {
  await pg.query(
    'INSERT INTO users (id, address, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [u.id, u.address, u.created_at]
  );
}
// ... repeat for each table
```

---

## Step 5: Switch the app to use PostgreSQL

In `server/db.js`, change the import from the SQLite module to the PostgreSQL module:

```js
// Before (SQLite):
import { getDb, resetDb, upsertUser } from './db.js';

// After (PostgreSQL):
import { getDb, resetDb, upsertUser } from './db/postgres.js';
```

**Important**: The PostgreSQL module returns **async** results. All route handlers that call `getDb().prepare(sql).all(...)` will need to be updated to use `await`:

```js
// Before (SQLite, synchronous):
const rows = getDb().prepare('SELECT * FROM bots WHERE user_id = ?').all(userId);

// After (PostgreSQL, async):
const rows = await getDb().prepare('SELECT * FROM bots WHERE user_id = ?').all(userId);
```

The `prepare()` helper auto-converts `?` placeholders to `$1, $2, ...` for pg.

### Key differences to handle in route files:

| SQLite (sync) | PostgreSQL (async) |
|---|---|
| `db.prepare(sql).all(...params)` | `await db.prepare(sql).all(...params)` |
| `db.prepare(sql).get(...params)` | `await db.prepare(sql).get(...params)` |
| `db.prepare(sql).run(...params)` | `await db.prepare(sql).run(...params)` |
| `result.changes` | `result.changes` (same) |
| `result.lastInsertRowid` | `result.lastInsertRowid` (same, via RETURNING) |
| `db.exec(sql)` | `await db.exec(sql)` |
| `INSERT OR IGNORE` | `ON CONFLICT DO NOTHING` (already in SQL) |
| `datetime('now')` | `now()` (already in SQL) |
| `INTEGER` + `0/1` for booleans | `BOOLEAN` + `true/false` |
| `JSON.stringify(obj)` for JSON columns | Auto-serialized by prepare() helper |
| `JSON.parse(col)` on read | pg returns parsed objects for JSONB columns |

---

## Step 6: Update the app entry point

In `server/index.js`, change the DB initialization:

```js
// Before:
import { getDb } from './db.js';
getDb(); // initializes SQLite synchronously

// After:
import { getDb } from './db/postgres.js';
await getDb(); // initializes PostgreSQL pool + runs migrations
```

---

## Step 7: Test

```bash
# Run with PostgreSQL
DATABASE_URL=postgresql://... node server/index.js

# Verify tables exist
psql $DATABASE_URL -c "\dt"

# Verify migration tracking
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"

# Test an endpoint
curl http://localhost:3001/api/settings
```

---

## Step 8: Deploy to Render

1. Add a **PostgreSQL** service in your Render dashboard
2. Copy the **Internal Database URL** from Render
3. Set `DATABASE_URL` in your web service's environment variables
4. Set `PGSSLMODE=require`
5. Deploy — migrations run automatically on startup

---

## File Reference

| File | Purpose |
|---|---|
| `server/db/postgres.js` | PostgreSQL client module (drop-in for db.js) |
| `server/db/migrate.js` | Migration runner (CLI + programmatic) |
| `server/db/migrations/001_initial_schema.sql` | All 14 CREATE TABLE statements |
| `server/db/migrations/002_indexes.sql` | Composite performance indexes |
| `.env.postgres.example` | Example environment variables |

---

## Rollback

To revert to SQLite:
1. Change imports back to `./db.js`
2. Remove `DATABASE_URL` from env
3. The SQLite database file is untouched — no data lost

---

## Troubleshooting

**"relation does not exist"** — Migrations haven't run. Run `node server/db/migrate.js`.

**"password authentication failed"** — Check `PGUSER`/`PGPASSWORD` or `DATABASE_URL`.

**"SSL required"** — Set `PGSSLMODE=require` for managed PostgreSQL.

**"too many connections"** — Lower `PG_POOL_MAX` (default 20) or upgrade your PostgreSQL plan.

**JSONB columns return strings** — The `prepare()` helper auto-serializes on write; pg auto-parses JSONB on read. If you see strings, the column may be `TEXT` not `JSONB`.
