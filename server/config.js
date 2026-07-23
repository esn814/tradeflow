// server/config.js — Centralized config validation (fails loudly at startup)
// All required env vars are checked here, not scattered across files

const config = {
  // Required
  JWT_SECRET: process.env.JWT_SECRET,

  // Optional with defaults
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH,
  SIWE_DOMAIN: process.env.SIWE_DOMAIN || 'tradeflow.cloud.hyperpaxeer.com',
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  SENTRY_DSN: process.env.SENTRY_DSN || null,
};

// Validate required vars
const errors = [];

if (!config.JWT_SECRET) {
  errors.push('JWT_SECRET is required (generate with: openssl rand -hex 32)');
}

if (isNaN(config.PORT) || config.PORT < 1 || config.PORT > 65535) {
  errors.push(`PORT must be a valid port number, got: ${process.env.PORT}`);
}

if (isNaN(config.BACKUP_RETENTION_DAYS) || config.BACKUP_RETENTION_DAYS < 1) {
  errors.push(`BACKUP_RETENTION_DAYS must be a positive integer, got: ${process.env.BACKUP_RETENTION_DAYS}`);
}

const validLogLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
if (!validLogLevels.includes(config.LOG_LEVEL)) {
  errors.push(`LOG_LEVEL must be one of ${validLogLevels.join(', ')}, got: ${config.LOG_LEVEL}`);
}

if (errors.length > 0) {
  console.error('FATAL: Configuration errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

// Log config at startup (non-sensitive values only)
export function logConfig(logger) {
  logger.info({
    port: config.PORT,
    nodeEnv: config.NODE_ENV,
    siweDomain: config.SIWE_DOMAIN,
    backupRetentionDays: config.BACKUP_RETENTION_DAYS,
    logLevel: config.LOG_LEVEL,
    sentryEnabled: !!config.SENTRY_DSN,
    dbPath: config.DB_PATH || '(default)',
  }, 'Server configuration loaded');
}

export default config;
