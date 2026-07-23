import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../auth.js';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAPID_KEYS_PATH = join(__dirname, '..', 'vapid-keys.json');

// Load VAPID keys
let vapidKeys = null;
if (existsSync(VAPID_KEYS_PATH)) {
  vapidKeys = JSON.parse(readFileSync(VAPID_KEYS_PATH, 'utf8'));
}

const router = Router();

// GET /api/push/vapid-public-key — no auth needed, this is public info
router.get('/vapid-public-key', (req, res) => {
  if (!vapidKeys) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }
  res.json({ publicKey: vapidKeys.publicKey });
});

// All other push routes require auth
router.use(authMiddleware);

// POST /api/push/subscribe — store a push subscription for this user
router.post('/subscribe', (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Missing endpoint or keys' });
    }

    const db = getDb();
    db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
    `).run(req.userId, endpoint, keys.p256dh, keys.auth);

    res.json({ ok: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// POST /api/push/unsubscribe — remove a push subscription
router.post('/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }

    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .run(req.userId, endpoint);

    res.json({ ok: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// GET /api/push/subscriptions — list user's active subscriptions
router.get('/subscriptions', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = ?')
      .all(req.userId);
    res.json(rows);
  } catch (err) {
    console.error('Push list error:', err);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
});

export default router;
export { vapidKeys };
