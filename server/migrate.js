// server/migrate.js — Simple numbered SQL migration runner
// Reads .sql files from server/migrations/ in order, tracks version in schema_version table

import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export function runMigrations(db) {
  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Get current version
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
  const currentVersion = row?.version || 0;

  // Read migration files
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // filenames are numbered, so alphabetical = chronological

  let applied = 0;

  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    if (version <= currentVersion) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // Run migration in a transaction
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(version, file);
    })();

    applied++;
    console.log(`[migrate] Applied migration ${version}: ${file}`);
  }

  if (applied === 0) {
    console.log(`[migrate] Schema up to date (version ${currentVersion})`);
  } else {
    console.log(`[migrate] Applied ${applied} migration(s), now at version ${currentVersion + applied}`);
  }

  return applied;
}
