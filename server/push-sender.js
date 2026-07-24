// Push notification sender — dispatches web-push to all of a user's subscriptions
import webpush from 'web-push';
import { getDb } from './db.js';
import { logger } from './logger.js';
import config from './config.js';

// Configure VAPID from env vars
let vapidConfigured = false;
if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:alerts@tradeflow.app', config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  logger.info('[push-sender] VAPID keys loaded from environment');
} else {
  logger.warn('[push-sender] VAPID keys not set — push sending disabled');
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
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        logger.info({ subId: sub.id }, '[push-sender] Removed stale subscription');
      } else {
        logger.warn({ err, subId: sub.id, statusCode: err.statusCode }, '[push-sender] Push failed');
      }
    }
  }

  return { sent, failed };
}

export { vapidConfigured };
