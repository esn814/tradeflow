/**
 * RealPriceProvider — bridges real multi-exchange data to the interface
 * that SimulationEngine expects from PriceSimulator.
 *
 * PRIMARY source: ExchangeAggregator (Binance + CoinGecko + CoinCap + Bybit + Paxeer Data API)
 * All 5 sources queried in parallel; Paxeer Data API also provides PAX price.
 *
 * Same shape: tick() → { [symbol]: { price, change, changePct, high, low } }
 * getPrice(symbol) → number
 * getAllPrices() → { [symbol]: { price, change, changePct, high, low } }
 * getHistory(symbol) → [{ price, ts }]
 * getCoins() → string[]
 * reset()
 *
 * Trading remains DEMO/SIMULATION — only market data is real.
 */

import { ExchangeAggregator } from '../services/exchangeApis.js';

const DEFAULT_COINS = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT', 'PAX'];

// Fallback prices in case all APIs are unreachable (realistic mid-2024 values)
const FALLBACK_PRICES = {
  BTC: 67500, ETH: 3450, SOL: 148, AVAX: 28, MATIC: 0.72, LINK: 14.5, DOT: 6.8, PAX: 1.0,
};

export class RealPriceProvider {
  constructor(coinSymbols = DEFAULT_COINS) {
    this.coinSymbols = coinSymbols;
    this.coins = {};
    this.history = {};
    this.tickCount = 0;
    this.lastFetchTime = 0;
    this.fetchIntervalMs = 5000; // fetch real prices every 5 seconds
    this._fetching = false;

    // Exchange status tracking
    this.exchangeStatus = { binance: false, coingecko: false, coincap: false, bybit: false, paxeer: false };
    this.exchangeSources = {}; // { [symbol]: ['binance', 'coingecko', ...] }
    this._lastAggregatorResult = null;

    for (const symbol of coinSymbols) {
      const base = FALLBACK_PRICES[symbol] || 100;
      this.coins[symbol] = {
        price: base,
        prevPrice: base,
        change24h: 0,
        high24h: base,
        low24h: base,
        volume24h: 0,
        marketCap: 0,
        lastUpdate: 0,
      };
      this.history[symbol] = [{ price: base, ts: Date.now() }];
    }
  }

  /**
   * Fetch real prices — PRIMARY: ExchangeAggregator, FALLBACK: Paxeer Data API.
   * Returns a map of { [SYMBOL]: { price, change24h, volume24h, marketCap } } or null on failure.
   */
  async fetchRealPrices() {
    if (this._fetching) return null;
    this._fetching = true;

    try {
      // ── PRIMARY: Multi-exchange aggregation ──
      const aggregatorResult = await ExchangeAggregator.fetchAll(this.coinSymbols);

      if (aggregatorResult.ok) {
        this.exchangeStatus = aggregatorResult.exchangeStatus;
        this.exchangeSources = aggregatorResult.sources;
        this._lastAggregatorResult = aggregatorResult;
        this._fetching = false;
        return aggregatorResult.prices;
      }

      // ── FALLBACK: Paxeer Data API ──
      console.warn('[RealPriceProvider] Exchange aggregator unavailable, falling back to Paxeer Data API');
      // All 5 sources failed — nothing to fall back to
      this._fetching = false;
      return null;
    } catch (err) {
      this._fetching = false;
      console.warn('[RealPriceProvider] fetch failed:', err.message);
      return null;
    }
  }

  /**
   * Advance prices by one tick.
   * If enough time has passed since last fetch, poll real APIs.
   * Otherwise, do a tiny interpolation tick to keep the engine flowing.
   * Returns { [symbol]: { price, change, changePct, high, low } }
   */
  async tick() {
    this.tickCount++;
    const now = Date.now();
    const updates = {};

    // Fetch real prices when interval has elapsed
    if (now - this.lastFetchTime >= this.fetchIntervalMs) {
      const realPrices = await this.fetchRealPrices();
      if (realPrices) {
        this.lastFetchTime = now;
        for (const [symbol, data] of Object.entries(realPrices)) {
          const coin = this.coins[symbol];
          if (!coin) continue;
          coin.prevPrice = coin.price;
          coin.price = data.price;
          coin.change24h = data.change24h ?? coin.change24h;
          coin.volume24h = data.volume24h ?? coin.volume24h;
          coin.marketCap = data.marketCap ?? coin.marketCap;
          coin.lastUpdate = now;

          // Track 24h high/low
          if (coin.price > coin.high24h) coin.high24h = coin.price;
          if (coin.price < coin.low24h) coin.low24h = coin.price;
          coin.high24h = coin.high24h * 0.999 + coin.price * 0.001;
          coin.low24h = coin.low24h * 0.999 + coin.price * 0.001;
        }
      }
    }

    // Build updates from current state (whether real or last-known)
    for (const [symbol, coin] of Object.entries(this.coins)) {
      const change = coin.price - coin.prevPrice;
      const changePct = coin.prevPrice > 0 ? (change / coin.prevPrice) * 100 : 0;

      updates[symbol] = {
        price: coin.price,
        change,
        changePct,
        high: coin.high24h,
        low: coin.low24h,
        change24h: coin.change24h,
        volume24h: coin.volume24h,
        marketCap: coin.marketCap,
        isLive: now - coin.lastUpdate < 15000,
      };

      // Keep price history
      this.history[symbol].push({ price: coin.price, ts: now });
      if (this.history[symbol].length > 500) this.history[symbol].shift();
    }

    return updates;
  }

  /** Synchronous tick for engine compatibility — returns last known prices */
  tickSync() {
    this.tickCount++;
    const updates = {};
    for (const [symbol, coin] of Object.entries(this.coins)) {
      const change = coin.price - coin.prevPrice;
      const changePct = coin.prevPrice > 0 ? (change / coin.prevPrice) * 100 : 0;
      updates[symbol] = {
        price: coin.price,
        change,
        changePct,
        high: coin.high24h,
        low: coin.low24h,
        change24h: coin.change24h,
        volume24h: coin.volume24h,
        marketCap: coin.marketCap,
      };
    }
    return updates;
  }

  /** Get current price for a coin */
  getPrice(symbol) {
    return this.coins[symbol]?.price ?? 0;
  }

  /** Get all current prices */
  getAllPrices() {
    const prices = {};
    for (const [symbol, coin] of Object.entries(this.coins)) {
      prices[symbol] = {
        price: coin.price,
        change: coin.price - coin.prevPrice,
        changePct: coin.prevPrice > 0 ? ((coin.price - coin.prevPrice) / coin.prevPrice) * 100 : 0,
        high: coin.high24h,
        low: coin.low24h,
        change24h: coin.change24h,
        volume24h: coin.volume24h,
        marketCap: coin.marketCap,
      };
    }
    return prices;
  }

  /** Get price history for a coin */
  getHistory(symbol) {
    return this.history[symbol] || [];
  }

  /** Get list of available coins */
  getCoins() {
    return this.coinSymbols;
  }

  /** Get which exchanges provided the price for a symbol */
  getExchangeSources(symbol) {
    return this.exchangeSources[symbol] || [];
  }

  /** Get current exchange status */
  getExchangeStatus() {
    return { ...this.exchangeStatus };
  }

  /** Check if we have live data */
  isLive(symbol) {
    const coin = this.coins[symbol];
    return coin ? Date.now() - coin.lastUpdate < 15000 : false;
  }

  /** Check if any exchange is online */
  isAnyExchangeOnline() {
    return Object.values(this.exchangeStatus).some(v => v);
  }

  /** Reset all prices to fallback */
  reset() {
    for (const symbol of this.coinSymbols) {
      const base = FALLBACK_PRICES[symbol] || 100;
      this.coins[symbol] = {
        price: base,
        prevPrice: base,
        change24h: 0,
        high24h: base,
        low24h: base,
        volume24h: 0,
        marketCap: 0,
        lastUpdate: 0,
      };
      this.history[symbol] = [{ price: base, ts: Date.now() }];
    }
    this.tickCount = 0;
    this.lastFetchTime = 0;
    this.exchangeStatus = { binance: false, coingecko: false, coincap: false, bybit: false, paxeer: false };
    this.exchangeSources = {};
  }
}
