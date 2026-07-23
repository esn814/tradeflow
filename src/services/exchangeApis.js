/**
 * ExchangeAggregator — fetches real-time crypto prices from multiple
 * free public exchange APIs and aggregates them into a consensus price.
 *
 * Sources (no API keys needed):
 *   1. Binance public API
 *   2. CoinGecko API
 *   3. CoinCap API
 *   4. Bybit public API
 *   5. Paxeer Data API
 *
 * Each source is tried independently; failures are tolerated.
 * The aggregator returns a weighted median of available prices.
 */

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINCAP_BASE = 'https://api.coincap.io/v2';
const BYBIT_BASE = 'https://api.bybit.com/v5';
const PAXEER_DATA_API = 'https://data-api.crossverse.app/api';

// Maps our symbols to exchange-specific identifiers
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

const BYBIT_SYMBOLS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', AVAX: 'AVAXUSDT',
  MATIC: 'MATICUSDT', LINK: 'LINKUSDT', DOT: 'DOTUSDT',
};

const PAXEER_SYMBOLS = {
  BTC: 'btc', ETH: 'eth', SOL: 'sol', AVAX: 'avax', MATIC: 'matic',
  LINK: 'link', DOT: 'dot', PAX: 'pax',
};

const TIMEOUT_MS = 8000;

function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Individual exchange fetchers ──────────────────────────────────

async function fetchBinance(symbols) {
  const validSymbols = symbols.filter(s => BINANCE_SYMBOLS[s]);
  if (validSymbols.length === 0) return { source: 'binance', ok: false, prices: {}, volumes: {} };

  try {
    // Fetch all tickers in one call
    const res = await fetchWithTimeout(`${BINANCE_BASE}/ticker/24hr`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const allTickers = await res.json();

    const prices = {};
    const volumes = {};
    const tickerMap = {};
    for (const t of allTickers) tickerMap[t.symbol] = t;

    for (const sym of validSymbols) {
      const bSymbol = BINANCE_SYMBOLS[sym];
      const t = tickerMap[bSymbol];
      if (t) {
        const p = parseFloat(t.lastPrice);
        const v = parseFloat(t.quoteVolume); // 24h USDT volume
        if (p > 0) {
          prices[sym] = p;
          volumes[sym] = v;
        }
      }
    }

    return { source: 'binance', ok: Object.keys(prices).length > 0, prices, volumes };
  } catch (err) {
    return { source: 'binance', ok: false, prices: {}, volumes: {}, error: err.message };
  }
}

async function fetchCoinGecko(symbols) {
  const validSymbols = symbols.filter(s => COINGECKO_IDS[s]);
  if (validSymbols.length === 0) return { source: 'coingecko', ok: false, prices: {}, volumes: {} };

  try {
    const ids = validSymbols.map(s => COINGECKO_IDS[s]).join(',');
    const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const prices = {};
    const volumes = {};
    const changes = {};

    for (const sym of validSymbols) {
      const cgId = COINGECKO_IDS[sym];
      const entry = data[cgId];
      if (entry?.usd > 0) {
        prices[sym] = entry.usd;
        volumes[sym] = entry.usd_24h_vol ?? 0;
        changes[sym] = entry.usd_24h_change ?? 0;
      }
    }

    return { source: 'coingecko', ok: Object.keys(prices).length > 0, prices, volumes, changes };
  } catch (err) {
    return { source: 'coingecko', ok: false, prices: {}, volumes: {}, error: err.message };
  }
}

async function fetchCoinCap(symbols) {
  const validSymbols = symbols.filter(s => COINCAP_IDS[s]);
  if (validSymbols.length === 0) return { source: 'coincap', ok: false, prices: {}, volumes: {} };

  try {
    const prices = {};
    const volumes = {};
    const marketCaps = {};

    // CoinCap has a bulk assets endpoint
    const ids = [...new Set(validSymbols.map(s => COINCAP_IDS[s]))].join(',');
    const res = await fetchWithTimeout(`${COINCAP_BASE}/assets?ids=${ids}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    for (const asset of data.data || []) {
      // Find matching symbols (multiple symbols can map to same coincap id)
      for (const sym of validSymbols) {
        if (COINCAP_IDS[sym] === asset.id) {
          const p = parseFloat(asset.priceUsd);
          if (p > 0) {
            prices[sym] = p;
            volumes[sym] = parseFloat(asset.volumeUsd24Hr) || 0;
            marketCaps[sym] = parseFloat(asset.marketCapUsd) || 0;
          }
        }
      }
    }

    return { source: 'coincap', ok: Object.keys(prices).length > 0, prices, volumes, marketCaps };
  } catch (err) {
    return { source: 'coincap', ok: false, prices: {}, volumes: {}, error: err.message };
  }
}

// ── Bybit (source 4) ────────────────────────────────────────────

async function fetchBybit(symbols) {
  const validSymbols = symbols.filter(s => BYBIT_SYMBOLS[s]);
  if (validSymbols.length === 0) return { source: 'bybit', ok: false, prices: {}, volumes: {} };

  try {
    const prices = {};
    const volumes = {};
    const res = await fetchWithTimeout(`${BYBIT_BASE}/market/tickers?category=spot`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const tickerMap = {};
    for (const t of json?.result?.list || []) tickerMap[t.symbol] = t;

    for (const sym of validSymbols) {
      const bSym = BYBIT_SYMBOLS[sym];
      const t = tickerMap[bSym];
      if (t) {
        const p = parseFloat(t.lastPrice);
        if (p > 0) {
          prices[sym] = p;
          volumes[sym] = parseFloat(t.turnover24h) || 0;
        }
      }
    }

    return { source: 'bybit', ok: Object.keys(prices).length > 0, prices, volumes };
  } catch (err) {
    return { source: 'bybit', ok: false, prices: {}, volumes: {}, error: err.message };
  }
}

// ── Paxeer Data API (source 5) ───────────────────────────────────

async function fetchPaxeer(symbols) {
  const validSymbols = symbols.filter(s => PAXEER_SYMBOLS[s]);
  if (validSymbols.length === 0) return { source: 'paxeer', ok: false, prices: {}, volumes: {} };

  try {
    const prices = {};
    const volumes = {};

    const results = await Promise.allSettled(
      validSymbols.map(async (sym) => {
        const pSym = PAXEER_SYMBOLS[sym];
        const res = await fetchWithTimeout(`${PAXEER_DATA_API}/${pSym}/price`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { sym, data };
      })
    );

    for (const r of results) {
      if (r.status !== 'fulfilled' || !r.value?.data) continue;
      const { sym, data } = r.value;
      const price = typeof data === 'number' ? data
        : data?.price ?? data?.last ?? data?.close ?? null;
      if (price && typeof price === 'number' && price > 0) {
        prices[sym] = price;
        volumes[sym] = data?.volume24h ?? data?.volume ?? 0;
      }
    }

    return { source: 'paxeer', ok: Object.keys(prices).length > 0, prices, volumes };
  } catch (err) {
    return { source: 'paxeer', ok: false, prices: {}, volumes: {}, error: err.message };
  }
}

// ── Aggregation logic ─────────────────────────────────────────────

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Main aggregation: fetch from all sources in parallel, then compute
 * consensus prices, volumes, and market caps.
 *
 * Returns:
 * {
 *   prices: { [SYMBOL]: { price, change24h, volume24h, marketCap } },
 *   exchangeStatus: { binance: bool, coingecko: bool, coincap: bool },
 *   sources: { [SYMBOL]: ['binance', 'coingecko', ...] },
 *   ok: boolean
 * }
 */
async function fetchAll(symbols = Object.keys(BINANCE_SYMBOLS)) {
  const [binance, coingecko, coincap, bybit, paxeer] = await Promise.allSettled([
    fetchBinance(symbols),
    fetchCoinGecko(symbols),
    fetchCoinCap(symbols),
    fetchBybit(symbols),
    fetchPaxeer(symbols),
  ]);

  const results = [binance, coingecko, coincap, bybit, paxeer]
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const exchangeStatus = {
    binance: false,
    coingecko: false,
    coincap: false,
    bybit: false,
    paxeer: false,
  };

  for (const r of results) {
    if (r.ok) exchangeStatus[r.source] = true;
  }

  const prices = {};
  const sources = {};

  for (const sym of symbols) {
    const priceValues = [];
    const volumeValues = [];
    const changeValues = [];
    const mcapValues = [];
    const contributingSources = [];

    for (const r of results) {
      if (r.prices[sym] && r.prices[sym] > 0) {
        priceValues.push(r.prices[sym]);
        contributingSources.push(r.source);
      }
      if (r.volumes?.[sym] && r.volumes[sym] > 0) {
        volumeValues.push(r.volumes[sym]);
      }
      if (r.changes?.[sym] != null) {
        changeValues.push(r.changes[sym]);
      }
      if (r.marketCaps?.[sym] && r.marketCaps[sym] > 0) {
        mcapValues.push(r.marketCaps[sym]);
      }
    }

    if (priceValues.length > 0) {
      prices[sym] = {
        price: median(priceValues),
        volume24h: volumeValues.length > 0 ? median(volumeValues) : 0,
        change24h: changeValues.length > 0
          ? changeValues.reduce((a, b) => a + b, 0) / changeValues.length
          : 0,
        marketCap: mcapValues.length > 0 ? median(mcapValues) : 0,
      };
      sources[sym] = contributingSources;
    }
  }

  return {
    prices,
    exchangeStatus,
    sources,
    ok: Object.keys(prices).length > 0,
  };
}

// ── Exported singleton ─────────────────────────────────────────────

export const ExchangeAggregator = {
  fetchAll,
  fetchBinance,
  fetchCoinGecko,
  fetchCoinCap,
  fetchBybit,
  fetchPaxeer,
  EXCHANGES: ['binance', 'coingecko', 'coincap', 'bybit', 'paxeer'],
};
