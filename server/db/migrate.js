// server/db/migrate.js — PostgreSQL migration runner
// Reads numbered .sql files from this directory's migrations/ subfolder,
// tracks applied migrations in a schema_migrations table, supports --dry-run.
//
// Usage:
//   node server/db/migrate.js              # apply all pending migrations
//   node server/db/migrate.js --dry-run    # show what would run, don't execute
//   node server/db/migrate.js --status     # list applied vs pending migrations

import pg from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const STATUS_ONLY = args.includes('--status');

/**
 * Run all pending migrations against the given pg Pool (or create one from env).
 * Exported for use by postgres.js on startup.
 */
export async function runMigrations(pool) {
  const ownPool = !pool;
  if (ownPool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host:     process.env.PGHOST     || undefined,
      port:     process.env.PGPORT     ? parseInt(process.env.PGPORT, 10) : undefined,
      database: process.env.PGDATABASE || undefined,
      user:     process.env.PGUSER     || undefined,
      password: process.env.PGPASSWORD || undefined,
      ssl:      process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
    });
  }

  try {
    // Ensure schema_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Get applied versions
    const { rows: applied } = await pool.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedSet = new Set(applied.map(r => r.version));

    // Read migration files
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[migrate] No migration files found in', MIGRATIONS_DIR);
      return 0;
    }

    let applied_count = 0;

    for (const file of files) {
      const match = file.match(/^(\d+)_/);
      if (!match) continue;

      const version = parseInt(match[1], 10);
      const isApplied = appliedSet.has(version);

      if (STATUS_ONLY) {
        const status = isApplied ? '✓ applied' : '○ pending';
        console.log(`  ${status}  ${file}`);
        continue;
      }

      if (isApplied) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

      if (DRY_RUN) {
        console.log(`[dry-run] Would apply migration ${version}: ${file}`);
        console.log(`  SQL preview (${sql.length} bytes):`);
        // Show first 5 lines
        const lines = sql.split('\n').slice(0, 5);
        for (const line of lines) {
          console.log(`    ${line}`);
        }
        if (sql.split('\n').length > 5) {
          console.log(`    ... (${sql.split('\n').length - 5} more lines)`);
        }
        continue;
      }

      // Apply migration in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, file]
        );
        await client.query('COMMIT');
        applied_count++;
        console.log(`[migrate] Applied migration ${version}: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED migration ${version}: ${file}`);
        console.error(`  Error: ${err.message}`);
        throw err;
      } finally {
        client.release();
      }
    }

    if (STATUS_ONLY) {
      // no-op summary
    } else if (DRY_RUN) {
      console.log(`[dry-run] ${files.filter(f => !appliedSet.has(parseInt(f.match(/^(\d+)_/)?.[1], 10))).length} migration(s) would be applied`);
    } else if (applied_count === 0) {
      const maxVersion = applied.length > 0 ? Math.max(...applied.map(r => r.version)) : 0;
      console.log(`[migrate] Schema up to date (version ${maxVersion})`);
    } else {
      console.log(`[migrate] Applied ${applied_count} migration(s)`);
    }

    return applied_count;
  } finally {
    if (ownPool) {
      await pool.end();
    }
  }
}

// Run directly from CLI
if (process.argv[1] && (
  process.argv[1].endsWith('/migrate.js') ||
  process.argv[1].endsWith('\\migrate.js')
)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] Fatal error:', err.message);
      process.exit(1);
    });
}
