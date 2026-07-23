/**
 * Price Simulator — generates realistic multi-coin price feeds
 * using geometric Brownian motion (random walk with drift + volatility).
 *
 * All prices are fake. No external APIs, no real market data.
 */

const COINS = {
  BTC: { base: 67500, drift: 0.0002, volatility: 0.018 },
  ETH: { base: 3450,  drift: 0.0003, volatility: 0.022 },
  SOL: { base: 148,   drift: 0.0004, volatility: 0.032 },
  AVAX: { base: 28,   drift: 0.0002, volatility: 0.028 },
  MATIC: { base: 0.72, drift: 0.0001, volatility: 0.035 },
  LINK: { base: 14.5,  drift: 0.0002, volatility: 0.025 },
  DOT: { base: 6.8,   drift: 0.0001, volatility: 0.030 },
  PAX: { base: 1.0,   drift: 0.0000, volatility: 0.005 },
};

function gaussRandom() {
  // Box-Muller transform for normally-distributed random
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export class PriceSimulator {
  constructor(coinSymbols = Object.keys(COINS)) {
    this.coins = {};
    this.history = {};
    this.tickCount = 0;

    for (const symbol of coinSymbols) {
      const cfg = COINS[symbol] || COINS.BTC;
      this.coins[symbol] = {
        price: cfg.base * (0.95 + Math.random() * 0.1), // slight random offset
        prevPrice: cfg.base,
        drift: cfg.drift,
        volatility: cfg.volatility,
        high24h: cfg.base,
        low24h: cfg.base,
      };
      this.history[symbol] = [{ price: this.coins[symbol].price, ts: Date.now() }];
    }
  }

  /** Advance all prices by one tick. Returns { [symbol]: { price, change, changePct, high, low } } */
  tick() {
    this.tickCount++;
    const updates = {};

    for (const [symbol, coin] of Object.entries(this.coins)) {
      const prevPrice = coin.price;
      // Geometric Brownian motion: dS/S = μ·dt + σ·dW
      const dW = gaussRandom();
      const dS = coin.price * (coin.drift + coin.volatility * dW);

      // Clamp: don't let price go negative or move more than 15% in one tick
      const maxMove = coin.price * 0.15;
      const clampedDS = Math.max(-maxMove, Math.min(maxMove, dS));
      coin.prevPrice = prevPrice;
      coin.price = Math.max(coin.price * 0.01, coin.price + clampedDS);

      // Track 24h high/low (rolling ~1440 ticks at 1/min, or ~100 at 1/sec for demo)
      if (coin.price > coin.high24h) coin.high24h = coin.price;
      if (coin.price < coin.low24h) coin.low24h = coin.price;
      // Decay high/low toward current price (rolling window simulation)
      coin.high24h = coin.high24h * 0.999 + coin.price * 0.001;
      coin.low24h = coin.low24h * 0.999 + coin.price * 0.001;

      const change = coin.price - prevPrice;
      const changePct = prevPrice > 0 ? (change / prevPrice) * 100 : 0;

      updates[symbol] = {
        price: coin.price,
        change,
        changePct,
        high: coin.high24h,
        low: coin.low24h,
      };

      // Keep last 500 price points per coin
      this.history[symbol].push({ price: coin.price, ts: Date.now() });
      if (this.history[symbol].length > 500) this.history[symbol].shift();
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
    return Object.keys(this.coins);
  }

  /** Reset all prices to base */
  reset() {
    for (const [symbol, coin] of Object.entries(this.coins)) {
      const cfg = COINS[symbol] || COINS.BTC;
      coin.price = cfg.base;
      coin.prevPrice = cfg.base;
      coin.high24h = cfg.base;
      coin.low24h = cfg.base;
      this.history[symbol] = [{ price: cfg.base, ts: Date.now() }];
    }
    this.tickCount = 0;
  }
}
