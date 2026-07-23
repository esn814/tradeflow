import { readdirSync, unlinkSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { getDb } from './db.js';

const DB_PATH = process.env.DB_PATH || join(import.meta.dirname, 'data', 'tradeflow.db');
const BACKUP_DIR = join(dirname(DB_PATH), 'backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a timestamped backup of the SQLite database using VACUUM INTO.
 * Returns the backup file path on success.
 */
export function createBackup() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = join(BACKUP_DIR, `tradeflow-${ts}.db`);

  try {
    const db = getDb();
    // VACUUM INTO creates a defragmented standalone copy — safe during reads
    db.exec(`VACUUM INTO '${backupPath}'`);

    const size = statSync(backupPath).size;
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    console.log(`[backup] Created: ${backupPath} (${sizeMB} MB)`);

    return { ok: true, path: backupPath, sizeMB };
  } catch (err) {
    console.error('[backup] Failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Delete backup files older than RETENTION_DAYS.
 */
export function cleanupOldBackups() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  try {
    for (const file of readdirSync(BACKUP_DIR)) {
      if (!file.endsWith('.db')) continue;
      const filePath = join(BACKUP_DIR, file);
      const stat = statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        unlinkSync(filePath);
        deleted++;
        console.log(`[backup] Deleted old: ${file}`);
      }
    }
  } catch (err) {
    console.error('[backup] Cleanup error:', err.message);
  }

  return { deleted };
}

/**
 * List existing backups with sizes.
 */
export function listBackups() {
  mkdirSync(BACKUP_DIR, { recursive: true });

  try {
    return readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const filePath = join(BACKUP_DIR, f);
        const stat = statSync(filePath);
        return {
          name: f,
          sizeMB: (stat.size / 1024 / 1024).toFixed(2),
          created: new Date(stat.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => b.created.localeCompare(a.created));
  } catch {
    return [];
  }
}

/**
 * Start the daily backup scheduler. Runs backup + cleanup on interval.
 */
export function startBackupScheduler() {
  // Run first backup 60 seconds after startup
  setTimeout(() => {
    console.log('[backup] Running initial backup...');
    createBackup();
    cleanupOldBackups();
  }, 60_000);

  // Then every 24 hours
  setInterval(() => {
    console.log('[backup] Scheduled backup starting...');
    createBackup();
    cleanupOldBackups();
  }, BACKUP_INTERVAL_MS);

  console.log(`[backup] Scheduler started — daily backups, ${RETENTION_DAYS}-day retention`);
}
