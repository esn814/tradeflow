import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getDb } from '../db.js';
import { sanitize } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);
router.use(sanitize);

router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM schedules WHERE user_id = ? ORDER BY created_at DESC`).all(req.userId);
    res.json(rows.map(r => ({
      id: r.id, action: r.action, cron: r.cron,
      params: r.params ? JSON.parse(r.params) : null,
      active: !!r.active, lastRun: r.last_run, createdAt: r.created_at,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch schedules' }); }
});

router.post('/', (req, res) => {
  try {
    const { id, action, cron, params } = req.body;
    const scheduleId = id || `sch-${Date.now()}`;
    getDb().prepare(`
      INSERT INTO schedules (id,user_id,action,cron,params,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)
      ON CONFLICT(id) DO UPDATE SET
        action=excluded.action, cron=excluded.cron, params=excluded.params,
        active=excluded.active, updated_at=excluded.updated_at
      WHERE schedules.user_id = excluded.user_id
    `).run(scheduleId, req.userId, action, cron, params?JSON.stringify(params):null, now, now);
    res.status(201).json({ ok: true, id: scheduleId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create schedule' }); }
});

router.put('/:id', (req, res) => {
  try {
    const { action, cron, params, active } = req.body;
    const result = getDb().prepare(`
      UPDATE schedules SET action=COALESCE(?,action), cron=COALESCE(?,cron),
      params=COALESCE(?,params), active=COALESCE(?,active) WHERE id=? AND user_id=?
    `).run(action, cron, params?JSON.stringify(params):null, active!=null?(active?1:0):null, req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update schedule' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const result = getDb().prepare(`DELETE FROM schedules WHERE id=? AND user_id=?`).run(req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete schedule' }); }
});

export default router;
