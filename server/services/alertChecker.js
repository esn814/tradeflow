// Alert Checker — periodically checks price alert conditions and sends push notifications
import webpush from 'web-push';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAPID_KEYS_PATH = join(__dirname, '..', 'vapid-keys.json');

let configured = false;

function ensureVapid() {
  if (configured) return;
  if (!existsSync(VAPID_KEYS_PATH)) {
    console.warn('[alertChecker] VAPID keys not found — push notifications disabled');
    return;
  }
  const keys = JSON.parse(readFileSync(VAPID_KEYS_PATH, 'utf8'));
  webpush.setVapidDetails('mailto:alerts@tradeflow.app', keys.publicKey, keys.privateKey);
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
    console.warn(`[alertChecker] Price fetch failed for ${key}:`, err.message);
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
  // 24h change percentage conditions
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
      console.log(`[alertChecker] Removing stale subscription`);
      try {
        getDb().prepare('DELETE FROM push_subscriptions WHERE id = ?').run(subscription.id);
      } catch {}
    } else {
      console.warn(`[alertChecker] Push send failed (${err.statusCode}):`, err.message);
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
        console.log(`[alertChecker] Alert #${alert.id} (${asset} ${alert.condition} $${alert.value}) triggered at $${currentPrice} — pushed to ${sent}/${subs.length} devices`);
      }
    }
  } catch (err) {
    console.error('[alertChecker] Check cycle error:', err.message);
  }
}

let _interval = null;

export function startAlertChecker(intervalMs = 60_000) {
  ensureVapid();
  if (!configured) {
    console.warn('[alertChecker] Cannot start — VAPID not configured');
    return;
  }
  checkAlerts();
  _interval = setInterval(checkAlerts, intervalMs);
  console.log(`[alertChecker] Started — checking every ${intervalMs / 1000}s`);
}

export function stopAlertChecker() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    console.log('[alertChecker] Stopped');
  }
}
