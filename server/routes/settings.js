import { Router } from 'express';
import { logger } from '../logger.js';
import { authMiddleware } from '../auth.js';
import { getDb } from '../db.js';
import { sanitize } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);
router.use(sanitize);

// GET /api/settings — fetch user settings (auto-creates defaults if none exist)
router.get('/', (req, res) => {
  try {
    let row = getDb().prepare(`SELECT * FROM settings WHERE user_id = ?`).get(req.userId);
    if (!row) {
      getDb().prepare(`INSERT INTO settings (user_id) VALUES (?)`).run(req.userId);
      row = getDb().prepare(`SELECT * FROM settings WHERE user_id = ?`).get(req.userId);
    }
    res.json({
      riskTolerance: row.risk_tolerance,
      notifications: !!row.notifications,
      darkMode: !!row.dark_mode,
      demoMode: !!row.demo_mode,
      virtualBalance: row.virtual_balance,
      selectedPlan: row.selected_plan,
      hasCompletedOnboarding: !!row.has_completed_onboarding,
      antiPhishingCode: row.anti_phishing_code || '',
    });
  } catch (err) { logger.error({ err }; res.status(500).json({ error: 'Failed to fetch settings' }); }
});

// PUT /api/settings — update user settings
router.put('/', (req, res) => {
  try {
    const { riskTolerance, notifications, darkMode, demoMode, virtualBalance, selectedPlan, hasCompletedOnboarding, antiPhishingCode } = req.body;
    // Ensure row exists
    getDb().prepare(`INSERT OR IGNORE INTO settings (user_id) VALUES (?)`).run(req.userId);
    getDb().prepare(`
      UPDATE settings SET
        risk_tolerance = COALESCE(?, risk_tolerance),
        notifications = COALESCE(?, notifications),
        dark_mode = COALESCE(?, dark_mode),
        demo_mode = COALESCE(?, demo_mode),
        virtual_balance = COALESCE(?, virtual_balance),
        selected_plan = COALESCE(?, selected_plan),
        has_completed_onboarding = COALESCE(?, has_completed_onboarding),
        anti_phishing_code = COALESCE(?, anti_phishing_code),
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      riskTolerance ?? null,
      notifications != null ? (notifications ? 1 : 0) : null,
      darkMode != null ? (darkMode ? 1 : 0) : null,
      demoMode != null ? (demoMode ? 1 : 0) : null,
      virtualBalance ?? null,
      selectedPlan ?? null,
      hasCompletedOnboarding != null ? (hasCompletedOnboarding ? 1 : 0) : null,
      antiPhishingCode ?? null,
      req.userId
    );
    res.json({ ok: true });
  } catch (err) { logger.error({ err }; res.status(500).json({ error: 'Failed to update settings' }); }
});

// GET /api/settings/demo-trades — fetch demo trade history
router.get('/demo-trades', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM demo_trades WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500`).all(req.userId);
    res.json(rows.map(r => ({
      id: r.id, pair: r.pair, side: r.side, price: r.price,
      qty: r.qty, pnl: r.pnl, strategy: r.strategy, timestamp: r.timestamp,
    })));
  } catch (err) { logger.error({ err }; res.status(500).json({ error: 'Failed to fetch demo trades' }); }
});

// POST /api/settings/demo-trades — record a demo trade
router.post('/demo-trades', (req, res) => {
  try {
    const { id, pair, side, price, qty, pnl, strategy, timestamp } = req.body;
    const tradeId = id || `demo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    getDb().prepare(`
      INSERT INTO demo_trades (id, user_id, pair, side, price, qty, pnl, strategy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tradeId, req.userId, pair, side, price, qty, pnl || 0, strategy, timestamp || Date.now());
    res.status(201).json({ ok: true, id: tradeId });
  } catch (err) { logger.error({ err }; res.status(500).json({ error: 'Failed to record demo trade' }); }
});

export default router;
