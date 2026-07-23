import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getDb } from '../db.js';
import { sanitize } from '../middleware/validate.js';
import { validateBody } from '../middleware/validateZod.js';
import { createTradeSchema } from '../schemas.js';

const router = Router();
router.use(authMiddleware);
router.use(sanitize);

router.get('/', (req, res) => {
  try {
    const { botId, limit = 100, offset = 0 } = req.query;
    let sql = `SELECT * FROM trades WHERE user_id = ?`;
    const params = [req.userId];
    if (botId) { sql += ` AND bot_id = ?`; params.push(botId); }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    const rows = getDb().prepare(sql).all(...params);
    res.json(rows.map(r => ({
      id: r.id, botId: r.bot_id, pair: r.pair, side: r.side,
      price: r.price, qty: r.qty, pnl: r.pnl, status: r.status,
      sl: r.sl, tp: r.tp, strategy: r.strategy, time: r.created_at,
      meta: r.meta ? JSON.parse(r.meta) : null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch trades' }); }
});

router.get('/summary', (req, res) => {
  try {
    const { botId } = req.query;
    let where = `WHERE user_id = ?`;
    const params = [req.userId];
    if (botId) { where += ` AND bot_id = ?`; params.push(botId); }
    const stats = getDb().prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(pnl),0) as totalPnl,
             COALESCE(SUM(price*qty),0) as volume,
             SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
      FROM trades ${where}
    `).get(...params);
    res.json({
      count: stats.count, totalPnl: stats.totalPnl, volume: stats.volume,
      winRate: stats.count > 0 ? +((stats.wins / stats.count) * 100).toFixed(1) : 0,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to compute summary' }); }
});

router.post('/', validateBody(createTradeSchema), (req, res) => {
  try {
    const { id, botId, pair, side, price, qty, pnl, status, sl, tp, strategy, meta, time } = req.body;
    const tradeId = id || `trade-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    getDb().prepare(`
      INSERT INTO trades (id,user_id,bot_id,pair,side,price,qty,pnl,status,sl,tp,strategy,meta,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,datetime('now')))
    `).run(tradeId, req.userId, botId, pair, side, price, qty, pnl||0, status||'filled', sl, tp, strategy, meta?JSON.stringify(meta):null, time||null);
    res.status(201).json({ ok: true, id: tradeId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to record trade' }); }
});

export default router;
