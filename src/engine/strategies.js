/**
 * Trading Strategies — each strategy decides what trade (if any) to make
 * given current price data, bot state, and available balance.
 *
 * Every strategy returns { action, coin, amount, price, reason } or null (no trade).
 *
 * KEY FIX: All strategies use PERCENTAGE-BASED position sizing so bots
 * sustain trading activity over hours, not seconds. Fixed dollar amounts
 * exhaust balance in minutes; percentages recycle capital indefinitely.
 */

import { computeEMA, computeMACD, computeRSI, computeBollinger, computeATR, computeSMA } from './indicators.js';

/** DCA: buy a fraction of balance every N ticks, sell a fraction of holdings on alternating cycles */
export function dcaStrategy({ prices, bot, tickCount, balance, state }) {
  const interval = bot.params?.interval || 8;
  const buyPct = bot.params?.buyPct || 0.08;   // 8% of balance per buy
  const sellPct = bot.params?.sellPct || 0.05;  // 5% of holdings per sell

  if (tickCount % interval !== 0) return null;

  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const holdings = state.holdings || 0;
  const holdingsValue = holdings * price;
  const totalValue = balance + holdingsValue;

  // Alternate between buying and selling based on allocation
  // If holdings are > 40% of total value, sell to rebalance
  // If holdings are < 20% of total value, buy
  // Otherwise alternate based on tick parity
  const allocationRatio = totalValue > 0 ? holdingsValue / totalValue : 0;

  if (allocationRatio > 0.50 || (allocationRatio > 0.30 && tickCount % (interval * 2) === 0)) {
    // Sell: rebalance toward cash
    if (holdings > 0.0001) {
      const sellAmount = holdings * sellPct;
      return {
        action: 'sell',
        coin: bot.coin,
        amount: sellAmount,
        price,
        revenue: sellAmount * price,
        reason: `DCA sell: rebalancing ${(sellPct * 100).toFixed(0)}% of holdings (allocation ${(allocationRatio * 100).toFixed(0)}%)`,
        _setState: { holdings: holdings - sellAmount },
      };
    }
  }

  // Buy
  const buyCost = balance * buyPct;
  if (buyCost < 1) return null; // dust threshold

  const coinAmount = buyCost / price;
  return {
    action: 'buy',
    coin: bot.coin,
    amount: coinAmount,
    price,
    cost: buyCost,
    reason: `DCA buy: ${(buyPct * 100).toFixed(0)}% of balance ($${buyCost.toFixed(2)})`,
    _setState: { holdings: (holdings || 0) + coinAmount },
  };
}

/** Grid: buy at grid levels below, sell at grid levels above — percentage-based sizing */
export function gridStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const gridSpacing = bot.params?.gridSpacing || 0.008;
  const orderPct = bot.params?.orderPct || 0.10; // 10% of relevant pool per grid order
  const recenterInterval = bot.params?.recenterInterval || 50;

  // Initialize grid state on first run
  if (!state.gridLevels || !state.basePrice) {
    return { _setState: { gridLevels: true, basePrice: price, lastAction: null, holdings: 0, ticksSinceRecenter: 0 } };
  }

  let basePrice = state.basePrice;
  let ticksSinceRecenter = (state.ticksSinceRecenter || 0) + 1;

  // Periodically re-center base price so the grid stays active around current price
  if (ticksSinceRecenter >= recenterInterval) {
    basePrice = price;
    ticksSinceRecenter = 0;
  }

  const levelsFromBase = Math.floor(Math.log(price / basePrice) / Math.log(1 + gridSpacing));
  const holdings = state.holdings || 0;

  // Buy if price dropped to a new grid level below
  if (levelsFromBase < (state.lastBuyLevel ?? 0)) {
    const buyCost = balance * orderPct;
    if (buyCost >= 1) {
      const coinAmount = buyCost / price;
      return {
        action: 'buy',
        coin: bot.coin,
        amount: coinAmount,
        price,
        cost: buyCost,
        reason: `Grid buy at level ${levelsFromBase} (${(orderPct * 100).toFixed(0)}% of balance)`,
        _setState: { lastBuyLevel: levelsFromBase, holdings: holdings + coinAmount, basePrice, ticksSinceRecenter },
      };
    }
  }

  // Sell if price rose to a grid level above
  if (levelsFromBase > (state.lastSellLevel ?? 0) && holdings > 0.0001) {
    const sellAmount = holdings * orderPct;
    return {
      action: 'sell',
      coin: bot.coin,
      amount: sellAmount,
      price,
      revenue: sellAmount * price,
      reason: `Grid sell at level ${levelsFromBase} (${(orderPct * 100).toFixed(0)}% of holdings)`,
      _setState: { lastSellLevel: levelsFromBase, holdings: holdings - sellAmount, basePrice, ticksSinceRecenter },
    };
  }

  return { _setState: { basePrice, ticksSinceRecenter } };
}

/** Trend: follow momentum using short/long moving averages — percentage-based sizing */
export function trendStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const history = prices[bot.coin]?.history || [];
  const shortWindow = bot.params?.shortWindow || 5;
  const longWindow = bot.params?.longWindow || 20;
  const tradePct = bot.params?.tradePct || 0.12; // 12% per trade

  if (history.length < longWindow) {
    return { _setState: { priceHistory: [...(state.priceHistory || []), price].slice(-longWindow), holdings: state.holdings || 0 } };
  }

  const priceHistory = [...(state.priceHistory || []), price].slice(-longWindow);
  const shortMA = priceHistory.slice(-shortWindow).reduce((a, b) => a + b, 0) / shortWindow;
  const longMA = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;

  const prevShortMA = state.prevShortMA ?? shortMA;
  const prevLongMA = state.prevLongMA ?? longMA;

  const newState = { priceHistory, prevShortMA: shortMA, prevLongMA: longMA, holdings: state.holdings || 0 };
  const holdings = state.holdings || 0;

  // Buy signal: short MA crosses above long MA
  if (prevShortMA <= prevLongMA && shortMA > longMA && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy',
      coin: bot.coin,
      amount: coinAmount,
      price,
      cost: buyCost,
      reason: `Trend buy: MA cross up, ${(tradePct * 100).toFixed(0)}% of balance`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Sell signal: short MA crosses below long MA
  if (prevShortMA >= prevLongMA && shortMA < longMA && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell',
      coin: bot.coin,
      amount: sellAmount,
      price,
      revenue: sellAmount * price,
      reason: `Trend sell: MA cross down, ${(tradePct * 100).toFixed(0)}% of holdings`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

/** Momentum: buy when recent returns are strong, sell when weak — percentage-based */
export function momentumStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const lookback = bot.params?.lookback || 10;
  const threshold = bot.params?.threshold || 0.03;
  const tradePct = bot.params?.tradePct || 0.15; // 15% per trade

  const priceHistory = [...(state.priceHistory || []), price].slice(-lookback - 1);

  if (priceHistory.length < lookback + 1) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const oldPrice = priceHistory[0];
  const momentum = (price - oldPrice) / oldPrice;

  const newState = { priceHistory, holdings: state.holdings || 0 };
  const holdings = state.holdings || 0;

  // Strong positive momentum: buy
  if (momentum > threshold && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy',
      coin: bot.coin,
      amount: coinAmount,
      price,
      cost: buyCost,
      reason: `Momentum buy: ${(momentum * 100).toFixed(1)}% gain, ${(tradePct * 100).toFixed(0)}% of balance`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Strong negative momentum: sell
  if (momentum < -threshold && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell',
      coin: bot.coin,
      amount: sellAmount,
      price,
      revenue: sellAmount * price,
      reason: `Momentum sell: ${(momentum * 100).toFixed(1)}% loss, ${(tradePct * 100).toFixed(0)}% of holdings`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

/** Mean Reversion: buy dips below average, sell rallies above average — percentage-based */
export function meanReversionStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const window = bot.params?.window || 15;
  const deviation = bot.params?.deviation || 0.025;
  const tradePct = bot.params?.tradePct || 0.10; // 10% per trade

  const priceHistory = [...(state.priceHistory || []), price].slice(-window);

  if (priceHistory.length < window) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const avg = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
  const diff = (price - avg) / avg;

  const newState = { priceHistory, holdings: state.holdings || 0 };
  const holdings = state.holdings || 0;

  // Price significantly below average: buy
  if (diff < -deviation && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy',
      coin: bot.coin,
      amount: coinAmount,
      price,
      cost: buyCost,
      reason: `Mean rev buy: ${(diff * 100).toFixed(1)}% below avg, ${(tradePct * 100).toFixed(0)}% of balance`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Price significantly above average: sell
  if (diff > deviation && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell',
      coin: bot.coin,
      amount: sellAmount,
      price,
      revenue: sellAmount * price,
      reason: `Mean rev sell: ${(diff * 100).toFixed(1)}% above avg, ${(tradePct * 100).toFixed(0)}% of holdings`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

/** Scalper: fast EMA crossover + RSI + MACD confirmation — high frequency, small profits */
export function scalperStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const fastEMA = bot.params?.fastEMA || 5;
  const slowEMA = bot.params?.slowEMA || 13;
  const rsiPeriod = bot.params?.rsiPeriod || 7;
  const rsiBuy = bot.params?.rsiBuy || 30;
  const rsiSell = bot.params?.rsiSell || 70;
  const tradePct = bot.params?.tradePct || 0.20;

  const priceHistory = [...(state.priceHistory || []), price].slice(-slowEMA - 5);
  if (priceHistory.length < slowEMA + 1) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const fast = computeEMA(priceHistory, fastEMA);
  const slow = computeEMA(priceHistory, slowEMA);
  const rsi = computeRSI(priceHistory, rsiPeriod);
  const macd = computeMACD(priceHistory, fastEMA, slowEMA, 3);
  if (fast == null || slow == null || rsi == null) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const prevFast = state.prevFast ?? fast;
  const prevSlow = state.prevSlow ?? slow;
  const holdings = state.holdings || 0;
  const newState = { priceHistory, prevFast: fast, prevSlow: slow, holdings };

  // Buy: fast EMA crosses above slow + RSI not overbought + MACD histogram positive
  if (prevFast <= prevSlow && fast > slow && rsi < rsiSell && (!macd || macd.histogram > 0) && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Scalp buy: EMA ${fastEMA}/${slowEMA} cross up, RSI ${rsi.toFixed(0)}, MACD confirm`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Sell: fast EMA crosses below slow + RSI overbought OR MACD histogram negative
  if (prevFast >= prevSlow && fast < slow && rsi > rsiBuy && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Scalp sell: EMA ${fastEMA}/${slowEMA} cross down, RSI ${rsi.toFixed(0)}`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

/** Smart DCA: RSI-timed DCA — buys more aggressively on oversold dips, sells on overbought */
export function smartDCAStrategy({ prices, bot, tickCount, balance, state }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const interval = bot.params?.interval || 6;
  const baseBuyPct = bot.params?.baseBuyPct || 0.06;
  const dipBuyPct = bot.params?.dipBuyPct || 0.12;
  const rsiPeriod = bot.params?.rsiPeriod || 14;
  const rsiDip = bot.params?.rsiDip || 35;
  const sellPct = bot.params?.sellPct || 0.05;

  if (tickCount % interval !== 0) return null;

  const priceHistory = [...(state.priceHistory || []), price].slice(-rsiPeriod - 2);
  if (priceHistory.length < rsiPeriod + 1) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const rsi = computeRSI(priceHistory, rsiPeriod);
  if (rsi == null) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const holdings = state.holdings || 0;
  const holdingsValue = holdings * price;
  const totalValue = balance + holdingsValue;
  const allocationRatio = totalValue > 0 ? holdingsValue / totalValue : 0;
  const newState = { priceHistory, holdings };

  // Overbought: sell to lock profits
  if (rsi > 70 && holdings > 0.0001) {
    const sellAmount = holdings * sellPct * 1.5;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Smart DCA sell: RSI ${rsi.toFixed(0)} overbought, trimming ${(sellPct * 150).toFixed(1)}%`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  // Deep dip: buy aggressively (RSI below dip threshold)
  if (rsi < rsiDip && allocationRatio < 0.6) {
    const buyCost = balance * dipBuyPct;
    if (buyCost >= 1) {
      const coinAmount = buyCost / price;
      return {
        action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
        reason: `Smart DCA deep buy: RSI ${rsi.toFixed(0)} oversold, ${(dipBuyPct * 100).toFixed(0)}% of balance`,
        _setState: { ...newState, holdings: holdings + coinAmount },
      };
    }
  }

  // Regular interval buy
  if (allocationRatio < 0.4) {
    const buyCost = balance * baseBuyPct;
    if (buyCost >= 1) {
      const coinAmount = buyCost / price;
      return {
        action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
        reason: `Smart DCA buy: RSI ${rsi.toFixed(0)}, ${(baseBuyPct * 100).toFixed(0)}% of balance`,
        _setState: { ...newState, holdings: holdings + coinAmount },
      };
    }
  }

  return { _setState: newState };
}

/** Trailing Stop: EMA crossover for entry, trailing stop-loss that rises with price to lock profits */
export function trailingStopStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const fastEMA = bot.params?.fastEMA || 8;
  const slowEMA = bot.params?.slowEMA || 21;
  const trailPct = bot.params?.trailPct || 0.025;
  const tradePct = bot.params?.tradePct || 0.15;

  const priceHistory = [...(state.priceHistory || []), price].slice(-slowEMA - 5);
  if (priceHistory.length < slowEMA + 1) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const fast = computeEMA(priceHistory, fastEMA);
  const slow = computeEMA(priceHistory, slowEMA);
  if (fast == null || slow == null) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const prevFast = state.prevFast ?? fast;
  const prevSlow = state.prevSlow ?? slow;
  const holdings = state.holdings || 0;
  let trailingStop = state.trailingStop || 0;
  let inPosition = state.inPosition || false;

  // Update trailing stop: rises with price, never falls
  if (inPosition && price > trailingStop / (1 - trailPct)) {
    trailingStop = price * (1 - trailPct);
  }

  const newState = { priceHistory, prevFast: fast, prevSlow: slow, holdings, trailingStop, inPosition };

  // Entry: fast EMA crosses above slow EMA — open position
  if (!inPosition && prevFast <= prevSlow && fast > slow && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    const newTrailingStop = price * (1 - trailPct);
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Trailing stop buy: EMA ${fastEMA}/${slowEMA} cross up, trail at ${(trailPct * 100).toFixed(1)}%`,
      _setState: { ...newState, holdings: holdings + coinAmount, trailingStop: newTrailingStop, inPosition: true },
    };
  }

  // Exit: price drops below trailing stop — close position
  if (inPosition && price <= trailingStop && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Trailing stop sell: price ${price.toFixed(2)} hit trail ${trailingStop.toFixed(2)}, ${(tradePct * 100).toFixed(0)}% of holdings`,
      _setState: { ...newState, holdings: holdings - sellAmount, trailingStop: 0, inPosition: holdings - sellAmount > 0.0001 },
    };
  }

  // Also exit on bearish EMA crossover while in position
  if (inPosition && prevFast >= prevSlow && fast < slow && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Trailing stop sell: EMA ${fastEMA}/${slowEMA} cross down, exiting position`,
      _setState: { ...newState, holdings: holdings - sellAmount, trailingStop: 0, inPosition: holdings - sellAmount > 0.0001 },
    };
  }

  return { _setState: newState };
}

/** Breakout: detect price breaking above/below ATR-based bands for volatility expansion trades */
export function breakoutStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const atrPeriod = bot.params?.atrPeriod || 14;
  const atrMultiplier = bot.params?.atrMultiplier || 1.5;
  const lookback = bot.params?.lookback || 20;
  const tradePct = bot.params?.tradePct || 0.18;

  const priceHistory = [...(state.priceHistory || []), price].slice(-lookback - 2);
  if (priceHistory.length < lookback + 1) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const atr = computeATR(priceHistory, atrPeriod);
  if (atr == null) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  // Rolling high/low over lookback window (excluding current price)
  const windowPrices = priceHistory.slice(-(lookback + 1), -1);
  const rollingHigh = Math.max(...windowPrices);
  const rollingLow = Math.min(...windowPrices);

  // ATR-based resistance and support bands
  const resistance = rollingHigh + atr * atrMultiplier;
  const support = rollingLow - atr * atrMultiplier;

  const prevPrice = priceHistory[priceHistory.length - 2];
  const holdings = state.holdings || 0;
  const newState = { priceHistory, holdings };

  // Breakout above resistance: buy
  if (price > resistance && prevPrice <= resistance && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Breakout buy: price ${price.toFixed(2)} broke resistance ${resistance.toFixed(2)} (ATR ${atr.toFixed(2)} × ${atrMultiplier})`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Breakdown below support: sell
  if (price < support && prevPrice >= support && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Breakout sell: price ${price.toFixed(2)} broke support ${support.toFixed(2)} (ATR ${atr.toFixed(2)} × ${atrMultiplier})`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

/** RSI Bollinger: combine RSI oversold/overbought with Bollinger Band extremes for mean-reversion */
export function rsiBollingerStrategy({ prices, bot, state, balance }) {
  const price = prices[bot.coin]?.price;
  if (!price || price <= 0) return null;

  const rsiPeriod = bot.params?.rsiPeriod || 14;
  const bbPeriod = bot.params?.bbPeriod || 20;
  const rsiBuy = bot.params?.rsiBuy || 25;
  const rsiSell = bot.params?.rsiSell || 75;
  const tradePct = bot.params?.tradePct || 0.15;

  const minLen = Math.max(rsiPeriod, bbPeriod) + 2;
  const priceHistory = [...(state.priceHistory || []), price].slice(-minLen - 5);
  if (priceHistory.length < minLen) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const rsi = computeRSI(priceHistory, rsiPeriod);
  const bb = computeBollinger(priceHistory, bbPeriod);
  if (rsi == null || !bb) {
    return { _setState: { priceHistory, holdings: state.holdings || 0 } };
  }

  const holdings = state.holdings || 0;
  const newState = { priceHistory, holdings };

  // Buy: RSI oversold AND price below lower Bollinger Band — high-probability mean-reversion entry
  if (rsi < rsiBuy && price < bb.lower && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `RSI+BB buy: RSI ${rsi.toFixed(0)} < ${rsiBuy}, price ${price.toFixed(2)} < BB lower ${bb.lower.toFixed(2)}`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Sell: RSI overbought AND price above upper Bollinger Band — high-probability mean-reversion exit
  if (rsi > rsiSell && price > bb.upper && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `RSI+BB sell: RSI ${rsi.toFixed(0)} > ${rsiSell}, price ${price.toFixed(2)} > BB upper ${bb.upper.toFixed(2)}`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

/** Strategy registry */
export const STRATEGIES = {
  dca: { name: 'DCA', fn: dcaStrategy, description: 'Dollar-cost average at fixed intervals with auto-rebalancing' },
  grid: { name: 'Grid', fn: gridStrategy, description: 'Buy/sell at predefined price grid levels' },
  trend: { name: 'Trend', fn: trendStrategy, description: 'Follow MA crossover momentum' },
  momentum: { name: 'Momentum', fn: momentumStrategy, description: 'Buy winners, sell losers' },
  meanReversion: { name: 'Mean Reversion', fn: meanReversionStrategy, description: 'Buy dips, sell rallies' },
  scalper: { name: 'Scalper', fn: scalperStrategy, description: 'Fast EMA+RSI+MACD scalping for quick profits' },
  smartDCA: { name: 'Smart DCA', fn: smartDCAStrategy, description: 'RSI-timed DCA — buys more on oversold dips' },
  trailingStop: { name: 'Trailing Stop', fn: trailingStopStrategy, description: 'Trend follow with trailing stop-loss to lock profits' },
  breakout: { name: 'Breakout', fn: breakoutStrategy, description: 'ATR-based breakout detection for volatility expansion' },
  rsiBollinger: { name: 'RSI Bollinger', fn: rsiBollingerStrategy, description: 'Quick mean-reversion on RSI+Bollinger extremes' },
};

/** Default bot configs — percentage-based for sustained activity */
export const DEFAULT_BOT_CONFIGS = {
  dca: { interval: 8, buyPct: 0.08, sellPct: 0.05 },
  grid: { gridSpacing: 0.008, orderPct: 0.10, recenterInterval: 50 },
  trend: { shortWindow: 5, longWindow: 20, tradePct: 0.12 },
  momentum: { lookback: 10, threshold: 0.03, tradePct: 0.15 },
  meanReversion: { window: 15, deviation: 0.025, tradePct: 0.10 },
  scalper: { fastEMA: 5, slowEMA: 13, rsiPeriod: 7, rsiBuy: 30, rsiSell: 70, tradePct: 0.20 },
  smartDCA: { interval: 6, baseBuyPct: 0.06, dipBuyPct: 0.12, rsiPeriod: 14, rsiDip: 35, sellPct: 0.05 },
  trailingStop: { fastEMA: 8, slowEMA: 21, trailPct: 0.025, tradePct: 0.15 },
  breakout: { atrPeriod: 14, atrMultiplier: 1.5, lookback: 20, tradePct: 0.18 },
  rsiBollinger: { rsiPeriod: 14, bbPeriod: 20, rsiBuy: 25, rsiSell: 75, tradePct: 0.15 },
};
