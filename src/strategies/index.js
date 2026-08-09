/**
 * Unified Strategy Registry — the SINGLE source of truth for all trading strategies.
 *
 * Replaces:
 *   - engine/strategies.js STRATEGIES (engine-only, no UI metadata)
 *   - autopilot/autopilotData.js STRATEGIES (UI-only, no real logic)
 *   - data/marketData.js STRATEGIES (descriptions only, no execution)
 *
 * Each strategy has:
 *   - Real execution logic (from engine)
 *   - UI metadata (name, icon, risk, description, pairs)
 *   - Configurable params with defaults
 *   - Risk profile compatibility
 */

import {
  TrendingUp, RefreshCw, Activity, Target, Shield, Crosshair, Grid3x3,
  Zap, LineChart, BarChart2, Gauge
} from 'lucide-react';

// Re-export the real indicator library
export {
  computeEMA, computeEMASeries, computeMACD, computeRSI,
  computeBollinger, computeATR, computeStochastic, computeVWAP,
  computeADX, computeSMA
} from '../engine/indicators.js';

// Import all real strategy functions from the engine
import {
  dcaStrategy,
  gridStrategy,
  trendStrategy,
  momentumStrategy,
  meanReversionStrategy,
  scalperStrategy,
  smartDCAStrategy,
  trailingStopStrategy,
  breakoutStrategy,
  rsiBollingerStrategy,
} from '../engine/strategies.js';

// AI Confluence — server-side only, no client strategyFn needed
const aiConfluenceStrategy = null;

/**
 * Unified strategy definitions.
 * Each entry merges real execution logic with UI metadata.
 */
export const STRATEGY_REGISTRY = {
  dca: {
    id: 'dca',
    name: 'Dollar-Cost Average',
    shortName: 'DCA',
    icon: Shield,
    risk: 'Low',
    riskColor: 'text-green-400 bg-green-400/10',
    winRate: 68,
    avgReturn: '5-12%',
    timeframe: 'Any',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Any/Uptrend',
    aiValue: 'Moderate',
    description: 'Buy a fixed percentage of balance at regular intervals. Auto-rebalances when allocation drifts too far from target.',
    beginnerDesc: 'Like putting $50 in crypto every week no matter what. Over time, you buy more when prices are low and less when they\'re high — smoothing out the ride.',
    whenToUse: 'Long-term accumulation. Great for beginners or anyone who wants steady exposure without timing the market.',
    whenToAvoid: 'When you need quick returns or the market is in freefall with no recovery in sight.',
    marketFit: { trending: 'good', ranging: 'good', volatile: 'fair', calm: 'excellent' },
    strategyFn: dcaStrategy,
    defaultParams: { interval: 8, buyPct: 0.08, sellPct: 0.05 },
    uiParams: [
      { key: 'interval', label: 'Buy Interval (ticks)', default: 8, min: 2, max: 50 },
      { key: 'buyPct', label: 'Buy % of Balance', default: 8, min: 1, max: 25, unit: '%' },
      { key: 'sellPct', label: 'Sell % of Holdings', default: 5, min: 1, max: 20, unit: '%' },
    ],
    marketDataParams: [
      { key: 'baseAmount', label: 'Base Buy ($)', default: 50, min: 10, max: 5000 },
      { key: 'interval', label: 'Interval (hrs)', default: 24, min: 1, max: 168 },
      { key: 'dipMultiplier', label: 'Dip Multiplier', default: 2, min: 1, max: 5 },
    ],
  },

  grid: {
    id: 'grid',
    name: 'Grid Trading',
    shortName: 'Grid',
    icon: Grid3x3,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 62,
    avgReturn: '12-60%',
    timeframe: '15m',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Range-bound',
    aiValue: 'Moderate-High',
    description: 'Place buy and sell orders at fixed price intervals. Profits from price bouncing up and down within a range.',
    beginnerDesc: 'Imagine buying a coin every time it drops $100, and selling every time it rises $100. Grid trading profits from price bouncing, even when the overall direction isn\'t clear.',
    whenToUse: 'Range-bound markets where prices oscillate without a clear trend.',
    whenToAvoid: 'Strong trending markets — grid bots can get caught on the wrong side of a big move.',
    marketFit: { trending: 'poor', ranging: 'excellent', volatile: 'good', calm: 'good' },
    strategyFn: gridStrategy,
    defaultParams: { gridSpacing: 0.008, orderPct: 0.10, recenterInterval: 50 },
    uiParams: [
      { key: 'gridSpacing', label: 'Grid Spacing (%)', default: 0.8, min: 0.1, max: 5, unit: '%' },
      { key: 'orderPct', label: 'Order Size (%)', default: 10, min: 2, max: 30, unit: '%' },
      { key: 'recenterInterval', label: 'Recenter (ticks)', default: 50, min: 10, max: 200 },
    ],
    marketDataParams: [
      { key: 'gridRange', label: 'Grid Range (%)', default: 10, min: 1, max: 50 },
      { key: 'gridLevels', label: 'Grid Levels', default: 10, min: 3, max: 50 },
      { key: 'investmentPerLevel', label: '$ per Level', default: 100, min: 10, max: 10000 },
    ],
  },

  trend: {
    id: 'trend',
    name: 'Trend Following',
    shortName: 'Trend',
    icon: TrendingUp,
    risk: 'Medium-High',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 55,
    avgReturn: '15-40%',
    timeframe: '4h',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Strong trends',
    aiValue: 'Moderate',
    description: 'Follow momentum using EMA crossovers. Buys when short-term trend crosses above long-term, sells on the reverse.',
    beginnerDesc: 'Rides the wave. When a coin starts moving strongly upward, trend following jumps in and rides it — buying when prices go up, getting out before they fall.',
    whenToUse: 'Strong momentum markets with clear direction and volume.',
    whenToAvoid: 'Choppy, directionless markets — trend followers get whipsawed.',
    marketFit: { trending: 'excellent', ranging: 'poor', volatile: 'good', calm: 'fair' },
    strategyFn: trendStrategy,
    defaultParams: { shortWindow: 5, longWindow: 20, tradePct: 0.12 },
    uiParams: [
      { key: 'shortWindow', label: 'Fast MA Period', default: 5, min: 3, max: 20 },
      { key: 'longWindow', label: 'Slow MA Period', default: 20, min: 10, max: 100 },
      { key: 'tradePct', label: 'Trade Size (%)', default: 12, min: 3, max: 30, unit: '%' },
    ],
    marketDataParams: [
      { key: 'fastEMA', label: 'Fast EMA', default: 12, min: 5, max: 50 },
      { key: 'slowEMA', label: 'Slow EMA', default: 26, min: 20, max: 200 },
      { key: 'signalThreshold', label: 'Threshold', default: 0.02, min: 0.005, max: 0.1 },
    ],
  },

  momentum: {
    id: 'momentum',
    name: 'Momentum Rider',
    shortName: 'Momentum',
    icon: LineChart,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 60,
    avgReturn: '8-15%',
    timeframe: '4h',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Trending',
    aiValue: 'Moderate',
    description: 'Buy when recent returns are strong, sell when weak. Rides winners and cuts losers based on price momentum over a lookback window.',
    beginnerDesc: 'Buy when price is climbing steadily, sell when it dips below the trend line. Simple momentum-based approach.',
    whenToUse: 'Markets with clear directional momentum and sustained moves.',
    whenToAvoid: 'Sideways or mean-reverting markets where momentum signals are noisy.',
    marketFit: { trending: 'excellent', ranging: 'poor', volatile: 'good', calm: 'fair' },
    strategyFn: momentumStrategy,
    defaultParams: { lookback: 10, threshold: 0.03, tradePct: 0.15 },
    uiParams: [
      { key: 'lookback', label: 'Lookback Period', default: 10, min: 3, max: 50 },
      { key: 'threshold', label: 'Momentum Threshold (%)', default: 3, min: 1, max: 15, unit: '%' },
      { key: 'tradePct', label: 'Trade Size (%)', default: 15, min: 3, max: 30, unit: '%' },
    ],
  },

  meanReversion: {
    id: 'meanReversion',
    name: 'Mean Reversion',
    shortName: 'Mean Rev',
    icon: RefreshCw,
    risk: 'Low-Medium',
    riskColor: 'text-green-400 bg-green-400/10',
    winRate: 71,
    avgReturn: '4-8%',
    timeframe: '1h',
    pairs: ['BTC/USDT', 'ETH/USDT'],
    bestMarket: 'Range-bound',
    aiValue: 'High',
    description: 'Buy oversold dips, sell overbought rallies. Profits from price returning to its moving average.',
    beginnerDesc: 'What goes up must come down — and vice versa. Mean reversion bets that when a price moves too far from its average, it\'ll snap back.',
    whenToUse: 'Stable, range-bound markets where prices oscillate around a central value.',
    whenToAvoid: 'Strong trends or when a fundamental event breaks the old range.',
    marketFit: { trending: 'fair', ranging: 'excellent', volatile: 'good', calm: 'good' },
    strategyFn: meanReversionStrategy,
    defaultParams: { window: 15, deviation: 0.025, tradePct: 0.10 },
    uiParams: [
      { key: 'window', label: 'Lookback Window', default: 15, min: 5, max: 50 },
      { key: 'deviation', label: 'Deviation Threshold (%)', default: 2.5, min: 0.5, max: 10, unit: '%' },
      { key: 'tradePct', label: 'Trade Size (%)', default: 10, min: 3, max: 25, unit: '%' },
    ],
    marketDataParams: [
      { key: 'bbPeriod', label: 'BB Period', default: 20, min: 10, max: 50 },
      { key: 'bbStdDev', label: 'BB Std Dev', default: 2, min: 1, max: 3 },
      { key: 'zScoreThreshold', label: 'Z-Score', default: 2, min: 1, max: 3 },
    ],
  },

  scalper: {
    id: 'scalper',
    name: 'Micro Scalper',
    shortName: 'Scalper',
    icon: Activity,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 58,
    avgReturn: '2-5%',
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    bestMarket: 'Volatile',
    aiValue: 'Moderate',
    description: 'Fast EMA crossover + RSI + MACD confirmation. Takes many small trades for quick profits with tight risk management.',
    beginnerDesc: 'Takes many small trades from tiny price movements — high frequency, low risk per trade.',
    whenToUse: 'Liquid, volatile markets with tight spreads.',
    whenToAvoid: 'Low-liquidity or trending markets where scalps get stopped out.',
    marketFit: { trending: 'fair', ranging: 'excellent', volatile: 'good', calm: 'poor' },
    strategyFn: scalperStrategy,
    defaultParams: { fastEMA: 5, slowEMA: 13, rsiPeriod: 7, rsiBuy: 30, rsiSell: 70, tradePct: 0.05 },
    uiParams: [
      { key: 'fastEMA', label: 'Fast EMA', default: 5, min: 2, max: 15 },
      { key: 'slowEMA', label: 'Slow EMA', default: 13, min: 8, max: 30 },
      { key: 'rsiBuy', label: 'RSI Buy Level', default: 30, min: 15, max: 45 },
      { key: 'rsiSell', label: 'RSI Sell Level', default: 70, min: 55, max: 85 },
      { key: 'tradePct', label: 'Trade Size (%)', default: 5, min: 1, max: 15, unit: '%' },
    ],
  },

  smartDCA: {
    id: 'smartDCA',
    name: 'Smart DCA',
    shortName: 'Smart DCA',
    icon: Zap,
    risk: 'Low-Medium',
    riskColor: 'text-green-400 bg-green-400/10',
    winRate: 65,
    avgReturn: '8-30%',
    timeframe: 'Any',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Volatile uptrend',
    aiValue: 'Moderate',
    description: 'RSI-timed DCA that buys more aggressively on oversold dips and trims on overbought rallies. Combines the safety of DCA with the timing of technical analysis.',
    beginnerDesc: 'Like regular DCA but smarter — it buys more when prices are low (RSI oversold) and less when they\'re high. Perfect for steady accumulation with better timing.',
    whenToUse: 'When you want steady accumulation but with better entry timing than blind DCA.',
    whenToAvoid: 'When you need full control over exact entry points or in extremely low-volatility markets.',
    marketFit: { trending: 'good', ranging: 'good', volatile: 'excellent', calm: 'fair' },
    strategyFn: smartDCAStrategy,
    defaultParams: { interval: 6, baseBuyPct: 0.06, dipBuyPct: 0.12, rsiPeriod: 14, rsiDip: 35, sellPct: 0.05 },
    uiParams: [
      { key: 'interval', label: 'Buy Interval (ticks)', default: 6, min: 2, max: 50 },
      { key: 'baseBuyPct', label: 'Base Buy %', default: 6, min: 1, max: 20, unit: '%' },
      { key: 'dipBuyPct', label: 'Dip Buy %', default: 12, min: 3, max: 30, unit: '%' },
      { key: 'rsiDip', label: 'RSI Dip Level', default: 35, min: 15, max: 45 },
    ],
  },

  trailingStop: {
    id: 'trailingStop',
    name: 'Trailing Stop',
    shortName: 'Trail Stop',
    icon: Target,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 52,
    avgReturn: '15-30%',
    timeframe: '4h',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Trending',
    aiValue: 'Moderate',
    description: 'EMA crossover for entry with a trailing stop-loss that rises with price to lock in profits. Cuts losses quickly, lets winners run.',
    beginnerDesc: 'Detects price squeezing into a tight range, then rides the explosive breakout move with a safety net that moves up with price.',
    whenToUse: 'Trending markets where you want to ride the move but protect against reversals.',
    whenToAvoid: 'Choppy markets — frequent EMA crossovers cause whipsaws.',
    marketFit: { trending: 'excellent', ranging: 'poor', volatile: 'good', calm: 'fair' },
    strategyFn: trailingStopStrategy,
    defaultParams: { fastEMA: 8, slowEMA: 21, trailPct: 0.025, tradePct: 0.15 },
    uiParams: [
      { key: 'fastEMA', label: 'Fast EMA', default: 8, min: 3, max: 20 },
      { key: 'slowEMA', label: 'Slow EMA', default: 21, min: 10, max: 50 },
      { key: 'trailPct', label: 'Trail Distance (%)', default: 2.5, min: 0.5, max: 10, unit: '%' },
      { key: 'tradePct', label: 'Trade Size (%)', default: 15, min: 3, max: 30, unit: '%' },
    ],
  },

  breakout: {
    id: 'breakout',
    name: 'Breakout Hunter',
    shortName: 'Breakout',
    icon: Crosshair,
    risk: 'High',
    riskColor: 'text-red-400 bg-red-400/10',
    winRate: 48,
    avgReturn: '15-30%',
    timeframe: '1d',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Consolidation',
    aiValue: 'Moderate',
    description: 'Detects price breaking ATR-based resistance/support bands for volatility expansion trades. Big wins on breakouts, small losses on false signals.',
    beginnerDesc: 'Detects price squeezing into a tight range, then rides the explosive breakout move. High risk, high reward.',
    whenToUse: 'After periods of consolidation when volatility is about to expand.',
    whenToAvoid: 'Already-volatile markets — false breakouts are expensive.',
    marketFit: { trending: 'good', ranging: 'good', volatile: 'excellent', calm: 'poor' },
    strategyFn: breakoutStrategy,
    defaultParams: { atrPeriod: 14, atrMultiplier: 1.5, lookback: 20, tradePct: 0.18 },
    uiParams: [
      { key: 'atrPeriod', label: 'ATR Period', default: 14, min: 5, max: 30 },
      { key: 'atrMultiplier', label: 'ATR Multiplier', default: 1.5, min: 0.5, max: 4 },
      { key: 'lookback', label: 'Lookback Window', default: 20, min: 10, max: 50 },
      { key: 'tradePct', label: 'Trade Size (%)', default: 18, min: 3, max: 30, unit: '%' },
    ],
  },

  rsiBollinger: {
    id: 'rsiBollinger',
    name: 'RSI Bollinger',
    shortName: 'RSI+BB',
    icon: BarChart2,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 64,
    avgReturn: '6-12%',
    timeframe: '15m',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    bestMarket: 'Range-bound',
    aiValue: 'High',
    description: 'Combines RSI oversold/overbought with Bollinger Band extremes for high-probability mean-reversion entries. Dual confirmation reduces false signals.',
    beginnerDesc: 'Uses two indicators together — RSI and Bollinger Bands — to find the best times to buy dips and sell rallies. Higher accuracy from double confirmation.',
    whenToUse: 'Range-bound markets with clear support/resistance levels.',
    whenToAvoid: 'Strong trending markets where mean-reversion signals fail.',
    marketFit: { trending: 'fair', ranging: 'excellent', volatile: 'good', calm: 'good' },
    strategyFn: rsiBollingerStrategy,
    defaultParams: { rsiPeriod: 14, bbPeriod: 20, rsiBuy: 25, rsiSell: 75, tradePct: 0.15 },
    uiParams: [
      { key: 'rsiPeriod', label: 'RSI Period', default: 14, min: 5, max: 30 },
      { key: 'bbPeriod', label: 'BB Period', default: 20, min: 10, max: 50 },
      { key: 'rsiBuy', label: 'RSI Buy Level', default: 25, min: 10, max: 40 },
      { key: 'rsiSell', label: 'RSI Sell Level', default: 75, min: 60, max: 90 },
      { key: 'tradePct', label: 'Trade Size (%)', default: 15, min: 3, max: 30, unit: '%' },
    ],
  },
  aiConfluence: {
    id: 'aiConfluence',
    name: 'AI Confluence',
    shortName: 'AI Conf',
    icon: Zap,
    risk: 'Medium-High',
    riskColor: 'text-orange-400 bg-orange-400/10',
    winRate: 72,
    avgReturn: '10-25%',
    timeframe: '1h+',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'],
    bestMarket: 'Trending/Volatile',
    aiValue: 'Very High',
    description: 'Multi-indicator confluence scoring using 8 technical indicators (RSI, MACD, Bollinger, EMA Cross, Stochastic, ADX, Volume, Regime). Server-side signal engine analyzes all indicators and only trades when confidence exceeds threshold.',
    beginnerDesc: 'The smartest strategy — it uses 8 different indicators together and only trades when they all agree. Runs on the server for maximum speed and accuracy.',
    whenToUse: 'All market conditions — adapts via regime detection (trending/ranging/volatile).',
    whenToAvoid: 'Extremely low-volatility sideways markets with no clear signals.',
    marketFit: { trending: 'excellent', ranging: 'good', volatile: 'excellent', calm: 'fair' },
    strategyFn: aiConfluenceStrategy,
    defaultParams: { confidence: 60, positionSize: 10, stopLoss: 5, takeProfit: 10 },
    uiParams: [
      { key: 'confidence', label: 'Min Confidence (%)', default: 60, min: 40, max: 90, step: 5 },
      { key: 'positionSize', label: 'Position Size (%)', default: 10, min: 1, max: 50, step: 1 },
      { key: 'stopLoss', label: 'Stop Loss (%)', default: 5, min: 1, max: 20, step: 0.5 },
      { key: 'takeProfit', label: 'Take Profit (%)', default: 10, min: 2, max: 50, step: 1 },
    ],
  },
};

// ─── Convenience exports ───

/** Array of all strategies (for iterating in UI) */
export const ALL_STRATEGIES = Object.values(STRATEGY_REGISTRY);

/** Map of strategy ID → strategyFn (for the engine) */
export const STRATEGY_FUNCTIONS = Object.fromEntries(
  Object.entries(STRATEGY_REGISTRY).map(([id, s]) => [id, s.strategyFn])
);

/** Map of strategy ID → defaultParams (for the engine) */
export const DEFAULT_PARAMS = Object.fromEntries(
  Object.entries(STRATEGY_REGISTRY).map(([id, s]) => [id, s.defaultParams])
);

/** Get a strategy by ID */
export function getStrategy(id) {
  return STRATEGY_REGISTRY[id] || null;
}

/** Get strategy function by ID */
export function getStrategyFn(id) {
  return STRATEGY_REGISTRY[id]?.strategyFn || null;
}

/** Get strategies filtered by risk level */
export function getStrategiesByRisk(risk) {
  return ALL_STRATEGIES.filter(s => s.risk.toLowerCase().includes(risk.toLowerCase()));
}

/** Get strategies that fit a market condition */
export function getStrategiesForMarket(condition) {
  return ALL_STRATEGIES.filter(s => s.marketFit[condition] === 'excellent' || s.marketFit[condition] === 'good');
}

/**
 * Risk profiles for the Autopilot UI.
 * These adjust position sizing and stop/take-profit levels.
 */
export const RISK_PROFILES = [
  {
    id: 'conservative',
    name: 'Conservative',
    label: 'Low Risk',
    icon: Shield,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30',
    activeBorder: 'border-green-400',
    activeBg: 'bg-green-400/10',
    desc: 'Tight stop-loss, modest targets. Protects capital first.',
    slMultiplier: 0.7,
    tpMultiplier: 0.8,
    sizeMultiplier: 0.5,
    winRateBonus: 8,
  },
  {
    id: 'moderate',
    name: 'Moderate',
    label: 'Balanced',
    icon: Activity,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    activeBorder: 'border-yellow-400',
    activeBg: 'bg-yellow-400/10',
    desc: 'Default strategy settings. Balanced risk and reward.',
    slMultiplier: 1.0,
    tpMultiplier: 1.0,
    sizeMultiplier: 1.0,
    winRateBonus: 0,
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    label: 'High Risk',
    icon: TrendingUp,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
    activeBorder: 'border-red-400',
    activeBg: 'bg-red-400/10',
    desc: 'Wider stops, bigger targets. Amplifies gains AND losses.',
    slMultiplier: 2.0,
    tpMultiplier: 2.5,
    sizeMultiplier: 2.0,
    winRateBonus: -10,
  },
];

/**
 * Convert UI param values to engine param values.
 * UI shows percentages as whole numbers (e.g., 8%), engine expects decimals (0.08).
 */
export function uiParamsToEngineParams(strategyId, uiValues) {
  const strategy = STRATEGY_REGISTRY[strategyId];
  if (!strategy) return {};

  const engineParams = {};
  for (const paramDef of strategy.uiParams) {
    const rawValue = uiValues[paramDef.key] ?? paramDef.default;
    if (paramDef.unit === '%') {
      engineParams[paramDef.key] = rawValue / 100;
    } else {
      engineParams[paramDef.key] = rawValue;
    }
  }
  return engineParams;
}

// ─── STRATEGY_META: Array format for Autopilot UI ───
// Maps unified registry to the shape the Autopilot page expects
export const STRATEGY_META = ALL_STRATEGIES.map(s => ({
  id: s.id,
  name: s.name,
  shortName: s.shortName,
  desc: s.description,
  beginnerDesc: s.beginnerDesc,
  whenToUse: s.whenToUse,
  whenToAvoid: s.whenToAvoid,
  icon: s.icon,
  risk: s.risk,
  riskColor: s.riskColor,
  winRate: s.winRate,
  avgReturn: s.avgReturn,
  timeframe: s.timeframe,
  pairs: s.pairs,
  marketFit: s.marketFit,
  // RiskSelector uses strategy.params.stopLoss / takeProfit
  params: {
    stopLoss: s.defaultParams.stopLoss || (s.id === 'scalper' ? 0.5 : s.id === 'breakout' ? 5 : 3),
    takeProfit: s.defaultParams.takeProfit || (s.id === 'scalper' ? 1.5 : s.id === 'breakout' ? 12 : 6),
  },
  riskDefaults: {
    stopLoss: s.defaultParams.stopLoss || (s.id === 'scalper' ? 0.5 : s.id === 'breakout' ? 5 : 3),
    takeProfit: s.defaultParams.takeProfit || (s.id === 'scalper' ? 1.5 : s.id === 'breakout' ? 12 : 6),
  },
  defaultParams: s.defaultParams,
  uiParams: s.uiParams,
}));

// ─── Autopilot ID → Engine Strategy ID mapping ───
const AUTOPILOT_TO_ENGINE_MAP = {
  dca: 'dca',
  grid: 'grid',
  trend: 'trend',
  momentum: 'momentum',
  'mean-revert': 'meanReversion',
  meanReversion: 'meanReversion',
  scalper: 'scalper',
  sniper: 'scalper',          // Sniper maps to scalper logic
  smartDCA: 'smartDCA',
  trailingStop: 'trailingStop',
  breakout: 'breakout',
  'grid-surge': 'grid',       // Grid Surge maps to grid logic
  rsiBollinger: 'rsiBollinger',
};

/**
 * Map an autopilot strategy ID to an engine strategy ID.
 * Returns the engine strategy key, display name, and default params.
 */
export function mapAutopilotToEngine(autopilotId) {
  const engineId = AUTOPILOT_TO_ENGINE_MAP[autopilotId] || autopilotId;
  const strategy = STRATEGY_REGISTRY[engineId];

  if (!strategy) {
    // Fallback to momentum if unknown
    const fallback = STRATEGY_REGISTRY.momentum;
    return {
      engineStrategy: 'momentum',
      name: fallback.name,
      params: { ...fallback.defaultParams },
    };
  }

  return {
    engineStrategy: engineId,
    name: strategy.name,
    params: { ...strategy.defaultParams },
  };
}
