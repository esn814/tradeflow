// Live Paxeer market data hooks
import { useState, useEffect, useCallback } from 'react';

const PAXEER_DATA_API = 'https://data-api.crossverse.app/api';

/**
 * Fetch current price for a symbol from Paxeer data API
 */
export async function fetchPrice(symbol = 'pax') {
  try {
    const res = await fetch(`${PAXEER_DATA_API}/${symbol}/price`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`Price fetch failed for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * Fetch OHLCV candle data for a symbol
 */
export async function fetchCandles(symbol = 'pax', interval = '1d', limit = 90) {
  try {
    const res = await fetch(`${PAXEER_DATA_API}/${symbol}/candles?interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`Candle fetch failed for ${symbol}:`, err.message);
    return null;
  }
}

/**
 * React hook: live price with auto-refresh
 */
export function useLivePrice(symbol = 'pax', refreshMs = 30000) {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const data = await fetchPrice(symbol);
    if (data) {
      setPrice(data);
      setError(null);
    } else {
      setError('Failed to fetch price');
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { price, loading, error, refresh: load };
}

/**
 * React hook: live multi-symbol prices
 */
const DEFAULT_SYMBOLS = ['pax', 'btc', 'eth', 'sol'];

export function useLivePrices(symbols = DEFAULT_SYMBOLS, refreshMs = 30000) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- symbolsKey is a stable serialization

  const load = useCallback(async () => {
    const syms = symbols;
    const results = {};
    await Promise.allSettled(
      syms.map(async (sym) => {
        const data = await fetchPrice(sym);
        if (data) results[sym] = data;
      })
    );
    setPrices(results);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols]);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { prices, loading, refresh: load };
}

/**
 * React hook: OHLCV candles with indicator computation
 */
export function useLiveCandles(symbol = 'pax', interval = '1d', limit = 90) {
  const [candles, setCandles] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchCandles(symbol, interval, limit);
    if (data && Array.isArray(data) && data.length > 0) {
      setCandles(data);
    }
    setLoading(false);
  }, [symbol, interval, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { candles, loading, refresh: load };
}

/**
 * Fetch aggregated data from multiple exchanges (no API key needed)
 */
const EXCHANGE_APIS = {
  binance: 'https://api.binance.com/api/v3',
  coingecko: 'https://api.coingecko.com/api/v3',
  coincap: 'https://api.coincap.io/v2',
  bybit: 'https://api.bybit.com/v5',
  paxeer: 'https://data-api.crossverse.app/api',
};

const BYBIT_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', AVAX: 'AVAXUSDT',
  MATIC: 'MATICUSDT', LINK: 'LINKUSDT', DOT: 'DOTUSDT',
};

const PAXEER_IDS = {
  BTC: 'btc', ETH: 'eth', SOL: 'sol', AVAX: 'avax', MATIC: 'matic',
  LINK: 'link', DOT: 'dot', PAX: 'pax',
};

const BINANCE_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', AVAX: 'AVAXUSDT',
  MATIC: 'MATICUSDT', LINK: 'LINKUSDT', DOT: 'DOTUSDT',
};

const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche-2',
  MATIC: 'matic-network', LINK: 'chainlink', DOT: 'polkadot',
};

const COINCAP_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche',
  MATIC: 'polygon', LINK: 'chainlink', DOT: 'polkadot',
};

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function fetchExchangePrices(symbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT']) {
  const TIMEOUT = 8000;
  const fetchWithTimeout = (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };

  const results = { prices: {}, volumes: {}, marketCaps: {}, exchangeStatus: { binance: false, coingecko: false, coincap: false, bybit: false, paxeer: false }, sources: {} };

  // Fetch from all 5 exchanges in parallel
  const [binanceRes, coingeckoRes, coincapRes, bybitRes, paxeerRes] = await Promise.allSettled([
    (async () => {
      try {
        const res = await fetchWithTimeout(`${EXCHANGE_APIS.binance}/ticker/24hr`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const allTickers = await res.json();
        const tickerMap = {};
        for (const t of allTickers) tickerMap[t.symbol] = t;
        const out = {};
        for (const sym of symbols) {
          const bSym = BINANCE_SYMBOLS[sym];
          const t = bSym && tickerMap[bSym];
          if (t) {
            const p = parseFloat(t.lastPrice);
            if (p > 0) out[sym] = { price: p, volume: parseFloat(t.quoteVolume) || 0 };
          }
        }
        results.exchangeStatus.binance = Object.keys(out).length > 0;
        return out;
      } catch { return {}; }
    })(),
    (async () => {
      try {
        const ids = symbols.map(s => COINGECKO_IDS[s]).filter(Boolean).join(',');
        const res = await fetchWithTimeout(`${EXCHANGE_APIS.coingecko}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const out = {};
        for (const sym of symbols) {
          const cgId = COINGECKO_IDS[sym];
          const entry = cgId && data[cgId];
          if (entry?.usd > 0) out[sym] = { price: entry.usd, volume: entry.usd_24h_vol ?? 0, change: entry.usd_24h_change ?? 0 };
        }
        results.exchangeStatus.coingecko = Object.keys(out).length > 0;
        return out;
      } catch { return {}; }
    })(),
    (async () => {
      try {
        const ids = [...new Set(symbols.map(s => COINCAP_IDS[s]).filter(Boolean))].join(',');
        const res = await fetchWithTimeout(`${EXCHANGE_APIS.coincap}/assets?ids=${ids}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const out = {};
        for (const asset of data.data || []) {
          for (const sym of symbols) {
            if (COINCAP_IDS[sym] === asset.id) {
              const p = parseFloat(asset.priceUsd);
              if (p > 0) out[sym] = { price: p, volume: parseFloat(asset.volumeUsd24Hr) || 0, marketCap: parseFloat(asset.marketCapUsd) || 0 };
            }
          }
        }
        results.exchangeStatus.coincap = Object.keys(out).length > 0;
        return out;
      } catch { return {}; }
    })(),
    (async () => {
      try {
        const res = await fetchWithTimeout(`${EXCHANGE_APIS.bybit}/market/tickers?category=spot`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const tickerMap = {};
        for (const t of json?.result?.list || []) tickerMap[t.symbol] = t;
        const out = {};
        for (const sym of symbols) {
          const bSym = BYBIT_SYMBOLS[sym];
          const t = bSym && tickerMap[bSym];
          if (t) {
            const p = parseFloat(t.lastPrice);
            if (p > 0) out[sym] = { price: p, volume: parseFloat(t.turnover24h) || 0 };
          }
        }
        results.exchangeStatus.bybit = Object.keys(out).length > 0;
        return out;
      } catch { return {}; }
    })(),
    (async () => {
      try {
        const out = {};
        const promises = symbols.map(async (sym) => {
          const pSym = PAXEER_IDS[sym];
          if (!pSym) return;
          const res = await fetchWithTimeout(`${EXCHANGE_APIS.paxeer}/${pSym}/price`);
          if (!res.ok) return;
          const data = await res.json();
          const p = typeof data === 'number' ? data : data?.price ?? data?.last ?? null;
          if (p && p > 0) out[sym] = { price: p, volume: data?.volume24h ?? data?.volume ?? 0 };
        });
        await Promise.allSettled(promises);
        results.exchangeStatus.paxeer = Object.keys(out).length > 0;
        return out;
      } catch { return {}; }
    })(),
  ]);

  const bData = binanceRes.status === 'fulfilled' ? binanceRes.value : {};
  const cgData = coingeckoRes.status === 'fulfilled' ? coingeckoRes.value : {};
  const ccData = coincapRes.status === 'fulfilled' ? coincapRes.value : {};
  const bbData = bybitRes.status === 'fulfilled' ? bybitRes.value : {};
  const pxData = paxeerRes.status === 'fulfilled' ? paxeerRes.value : {};

  for (const sym of symbols) {
    const priceVals = [];
    const volVals = [];
    const srcs = [];
    if (bData[sym]) { priceVals.push(bData[sym].price); volVals.push(bData[sym].volume); srcs.push('binance'); }
    if (cgData[sym]) { priceVals.push(cgData[sym].price); volVals.push(cgData[sym].volume); srcs.push('coingecko'); }
    if (ccData[sym]) { priceVals.push(ccData[sym].price); volVals.push(ccData[sym].volume); srcs.push('coincap'); if (ccData[sym].marketCap) results.marketCaps[sym] = ccData[sym].marketCap; }
    if (bbData[sym]) { priceVals.push(bbData[sym].price); volVals.push(bbData[sym].volume); srcs.push('bybit'); }
    if (pxData[sym]) { priceVals.push(pxData[sym].price); volVals.push(pxData[sym].volume); srcs.push('paxeer'); }
    if (priceVals.length > 0) {
      results.prices[sym] = { price: median(priceVals), change24h: cgData[sym]?.change ?? 0 };
      results.volumes[sym] = median(volVals);
      results.sources[sym] = srcs;
    }
  }

  return results;
}

/**
 * React hook: aggregated exchange data from Binance, CoinGecko, CoinCap
 * Returns { prices, volumes, marketCaps, exchangeStatus, loading, refresh }
 */
export function useExchangeData(symbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT'], refreshMs = 30000) {
  const [prices, setPrices] = useState({});
  const [volumes, setVolumes] = useState({});
  const [marketCaps, setMarketCaps] = useState({});
  const [exchangeStatus, setExchangeStatus] = useState({ binance: false, coingecko: false, coincap: false, bybit: false, paxeer: false });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchExchangePrices(symbols);
    setPrices(data.prices);
    setVolumes(data.volumes);
    setMarketCaps(data.marketCaps);
    setExchangeStatus(data.exchangeStatus);
    setLoading(false);
  }, [symbols]);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { prices, volumes, marketCaps, exchangeStatus, loading, refresh: load };
}

/**
 * React hook: aggregated market overview stats
 * Returns { totalMarketCap, total24hVolume, btcDominance, loading, refresh }
 */
export function useMarketOverview(refreshMs = 60000) {
  const [totalMarketCap, setTotalMarketCap] = useState(0);
  const [total24hVolume, setTotal24hVolume] = useState(0);
  const [btcDominance, setBtcDominance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/global');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const g = data?.data;
      if (g) {
        setTotalMarketCap(g.total_market_cap?.usd ?? 0);
        setTotal24hVolume(g.total_volume?.usd ?? 0);
        setBtcDominance(g.market_cap_percentage?.btc ? +g.market_cap_percentage.btc.toFixed(1) : 0);
      }
    } catch (err) {
      console.warn('[useMarketOverview] fetch failed:', err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { totalMarketCap, total24hVolume, btcDominance, loading, refresh: load };
}

const WS_URL = 'wss://data-api.crossverse.app/ws';
const MAX_BACKOFF = 30000;

/**
 * React hook: real-time price streaming via WebSocket with polling fallback.
 * Returns { prices, connected, error }.
 * - prices: { [symbol]: { price, change24h, ... } }
 * - connected: true when WebSocket is live, false when polling fallback
 * - error: last error message or null
 */
export function useLiveStream(symbols = DEFAULT_SYMBOLS, pollMs = 30000) {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const symbolsKey = Array.isArray(symbols) ? symbols.join(',') : '';

  useEffect(() => {
    let ws = null;
    let pollId = null;
    let backoff = 1000;
    let reconnectTimer = null;
    let unmounted = false;

    const updatePrice = (symbol, data) => {
      setPrices(prev => ({ ...prev, [symbol]: data }));
    };

    // Polling fallback
    const startPolling = () => {
      setConnected(false);
      const poll = async () => {
        const results = {};
        await Promise.allSettled(
          symbols.map(async (sym) => {
            const data = await fetchPrice(sym);
            if (data) results[sym] = data;
          })
        );
        if (!unmounted) setPrices(prev => ({ ...prev, ...results }));
      };
      poll();
      pollId = setInterval(poll, pollMs);
    };

    const stopPolling = () => {
      if (pollId) { clearInterval(pollId); pollId = null; }
    };

    const connect = () => {
      if (unmounted) return;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        setError('WebSocket not available');
        startPolling();
        return;
      }

      ws.onopen = () => {
        if (unmounted) { ws.close(); return; }
        backoff = 1000;
        setConnected(true);
        setError(null);
        stopPolling();
        // Subscribe to symbols
        try {
          ws.send(JSON.stringify({ type: 'subscribe', symbols }));
        } catch { /* ignore */ }
      };

      ws.onmessage = (evt) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(evt.data);
          // Handle single tick or array of ticks
          const ticks = Array.isArray(msg) ? msg : [msg];
          for (const tick of ticks) {
            const sym = tick.symbol || tick.s;
            if (sym) {
              updatePrice(sym.toLowerCase(), {
                price: tick.price || tick.p,
                change24h: tick.change24h || tick.c,
                timestamp: tick.timestamp || tick.t || Date.now(),
              });
            }
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        // Don't set persistent error — polling fallback will activate on close
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);
        setError(null); // Clear any previous error since polling handles it
        // Exponential backoff reconnect
        reconnectTimer = setTimeout(() => {
          backoff = Math.min(backoff * 2, MAX_BACKOFF);
          connect();
        }, backoff);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (ws) { try { ws.close(); } catch { /* */ } }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey, pollMs]);

  return { prices, connected, error };
}
