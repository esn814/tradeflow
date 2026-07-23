// TradeFlow API Client — persistent backend sync
// Falls back gracefully to localStorage-only when backend is unavailable

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let _token = null;
let _walletAddress = null;

// Set the JWT token after SIWE authentication
export function setAuthToken(token, address) {
  _token = token;
  _walletAddress = address;
  if (token) {
    localStorage.setItem('tf_auth_token', token);
    localStorage.setItem('tf_wallet_address', address);
  } else {
    localStorage.removeItem('tf_auth_token');
    localStorage.removeItem('tf_wallet_address');
  }
}

// Restore token from localStorage on app load
export function restoreAuthToken() {
  _token = localStorage.getItem('tf_auth_token');
  _walletAddress = localStorage.getItem('tf_wallet_address');
  return { token: _token, address: _walletAddress };
}

// Generic fetch wrapper with auth + error handling
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API ${res.status}`);
  }
  return res.json();
}

// Helper: run an API call, swallow errors (offline-safe)
async function safe(path, options) {
  try {
    return await apiFetch(path, options);
  } catch (err) {
    console.warn(`[apiClient] ${options?.method || 'GET'} ${path} failed:`, err.message);
    return null;
  }
}

// ─── Auth ──────────────────────────────────────────────────────
export async function getNonce() {
  const res = await apiFetch('/auth/nonce', { method: 'POST' });
  return res.nonce;
}

export async function verifySiwe(message, signature) {
  const res = await apiFetch('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
  setAuthToken(res.token, res.address);
  return res;
}

// ─── Bots ──────────────────────────────────────────────────────
export async function fetchBots() {
  return safe('/bots') ?? [];
}

export async function saveBot(bot) {
  return safe('/bots', { method: 'POST', body: JSON.stringify(bot) });
}

export async function updateBot(id, updates) {
  return safe(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function deleteBot(id) {
  return safe(`/bots/${id}`, { method: 'DELETE' });
}

// ─── Trades ────────────────────────────────────────────────────
export async function fetchTrades({ botId, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (botId) params.set('botId', botId);
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  return safe(`/trades${qs ? '?' + qs : ''}`) ?? [];
}

export async function fetchTradeSummary(botId) {
  const qs = botId ? `?botId=${botId}` : '';
  return safe(`/trades/summary${qs}`) ?? { count: 0, totalPnl: 0, volume: 0, winRate: 0 };
}

export async function recordTrade(trade) {
  return safe('/trades', { method: 'POST', body: JSON.stringify(trade) });
}

// ─── Alerts ────────────────────────────────────────────────────
export async function fetchAlerts() {
  return safe('/alerts') ?? [];
}

export async function createAlert(alert) {
  return safe('/alerts', { method: 'POST', body: JSON.stringify(alert) });
}

export async function updateAlert(id, updates) {
  return safe(`/alerts/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function deleteAlert(id) {
  return safe(`/alerts/${id}`, { method: 'DELETE' });
}

// ─── Schedules ─────────────────────────────────────────────────
export async function fetchSchedules() {
  return safe('/schedules') ?? [];
}

export async function createSchedule(schedule) {
  return safe('/schedules', { method: 'POST', body: JSON.stringify(schedule) });
}

export async function updateSchedule(id, updates) {
  return safe(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function deleteSchedule(id) {
  return safe(`/schedules/${id}`, { method: 'DELETE' });
}

// ─── Settings ──────────────────────────────────────────────────
export async function fetchSettings() {
  return safe('/settings') ?? null;
}

export async function saveSettings(settings) {
  return safe('/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

export async function fetchDemoTrades() {
  return safe('/settings/demo-trades') ?? [];
}

export async function recordDemoTrade(trade) {
  return safe('/settings/demo-trades', { method: 'POST', body: JSON.stringify(trade) });
}

// ─── Copy Trading ──────────────────────────────────────────────
export async function fetchFollowedTraders() {
  return safe('/copy-trading') ?? [];
}

export async function followTrader(traderId, copySettings) {
  return safe('/copy-trading', { method: 'POST', body: JSON.stringify({ traderId, copySettings }) });
}

export async function updateCopySettings(id, copySettings) {
  return safe(`/copy-trading/${id}`, { method: 'PUT', body: JSON.stringify({ copySettings }) });
}

export async function unfollowTrader(id) {
  return safe(`/copy-trading/${id}`, { method: 'DELETE' });
}

export async function fetchCopyTradeHistory(traderId, limit) {
  const params = new URLSearchParams();
  if (traderId) params.set('traderId', traderId);
  if (limit) params.set('limit', limit);
  const qs = params.toString();
  return safe(`/copy-trading/history${qs ? '?' + qs : ''}`) ?? [];
}

export async function recordCopyTrade(trade) {
  return safe('/copy-trading/history', { method: 'POST', body: JSON.stringify(trade) });
}

// ─── Social / Leaderboard ────────────────────────────────────
export async function fetchLeaderboard(period = 'week', limit = 25) {
  return safe(`/social/leaderboard?period=${period}&limit=${limit}`) ?? [];
}

export async function fetchSharedStrategies({ type, risk, search, page = 1, limit = 12 } = {}) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (risk) params.set('risk', risk);
  if (search) params.set('search', search);
  params.set('page', page);
  params.set('limit', limit);
  return safe(`/social/strategies?${params.toString()}`) ?? { strategies: [], total: 0 };
}

export async function publishStrategy(strategy) {
  return safe('/social/strategies', { method: 'POST', body: JSON.stringify(strategy) });
}

export async function likeStrategy(id) {
  return safe(`/social/strategies/${id}/like`, { method: 'POST' });
}

export async function forkStrategy(id) {
  return safe(`/social/strategies/${id}/fork`, { method: 'POST' });
}

export async function fetchMyStrategies() {
  return safe('/social/strategies/my') ?? [];
}

// ─── Health ────────────────────────────────────────────────────
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
