// Simulated market data generators and trading utilities

export function generateOHLCV(days = 90, basePrice = 65000) {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    const vol = 0.02 + Math.random() * 0.04;
    const change = (Math.random() - 0.48) * vol;
    const open = price;
    price = open * (1 + change);
    const high = Math.max(open, price) * (1 + Math.random() * 0.015);
    const low = Math.min(open, price) * (1 - Math.random() * 0.015);
    const volume = 500 + Math.random() * 2000;
    data.push({
      date: date.toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +price.toFixed(2),
      volume: +volume.toFixed(0),
    });
  }
  return data;
}

export function computeSMA(data, period) {
  return data.map((d, i) => {
    if (i < period - 1) return { ...d, sma: null };
    const slice = data.slice(i - period + 1, i + 1);
    return { ...d, sma: +(slice.reduce((s, v) => s + v.close, 0) / period).toFixed(2) };
  });
}

export function computeRSI(data, period = 14) {
  return data.map((d, i) => {
    if (i < period) return { ...d, rsi: null };
    const slice = data.slice(i - period, i);
    let gains = 0, losses = 0;
    for (let j = 1; j < slice.length; j++) {
      const diff = slice[j].close - slice[j - 1].close;
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    return { ...d, rsi: +(100 - 100 / (1 + rs)).toFixed(1) };
  });
}

export function computeBollinger(data, period = 20, mult = 2) {
  return data.map((d, i) => {
    if (i < period - 1) return { ...d, bb_mid: null, bb_upper: null, bb_lower: null };
    const slice = data.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, v) => s + v.close, 0) / period;
    const std = Math.sqrt(slice.reduce((s, v) => s + (v.close - mean) ** 2, 0) / period);
    return {
      ...d,
      bb_mid: +mean.toFixed(2),
      bb_upper: +(mean + mult * std).toFixed(2),
      bb_lower: +(mean - mult * std).toFixed(2),
    };
  });
}

// STRATEGIES removed — use ALL_STRATEGIES from strategies/index.js instead

export const RISK_METRICS = {
  sharpe: { name: 'Sharpe Ratio', good: '> 1.5', desc: 'Risk-adjusted return above risk-free rate' },
  sortino: { name: 'Sortino Ratio', good: '> 2.0', desc: 'Downside risk-adjusted return' },
  maxDrawdown: { name: 'Max Drawdown', good: '< 15%', desc: 'Largest peak-to-trough decline' },
  winRate: { name: 'Win Rate', good: '> 55%', desc: 'Percentage of profitable trades' },
  profitFactor: { name: 'Profit Factor', good: '> 1.5', desc: 'Gross profit / gross loss' },
  calmar: { name: 'Calmar Ratio', good: '> 2.0', desc: 'Annual return / max drawdown' },
};

export function calculatePositionSize(capital, riskPct, entry, stopLoss) {
  const riskAmt = capital * (riskPct / 100);
  const dist = Math.abs(entry - stopLoss);
  return dist === 0 ? 0 : +(riskAmt / dist).toFixed(6);
}

export function calculateKelly(winRate, avgWin, avgLoss) {
  if (avgLoss === 0) return 0;
  const b = avgWin / avgLoss;
  return +Math.max(0, Math.min((winRate * b - (1 - winRate)) / b, 0.25)).toFixed(4);
}

export function calculateATR(data, period = 14) {
  if (data.length < period + 1) return 0;
  let atr = 0;
  for (let i = 1; i <= period; i++) {
    const tr = Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i-1].close), Math.abs(data[i].low - data[i-1].close));
    atr += tr;
  }
  return +(atr / period).toFixed(2);
}

export function calculateSortino(returns, riskFreeRate = 0) {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const downside = returns.filter(r => r < riskFreeRate);
  if (downside.length === 0) return mean > 0 ? 999 : 0;
  const downDev = Math.sqrt(downside.reduce((s, r) => s + (r - riskFreeRate) ** 2, 0) / downside.length);
  return downDev === 0 ? 0 : +((mean - riskFreeRate) / downDev).toFixed(2);
}

export function calculateCalmar(totalReturnPct, maxDrawdownPct, periodDays = 365) {
  if (maxDrawdownPct === 0) return totalReturnPct > 0 ? 999 : 0;
  const annualizedReturn = totalReturnPct * (365 / periodDays);
  return +(annualizedReturn / Math.abs(maxDrawdownPct)).toFixed(2);
}

export const PORTFOLIO = {
  conservative: [
    { name: 'Bitcoin', pct: 60, color: '#f7931a' },
    { name: 'Ethereum', pct: 25, color: '#627eea' },
    { name: 'AI Tokens', pct: 10, color: '#00d4aa' },
    { name: 'Stablecoins', pct: 5, color: '#26a17b' },
  ],
  balanced: [
    { name: 'Bitcoin', pct: 40, color: '#f7931a' },
    { name: 'Ethereum', pct: 30, color: '#627eea' },
    { name: 'AI Tokens', pct: 20, color: '#00d4aa' },
    { name: 'Stablecoins', pct: 10, color: '#26a17b' },
  ],
  growth: [
    { name: 'Bitcoin', pct: 30, color: '#f7931a' },
    { name: 'Ethereum', pct: 30, color: '#627eea' },
    { name: 'AI Tokens', pct: 30, color: '#00d4aa' },
    { name: 'Stablecoins', pct: 10, color: '#26a17b' },
  ],
};
