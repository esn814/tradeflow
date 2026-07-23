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

/** Strategy registry */
export const STRATEGIES = {
  dca: { name: 'DCA', fn: dcaStrategy, description: 'Dollar-cost average at fixed intervals with auto-rebalancing' },
  grid: { name: 'Grid', fn: gridStrategy, description: 'Buy/sell at predefined price grid levels' },
  trend: { name: 'Trend', fn: trendStrategy, description: 'Follow MA crossover momentum' },
  momentum: { name: 'Momentum', fn: momentumStrategy, description: 'Buy winners, sell losers' },
  meanReversion: { name: 'Mean Reversion', fn: meanReversionStrategy, description: 'Buy dips, sell rallies' },
};

/** Default bot configs — percentage-based for sustained activity */
export const DEFAULT_BOT_CONFIGS = {
  dca: { interval: 8, buyPct: 0.08, sellPct: 0.05 },
  grid: { gridSpacing: 0.008, orderPct: 0.10, recenterInterval: 50 },
  trend: { shortWindow: 5, longWindow: 20, tradePct: 0.12 },
  momentum: { lookback: 10, threshold: 0.03, tradePct: 0.15 },
  meanReversion: { window: 15, deviation: 0.025, tradePct: 0.10 },
};
