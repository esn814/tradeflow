/**
 * Risk Manager — Position sizing, trailing stops, multi-TP, circuit breakers.
 *
 * Core principles:
 *   1. Kelly Criterion for optimal position sizing (fractional 0.25x for safety)
 *   2. Trailing stop-loss that follows price up, locks in gains
 *   3. Multiple take-profit levels (scale out in thirds)
 *   4. Portfolio-level drawdown circuit breaker
 *   5. Fee-aware profit targets (ensures trades are profitable after fees)
 */

import { logger } from '../logger.js';

// ── Constants ──────────────────────────────────────────────

const DEFAULT_FEES = {
  makerFee: 0.001,    // 0.10% Binance spot maker
  takerFee: 0.001,    // 0.10% Binance spot taker
  slippageBps: 5,     // 0.05% expected slippage
};

// ── Kelly Criterion ────────────────────────────────────────

/**
 * Calculate optimal position size using Kelly Criterion.
 *
 * Kelly formula: f* = (bp - q) / b
 *   where: b = net odds (avg win / avg loss), p = win rate, q = 1 - p
 *
 * We use fractional Kelly (0.25x) because:
 *   - Crypto returns are fat-tailed (extreme moves are common)
 *   - Win rate estimates are noisy with limited data
 *   - Full Kelly is too aggressive — half-Kelly is standard, quarter-Kelly for crypto
 *
 * @param {Object} params
 * @param {number} params.winRate - Win rate (0-1)
 * @param {number} params.avgWin - Average winning trade (absolute USD)
 * @param {number} params.avgLoss - Average losing trade (absolute USD, positive number)
 * @param {number} params.balance - Available balance in USD
 * @param {number} [params.kellyFraction=0.25] - Fraction of Kelly to use (0.25 = quarter Kelly)
 * @param {number} [params.maxAllocation=0.25] - Max % of balance to allocate (safety cap)
 * @returns {{ positionSize: number, kellyRaw: number, kellyAdjusted: number, reason: string }}
 */
export function kellyPositionSize({ winRate, avgWin, avgLoss, balance, kellyFraction = 0.25, maxAllocation = 0.25 }) {
  // Guard against bad data
  if (!winRate || winRate <= 0 || winRate >= 1 || !avgWin || avgWin <= 0 || !avgLoss || avgLoss <= 0 || !balance || balance <= 0) {
    return { positionSize: 0, kellyRaw: 0, kellyAdjusted: 0, reason: 'Insufficient trade history for Kelly sizing' };
  }

  const b = avgWin / avgLoss; // net odds
  const p = winRate;
  const q = 1 - p;
  const kellyRaw = (b * p - q) / b;

  // Kelly can be negative (don't trade) or unreasonably large
  if (kellyRaw <= 0) {
    return { positionSize: 0, kellyRaw, kellyAdjusted: 0, reason: `Kelly negative (${(kellyRaw * 100).toFixed(1)}%) — edge is against us` };
  }

  // Apply fractional Kelly and safety cap
  const kellyAdjusted = Math.min(kellyRaw * kellyFraction, maxAllocation);
  const positionSize = balance * kellyAdjusted;

  return {
    positionSize: Math.max(0, positionSize),
    kellyRaw,
    kellyAdjusted,
    reason: `Kelly ${(kellyRaw * 100).toFixed(1)}% → ${(kellyAdjusted * 100).toFixed(1)}% (fractional ${kellyFraction}x) → $${positionSize.toFixed(2)}`,
  };
}

/**
 * Calculate Kelly from bot's trade history.
 * Looks at the last N trades to compute win rate, avg win, avg loss.
 *
 * @param {Array} trades - Array of trade objects with { action, pnl }
 * @param {number} [lookback=50] - Number of recent trades to analyze
 * @returns {{ winRate, avgWin, avgLoss, tradeCount }}
 */
export function calculateWinLossStats(trades, lookback = 50) {
  const recentTrades = trades
    .filter(t => t.action === 'sell' && t.pnl !== null && t.pnl !== undefined)
    .slice(-lookback);

  if (recentTrades.length < 5) {
    return { winRate: 0, avgWin: 0, avgLoss: 0, tradeCount: recentTrades.length, insufficient: true };
  }

  const wins = recentTrades.filter(t => t.pnl > 0);
  const losses = recentTrades.filter(t => t.pnl < 0);

  const winRate = wins.length / recentTrades.length;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;

  return { winRate, avgWin, avgLoss, tradeCount: recentTrades.length, insufficient: false };
}

// ── Trailing Stop-Loss ─────────────────────────────────────

/**
 * Update trailing stop-loss level.
 * The trail follows price up (for longs) but never moves down.
 *
 * @param {Object} params
 * @param {number} params.price - Current price
 * @param {number} params.currentTrail - Current trailing stop level
 * @param {number} params.trailPct - Trail distance as decimal (0.025 = 2.5%)
 * @param {boolean} params.inPosition - Whether we have an open position
 * @returns {{ trail: number, triggered: boolean, newHigh: boolean }}
 */
export function updateTrailingStop({ price, currentTrail, trailPct, inPosition }) {
  if (!inPosition || !price || price <= 0) {
    return { trail: currentTrail || 0, triggered: false, newHigh: false };
  }

  const newTrailLevel = price * (1 - trailPct);
  let newHigh = false;

  // Only move trail up, never down
  if (!currentTrail || currentTrail <= 0) {
    return { trail: newTrailLevel, triggered: false, newHigh: true };
  }

  if (newTrailLevel > currentTrail) {
    newHigh = true;
    return { trail: newTrailLevel, triggered: false, newHigh: true };
  }

  // Check if price hit the trail
  const triggered = price <= currentTrail;

  return { trail: currentTrail, triggered, newHigh: false };
}

// ── Multi-Take-Profit ──────────────────────────────────────

/**
 * Default take-profit levels (scale out in thirds).
 * Can be customized per strategy.
 */
export const DEFAULT_TP_LEVELS = [
  { pct: 0.02, sellRatio: 0.33, label: 'TP1' },  // +2% → sell 33%
  { pct: 0.04, sellRatio: 0.33, label: 'TP2' },  // +4% → sell 33%
  { pct: 0.08, sellRatio: 0.34, label: 'TP3' },  // +8% → sell remaining 34%
];

/**
 * Check if any take-profit levels have been hit.
 *
 * @param {Object} params
 * @param {number} params.price - Current price
 * @param {number} params.entryPrice - Entry price of the position
 * @param {number} params.holdings - Current holdings quantity
 * @param {Array} params.tpLevels - Array of { pct, sellRatio, label }
 * @param {Set} params.hitLevels - Set of already-hit level labels
 * @returns {{ shouldSell: boolean, sellAmount: number, level: Object|null, reason: string }}
 */
export function checkTakeProfitLevels({ price, entryPrice, holdings, tpLevels = DEFAULT_TP_LEVELS, hitLevels = new Set() }) {
  if (!price || !entryPrice || !holdings || holdings <= 0) {
    return { shouldSell: false, sellAmount: 0, level: null, reason: '' };
  }

  const gainPct = (price - entryPrice) / entryPrice;

  for (const level of tpLevels) {
    if (gainPct >= level.pct && !hitLevels.has(level.label)) {
      const sellAmount = holdings * level.sellRatio;
      if (sellAmount > 0.0001) {
        return {
          shouldSell: true,
          sellAmount,
          level,
          reason: `${level.label} hit: +${(gainPct * 100).toFixed(1)}% gain → sell ${(level.sellRatio * 100).toFixed(0)}%`,
        };
      }
    }
  }

  return { shouldSell: false, sellAmount: 0, level: null, reason: '' };
}

// ── Fee-Aware Profit Targets ───────────────────────────────

/**
 * Calculate minimum profit target that covers exchange fees + slippage.
 *
 * For a round-trip trade (buy + sell):
 *   Total cost = buyFee + sellFee + slippage
 *   Break-even = total cost / (1 - total cost)
 *
 * @param {Object} [fees] - Fee configuration
 * @returns {number} Minimum gain percentage to break even (e.g., 0.003 = 0.3%)
 */
export function calculateBreakEvenTarget(fees = DEFAULT_FEES) {
  const roundTripFee = (fees.takerFee * 2); // buy + sell
  const slippage = fees.slippageBps / 10000;
  return roundTripFee + slippage;
}

/**
 * Ensure a trade signal has a reasonable profit target after fees.
 *
 * @param {Object} params
 * @param {number} params.entryPrice - Entry price
 * @param {number} params.targetPrice - Target price (e.g., take-profit)
 * @param {Object} [params.fees] - Fee configuration
 * @returns {{ viable: boolean, netProfit: number, reason: string }}
 */
export function checkFeeViability({ entryPrice, targetPrice, fees = DEFAULT_FEES }) {
  if (!entryPrice || !targetPrice) return { viable: false, netProfit: 0, reason: 'Missing price data' };

  const grossGain = (targetPrice - entryPrice) / entryPrice;
  const breakEven = calculateBreakEvenTarget(fees);
  const netProfit = grossGain - breakEven;

  return {
    viable: netProfit > 0,
    netProfit,
    reason: netProfit > 0
      ? `Net +${(netProfit * 100).toFixed(2)}% after fees`
      : `Not viable: gross ${(grossGain * 100).toFixed(2)}% < break-even ${(breakEven * 100).toFixed(2)}%`,
  };
}

// ── Portfolio Circuit Breaker ──────────────────────────────

/**
 * Check if portfolio-level drawdown exceeds the circuit breaker threshold.
 * When triggered, ALL bots should be paused.
 *
 * @param {Object} params
 * @param {number} params.startEquity - Starting equity (beginning of period)
 * @param {number} params.currentEquity - Current total equity
 * @param {number} [params.maxDrawdownPct=0.15] - Max drawdown before circuit breaker (15% default)
 * @returns {{ triggered: boolean, drawdownPct: number, reason: string }}
 */
export function checkCircuitBreaker({ startEquity, currentEquity, maxDrawdownPct = 0.15 }) {
  if (!startEquity || startEquity <= 0) return { triggered: false, drawdownPct: 0, reason: '' };

  const drawdownPct = (startEquity - currentEquity) / startEquity;

  return {
    triggered: drawdownPct >= maxDrawdownPct,
    drawdownPct,
    reason: drawdownPct >= maxDrawdownPct
      ? `🚨 Circuit breaker: ${(drawdownPct * 100).toFixed(1)}% drawdown exceeds ${(maxDrawdownPct * 100).toFixed(0)}% limit`
      : `Drawdown: ${(drawdownPct * 100).toFixed(1)}% / ${(maxDrawdownPct * 100).toFixed(0)}% limit`,
  };
}

// ── ATR-Based Dynamic Stops ────────────────────────────────

/**
 * Calculate ATR-based stop-loss and take-profit levels.
 * More adaptive than fixed percentage stops — adjusts to market volatility.
 *
 * @param {Object} params
 * @param {number} params.atr - Current ATR value
 * @param {number} params.price - Current price
 * @param {number} [params.stopMultiplier=2] - ATR multiplier for stop-loss
 * @param {number} [params.tpMultiplier=3] - ATR multiplier for take-profit
 * @returns {{ stopLoss: number, takeProfit: number, riskReward: number }}
 */
export function atrBasedLevels({ atr, price, stopMultiplier = 2, tpMultiplier = 3 }) {
  if (!atr || atr <= 0 || !price || price <= 0) {
    return { stopLoss: 0, takeProfit: 0, riskReward: 0 };
  }

  const stopLoss = price - (atr * stopMultiplier);
  const takeProfit = price + (atr * tpMultiplier);
  const riskReward = tpMultiplier / stopMultiplier;

  return { stopLoss, takeProfit, riskReward };
}

// ── Enhanced Position State ────────────────────────────────

/**
 * Create a new position state object with all risk management features.
 *
 * @param {Object} params
 * @param {number} params.entryPrice - Entry price
 * @param {number} params.quantity - Position quantity
 * @param {number} params.trailPct - Trailing stop percentage
 * @param {Array} [params.tpLevels] - Custom TP levels (defaults to DEFAULT_TP_LEVELS)
 * @returns {Object} Position state
 */
export function createPositionState({ entryPrice, quantity, trailPct, tpLevels = DEFAULT_TP_LEVELS }) {
  return {
    entryPrice,
    quantity,
    trailPct,
    trailingStop: entryPrice * (1 - trailPct),
    tpLevels,
    hitTpLevels: new Set(),
    highestPrice: entryPrice,
    createdAt: Date.now(),
  };
}

/**
 * Update position state with current price.
 * Handles trailing stop updates, TP level checking, and high-water mark.
 *
 * @param {Object} state - Current position state
 * @param {number} price - Current price
 * @param {number} holdings - Current holdings
 * @returns {{ state: Object, actions: Array }} Updated state and any actions to take
 */
export function updatePositionState(state, price, holdings) {
  const actions = [];
  const newState = { ...state };

  // Update high-water mark
  if (price > (state.highestPrice || 0)) {
    newState.highestPrice = price;
  }

  // Update trailing stop
  const trailResult = updateTrailingStop({
    price,
    currentTrail: state.trailingStop,
    trailPct: state.trailPct,
    inPosition: holdings > 0.0001,
  });
  newState.trailingStop = trailResult.trail;

  if (trailResult.triggered) {
    actions.push({
      type: 'trailing_stop_hit',
      sellAmount: holdings,
      reason: `Trailing stop hit at ${trailResult.trail.toFixed(2)}`,
    });
    return { state: newState, actions };
  }

  // Check take-profit levels
  const hitLevels = new Set(state.hitTpLevels || []);
  const tpResult = checkTakeProfitLevels({
    price,
    entryPrice: state.entryPrice,
    holdings,
    tpLevels: state.tpLevels || DEFAULT_TP_LEVELS,
    hitLevels,
  });

  if (tpResult.shouldSell) {
    hitLevels.add(tpResult.level.label);
    newState.hitTpLevels = hitLevels;
    actions.push({
      type: 'take_profit',
      sellAmount: tpResult.sellAmount,
      level: tpResult.level,
      reason: tpResult.reason,
    });
  }

  return { state: newState, actions };
}
