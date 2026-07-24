// storeSync.js — Bidirectional sync between AppStore (localStorage) and the TradeFlow backend.
// Designed to be a no-op when the user is not authenticated or the backend is unreachable.

import {
  restoreSession, getWalletAddress, checkHealth,
  fetchSettings, saveSettings,
} from './apiClient.js';

let _synced = false;
let _backendAvailable = null; // null = not checked, true/false

// Check if backend is reachable (cached after first check)
async function isBackendUp() {
  if (_backendAvailable !== null) return _backendAvailable;
  _backendAvailable = await checkHealth();
  return _backendAvailable;
}

// ─── LOAD FROM BACKEND (on app mount, if authenticated) ───────
export async function loadFromBackend() {
  const restored = await restoreSession();
  if (!restored || !getWalletAddress()) return null;

  const up = await isBackendUp();
  if (!up) return null;

  try {
    const [bots, alerts, schedules, settings, followedTraders] = await Promise.all([
      fetchBots(),
      fetchAlerts(),
      fetchSchedules(),
      fetchSettings(),
      fetchFollowedTraders(),
    ]);

    // Only return data if we got real responses
    if (!bots && !alerts && !schedules && !settings) return null;

    _synced = true;
    return {
      bots: bots?.length ? bots : undefined,
      alerts: alerts?.length ? alerts : undefined,
      schedules: schedules?.length ? schedules : undefined,
      settings: settings || undefined,
      followedTraders: followedTraders?.length ? followedTraders : undefined,
    };
  } catch (err) {
    console.warn('[storeSync] loadFromBackend failed:', err.message);
    return null;
  }
}

// ─── PUSH TO BACKEND (debounced, called on store changes) ─────
// Uses a dirty-tracking approach: only pushes slices that changed.
let _pushTimer = null;
let _prevSnapshot = {};

export function scheduleBackendPush(store) {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => pushToBackend(store), 10000);
}

async function pushToBackend(store) {
  if (!getWalletAddress()) return;

  const up = await isBackendUp();
  if (!up) return;

  try {
    // Detect which slices changed by comparing JSON
    const prev = _prevSnapshot;
    const curr = {
      bots: JSON.stringify(store.bots),
      alerts: JSON.stringify(store.alerts),
      schedules: JSON.stringify(store.schedules),
      settings: JSON.stringify(store.settings),
      followedTraders: JSON.stringify(store.followedTraders),
    };
    _prevSnapshot = { ...curr };

    // Push changed slices in parallel
    const pushes = [];

    if (prev.bots !== curr.bots && store.bots) {
      for (const bot of store.bots) {
        pushes.push(saveBot(bot).catch(() => {}));
      }
    }

    if (prev.alerts !== curr.alerts && store.alerts) {
      for (const alert of store.alerts) {
        pushes.push(createAlert(alert).catch(() => {}));
      }
    }

    if (prev.schedules !== curr.schedules && store.schedules) {
      for (const schedule of store.schedules) {
        pushes.push(createSchedule(schedule).catch(() => {}));
      }
    }

    if (prev.settings !== curr.settings && store.settings) {
      pushes.push(saveSettings(store.settings).catch(() => {}));
    }

    if (prev.followedTraders !== curr.followedTraders && store.followedTraders) {
      for (const trader of store.followedTraders) {
        pushes.push(followTrader(trader.traderId || trader.id, trader.copySettings).catch(() => {}));
      }
    }

    if (pushes.length > 0) {
      await Promise.allSettled(pushes);
      
    }
  } catch (err) {
    console.warn('[storeSync] pushToBackend failed:', err.message);
  }
}

// Reset sync state (e.g., on logout)
export function resetSync() {
  _synced = false;
  _backendAvailable = null;
  _prevSnapshot = {};
  if (_pushTimer) clearTimeout(_pushTimer);
}
