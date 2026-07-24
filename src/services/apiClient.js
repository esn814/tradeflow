// TradeFlow API Client — persistent backend sync
// Falls back gracefully to localStorage-only when backend is unavailable
// SECURITY: JWT stored in memory only (not localStorage). Refresh token is httpOnly cookie.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ── In-memory token (never persisted to localStorage) ──
let _token = null;
let _walletAddress = null;
let _refreshPromise = null; // prevent concurrent refreshes

// Set the JWT token after SIWE authentication (in memory only)
export function setAuthToken(token, address) {
  _token = token;
  _walletAddress = address;
  // FIX #1: Do NOT persist token to localStorage — memory only
}

// Clear in-memory token
export function clearAuthToken() {
  _token = null;
  _walletAddress = null;
}

// Get current in-memory token (for internal use by other services)
export function getAuthToken() {
  return _token;
}

// Get current address (for components that need it)
export function getWalletAddress() {
  return _walletAddress;
}

// ── Token refresh logic ────────────────────────────────────────
async function refreshToken() {
  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // send httpOnly refresh cookie
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        clearAuthToken();
        return false;
      }
      const data = await res.json();
      _token = data.token;
      _walletAddress = data.address;
      return true;
    } catch {
      clearAuthToken();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// ── Generic fetch wrapper with auth, auto-refresh, error handling ─
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const fetchOpts = {
    ...options,
    headers,
    credentials: 'include', // always send cookies (for refresh token)
  };

  let res = await fetch(`${API_BASE}${path}`, fetchOpts);

  // FIX #1: On 401, try refreshing the token once, then retry
  if (res.status === 401 && _token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const retryHeaders = { 'Content-Type': 'application/json', ...options.headers };
      if (_token) retryHeaders['Authorization'] = `Bearer ${_token}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders, credentials: 'include' });
    }
  }

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

// FIX #1: Restore session on app load using refresh token cookie
export async function restoreSession() {
  const refreshed = await refreshToken();
  return refreshed;
}

// FIX #1: Logout — revoke refresh token, clear memory
export async function logout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch { /* best effort */ }
  clearAuthToken();
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
  if (botId) botId = String(botId).slice(0, 100);
  limit = Math.min(Math.max(1, +limit || 100), 100);
  offset = Math.max(0, +offset || 0);
  const params = new URLSearchParams();
  if (botId) params.set('botId', botId);
  params.set('limit', limit);
  params.set('offset', offset);
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
  limit = Math.min(Math.max(1, +limit || 25), 100);
  return safe(`/social/leaderboard?period=${period}&limit=${limit}`) ?? [];
}

export async function fetchSharedStrategies({ type, risk, search, page = 1, limit = 12 } = {}) {
  limit = Math.min(Math.max(1, +limit || 12), 100);
  page = Math.max(1, +page || 1);
  if (search) search = String(search).slice(0, 200);
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
