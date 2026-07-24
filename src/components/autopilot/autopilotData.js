import { TrendingUp, RefreshCw, Activity, Target, Shield, Crosshair, Grid3x3 } from 'lucide-react';

/* ─── Strategy presets ─── */
export const STRATEGIES = [
  {
    id: 'momentum',
    name: 'Momentum Rider',
    desc: 'Buy when price is climbing steadily, sell when it dips below trend line',
    icon: TrendingUp,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 62,
    avgReturn: '8\u201315%',
    timeframe: '4h',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    params: { lookback: 14, threshold: 2.5, stopLoss: 3, takeProfit: 6 },
  },
  {
    id: 'mean-revert',
    name: 'Mean Reversion',
    desc: 'Buy oversold dips, sell overbought rallies \u2014 profits from price returning to average',
    icon: RefreshCw,
    risk: 'Low',
    riskColor: 'text-green-400 bg-green-400/10',
    winRate: 71,
    avgReturn: '4\u20138%',
    timeframe: '1h',
    pairs: ['BTC/USDT', 'ETH/USDT'],
    params: { rsiPeriod: 14, oversold: 30, overbought: 70, stopLoss: 2, takeProfit: 4 },
  },
  {
    id: 'breakout',
    name: 'Breakout Hunter',
    desc: 'Detects price squeezing into a tight range, then rides the explosive breakout move',
    icon: Target,
    risk: 'High',
    riskColor: 'text-red-400 bg-red-400/10',
    winRate: 48,
    avgReturn: '15\u201330%',
    timeframe: '1d',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    params: { atrPeriod: 14, squeezeThreshold: 0.6, stopLoss: 5, takeProfit: 12 },
  },
  {
    id: 'scalper',
    name: 'Micro Scalper',
    desc: 'Takes many small trades from tiny price movements \u2014 high frequency, low risk per trade',
    icon: Activity,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 58,
    avgReturn: '2\u20135%',
    timeframe: '5m',
    pairs: ['BTC/USDT'],
    params: { emaFast: 5, emaSlow: 20, stopLoss: 0.5, takeProfit: 1.5 },
  },
  {
    id: 'sniper',
    name: 'Sniper Scalp',
    desc: 'Ultra-fast RSI+EMA confluence entry — catches oversold bounces at the 1m timeframe for rapid-fire wins',
    icon: Crosshair,
    risk: 'High',
    riskColor: 'text-red-400 bg-red-400/10',
    winRate: 55,
    avgReturn: '3\u20138%',
    timeframe: '1m',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    params: { rsiPeriod: 7, rsiOversold: 25, emaFast: 3, emaSlow: 12, stopLoss: 1.5, takeProfit: 3 },
  },
  {
    id: 'grid-surge',
    name: 'Grid Surge',
    desc: 'Volatility-adaptive grid that tightens in range-bound markets and widens during breakouts for maximum capture',
    icon: Grid3x3,
    risk: 'Medium',
    riskColor: 'text-yellow-400 bg-yellow-400/10',
    winRate: 64,
    avgReturn: '6\u201312%',
    timeframe: '15m',
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    params: { gridLevels: 8, atrPeriod: 14, rangeMultiplier: 1.2, breakoutMultiplier: 2.5, stopLoss: 3, takeProfit: 8 },
  },
];

/* ─── Risk profiles: auto-adjust SL/TP and position sizing ─── */
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

/* ─── Live trade generator (uses user-adjusted stopLoss/takeProfit) ─── */
export function generateTrade(strategy, prices, slOverride, tpOverride, riskMult, tradeAmount) {
  const pair = strategy.pairs[Math.floor(Math.random() * strategy.pairs.length)];
  const sym = pair.split('/')[0].toLowerCase();
  const price = prices?.[sym]?.price || (100 + Math.random() * 50000);
  const side = Math.random() > 0.45 ? 'BUY' : 'SELL';
  const budget = (tradeAmount || 100) * (0.3 + Math.random() * 0.7);
  const baseQty = budget / price;
  const qty = (baseQty * (riskMult || 1)).toFixed(4);
  const sl = slOverride ?? strategy.params.stopLoss;
  const tp = tpOverride ?? strategy.params.takeProfit;
  const raw = (Math.random() - 0.38) * price * parseFloat(qty) * 0.03;
  const capped = raw < 0
    ? -Math.min(Math.abs(raw), price * parseFloat(qty) * sl / 100)
    : Math.min(raw, price * parseFloat(qty) * tp / 100);
  return {
    id: Date.now() + Math.random(),
    time: new Date(),
    pair,
    side,
    price: price.toFixed(2),
    qty,
    pnl: capped.toFixed(2),
    status: Math.random() > 0.1 ? 'filled' : 'open',
    sl,
    tp,
  };
}
