import express from 'express';
import cors from 'cors';
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
const PORT = process.env.PORT || 3001;

// Trust reverse proxy (Render, Cloudflare) for correct rate-limit IPs and proto
app.set('trust proxy', 1);

// CORS origins from env (comma-separated) or defaults
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'https://tradeflow.cloud.hyperpaxeer.com',
];
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : DEFAULT_ORIGINS;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
    else cb(new Error('CORS blocked: ' + origin));
  },
}));
app.use(express.json({ limit: '1mb' }));

// ── Rate Limiting ──────────────────────────────────────────────
// Global: 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', globalLimiter);

// Auth endpoints: stricter — 20 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later' },
});
app.use('/api/auth', authLimiter);

// Write endpoints: 30 requests per 15 minutes
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, please try again later' },
});

// Health check
app.get('/api/health', (req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ ok: true, uptime: process.uptime() });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unreachable' });
  }
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/bots', writeLimiter, botsRouter);
app.use('/api/trades', writeLimiter, tradesRouter);
app.use('/api/alerts', writeLimiter, alertsRouter);
app.use('/api/schedules', writeLimiter, schedulesRouter);
app.use('/api/settings', writeLimiter, settingsRouter);
app.use('/api/copy-trading', writeLimiter, copyTradingRouter);
app.use('/api/push', writeLimiter, pushRouter);
app.use('/api/social', socialRouter);

// Backup endpoints — manual trigger + list
app.get('/api/backup', authMiddleware, (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups, count: backups.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});
app.post('/api/backup', authMiddleware, (req, res) => {
  try {
    const result = createBackup();
    if (result.ok) res.json(result);
    else res.status(500).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Backup failed' });
  }
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`TradeFlow API v1.1 running on port ${PORT}`);
  startAlertChecker(60_000); // check alerts every 60s
  startBackupScheduler(); // daily SQLite backups with 7-day retention
});

// Graceful shutdown — close DB and server on SIGTERM/SIGINT
function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  server.close(() => {
    try {
      const db = getDb();
      if (db && db.open) db.close();
    } catch {}
    console.log('Server closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => { process.exit(1); }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
