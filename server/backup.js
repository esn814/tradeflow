import { readdirSync, unlinkSync, mkdirSync, statSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { getDb, resetDb } from './db.js';
import { logger } from './logger.js';

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
    // Sanitize path to prevent SQL injection (only allow safe chars)
    const safePath = backupPath.replace(/[^a-zA-Z0-9_\-\/\.]/g, '');
    db.exec(`VACUUM INTO '${safePath}'`);

    const size = statSync(backupPath).size;
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    logger.info({ path: backupPath, sizeMB }, '[backup] Created');

    return { ok: true, path: backupPath, sizeMB };
  } catch (err) {
    logger.error({ err: err.message }, '[backup] Failed');
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
        logger.info({ file }, '[backup] Deleted old');
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, '[backup] Cleanup error');
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
 * Restore the database from a named backup file.
 * Safety: closes current DB, copies backup over live DB, reopens.
 * Returns ok:true on success.
 */
export function restoreBackup(backupName) {
  // Validate filename — only allow safe chars, prevent path traversal
  if (!/^tradeflow-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/.test(backupName)) {
    return { ok: false, error: 'Invalid backup filename' };
  }

  const backupPath = join(BACKUP_DIR, backupName);
  if (!existsSync(backupPath)) {
    return { ok: false, error: 'Backup not found' };
  }

  try {
    const db = getDb();
    db.close();
    copyFileSync(backupPath, DB_PATH);
    // Reopen by clearing the cached reference and reinitializing
    resetDb();
    getDb();
    return { ok: true, restoredFrom: backupName };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Start the daily backup scheduler. Runs backup + cleanup on interval.
 */
export function startBackupScheduler() {
  // Run first backup 60 seconds after startup
  setTimeout(() => {
    logger.info('[backup] Running initial backup...');
    createBackup();
    cleanupOldBackups();
  }, 60_000);

  // Then every 24 hours
  setInterval(() => {
    logger.info('[backup] Scheduled backup starting...');
    createBackup();
    cleanupOldBackups();
  }, BACKUP_INTERVAL_MS);

  logger.info({ retentionDays: RETENTION_DAYS }, '[backup] Scheduler started — daily backups');
}
