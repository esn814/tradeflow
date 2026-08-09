/**
 * Binance Proxy — forwards authenticated Binance API requests server-to-server.
 *
 * The browser can't call Binance directly because of CORS (the X-MBX-APIKEY
 * header triggers a preflight that Binance testnet rejects). This proxy
 * sits on the backend (Render) which has no CORS restrictions.
 *
 * Routes:
 *   POST /api/binance/connect    — verify API key + return account info
 *   GET  /api/binance/balances   — get account balances
 *   POST /api/binance/order      — place an order
 *   DELETE /api/binance/order    — cancel an order
 *   GET  /api/binance/open-orders — get open orders
 *   GET  /api/binance/trades     — get trade history
 *   POST /api/binance/exchange-info — get symbol filters
 *   POST /api/binance/ws-token   — return WS stream URL (client connects directly)
 *
 * The client sends { apiKey, apiSecret, environment, ... } in the request body.
 * The proxy signs the request with HMAC-SHA256 and forwards to Binance.
 * API keys are NEVER stored on the server — they exist only for the duration of the request.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { logger } from '../logger.js';

const router = Router();

// ── Binance endpoints ─────────────────────────────────────────

const ENDPOINTS = {
  testnet: 'https://testnet.binance.vision/api/v3',
  production: 'https://api.binance.com/api/v3',
};

const WS_ENDPOINTS = {
  testnet: 'wss://stream.binance.com',
  production: 'wss://stream.binance.com',
};

// ── Helpers ───────────────────────────────────────────────────

function hmacSha256(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function getEndpoints(env) {
  const environment = env === 'production' ? 'production' : 'testnet';
  return { rest: ENDPOINTS[environment], ws: WS_ENDPOINTS[environment], environment };
}

async function binancePublicGet(path, params, environment) {
  const { rest } = getEndpoints(environment);
  const qs = new URLSearchParams(params).toString();
  const url = `${rest}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  return { status: res.status, data };
}

async function binancePrivateRequest(method, path, params, apiKey, apiSecret, environment) {
  const { rest } = getEndpoints(environment);
  const fullParams = {
    ...params,
    timestamp: Date.now(),
    recvWindow: 5000,
  };
  const qs = new URLSearchParams(fullParams).toString();
  const signature = hmacSha256(apiSecret, qs);
  const url = `${rest}${path}?${qs}&signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: { 'X-MBX-APIKEY': apiKey },
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ── Validation middleware ─────────────────────────────────────

function requireKeys(req, res, next) {
  const { apiKey, apiSecret, environment } = req.body;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'apiKey and apiSecret are required' });
  }
  req.binance = { apiKey, apiSecret, environment: environment || 'testnet' };
  next();
}

// ── Routes ────────────────────────────────────────────────────

/**
 * POST /api/binance/connect
 * Verify API key by calling GET /account (private endpoint).
 * Returns account info + balances on success.
 */
router.post('/connect', requireKeys, async (req, res) => {
  try {
    const { apiKey, apiSecret, environment } = req.binance;

    // Verify key with account endpoint
    const result = await binancePrivateRequest('GET', '/account', {}, apiKey, apiSecret, environment);

    if (result.status !== 200) {
      return res.status(result.status).json({
        error: result.data.msg || 'API key verification failed',
        code: result.data.code,
      });
    }

    // Extract non-zero balances
    const balances = (result.data.balances || [])
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }));

    res.json({
      ok: true,
      environment,
      permissions: result.data.permissions || [],
      balances,
      accountType: result.data.accountType,
    });
  } catch (err) {
    logger.error({ err }, '[binance-proxy] connect failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/balances
 * Get account balances.
 */
router.post('/balances', requireKeys, async (req, res) => {
  try {
    const { apiKey, apiSecret, environment } = req.binance;
    const result = await binancePrivateRequest('GET', '/account', {}, apiKey, apiSecret, environment);

    if (result.status !== 200) {
      return res.status(result.status).json({ error: result.data.msg, code: result.data.code });
    }

    const balances = (result.data.balances || [])
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
        total: parseFloat(b.free) + parseFloat(b.locked),
      }));

    res.json({ ok: true, balances });
  } catch (err) {
    logger.error({ err }, '[binance-proxy] balances failed');
    res.status(500).json({ error: 'Failed to fetch balances. Please check your API keys.' });
  }
});

/**
 * POST /api/binance/order
 * Place an order (market, limit, stop-loss-limit).
 */
router.post('/order', requireKeys, async (req, res) => {
  try {
    const { symbol, side, type, quantity, price, stopPrice, timeInForce, ...rest } = req.body;
    const keys = req.binance;

    // Validate order parameters
    const allowedSides = ['BUY', 'SELL'];
    const allowedTypes = ['MARKET', 'LIMIT', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'];
    if (!symbol || !allowedSides.includes(side) || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid order parameters: symbol, side, or type invalid' });
    }
    if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    if (type !== 'MARKET' && (!price || isNaN(price) || Number(price) <= 0)) {
      return res.status(400).json({ error: 'Invalid price for limit order' });
    }

    const orderParams = { symbol, side, type, quantity };
    if (price) orderParams.price = price;
    if (stopPrice) orderParams.stopPrice = stopPrice;
    if (timeInForce) orderParams.timeInForce = timeInForce;

    const result = await binancePrivateRequest('POST', '/order', orderParams, keys.apiKey, keys.apiSecret, keys.environment);
    res.status(result.status).json(result.data);
  } catch (err) {
    logger.error({ err }, '[binance-proxy] order failed');
    res.status(500).json({ error: 'Order placement failed. Please check your API keys and parameters.' });
  }
});

/**
 * DELETE /api/binance/order
 * Cancel an order.
 */
router.delete('/order', requireKeys, async (req, res) => {
  try {
    const { symbol, orderId } = req.query;
    const { apiKey, apiSecret, environment } = req.binance;
    const result = await binancePrivateRequest('DELETE', '/order', { symbol, orderId }, apiKey, apiSecret, environment);
    res.status(result.status).json(result.data);
  } catch (err) {
    logger.error({ err }, '[binance-proxy] cancel order failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/open-orders
 * Get open orders.
 */
router.post('/open-orders', requireKeys, async (req, res) => {
  try {
    const { symbol } = req.body;
    const { apiKey, apiSecret, environment } = req.binance;
    const params = symbol ? { symbol } : {};
    const result = await binancePrivateRequest('GET', '/openOrders', params, apiKey, apiSecret, environment);
    res.status(result.status).json(result.data);
  } catch (err) {
    logger.error({ err }, '[binance-proxy] open orders failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/trades
 * Get recent trades (fills) for a symbol.
 */
router.post('/trades', requireKeys, async (req, res) => {
  try {
    const { symbol, limit = 50 } = req.body;
    const { apiKey, apiSecret, environment } = req.binance;
    const result = await binancePrivateRequest('GET', '/myTrades', { symbol, limit }, apiKey, apiSecret, environment);
    res.status(result.status).json(result.data);
  } catch (err) {
    logger.error({ err }, '[binance-proxy] trades failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/exchange-info
 * Get exchange info (symbol filters, LOT_SIZE, etc.) — public endpoint.
 */
router.post('/exchange-info', async (req, res) => {
  try {
    const { symbol, environment } = req.body;
    const params = symbol ? { symbol } : {};
    const result = await binancePublicGet('/exchangeInfo', params, environment || 'testnet');
    res.status(result.status).json(result.data);
  } catch (err) {
    logger.error({ err }, '[binance-proxy] exchange-info failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/price
 * Get current price — public endpoint, no auth needed.
 */
router.post('/price', async (req, res) => {
  try {
    const { symbol, environment } = req.body;
    const params = symbol ? { symbol } : {};
    const result = await binancePublicGet('/ticker/price', params, environment || 'testnet');
    res.status(result.status).json(result.data);
  } catch (err) {
    logger.error({ err }, '[binance-proxy] price failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/ping
 * Ping Binance — public endpoint.
 */
router.post('/ping', async (req, res) => {
  try {
    const { environment } = req.body;
    const result = await binancePublicGet('/ping', {}, environment || 'testnet');
    res.status(result.status).json({ ok: result.status === 200, environment: environment || 'testnet' });
  } catch (err) {
    logger.error({ err }, '[binance-proxy] ping failed');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/binance/ws-url
 * Return the WebSocket stream URL so the client can connect directly.
 * WS connections don't have the same CORS issues as fetch+headers.
 */
router.post('/ws-url', (req, res) => {
  const { environment, streams } = req.body;
  const { ws } = getEndpoints(environment || 'testnet');
  const url = streams ? `${ws}/stream?streams=${streams}` : `${ws}/ws`;
  res.json({ url });
});

export default router;
