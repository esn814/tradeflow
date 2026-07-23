import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getDb } from '../db.js';
import { sanitize } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);
router.use(sanitize);

router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC`).all(req.userId);
    res.json(rows.map(r => ({
      id: r.id, type: r.type, asset: r.asset, condition: r.condition,
      value: r.value, active: !!r.active, triggered: !!r.triggered,
      createdAt: r.created_at, meta: r.meta ? JSON.parse(r.meta) : null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch alerts' }); }
});

router.post('/', (req, res) => {
  try {
    const { type, asset, condition, value, meta } = req.body;
    const result = getDb().prepare(`
      INSERT INTO alerts (user_id,type,asset,condition,value,active,triggered,meta) VALUES (?,?,?,?,?,1,0,?)
    `).run(req.userId, type, asset, condition, value, meta?JSON.stringify(meta):null);
    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create alert' }); }
});

router.put('/:id', (req, res) => {
  try {
    const { type, asset, condition, value, active, triggered, meta } = req.body;
    const result = getDb().prepare(`
      UPDATE alerts SET type=COALESCE(?,type), asset=COALESCE(?,asset),
      condition=COALESCE(?,condition), value=COALESCE(?,value),
      active=COALESCE(?,active), triggered=COALESCE(?,triggered), meta=COALESCE(?,meta)
      WHERE id=? AND user_id=?
    `).run(type, asset, condition, value, active!=null?(active?1:0):null, triggered!=null?(triggered?1:0):null, meta?JSON.stringify(meta):null, req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update alert' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const result = getDb().prepare(`DELETE FROM alerts WHERE id=? AND user_id=?`).run(req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete alert' }); }
});

export default router;
