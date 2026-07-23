// Push notification sender — dispatches web-push to all of a user's subscriptions
import webpush from 'web-push';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAPID_KEYS_PATH = join(__dirname, 'vapid-keys.json');

// Configure VAPID
let vapidConfigured = false;
if (existsSync(VAPID_KEYS_PATH)) {
  const keys = JSON.parse(readFileSync(VAPID_KEYS_PATH, 'utf8'));
  webpush.setVapidDetails('mailto:alerts@tradeflow.app', keys.publicKey, keys.privateKey);
  vapidConfigured = true;
  console.log('[push-sender] VAPID keys loaded');
} else {
  console.warn('[push-sender] VAPID keys not found — push sending disabled');
}

/**
 * Send a push notification to all of a user's subscribed devices.
 * @param {number} userId
 * @param {object} payload — { title, body, icon?, tag?, url?, data? }
 * @returns {{ sent: number, failed: number }}
 */
export async function sendPushToUser(userId, payload) {
  if (!vapidConfigured) return { sent: 0, failed: 0, reason: 'no-vapid' };

  const db = getDb();
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  if (subs.length === 0) return { sent: 0, failed: 0, reason: 'no-subscriptions' };

  const pushPayload = JSON.stringify({
    title: payload.title || 'TradeFlow Alert',
    body: payload.body || '',
    icon: payload.icon || '/logo.jpg',
    tag: payload.tag || 'tradeflow-alert',
    data: { url: payload.url || '/alerts', ...payload.data },
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload,
      );
      sent++;
    } catch (err) {
      failed++;
      // 410 Gone or 404 = subscription expired/invalid — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        console.log(`[push-sender] Removed stale subscription ${sub.id}`);
      } else {
        console.warn(`[push-sender] Push failed for sub ${sub.id}:`, err.statusCode, err.message);
      }
    }
  }

  return { sent, failed };
}

export { vapidConfigured };
