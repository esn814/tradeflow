// Alert Checker — periodically checks price alert conditions and sends push notifications
import webpush from 'web-push';
import { getDb } from '../db.js';
import { logger } from '../logger.js';
import config from '../config.js';

let configured = false;

function ensureVapid() {
  if (configured) return;
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
    logger.warn('[alertChecker] VAPID keys not set — push notifications disabled');
    return;
  }
  webpush.setVapidDetails('mailto:alerts@tradeflow.app', config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
  configured = true;
}

// Price cache to avoid hammering external APIs
const priceCache = new Map();
const PRICE_CACHE_TTL = 30_000;

async function fetchPriceData(asset) {
  const key = asset.toUpperCase();
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) return cached;

  try {
    const res = await fetch(`https://data-api.crossverse.app/api/${key.toLowerCase()}/price`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const price = data.price ?? data.last ?? data.close ?? null;
    const change24h = data.change24h ?? data.change_24h ?? data.percentChange24h ?? null;
    if (price != null) {
      const entry = { price: Number(price), change24h: change24h != null ? Number(change24h) : null, ts: Date.now() };
      priceCache.set(key, entry);
      return entry;
    }
    return cached ?? { price: null, change24h: null };
  } catch (err) {
    logger.warn({ err, asset: key }, '[alertChecker] Price fetch failed');
    return cached ?? { price: null, change24h: null };
  }
}

function checkCondition(condition, currentPrice, threshold, priceData) {
  const c = (condition || '').toLowerCase().trim();
  if (c === 'above' || c === '>') return currentPrice > threshold;
  if (c === 'below' || c === '<') return currentPrice < threshold;
  if (c === '>=') return currentPrice >= threshold;
  if (c === '<=') return currentPrice <= threshold;
  if (c === '==' || c === '=') return Math.abs(currentPrice - threshold) < threshold * 0.001;
  const change24h = priceData?.change24h ?? null;
  if (change24h != null) {
    if (c === 'change_up') return change24h >= threshold;
    if (c === 'change_down') return change24h <= -threshold;
  }
  return false;
}

async function sendPush(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 3600 }
    );
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      logger.info('[alertChecker] Removing stale subscription');
      try {
        getDb().prepare('DELETE FROM push_subscriptions WHERE id = ?').run(subscription.id);
      } catch {}
    } else {
      logger.warn({ err, statusCode: err.statusCode }, '[alertChecker] Push send failed');
    }
    return false;
  }
}

async function checkAlerts() {
  try {
    const db = getDb();
    const alerts = db.prepare(`
      SELECT a.*, u.address
      FROM alerts a
      JOIN users u ON u.id = a.user_id
      WHERE a.active = 1 AND a.triggered = 0 AND a.type = 'price'
    `).all();

    if (alerts.length === 0) return;

    const assetGroups = new Map();
    for (const alert of alerts) {
      const key = (alert.asset || '').toUpperCase();
      if (!assetGroups.has(key)) assetGroups.set(key, []);
      assetGroups.get(key).push(alert);
    }

    for (const [asset, groupAlerts] of assetGroups) {
      const priceData = await fetchPriceData(asset);
      const currentPrice = priceData.price;
      if (currentPrice == null) continue;

      for (const alert of groupAlerts) {
        if (!checkCondition(alert.condition, currentPrice, alert.value, priceData)) continue;

        db.prepare('UPDATE alerts SET triggered = 1 WHERE id = ?').run(alert.id);

        const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(alert.user_id);
        if (subs.length === 0) continue;

        const payload = {
          title: `${asset} Alert Triggered`,
          body: `${asset} is now $${currentPrice.toLocaleString()} (${alert.condition} $${alert.value.toLocaleString()})`,
          icon: '/logo.jpg',
          badge: '/logo.jpg',
          tag: `alert-${alert.id}`,
          data: { alertId: alert.id, asset, price: currentPrice, url: '/alerts' },
          actions: [
            { action: 'view', title: 'View Alerts' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        };

        let sent = 0;
        for (const sub of subs) {
          if (await sendPush(sub, payload)) sent++;
        }
        logger.info({ alertId: alert.id, asset, condition: alert.condition, value: alert.value, price: currentPrice, pushed: sent, total: subs.length }, '[alertChecker] Alert triggered');
      }
    }
  } catch (err) {
    logger.error({ err }, '[alertChecker] Check cycle error');
  }
}

let _interval = null;

export function startAlertChecker(intervalMs = 60_000) {
  ensureVapid();
  if (!configured) {
    logger.warn('[alertChecker] Cannot start — VAPID not configured');
    return;
  }
  checkAlerts();
  _interval = setInterval(checkAlerts, intervalMs);
  logger.info({ intervalMs }, '[alertChecker] Started');
}

export function stopAlertChecker() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    logger.info('[alertChecker] Stopped');
  }
}
