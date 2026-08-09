/**
 * Live Trading Routes — REST API for the AutoTrader.
 *
 * Endpoints:
 *   GET  /api/live-trading/strategies         — list available strategies
 *   POST /api/live-trading/bots               — create a live bot
 *   GET  /api/live-trading/bots               — list user's bots
 *   GET  /api/live-trading/bots/:id           — get bot detail
 *   POST /api/live-trading/bots/:id/start     — start a bot
 *   POST /api/live-trading/bots/:id/stop      — stop a bot
 *   DELETE /api/live-trading/bots/:id         — delete a bot
 *   GET  /api/live-trading/bots/:id/trades    — get bot's trade history
 *   GET  /api/live-trading/trades             — get all user trades
 *   GET  /api/live-trading/positions          — get open positions
 *   GET  /api/live-trading/pnl                — get P&L summary
 *   POST /api/live-trading/keys               — store exchange API keys
 *   GET  /api/live-trading/keys               — list stored key previews
 */

import { Router } from 'express';
import { randomBytes } from 'crypto';
import { getDb } from '../db.js';
import { authMiddleware } from '../auth.js';
import { logger } from '../logger.js';
import { encrypt, decrypt } from '../services/crypto.js';
import {
  startBot, stopBot, getBotStatus, getAllRunningBots,
  getAvailableStrategies,
} from '../services/autoTrader.js';

const router = Router();
router.use(authMiddleware);

// ── Strategies ─────────────────────────────────────────────

router.get('/strategies', (req, res) => {
  try {
    const strategies = getAvailableStrategies();
    res.json(strategies);
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get strategies');
    res.status(500).json({ error: 'Failed to get strategies' });
  }
});

// ── Exchange Keys ──────────────────────────────────────────

router.post('/keys', async (req, res) => {
  try {
    const { exchange, apiKey, apiSecret, environment = 'testnet' } = req.body;
    if (!exchange || !apiKey || !apiSecret) {
      return res.status(400).json({ error: 'exchange, apiKey, and apiSecret are required' });
    }

    // Validate exchange against allowlist
    const ALLOWED_EXCHANGES = ['binance', 'coinbase', 'kraken', 'bybit', 'bitget', 'okx'];
    if (!ALLOWED_EXCHANGES.includes(exchange.toLowerCase())) {
      return res.status(400).json({ error: `Unsupported exchange: ${exchange}. Allowed: ${ALLOWED_EXCHANGES.join(', ')}` });
    }

    // Validate environment
    const allowedEnvs = ['testnet', 'production'];
    if (!allowedEnvs.includes(environment)) {
      return res.status(400).json({ error: `Invalid environment: ${environment}. Must be testnet or production` });
    }

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);
    const keyPreview = apiKey.slice(0, 8) + '••••••••';

    const db = getDb();
    db.prepare(`
      INSERT INTO exchange_keys (user_id, exchange, api_key_encrypted, api_secret_encrypted, environment, key_preview, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, exchange, environment) DO UPDATE SET
        api_key_encrypted = excluded.api_key_encrypted,
        api_secret_encrypted = excluded.api_secret_encrypted,
        key_preview = excluded.key_preview,
        updated_at = datetime('now')
    `).run(req.userId, exchange, encryptedKey, encryptedSecret, environment, keyPreview);

    res.json({ ok: true, keyPreview, environment });
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to store keys');
    res.status(500).json({ error: 'Failed to store keys' });
  }
});

router.get('/keys', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT id, exchange, environment, key_preview, created_at FROM exchange_keys WHERE user_id = ?')
      .all(req.userId);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to list keys');
    res.status(500).json({ error: 'Failed to list keys' });
  }
});

// ── Bots CRUD ──────────────────────────────────────────────

router.post('/bots', async (req, res) => {
  try {
    const { name, coin, strategy, config = {}, riskConfig = {}, intervalMs = 60000 } = req.body;
    if (!name || !coin || !strategy) {
      return res.status(400).json({ error: 'name, coin, and strategy are required' });
    }

    // Validate strategy exists
    const strategies = getAvailableStrategies();
    if (!strategies.find(s => s.id === strategy)) {
      return res.status(400).json({ error: `Unknown strategy: ${strategy}` });
    }

    // Validate and clamp risk config
    const safeMaxTradeUsd = Math.min(Math.max(Number(riskConfig.maxTradeUsd) || 1000, 1), 100000);
    const safeMaxPositionUsd = Math.min(Math.max(Number(riskConfig.maxPositionUsd) || 5000, 1), 500000);
    const safeMaxDailyLoss = Math.min(Math.max(Number(riskConfig.maxDailyLoss) || 500, 1), 50000);
    const safeMaxDrawdown = Math.min(Math.max(Number(riskConfig.maxDrawdown) || 10, 1), 50);
    const safeConfig = {
      ...riskConfig,
      maxTradeUsd: safeMaxTradeUsd,
      maxPositionUsd: safeMaxPositionUsd,
      maxDailyLoss: safeMaxDailyLoss,
      maxDrawdown: safeMaxDrawdown,
    };

    // Validate and clamp interval (30s minimum to avoid Binance rate limits)
    const safeIntervalMs = Math.max(30000, Math.min(Number(intervalMs) || 60000, 3600000));

    const botId = `bot-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const db = getDb();

    db.prepare(`
      INSERT INTO live_bots (id, user_id, name, coin, strategy, config, risk_config, interval_ms, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stopped')
    `).run(botId, req.userId, name, coin.toUpperCase(), strategy, JSON.stringify(config), JSON.stringify(safeConfig), safeIntervalMs);

    const bot = db.prepare('SELECT * FROM live_bots WHERE id = ?').get(botId);
    res.status(201).json({
      id: bot.id, name: bot.name, coin: bot.coin, strategy: bot.strategy,
      config: JSON.parse(bot.config), riskConfig: JSON.parse(bot.risk_config),
      intervalMs: bot.interval_ms, status: bot.status,
    });
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to create bot');
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

router.get('/bots', (req, res) => {
  try {
    const db = getDb();
    const bots = db.prepare('SELECT * FROM live_bots WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);

    const enriched = bots.map(bot => {
      const runtime = getBotStatus(bot.id);
      return {
        id: bot.id, name: bot.name, coin: bot.coin, strategy: bot.strategy,
        config: JSON.parse(bot.config || '{}'),
        riskConfig: JSON.parse(bot.risk_config || '{}'),
        intervalMs: bot.interval_ms,
        status: runtime.running ? 'running' : bot.status,
        totalTrades: bot.total_trades,
        totalPnl: bot.total_pnl,
        winCount: bot.win_count,
        lossCount: bot.loss_count,
        lastTickAt: bot.last_tick_at,
        errorMessage: bot.error_message,
        createdAt: bot.created_at,
        updatedAt: bot.updated_at,
      };
    });

    res.json(enriched);
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to list bots');
    res.status(500).json({ error: 'Failed to list bots' });
  }
});

router.get('/bots/:id', (req, res) => {
  try {
    const db = getDb();
    const bot = db.prepare('SELECT * FROM live_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const runtime = getBotStatus(bot.id);
    const trades = db.prepare('SELECT * FROM live_trades WHERE bot_id = ? ORDER BY created_at DESC LIMIT 50').all(bot.id);
    const positions = db.prepare('SELECT * FROM live_positions WHERE bot_id = ?').all(bot.id);

    res.json({
      id: bot.id, name: bot.name, coin: bot.coin, strategy: bot.strategy,
      config: JSON.parse(bot.config || '{}'),
      riskConfig: JSON.parse(bot.risk_config || '{}'),
      intervalMs: bot.interval_ms,
      status: runtime.running ? 'running' : bot.status,
      totalTrades: bot.total_trades,
      totalPnl: bot.total_pnl,
      winCount: bot.win_count,
      lossCount: bot.loss_count,
      lastTickAt: bot.last_tick_at,
      errorMessage: bot.error_message,
      trades: trades.map(t => ({
        id: t.id, action: t.action, coin: t.coin,
        price: t.price, qty: t.qty, value: t.value, pnl: t.pnl,
        reason: t.reason, orderId: t.order_id, status: t.status,
        createdAt: t.created_at,
      })),
      positions: positions.map(p => ({
        coin: p.coin, qty: p.qty,
        avgEntryPrice: p.avg_entry_price,
        currentPrice: p.current_price,
        unrealizedPnl: p.unrealized_pnl,
      })),
      runtime: runtime.running ? {
        tickCount: runtime.tickCount,
        dailyPnl: runtime.dailyPnl,
        dailyTradeCount: runtime.dailyTradeCount,
        lastError: runtime.lastError,
      } : null,
    });
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get bot');
    res.status(500).json({ error: 'Failed to get bot' });
  }
});

router.delete('/bots/:id', (req, res) => {
  try {
    const db = getDb();
    const bot = db.prepare('SELECT * FROM live_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    // Stop if running
    if (getBotStatus(bot.id).running) {
      stopBot(bot.id, 'deleted');
    }

    // Clean up related data
    db.prepare('DELETE FROM live_trades WHERE bot_id = ?').run(bot.id);
    db.prepare('DELETE FROM live_positions WHERE bot_id = ?').run(bot.id);
    db.prepare('DELETE FROM daily_pnl WHERE bot_id = ?').run(bot.id);
    db.prepare('DELETE FROM live_bots WHERE id = ?').run(bot.id);

    res.json({ ok: true, deleted: bot.id });
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to delete bot');
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// ── Bot Controls ───────────────────────────────────────────

router.post('/bots/:id/start', async (req, res) => {
  try {
    const db = getDb();
    const bot = db.prepare('SELECT * FROM live_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    // Check for exchange keys matching the bot's expected exchange
    const keys = db.prepare('SELECT * FROM exchange_keys WHERE user_id = ?').get(req.userId);
    if (!keys) {
      return res.status(400).json({ error: 'No exchange API keys configured. Add keys in Settings → Connections.' });
    }
    // Verify keys are for a supported exchange (binance for now)
    if (keys.exchange && keys.exchange.toLowerCase() !== 'binance') {
      return res.status(400).json({ error: `Bot requires Binance keys, but found ${keys.exchange} keys. Add Binance keys in Settings → Connections.` });
    }

    const result = await startBot(bot.id, req.userId);
    res.json(result);
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to start bot');
    res.status(500).json({ error: err.message || 'Failed to start bot' });
  }
});

router.post('/bots/:id/stop', (req, res) => {
  try {
    const db = getDb();
    const bot = db.prepare('SELECT * FROM live_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const result = stopBot(bot.id, 'manual');
    res.json(result);
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to stop bot');
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

// ── Trades & Positions ─────────────────────────────────────

router.get('/bots/:id/trades', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const db = getDb();
    const bot = db.prepare('SELECT id FROM live_bots WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });

    const trades = db.prepare('SELECT * FROM live_trades WHERE bot_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(bot.id, Math.min(+limit, 200), +offset);

    res.json(trades.map(t => ({
      id: t.id, action: t.action, coin: t.coin,
      price: t.price, qty: t.qty, value: t.value, pnl: t.pnl,
      reason: t.reason, orderId: t.order_id, status: t.status,
      createdAt: t.created_at,
    })));
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get trades');
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

router.get('/trades', (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const db = getDb();
    const trades = db.prepare('SELECT * FROM live_trades WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(req.userId, Math.min(+limit, 500), +offset);

    res.json(trades.map(t => ({
      id: t.id, botId: t.bot_id, action: t.action, coin: t.coin,
      price: t.price, qty: t.qty, value: t.value, pnl: t.pnl,
      reason: t.reason, status: t.status, createdAt: t.created_at,
    })));
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get trades');
    res.status(500).json({ error: 'Failed to get trades' });
  }
});

router.get('/positions', (req, res) => {
  try {
    const db = getDb();
    const positions = db.prepare('SELECT * FROM live_positions WHERE user_id = ? AND qty > 0').all(req.userId);
    res.json(positions.map(p => ({
      botId: p.bot_id, coin: p.coin, qty: p.qty,
      avgEntryPrice: p.avg_entry_price, currentPrice: p.current_price,
      unrealizedPnl: p.unrealized_pnl,
    })));
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get positions');
    res.status(500).json({ error: 'Failed to get positions' });
  }
});

router.get('/pnl', (req, res) => {
  try {
    const db = getDb();

    // Total P&L across all bots
    const totals = db.prepare(`
      SELECT SUM(total_pnl) as totalPnl, SUM(total_trades) as totalTrades,
             SUM(win_count) as winCount, SUM(loss_count) as lossCount
      FROM live_bots WHERE user_id = ?
    `).get(req.userId) || {};

    // Daily P&L for last 30 days
    const daily = db.prepare(`
      SELECT date, SUM(realized_pnl) as pnl, SUM(trade_count) as trades,
             SUM(win_count) as wins, SUM(loss_count) as losses
      FROM daily_pnl WHERE user_id = ?
      GROUP BY date ORDER BY date DESC LIMIT 30
    `).all(req.userId);

    const totalTrades = totals.totalTrades || 0;
    const winRate = totalTrades > 0 ? ((totals.winCount || 0) / totalTrades * 100).toFixed(1) : '0.0';

    res.json({
      totalPnl: totals.totalPnl || 0,
      totalTrades,
      winCount: totals.winCount || 0,
      lossCount: totals.lossCount || 0,
      winRate,
      daily,
    });
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get P&L');
    res.status(500).json({ error: 'Failed to get P&L' });
  }
});

// ── Running bots status ────────────────────────────────────

router.get('/running', (req, res) => {
  try {
    const running = getAllRunningBots(req.userId);
    res.json(running);
  } catch (err) {
    logger.error({ err }, '[live-trading] Failed to get running bots');
    res.status(500).json({ error: 'Failed to get running bots' });
  }
});

export default router;
