import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { getDb } from '../db.js';
import { sanitize } from '../middleware/validate.js';

const router = Router();
router.use(authMiddleware);
router.use(sanitize);

router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT * FROM bots WHERE user_id = ? ORDER BY created_at DESC`).all(req.userId);
    res.json(rows.map(r => ({
      id: r.id, name: r.name, type: r.type, coin: r.coin,
      invested: r.invested, currentValue: r.current_value,
      status: r.status, strategy: r.strategy, createdAt: r.created_at,
      config: r.config ? JSON.parse(r.config) : null,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch bots' }); }
});

router.post('/', (req, res) => {
  try {
    const { id, name, type, coin, invested, currentValue, status, strategy, config } = req.body;
    if (!id) return res.status(400).json({ error: 'Bot id is required' });
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO bots (id, user_id, name, type, coin, invested, current_value, status, strategy, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, type=excluded.type, coin=excluded.coin,
        invested=excluded.invested, current_value=excluded.current_value,
        status=excluded.status, strategy=excluded.strategy, config=excluded.config,
        updated_at=excluded.updated_at
      WHERE bots.user_id = excluded.user_id
    `).run(id, req.userId, name, type, coin, invested || 0, currentValue || 0, status || 'active', strategy, config ? JSON.stringify(config) : null, now, now);
    res.status(201).json({ ok: true, id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create bot' }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, type, coin, invested, currentValue, status, strategy, config } = req.body;
    const now = new Date().toISOString();
    const result = getDb().prepare(`
      UPDATE bots SET name=COALESCE(?,name), type=COALESCE(?,type), coin=COALESCE(?,coin),
      invested=COALESCE(?,invested), current_value=COALESCE(?,current_value),
      status=COALESCE(?,status), strategy=COALESCE(?,strategy),
      config=COALESCE(?,config), updated_at=?
      WHERE id=? AND user_id=?
    `).run(name, type, coin, invested, currentValue, status, strategy, config ? JSON.stringify(config) : null, now, req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Bot not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update bot' }); }
});

router.delete('/:id', (req, res) => {
  try {
    const result = getDb().prepare(`DELETE FROM bots WHERE id=? AND user_id=?`).run(req.params.id, req.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Bot not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to delete bot' }); }
});

export default router;
