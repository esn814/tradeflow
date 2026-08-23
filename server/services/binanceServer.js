/**
 * BinanceServer — Server-side Binance API client for AutoTrader.
 *
 * Wraps the Binance REST API with proper HMAC-SHA256 signing,
 * rate limiting awareness, and exchange info caching.
 */

import crypto from 'crypto';
import { logger } from '../logger.js';

const BASE_URLS = {
  testnet: 'https://testnet.binance.vision',
  production: 'https://api.binance.com',
};

export class BinanceServer {
  constructor({ apiKey, apiSecret, environment = 'testnet' }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = BASE_URLS[environment] || BASE_URLS.testnet;
    this._symbolFilters = {};
    this._exchangeInfoLoaded = false;
  }

  /**
   * Sign a request with HMAC-SHA256.
   */
  _sign(params) {
    const qs = new URLSearchParams(params).toString();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(qs)
      .digest('hex');
    return { ...params, signature };
  }

  /**
   * Make a signed request to Binance.
   */
  async _request(method, path, params = {}) {
    const signed = this._sign({
      ...params,
      timestamp: Date.now(),
      recvWindow: 5000,
    });

    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    if (method === 'GET' || method === 'DELETE') {
      const qs = new URLSearchParams(signed).toString();
      const res = await fetch(`${url}?${qs}`, options);
      const data = await res.json();
      if (data.code && data.code !== 200) {
        throw new Error(`Binance API error ${data.code}: ${data.msg}`);
      }
      return data;
    } else {
      options.body = new URLSearchParams(signed).toString();
      const res = await fetch(url, options);
      const data = await res.json();
      if (data.code && data.code !== 200) {
        throw new Error(`Binance API error ${data.code}: ${data.msg}`);
      }
      return data;
    }
  }

  /**
   * Verify API key works by fetching account info.
   */
  async verifyKey() {
    try {
      const data = await this._request('GET', '/api/v3/account');
      return { ok: true, canTrade: data.canTrade, permissions: data.permissions };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Load exchange info (symbol filters, lot sizes, etc.) for proper order sizing.
   */
  async loadExchangeInfo() {
    try {
      const res = await fetch(`${this.baseUrl}/api/v3/exchangeInfo`);
      const data = await res.json();

      for (const sym of data.symbols || []) {
        const filters = {};
        for (const f of sym.filters || []) {
          filters[f.filterType] = f;
        }
        this._symbolFilters[sym.symbol] = {
          baseAsset: sym.baseAsset,
          quoteAsset: sym.quoteAsset,
          filters,
          status: sym.status,
        };
      }
      this._exchangeInfoLoaded = true;
    } catch (err) {
      logger.warn({ err: err.message }, '[BinanceServer] Failed to load exchange info');
      throw err;
    }
  }

  /**
   * Get symbol filters (lot size, tick size, etc.).
   */
  getSymbolInfo(symbol) {
    return this._symbolFilters[symbol.toUpperCase()] || null;
  }

  /**
   * Round quantity to proper step size for a symbol.
   */
  roundQuantity(symbol, qty) {
    const info = this.getSymbolInfo(symbol);
    if (!info) return qty;

    const lotFilter = info.filters['LOT_SIZE'];
    if (!lotFilter) return qty;

    const stepSize = parseFloat(lotFilter.stepSize);
    const minQty = parseFloat(lotFilter.minQty);
    const precision = stepSize.toString().split('.')[1]?.length || 0;

    const rounded = Math.floor(qty / stepSize) * stepSize;
    return Math.max(rounded, minQty).toFixed(precision);
  }

  /**
   * Round price to proper tick size for a symbol.
   */
  roundPrice(symbol, price) {
    const info = this.getSymbolInfo(symbol);
    if (!info) return price;

    const priceFilter = info.filters['PRICE_FILTER'];
    if (!priceFilter) return price;

    const tickSize = parseFloat(priceFilter.tickSize);
    const precision = tickSize.toString().split('.')[1]?.length || 0;

    return (Math.floor(price / tickSize) * tickSize).toFixed(precision);
  }

  /**
   * Get current price for a symbol.
   */
  async getPrice(symbol) {
    const res = await fetch(`${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`);
    const data = await res.json();
    if (data.msg) throw new Error(data.msg);
    return parseFloat(data.price);
  }

  /**
   * Get all prices.
   */
  async getAllPrices() {
    const res = await fetch(`${this.baseUrl}/api/v3/ticker/price`);
    const data = await res.json();
    const prices = {};
    for (const item of data) {
      prices[item.symbol] = parseFloat(item.price);
    }
    return prices;
  }

  /**
   * Get account balances.
   */
  async getBalances() {
    const data = await this._request('GET', '/api/v3/account');
    return (data.balances || [])
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }));
  }

  /**
   * Place a market order using base-asset quantity.
   */
  async marketOrder(symbol, side, quantity, clientOrderId) {
    const qty = this.roundQuantity(symbol, quantity);
    return this._request('POST', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: 'MARKET',
      quantity: qty,
      ...(clientOrderId ? { newClientOrderId: clientOrderId } : {}),
    });
  }

  /**
   * Place a market BUY using quote-asset notional (for example, USDT).
   */
  async marketOrderQuote(symbol, quoteOrderQty, clientOrderId) {
    const notional = Number(quoteOrderQty);
    if (!Number.isFinite(notional) || notional <= 0) {
      throw new Error('Invalid quote order amount');
    }
    return this._request('POST', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: notional.toFixed(8),
      ...(clientOrderId ? { newClientOrderId: clientOrderId } : {}),
    });
  }

  /**
   * Place a limit order.
   */
  async limitOrder(symbol, side, quantity, price, timeInForce = 'GTC') {
    const qty = this.roundQuantity(symbol, quantity);
    const px = this.roundPrice(symbol, price);
    return this._request('POST', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: 'LIMIT',
      quantity: qty,
      price: px,
      timeInForce,
    });
  }

  /**
   * Place a stop-loss-limit order.
   */
  async stopLossLimit(symbol, side, quantity, stopPrice, limitPrice) {
    const qty = this.roundQuantity(symbol, quantity);
    const sp = this.roundPrice(symbol, stopPrice);
    const lp = this.roundPrice(symbol, limitPrice);
    return this._request('POST', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: 'STOP_LOSS_LIMIT',
      quantity: qty,
      stopPrice: sp,
      price: lp,
      timeInForce: 'GTC',
    });
  }

  /**
   * Get the current exchange state for an order.
   */
  async getOrder(symbol, orderId, origClientOrderId) {
    return this._request('GET', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      ...(orderId ? { orderId } : {}),
      ...(origClientOrderId ? { origClientOrderId } : {}),
    });
  }

  /**
   * Cancel an order.
   */
  async cancelOrder(symbol, orderId) {
    return this._request('DELETE', '/api/v3/order', {
      symbol: symbol.toUpperCase(),
      orderId,
    });
  }

  /**
   * Get open orders for a symbol.
   */
  async getOpenOrders(symbol) {
    const params = {};
    if (symbol) params.symbol = symbol.toUpperCase();
    return this._request('GET', '/api/v3/openOrders', params);
  }

  /**
   * Get recent trades for a symbol.
   */
  async getMyTrades(symbol, limit = 50) {
    return this._request('GET', '/api/v3/myTrades', {
      symbol: symbol.toUpperCase(),
      limit,
    });
  }
}
