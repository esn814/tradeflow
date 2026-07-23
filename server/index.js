import config, { logConfig } from './config.js'; // validates env vars on import — exits if invalid
import { logger } from './logger.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import rateLimit from 'express-rate-limit';
import { getDb } from './db.js';
import authRouter, { authMiddleware } from './auth.js';
import botsRouter from './routes/bots.js';
import tradesRouter from './routes/trades.js';
import alertsRouter from './routes/alerts.js';
import schedulesRouter from './routes/schedules.js';
import settingsRouter from './routes/settings.js';
import copyTradingRouter from './routes/copy-trading.js';
import pushRouter from './routes/push.js';
import socialRouter from './routes/social.js';
import { startAlertChecker } from './services/alertChecker.js';
import { startBackupScheduler, createBackup, listBackups } from './backup.js';

const app = express();
const PORT = config.PORT;

// ── Sentry (must be before all middleware) ─────────────────────
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  app.use(Sentry.setupExpressRequestHandler());
}

// Trust reverse proxy (Render, Cloudflare) for correct rate-limit IPs and proto
app.set('trust proxy', 1);

// ── Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.) ──
app.use(helmet({
  contentSecurityPolicy: false, // CSP is in HTML meta tag
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// CORS origins from env (comma-separated) or defaults
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'https://tradeflow.cloud.hyperpaxeer.com',
];
const ALLOWED_ORIGINS = config.CORS_ORIGINS
  ? config.CORS_ORIGINS.split(',').map(o => o.trim())
  : DEFAULT_ORIGINS;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── Structured request logging (pino-http) ────────────────────
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

// ── Rate Limiting ──────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later' },
});
app.use('/api/auth', authLimiter);

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later' },
});

// Health check — no uptime disclosure
app.get('/api/health', (req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

const tradeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many trade requests. Slow down.' },
});

const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Backup request limit reached. Try again later.' },
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/bots', writeLimiter, botsRouter);
app.use('/api/trades', tradeLimiter, tradesRouter);
app.use('/api/alerts', writeLimiter, alertsRouter);
app.use('/api/schedules', writeLimiter, schedulesRouter);
app.use('/api/settings', writeLimiter, settingsRouter);
app.use('/api/copy-trading', writeLimiter, copyTradingRouter);
app.use('/api/push', writeLimiter, pushRouter);
app.use('/api/social', socialRouter);

// Backup endpoints — no path disclosure, rate limited
app.get('/api/backup', authMiddleware, (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups, count: backups.length });
  } catch {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});
app.post('/api/backup', backupLimiter, authMiddleware, (req, res) => {
  try {
    const result = createBackup();
    if (result.ok) {
      res.json({ ok: result.ok, sizeMB: result.sizeMB });
    } else {
      res.status(500).json({ error: 'Backup failed' });
    }
  } catch {
    res.status(500).json({ error: 'Backup failed' });
  }
});

// Sentry error handler (must be after routes, before custom error handler)
if (config.SENTRY_DSN) {
  app.use(Sentry.setupExpressErrorHandler());
}

// Global error handler
app.use((err, req, res, _next) => {
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  logConfig(logger);
  logger.info({ port: PORT }, `TradeFlow API v1.1 running on port ${PORT}`);
  startAlertChecker(60_000);
  startBackupScheduler();
});

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  try { createBackup(); } catch {}
  server.close(() => {
    try {
      const db = getDb();
      if (db && db.open) db.close();
    } catch {}
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
