import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { sanitize } from '../middleware/validate.js';
import { getDb } from '../db.js';

const router = Router();
router.use(authMiddleware);
router.use(sanitize);

// GET /api/copy-trading — list followed traders
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM followed_traders WHERE user_id = ? ORDER BY followed_at DESC`).all(req.userId);
    res.json(rows.map(r => ({
      id: r.id, traderId: r.trader_id, followedAt: r.followed_at,
      copySettings: r.copy_settings ? JSON.parse(r.copy_settings) : null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch followed traders' }); }
});

// POST /api/copy-trading — follow a trader
router.post('/', (req, res) => {
  try {
    const { traderId, copySettings } = req.body;
    if (!traderId) return res.status(400).json({ error: 'traderId is required' });
    getDb().prepare(`
      INSERT OR IGNORE INTO followed_traders (user_id, trader_id, copy_settings) VALUES (?, ?, ?)
    `).run(req.userId, traderId, copySettings ? JSON.stringify(copySettings) : null);
    res.status(201).json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to follow trader' }); }
});

// PUT /api/copy-trading/:id — update copy settings
router.put('/:id', (req, res) => {
  try {
    const { copySettings } = req.body;
    const result = getDb().prepare(`
      UPDATE followed_traders SET copy_settings = ? WHERE id = ? AND user_id = ?
    `).run(copySettings ? JSON.stringify(copySettings) : null, req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Follow not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update copy settings' }); }
});

// DELETE /api/copy-trading/:id — unfollow a trader
router.delete('/:id', (req, res) => {
  try {
    const result = getDb().prepare(`DELETE FROM followed_traders WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Follow not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to unfollow trader' }); }
});

// GET /api/copy-trading/history — copy trade history
router.get('/history', (req, res) => {
  try {
    const { traderId, limit = 100 } = req.query;
    let sql = `SELECT * FROM copy_trade_history WHERE user_id = ?`;
    const params = [req.userId];
    if (traderId) { sql += ` AND trader_id = ?`; params.push(traderId); }
    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(Number(limit));
    const rows = getDb().prepare(sql).all(...params);
    res.json(rows.map(r => ({
      id: r.id, traderId: r.trader_id, pair: r.pair, side: r.side,
      price: r.price, qty: r.qty, pnl: r.pnl, timestamp: r.timestamp,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch copy trade history' }); }
});

// POST /api/copy-trading/history — record a copy trade
router.post('/history', (req, res) => {
  try {
    const { id, traderId, pair, side, price, qty, pnl, timestamp } = req.body;
    const tradeId = id || `ct-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    getDb().prepare(`
      INSERT INTO copy_trade_history (id, user_id, trader_id, pair, side, price, qty, pnl, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tradeId, req.userId, traderId, pair, side, price, qty, pnl || 0, timestamp || Date.now());
    res.status(201).json({ ok: true, id: tradeId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to record copy trade' }); }
});

export default router;
