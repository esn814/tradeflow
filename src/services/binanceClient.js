/**
 * BinanceClient — authenticated REST + WebSocket client for Binance.
 *
 * Supports both TESTNET (testnet.binance.vision) and PRODUCTION.
 * HMAC-SHA256 signed requests for all private endpoints.
 * No external dependencies — uses Web Crypto API + native WebSocket.
 */

const ENDPOINTS = {
  testnet: {
    rest: 'https://api.binance.com/api/v3',
    stream: 'wss://stream.binance.com',
  },
  production: {
    rest: 'https://api.binance.com/api/v3',
    stream: 'wss://stream.binance.com',
  },
};

export const SYMBOL_MAP = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', AVAX: 'AVAXUSDT',
  MATIC: 'MATICUSDT', LINK: 'LINKUSDT', DOT: 'DOTUSDT', BNB: 'BNBUSDT',
  XRP: 'XRPUSDT', ADA: 'ADAUSDT',
};

const MIN_NOTIONAL = 10;
const DEFAULT_RECV_WINDOW = 5000;

// ── HMAC-SHA256 via Web Crypto ─────────────────────────────────

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── BinanceError ──────────────────────────────────────────────

export class BinanceError extends Error {
  constructor(code, msg, path) { super(msg); this.name = 'BinanceError'; this.code = code; this.path = path; }
}

// ── BinanceClient ─────────────────────────────────────────────

export class BinanceClient {
  constructor({ apiKey, apiSecret, environment = 'testnet', recvWindow = DEFAULT_RECV_WINDOW, proxyUrl = null } = {}) {
    if (!apiKey || !apiSecret) throw new Error('BinanceClient requires apiKey and apiSecret');
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.environment = environment;
    this.recvWindow = recvWindow;
    this.endpoints = ENDPOINTS[environment];
    if (!this.endpoints) throw new Error(`Unknown environment: ${environment}`);
    // FIX: proxyUrl routes authenticated calls through our backend to avoid CORS
    this.proxyUrl = proxyUrl; // e.g. 'https://tradeflow-api-i2o1.onrender.com/api/binance'

    // WebSocket state
    this._ws = null;
    this._wsCallbacks = new Map();
    this._wsReconnectTimer = null;
    this._wsReconnectDelay = 1000;
    this._wsMaxReconnectDelay = 30000;
    this._wsConnected = false;
    this._wsSubscriptions = new Set();
    this._destroyed = false;
    this._lastRestCall = 0;

    // FIX #2: Cached exchange info filters (LOT_SIZE, PRICE_FILTER per symbol)
    this._exchangeInfoCache = null;
    this._symbolFilters = {}; // symbol → { stepSize, tickSize, minQty, minNotional }
  }

  toSymbol(coin) { return SYMBOL_MAP[coin.toUpperCase()] || `${coin.toUpperCase()}USDT`; }
  fromSymbol(s) { return s.replace(/USDT$/, ''); }

  // ── FIX #2: Exchange info + symbol filter cache ─────────────

  /** Fetch and cache exchange info filters. Call once on connect. */
  async loadExchangeInfo() {
    const info = await this._publicGet('/exchangeInfo');
    this._exchangeInfoCache = info;
    this._symbolFilters = {};
    for (const sym of info.symbols || []) {
      const filters = {};
      for (const f of sym.filters || []) {
        if (f.filterType === 'LOT_SIZE') {
          filters.stepSize = parseFloat(f.stepSize);
          filters.minQty = parseFloat(f.minQty);
          filters.maxQty = parseFloat(f.maxQty);
        }
        if (f.filterType === 'PRICE_FILTER') {
          filters.tickSize = parseFloat(f.tickSize);
        }
        if (f.filterType === 'NOTIONAL' || f.filterType === 'MIN_NOTIONAL') {
          filters.minNotional = parseFloat(f.minNotional || f.notional);
        }
      }
      this._symbolFilters[sym.symbol] = filters;
    }
    return Object.keys(this._symbolFilters).length;
  }

  /** Get cached filters for a Binance symbol (e.g. 'BTCUSDT') */
  getSymbolFilters(binanceSymbol) {
    return this._symbolFilters[binanceSymbol] || {};
  }

  /** Round quantity to the correct step size for a symbol */
  roundQty(symbol, qty) {
    const binanceSymbol = SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
    const f = this._symbolFilters[binanceSymbol];
    if (!f?.stepSize) return this._fmtQty(symbol, qty); // fallback to hardcoded
    const precision = Math.max(0, Math.round(-Math.log10(f.stepSize)));
    const stepped = Math.floor(qty / f.stepSize) * f.stepSize;
    return stepped.toFixed(precision);
  }

  /** Round price to the correct tick size for a symbol */
  roundPrice(symbol, price) {
    const binanceSymbol = SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
    const f = this._symbolFilters[binanceSymbol];
    if (!f?.tickSize) return this._fmtPrice(symbol, price);
    const precision = Math.max(0, Math.round(-Math.log10(f.tickSize)));
    const stepped = Math.floor(price / f.tickSize) * f.tickSize;
    return stepped.toFixed(precision);
  }

  /** Validate an order against symbol filters before placing it */
  validateOrder(symbol, side, qty, price) {
    const binanceSymbol = SYMBOL_MAP[symbol.toUpperCase()] || `${symbol.toUpperCase()}USDT`;
    const f = this._symbolFilters[binanceSymbol];
    if (!f) return { ok: true, warnings: ['No cached filters — order may be rejected'] };
    const errors = [];
    if (f.minQty && qty < f.minQty) errors.push(`Qty ${qty} below min ${f.minQty}`);
    if (f.maxQty && qty > f.maxQty) errors.push(`Qty ${qty} above max ${f.maxQty}`);
    if (f.minNotional && price && (qty * price) < f.minNotional) errors.push(`Notional ${(qty * price).toFixed(2)} below min ${f.minNotional}`);
    return { ok: errors.length === 0, errors };
  }

  async _signedParams(extra = {}) {
    const params = { timestamp: Date.now(), recvWindow: this.recvWindow, ...extra };
    const qs = new URLSearchParams(params).toString();
    const signature = await hmacSha256(this.apiSecret, qs);
    return `${qs}&signature=${signature}`;
  }

  async _publicGet(path, params = {}) {
    // When proxyUrl is set, route through our backend to avoid CORS
    if (this.proxyUrl) {
      const proxyPath = this._proxyEndpoint(path, 'GET').path;
      const res = await fetch(`${this.proxyUrl}${proxyPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: this.environment, ...params }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new BinanceError(b.code || res.status, b.error || b.msg || `HTTP ${res.status}`, path); }
      this._lastRestCall = Date.now();
      return res.json();
    }

    const qs = new URLSearchParams(params).toString();
    const url = `${this.endpoints.rest}${path}${qs ? '?' + qs : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new BinanceError(b.code || res.status, b.msg || `HTTP ${res.status}`, path); }
    this._lastRestCall = Date.now();
    return res.json();
  }

  async _privateRequest(method, path, params = {}) {
    // When proxyUrl is set, route through our backend to avoid CORS
    if (this.proxyUrl) {
      const endpoint = this._proxyEndpoint(path, method);
      const res = await fetch(`${this.proxyUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: this.apiKey, apiSecret: this.apiSecret, environment: this.environment, ...params }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new BinanceError(b.code || res.status, b.error || b.msg || `HTTP ${res.status}`, path);
      }
      this._lastRestCall = Date.now();
      return res.json();
    }

    // Direct call (no proxy)
    const signedQs = await this._signedParams(params);
    const url = `${this.endpoints.rest}${path}?${signedQs}`;
    const res = await fetch(url, { method, headers: { 'X-MBX-APIKEY': this.apiKey }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new BinanceError(b.code || res.status, b.msg || `HTTP ${res.status}`, path); }
    this._lastRestCall = Date.now();
    return res.json();
  }

  /** Map Binance API paths to proxy endpoints */
  _proxyEndpoint(path, method) {
    const map = {
      '/account':        { path: '/connect', method: 'POST' },
      '/openOrders':     { path: '/open-orders', method: 'POST' },
      '/allOrders':      { path: '/open-orders', method: 'POST' },
      '/myTrades':       { path: '/trades', method: 'POST' },
      '/order':          { path: '/order', method: method === 'DELETE' ? 'DELETE' : 'POST' },
      '/exchangeInfo':   { path: '/exchange-info', method: 'POST' },
      '/ticker/price':   { path: '/price', method: 'POST' },
      '/ping':           { path: '/ping', method: 'POST' },
    };
    return map[path] || { path: '/connect', method: 'POST' };
  }

  // ── Public endpoints ───────────────────────────────────────

  async getPrice(symbol) {
    if (symbol) { const d = await this._publicGet('/ticker/price', { symbol: this.toSymbol(symbol) }); return { symbol: d.symbol, price: parseFloat(d.price) }; }
    const d = await this._publicGet('/ticker/price');
    const prices = {};
    for (const t of d) { if (t.symbol.endsWith('USDT')) prices[this.fromSymbol(t.symbol)] = parseFloat(t.price); }
    return prices;
  }

  async get24hTicker(symbol) {
    const d = await this._publicGet('/ticker/24hr', { symbol: this.toSymbol(symbol) });
    return { symbol: d.symbol, priceChange: parseFloat(d.priceChange), priceChangePercent: parseFloat(d.priceChangePercent),
      lastPrice: parseFloat(d.lastPrice), highPrice: parseFloat(d.highPrice), lowPrice: parseFloat(d.lowPrice),
      volume: parseFloat(d.volume), quoteVolume: parseFloat(d.quoteVolume) };
  }

  async getDepth(symbol, limit = 20) {
    const d = await this._publicGet('/depth', { symbol: this.toSymbol(symbol), limit });
    return { bids: d.bids.map(([p, q]) => [parseFloat(p), parseFloat(q)]), asks: d.asks.map(([p, q]) => [parseFloat(p), parseFloat(q)]) };
  }

  async getKlines(symbol, interval = '1h', limit = 100) {
    const d = await this._publicGet('/klines', { symbol: this.toSymbol(symbol), interval, limit });
    return d.map(k => ({ openTime: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]),
      close: parseFloat(k[4]), volume: parseFloat(k[5]), closeTime: k[6], quoteVolume: parseFloat(k[7]), trades: k[8] }));
  }

  async getExchangeInfo(symbol) { return this._publicGet('/exchangeInfo', symbol ? { symbol: this.toSymbol(symbol) } : {}); }

  // ── Private endpoints ──────────────────────────────────────

  async getAccount() { return this._privateRequest('GET', '/account'); }

  async getBalances() {
    const a = await this.getAccount();
    return (a.balances || []).filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked), total: parseFloat(b.free) + parseFloat(b.locked) }));
  }

  async getUsdtBalance() { const b = await this.getBalances(); return b.find(x => x.asset === 'USDT') || { asset: 'USDT', free: 0, locked: 0, total: 0 }; }

  async marketOrder(side, symbol, quantity) {
    return this._privateRequest('POST', '/order', { symbol: this.toSymbol(symbol), side, type: 'MARKET', quantity: this._fmtQty(symbol, quantity) });
  }

  async marketOrderQuote(side, symbol, quoteAmount) {
    return this._privateRequest('POST', '/order', { symbol: this.toSymbol(symbol), side, type: 'MARKET', quoteOrderQty: quoteAmount.toFixed(2) });
  }

  async limitOrder(side, symbol, quantity, price, timeInForce = 'GTC') {
    return this._privateRequest('POST', '/order', { symbol: this.toSymbol(symbol), side, type: 'LIMIT', timeInForce,
      quantity: this._fmtQty(symbol, quantity), price: this._fmtPrice(symbol, price) });
  }

  async stopLossLimit(side, symbol, quantity, stopPrice, limitPrice) {
    return this._privateRequest('POST', '/order', { symbol: this.toSymbol(symbol), side, type: 'STOP_LOSS_LIMIT', timeInForce: 'GTC',
      quantity: this._fmtQty(symbol, quantity), price: this._fmtPrice(symbol, limitPrice), stopPrice: this._fmtPrice(symbol, stopPrice) });
  }

  async cancelOrder(symbol, orderId) { return this._privateRequest('DELETE', '/order', { symbol: this.toSymbol(symbol), orderId }); }
  async cancelAllOrders(symbol) { return this._privateRequest('DELETE', '/openOrders', { symbol: this.toSymbol(symbol) }); }
  async getOpenOrders(symbol) { return this._privateRequest('GET', '/openOrders', symbol ? { symbol: this.toSymbol(symbol) } : {}); }

  async getAllOrders(symbol, limit = 50) { return this._privateRequest('GET', '/allOrders', { symbol: this.toSymbol(symbol), limit }); }

  async getMyTrades(symbol, limit = 50) {
    const d = await this._privateRequest('GET', '/myTrades', { symbol: this.toSymbol(symbol), limit });
    return d.map(t => ({ id: t.id, orderId: t.orderId, symbol: t.symbol, price: parseFloat(t.price), qty: parseFloat(t.qty),
      quoteQty: parseFloat(t.quoteQty), commission: parseFloat(t.commission), commissionAsset: t.commissionAsset,
      time: t.time, isBuyer: t.isBuyer, isMaker: t.isMaker }));
  }

  async ping() { try { await this._publicGet('/ping'); return true; } catch { return false; } }

  async verifyKey() {
    try { await this.getAccount(); return { ok: true, environment: this.environment }; }
    catch (err) { return { ok: false, error: err.message, code: err.code, environment: this.environment }; }
  }

  // ── WebSocket — real-time price streams ────────────────────

  /**
   * Subscribe to real-time 24hr ticker updates via WebSocket.
   * @param {string[]} symbols — our coin symbols (e.g. ['BTC', 'ETH'])
   * @param {Function} onPrice — callback({ coin, price, priceChange, high24h, low24h, volume24h, timestamp })
   * @returns {Function} unsubscribe function
   */
  subscribePrices(symbols, onPrice) {
    const streams = symbols.map(s => `${this.toSymbol(s).toLowerCase()}@ticker`);
    const unsubscribers = [];
    for (const stream of streams) {
      if (!this._wsCallbacks.has(stream)) this._wsCallbacks.set(stream, new Set());
      this._wsCallbacks.get(stream).add(onPrice);
      unsubscribers.push(() => {
        const cbs = this._wsCallbacks.get(stream);
        if (cbs) { cbs.delete(onPrice); if (cbs.size === 0) this._wsCallbacks.delete(stream); }
      });
    }
    this._wsSubscriptions = new Set([...this._wsSubscriptions, ...streams]);
    this._connectWs();
    return () => { for (const u of unsubscribers) u(); if (this._wsCallbacks.size === 0) this._disconnectWs(); };
  }

  /** Subscribe to live kline/candlestick updates */
  subscribeKlines(symbol, interval, onCandle) {
    const stream = `${this.toSymbol(symbol).toLowerCase()}@kline_${interval}`;
    if (!this._wsCallbacks.has(stream)) this._wsCallbacks.set(stream, new Set());
    this._wsCallbacks.get(stream).add(onCandle);
    this._wsSubscriptions = new Set([...this._wsSubscriptions, stream]);
    this._connectWs();
    return () => {
      const cbs = this._wsCallbacks.get(stream);
      if (cbs) { cbs.delete(onCandle); if (cbs.size === 0) this._wsCallbacks.delete(stream); }
      if (this._wsCallbacks.size === 0) this._disconnectWs();
    };
  }

  _connectWs() {
    if (this._destroyed || this._ws) return;
    const streams = [...this._wsSubscriptions].join('/');
    const url = `${this.endpoints.stream}/stream?streams=${streams}`;
    try { this._ws = new WebSocket(url); }
    catch (err) { console.warn('[BinanceClient] WS create failed:', err.message); this._scheduleReconnect(); return; }

    this._ws.onopen = () => {
      this._wsConnected = true;
      this._wsReconnectDelay = 1000;
      console.log(`[BinanceClient] WebSocket connected (${this.environment})`);
    };

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const stream = msg.stream;
        const data = msg.data || msg;
        if (!stream || !this._wsCallbacks.has(stream)) return;
        for (const cb of this._wsCallbacks.get(stream)) {
          try {
            // Ticker stream
            if (stream.endsWith('@ticker')) {
              cb({ coin: this.fromSymbol(data.s), price: parseFloat(data.c), priceChange: parseFloat(data.P),
                high24h: parseFloat(data.h), low24h: parseFloat(data.l), volume24h: parseFloat(data.v),
                quoteVolume24h: parseFloat(data.q), trades24h: parseInt(data.n, 10), timestamp: Date.now() });
            }
            // Kline stream
            else if (stream.includes('@kline_')) {
              const k = data.k;
              cb({ coin: this.fromSymbol(k.s), interval: k.i, open: parseFloat(k.o), high: parseFloat(k.h),
                low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v),
                isClosed: k.x, openTime: k.t, closeTime: k.T, timestamp: Date.now() });
            }
          } catch (e) { console.error('[BinanceClient] callback error:', e.message); }
        }
      } catch { /* ignore pong / parse errors */ }
    };

    this._ws.onerror = () => {};
    this._ws.onclose = () => {
      this._wsConnected = false;
      this._ws = null;
      if (!this._destroyed && this._wsSubscriptions.size > 0) this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this._destroyed || this._wsReconnectTimer) return;
    this._wsReconnectTimer = setTimeout(() => {
      this._wsReconnectTimer = null;
      this._wsReconnectDelay = Math.min(this._wsReconnectDelay * 1.5, this._wsMaxReconnectDelay);
      this._connectWs();
    }, this._wsReconnectDelay);
  }

  _disconnectWs() {
    if (this._wsReconnectTimer) { clearTimeout(this._wsReconnectTimer); this._wsReconnectTimer = null; }
    if (this._ws) { this._ws.onclose = null; this._ws.close(); this._ws = null; }
    this._wsConnected = false;
  }

  // ── Formatting helpers ─────────────────────────────────────

  _fmtQty(symbol, qty) {
    const c = symbol.toUpperCase();
    if (c === 'BTC') return qty.toFixed(6);
    if (['ETH','SOL','AVAX','BNB','LINK'].includes(c)) return qty.toFixed(4);
    return qty.toFixed(2);
  }

  _fmtPrice(symbol, price) {
    const c = symbol.toUpperCase();
    if (['BTC','ETH'].includes(c)) return price.toFixed(2);
    if (['SOL','AVAX','BNB','LINK','DOT'].includes(c)) return price.toFixed(2);
    if (['MATIC','ADA','XRP'].includes(c)) return price.toFixed(4);
    return price.toFixed(2);
  }

  getStatus() {
    return { environment: this.environment, wsConnected: this._wsConnected, lastRestCall: this._lastRestCall,
      subscriptionCount: this._wsSubscriptions.size };
  }

  destroy() {
    this._destroyed = true;
    this._disconnectWs();
    this._wsCallbacks.clear();
    this._wsSubscriptions.clear();
  }
}

BinanceClient.SYMBOL_MAP = SYMBOL_MAP;
BinanceClient.SUPPORTED_COINS = Object.keys(SYMBOL_MAP);
BinanceClient.MIN_NOTIONAL = MIN_NOTIONAL;

