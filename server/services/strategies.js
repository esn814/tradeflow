/**
 * Server-side trading strategies — ported from src/engine/strategies.js
 * Pure functions, no browser dependencies. Each returns { action, coin, amount, price, cost, reason } or null.
 */

import { computeEMA, computeRSI, computeBollinger, computeATRFromPrices, detectRegime } from './indicators.js';
import { computeSignals } from './signalEngine.js';

/** Volume confirmation filter */
function volumeConfirms(priceData, minRatio = 0.5) {
  const vol = priceData?.volume24h;
  if (!vol || vol <= 0) return true;
  const history = priceData?.volumeHistory;
  if (!history || history.length < 5) return true;
  const avgVol = history.reduce((a, b) => a + b, 0) / history.length;
  if (avgVol <= 0) return true;
  return vol >= avgVol * minRatio;
}

/** Regime-aware position scaling */
function regimeAdjustedSize(priceData, baseTradePct) {
  const history = priceData?.history;
  if (!history || history.length < 16) return baseTradePct;
  const { regime } = detectRegime(history, 14);
  if (regime === 'volatile') return baseTradePct * 0.6;
  if (regime === 'trending-up' || regime === 'trending-down') return baseTradePct * 0.8;
  return baseTradePct;
}

// ── Strategy implementations ──────────────────────────────

export function dcaStrategy({ price, priceData, bot, tickCount, balance, state }) {
  const interval = bot.config?.interval || 8;
  const baseBuyPct = bot.config?.buyPct || 0.08;
  const sellPct = bot.config?.sellPct || 0.05;

  if (tickCount % interval !== 0) return null;
  if (!price || price <= 0) return null;

  const buyPct = regimeAdjustedSize(priceData, baseBuyPct);
  const holdings = state.holdings || 0;
  const holdingsValue = holdings * price;
  const totalValue = balance + holdingsValue;
  const allocationRatio = totalValue > 0 ? holdingsValue / totalValue : 0;

  if (allocationRatio > 0.50 || (allocationRatio > 0.30 && tickCount % (interval * 2) === 0)) {
    if (holdings > 0.0001) {
      const sellAmount = holdings * sellPct;
      return {
        action: 'sell', coin: bot.coin, amount: sellAmount, price,
        revenue: sellAmount * price,
        reason: `DCA sell: rebalancing ${(sellPct * 100).toFixed(0)}% (allocation ${(allocationRatio * 100).toFixed(0)}%)`,
        _setState: { holdings: holdings - sellAmount },
      };
    }
  }

  const buyCost = balance * buyPct;
  if (buyCost < 1) return null;
  if (!volumeConfirms(priceData)) return null;

  const coinAmount = buyCost / price;
  return {
    action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
    reason: `DCA buy: ${(buyPct * 100).toFixed(0)}% of balance ($${buyCost.toFixed(2)})`,
    _setState: { holdings: (holdings || 0) + coinAmount },
  };
}

export function gridStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const gridSpacing = bot.config?.gridSpacing || 0.008;
  const baseOrderPct = bot.config?.orderPct || 0.10;
  const recenterInterval = bot.config?.recenterInterval || 50;

  if (!state.gridLevels || !state.basePrice) {
    return { _setState: { gridLevels: true, basePrice: price, lastAction: null, holdings: 0, ticksSinceRecenter: 0 } };
  }

  const orderPct = regimeAdjustedSize(priceData, baseOrderPct);
  let basePrice = state.basePrice;
  let ticksSinceRecenter = (state.ticksSinceRecenter || 0) + 1;

  // ATR-based recentering
  const priceHistory = priceData?.history || [];
  let shouldRecenter = ticksSinceRecenter >= recenterInterval;
  if (priceHistory.length >= 15) {
    const regime = detectRegime(priceHistory, 14);
    if (regime.atr > 0) {
      const drift = Math.abs(price - basePrice);
      if (drift > regime.atr * 3) shouldRecenter = true;
      if (ticksSinceRecenter > 10 && (regime.regime === 'trending-up' || regime.regime === 'trending-down')) {
        if (drift > regime.atr * 1.5) shouldRecenter = true;
      }
    }
  }
  if (shouldRecenter) { basePrice = price; ticksSinceRecenter = 0; }

  const levelsFromBase = Math.floor(Math.log(price / basePrice) / Math.log(1 + gridSpacing));
  const holdings = state.holdings || 0;

  if (levelsFromBase < (state.lastBuyLevel ?? 0)) {
    const buyCost = balance * orderPct;
    if (buyCost >= 1 && volumeConfirms(priceData)) {
      const coinAmount = buyCost / price;
      return {
        action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
        reason: `Grid buy at level ${levelsFromBase}`,
        _setState: { lastBuyLevel: levelsFromBase, holdings: holdings + coinAmount, basePrice, ticksSinceRecenter },
      };
    }
  }

  if (levelsFromBase > (state.lastSellLevel ?? 0) && holdings > 0.0001) {
    const sellAmount = holdings * orderPct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Grid sell at level ${levelsFromBase}`,
      _setState: { lastSellLevel: levelsFromBase, holdings: holdings - sellAmount, basePrice, ticksSinceRecenter },
    };
  }

  return { _setState: { basePrice, ticksSinceRecenter } };
}

export function trendStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const shortWindow = bot.config?.shortWindow || 5;
  const longWindow = bot.config?.longWindow || 20;
  const baseTradePct = bot.config?.tradePct || 0.12;

  const history = priceData?.history || [];
  if (history.length < longWindow) return { _setState: { holdings: state.holdings || 0 } };

  const priceHistory = [...history, price].slice(-longWindow);
  const shortMA = priceHistory.slice(-shortWindow).reduce((a, b) => a + b, 0) / shortWindow;
  const longMA = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;

  const prevShortMA = state.prevShortMA ?? shortMA;
  const prevLongMA = state.prevLongMA ?? longMA;
  const tradePct = regimeAdjustedSize(priceData, baseTradePct);
  const newState = { prevShortMA: shortMA, prevLongMA: longMA, holdings: state.holdings || 0 };
  const holdings = state.holdings || 0;

  if (prevShortMA <= prevLongMA && shortMA > longMA && balance >= 1 && volumeConfirms(priceData)) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Trend buy: MA cross up, ${(tradePct * 100).toFixed(0)}% of balance`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  if (prevShortMA >= prevLongMA && shortMA < longMA && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Trend sell: MA cross down, ${(tradePct * 100).toFixed(0)}% of holdings`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

export function momentumStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const lookback = bot.config?.lookback || 10;
  const baseThreshold = bot.config?.threshold || 0.03;
  const baseTradePct = bot.config?.tradePct || 0.15;

  const history = priceData?.history || [];
  if (history.length < lookback + 1) return { _setState: { holdings: state.holdings || 0 } };

  const oldPrice = history[history.length - lookback];
  const momentum = (price - oldPrice) / oldPrice;

  const atr = history.length >= 15
    ? history.slice(-15).reduce((sum, p, i, arr) => i > 0 ? sum + Math.abs(p - arr[i - 1]) : sum, 0) / 14
    : 0;
  const atrPct = price > 0 && atr > 0 ? atr / price : 0;
  const threshold = atrPct > 0.005 ? Math.max(atrPct, 0.01) : baseThreshold;

  const tradePct = regimeAdjustedSize(priceData, baseTradePct);
  const newState = { holdings: state.holdings || 0 };
  const holdings = state.holdings || 0;

  if (momentum > threshold && balance >= 1 && volumeConfirms(priceData)) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Momentum buy: ${(momentum * 100).toFixed(1)}% gain`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  if (momentum < -threshold && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Momentum sell: ${(momentum * 100).toFixed(1)}% loss`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

export function meanReversionStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const window = bot.config?.window || 15;
  const deviation = bot.config?.deviation || 0.025;
  const tradePct = bot.config?.tradePct || 0.10;

  const history = priceData?.history || [];
  if (history.length < window) return { _setState: { holdings: state.holdings || 0 } };

  const avg = history.slice(-window).reduce((a, b) => a + b, 0) / window;
  const diff = (price - avg) / avg;
  const holdings = state.holdings || 0;
  const newState = { holdings };

  if (diff < -deviation && balance >= 1 && volumeConfirms(priceData)) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Mean rev buy: ${(diff * 100).toFixed(1)}% below avg`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  if (diff > deviation && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Mean rev sell: ${(diff * 100).toFixed(1)}% above avg`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

export function scalperStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const fastEMA = bot.config?.fastEMA || 5;
  const slowEMA = bot.config?.slowEMA || 13;
  const rsiPeriod = bot.config?.rsiPeriod || 7;
  const rsiBuy = bot.config?.rsiBuy || 30;
  const rsiSell = bot.config?.rsiSell || 70;
  const tradePct = bot.config?.tradePct || 0.05;

  const history = priceData?.history || [];
  if (history.length < slowEMA + 1) return { _setState: { holdings: state.holdings || 0 } };

  const prices = [...history, price].slice(-slowEMA - 5);
  const fast = computeEMA(prices, fastEMA);
  const slow = computeEMA(prices, slowEMA);
  const rsi = computeRSI(prices, rsiPeriod);
  if (fast == null || slow == null || rsi == null) return { _setState: { holdings: state.holdings || 0 } };

  const prevFast = state.prevFast ?? fast;
  const prevSlow = state.prevSlow ?? slow;
  const holdings = state.holdings || 0;
  const newState = { prevFast: fast, prevSlow: slow, holdings };

  if (prevFast <= prevSlow && fast > slow && rsi < rsiSell && balance >= 1 && volumeConfirms(priceData)) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Scalp buy: EMA cross up, RSI ${rsi.toFixed(0)}`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  if (prevFast >= prevSlow && fast < slow && rsi > rsiBuy && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Scalp sell: EMA cross down, RSI ${rsi.toFixed(0)}`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

export function trailingStopStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const fastEMA = bot.config?.fastEMA || 8;
  const slowEMA = bot.config?.slowEMA || 21;
  const baseTrailPct = bot.config?.trailPct || 0.025;
  const baseTradePct = bot.config?.tradePct || 0.15;

  const history = priceData?.history || [];
  if (history.length < slowEMA + 1) return { _setState: { holdings: state.holdings || 0 } };

  const prices = [...history, price].slice(-slowEMA - 5);
  let trailPct = baseTrailPct;
  if (prices.length >= 16) {
    const { regime, atrPct } = detectRegime(prices, 14);
    if (regime === 'volatile') trailPct = Math.max(baseTrailPct, atrPct * 2);
    else if (regime === 'ranging') trailPct = Math.min(baseTrailPct, atrPct * 1.2 || baseTrailPct);
  }
  const tradePct = regimeAdjustedSize(priceData, baseTradePct);

  const fast = computeEMA(prices, fastEMA);
  const slow = computeEMA(prices, slowEMA);
  if (fast == null || slow == null) return { _setState: { holdings: state.holdings || 0 } };

  const prevFast = state.prevFast ?? fast;
  const prevSlow = state.prevSlow ?? slow;
  const holdings = state.holdings || 0;
  let trailingStop = state.trailingStop || 0;
  let inPosition = state.inPosition || false;

  if (inPosition && price > trailingStop / (1 - trailPct)) {
    trailingStop = price * (1 - trailPct);
  }

  const newState = { prevFast: fast, prevSlow: slow, holdings, trailingStop, inPosition };

  // Entry
  if (!inPosition && prevFast <= prevSlow && fast > slow && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    const newTrailingStop = price * (1 - trailPct);
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Trailing stop buy: EMA cross up, trail ${(trailPct * 100).toFixed(1)}%`,
      _setState: { ...newState, holdings: holdings + coinAmount, trailingStop: newTrailingStop, inPosition: true },
    };
  }

  // Exit on trail hit
  if (inPosition && price <= trailingStop && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Trailing stop sell: price hit trail ${trailingStop.toFixed(2)}`,
      _setState: { ...newState, holdings: holdings - sellAmount, trailingStop: 0, inPosition: holdings - sellAmount > 0.0001 },
    };
  }

  // Exit on bearish cross
  if (inPosition && prevFast >= prevSlow && fast < slow && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Trailing stop sell: EMA cross down`,
      _setState: { ...newState, holdings: holdings - sellAmount, trailingStop: 0, inPosition: holdings - sellAmount > 0.0001 },
    };
  }

  return { _setState: newState };
}

export function breakoutStrategy({ price, priceData, bot, state, balance }) {
  if (!price || price <= 0) return null;

  const atrMultiplier = bot.config?.atrMultiplier || 1.5;
  const lookback = bot.config?.lookback || 20;
  const tradePct = bot.config?.tradePct || 0.18;

  const history = priceData?.history || [];
  if (history.length < lookback + 2) return { _setState: { holdings: state.holdings || 0 } };

  const atr = computeATRFromPrices(history.slice(-20), 14);
  if (atr == null) return { _setState: { holdings: state.holdings || 0 } };

  const windowPrices = history.slice(-(lookback + 1), -1);
  const rollingHigh = Math.max(...windowPrices);
  const rollingLow = Math.min(...windowPrices);
  const resistance = rollingHigh + atr * atrMultiplier;
  const support = rollingLow - atr * atrMultiplier;

  const prevPrice = history[history.length - 1];
  const holdings = state.holdings || 0;
  const newState = { holdings };

  if (price > resistance && prevPrice <= resistance && balance >= 1 && volumeConfirms(priceData)) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `Breakout buy: broke resistance ${resistance.toFixed(2)}`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  if (price < support && prevPrice >= support && holdings > 0.0001) {
    const sellAmount = holdings * tradePct;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `Breakout sell: broke support ${support.toFixed(2)}`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  return { _setState: newState };
}

export function smartDCAStrategy({ price, priceData, bot, tickCount, balance, state }) {
  if (!price || price <= 0) return null;

  const interval = bot.config?.interval || 6;
  const baseBuyPct = bot.config?.baseBuyPct || 0.06;
  const dipBuyPct = bot.config?.dipBuyPct || 0.12;
  const rsiPeriod = bot.config?.rsiPeriod || 14;
  const rsiDip = bot.config?.rsiDip || 35;
  const sellPct = bot.config?.sellPct || 0.05;

  if (tickCount % interval !== 0) return null;

  const history = priceData?.history || [];
  if (history.length < rsiPeriod + 1) return { _setState: { holdings: state.holdings || 0 } };

  const rsi = computeRSI([...history, price], rsiPeriod);
  if (rsi == null) return { _setState: { holdings: state.holdings || 0 } };

  const holdings = state.holdings || 0;
  const holdingsValue = holdings * price;
  const totalValue = balance + holdingsValue;
  const allocationRatio = totalValue > 0 ? holdingsValue / totalValue : 0;
  const newState = { holdings };

  if (rsi > 70 && holdings > 0.0001) {
    const sellAmount = holdings * sellPct * 1.5;
    return {
      action: 'sell', coin: bot.coin, amount: sellAmount, price, revenue: sellAmount * price,
      reason: `RSI DCA sell: RSI ${rsi.toFixed(0)} overbought`,
      _setState: { ...newState, holdings: holdings - sellAmount },
    };
  }

  if (rsi < rsiDip && allocationRatio < 0.6) {
    const buyCost = balance * dipBuyPct;
    if (buyCost >= 1) {
      const coinAmount = buyCost / price;
      return {
        action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
        reason: `RSI DCA deep buy: RSI ${rsi.toFixed(0)} oversold`,
        _setState: { ...newState, holdings: holdings + coinAmount },
      };
    }
  }

  if (allocationRatio < 0.4) {
    const buyCost = balance * baseBuyPct;
    if (buyCost >= 1) {
      const coinAmount = buyCost / price;
      return {
        action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
        reason: `RSI DCA buy: RSI ${rsi.toFixed(0)}`,
        _setState: { ...newState, holdings: holdings + coinAmount },
      };
    }
  }

  return { _setState: newState };
}

/** RSI Bollinger: mean-reversion on RSI+Bollinger extremes */
function rsiBollingerStrategy({ price, priceData, bot, tickCount, balance, state }) {
  const config = bot.config || {};
  const rsiPeriod = config.rsiPeriod || 14;
  const bbPeriod = config.bbPeriod || 20;
  const rsiBuy = config.rsiBuy || 25;
  const rsiSell = config.rsiSell || 75;
  const tradePct = config.tradePct || 0.15;

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

  // Buy: RSI oversold AND price below lower Bollinger Band
  if (rsi < rsiBuy && price < bb.lower && balance >= 1) {
    const buyCost = balance * tradePct;
    const coinAmount = buyCost / price;
    return {
      action: 'buy', coin: bot.coin, amount: coinAmount, price, cost: buyCost,
      reason: `RSI+BB buy: RSI ${rsi.toFixed(0)} < ${rsiBuy}, price ${price.toFixed(2)} < BB lower ${bb.lower.toFixed(2)}`,
      _setState: { ...newState, holdings: holdings + coinAmount },
    };
  }

  // Sell: RSI overbought AND price above upper Bollinger Band
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

// ── Confluence (Signal Engine) Strategy ─────────────────────
// Wraps the multi-indicator confluence engine as a standard strategy.

function confluenceStrategy({ price, priceData, bot, tickCount, balance, state }) {
  const minConfidence = bot.config?.minConfidence || 40;
  const buyPct = bot.config?.buyPct || 0.10;
  const sellPct = bot.config?.sellPct || 0.08;

  // Need enough history for all indicators
  if (!priceData?.history || priceData.history.length < 35) return null;

  // Only evaluate every N ticks to avoid overtrading
  const interval = bot.config?.interval || 3;
  if (tickCount % interval !== 0) return null;

  const signalResult = computeSignals(bot.coin, {
    price,
    history: priceData.history,
    volumes: priceData.volumeHistory,
  });

  const { recommendation, confluence } = signalResult;
  const holdings = state.holdings || 0;

  // Buy signal: strong bullish confluence
  if (recommendation.action === 'buy' && recommendation.confidence >= minConfidence) {
    if (balance <= 0) return null;
    const tradePct = regimeAdjustedSize(priceData, buyPct);
    const amount = (balance * tradePct) / price;
    if (amount * price < 10) return null; // Below minimum notional
    return {
      action: 'buy', coin: bot.coin, amount, price,
      cost: amount * price,
      reason: `Confluence BUY (${recommendation.confidence}% confidence): ${recommendation.reason}`,
    };
  }

  // Sell signal: strong bearish confluence
  if (recommendation.action === 'sell' && recommendation.confidence >= minConfidence) {
    if (holdings <= 0.0001) return null;
    const amount = holdings * sellPct;
    return {
      action: 'sell', coin: bot.coin, amount, price,
      revenue: amount * price,
      reason: `Confluence SELL (${recommendation.confidence}% confidence): ${recommendation.reason}`,
    };
  }

  return null;
}

// ── Strategy registry ─────────────────────────────────────

export const STRATEGIES = {
  dca: { name: 'DCA', fn: dcaStrategy, description: 'Dollar-cost average with auto-rebalancing' },
  grid: { name: 'Grid', fn: gridStrategy, description: 'Buy/sell at predefined grid levels' },
  trend: { name: 'Trend', fn: trendStrategy, description: 'Follow MA crossover momentum' },
  momentum: { name: 'Momentum', fn: momentumStrategy, description: 'Buy winners, sell losers' },
  meanReversion: { name: 'Mean Reversion', fn: meanReversionStrategy, description: 'Buy dips, sell rallies' },
  scalper: { name: 'Scalper', fn: scalperStrategy, description: 'Fast EMA+RSI+MACD scalping' },
  smartDCA: { name: 'RSI DCA', fn: smartDCAStrategy, description: 'RSI-timed DCA on oversold dips' },
  trailingStop: { name: 'Trailing Stop', fn: trailingStopStrategy, description: 'Trend follow with trailing stop' },
  breakout: { name: 'Breakout', fn: breakoutStrategy, description: 'ATR-based breakout detection' },
  rsiBollinger: { name: 'RSI Bollinger', fn: rsiBollingerStrategy, description: 'Mean-reversion on RSI+Bollinger extremes' },
  confluence: { name: 'AI Confluence', fn: confluenceStrategy, description: 'Multi-indicator confluence scoring (8 signals weighted)' },
};
