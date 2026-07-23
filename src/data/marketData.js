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

export const STRATEGIES = [
  {
    id: 'grid', name: 'Grid Trading', risk: 'Medium', returnRange: '12-60% annual',
    bestMarket: 'Range-bound', aiValue: 'Moderate-High',
    description: 'Places buy and sell orders at fixed intervals within a price range. AI dynamically adjusts grid range and spacing based on volatility.',
    beginnerDesc: 'Imagine buying a coin every time it drops $100, and selling every time it rises $100. That\'s grid trading — it profits from price bouncing up and down, even when the overall direction isn\'t clear.',
    whenToUse: 'When prices are moving sideways — not clearly going up or down. Grid bots love choppy markets.',
    whenToAvoid: 'When the market is in a strong trend (big moves up or down). Grid bots can get caught on the wrong side.',
    marketFit: { trending: 'poor', ranging: 'excellent', volatile: 'good', calm: 'good' },
    params: [
      { key: 'gridRange', label: 'Grid Range (%)', default: 10, min: 1, max: 50 },
      { key: 'gridLevels', label: 'Grid Levels', default: 10, min: 3, max: 50 },
      { key: 'investmentPerLevel', label: '$ per Level', default: 100, min: 10, max: 10000 },
    ],
  },
  {
    id: 'dca', name: 'Smart DCA', risk: 'Low-Medium', returnRange: '8-30% annual',
    bestMarket: 'Volatile uptrend', aiValue: 'Moderate',
    description: 'Dollar-cost averaging with AI timing. Increases buys during dips, reduces during euphoria using RSI and sentiment signals.',
    beginnerDesc: 'Instead of investing all your money at once, you buy a little bit on a regular schedule — like $50 every week. The "smart" part means it buys more when prices are low and less when they\'re high.',
    whenToUse: 'When you want steady, low-stress investing. Perfect for beginners and for building a position over time.',
    whenToAvoid: 'When you need quick returns or the market is crashing hard with no signs of recovery.',
    marketFit: { trending: 'good', ranging: 'fair', volatile: 'excellent', calm: 'fair' },
    params: [
      { key: 'baseAmount', label: 'Base Buy ($)', default: 50, min: 10, max: 5000 },
      { key: 'interval', label: 'Interval (hrs)', default: 24, min: 1, max: 168 },
      { key: 'dipMultiplier', label: 'Dip Multiplier', default: 2, min: 1, max: 5 },
    ],
  },
  {
    id: 'trend', name: 'Trend Following', risk: 'Medium-High', returnRange: '15-40% annual',
    bestMarket: 'Strong trends', aiValue: 'Moderate',
    description: 'Identifies momentum using EMA crossovers, MACD, and breakouts. AI filters false breakouts using volume/order-flow classifiers.',
    beginnerDesc: 'This strategy tries to ride the wave. When a coin starts moving strongly in one direction, trend following jumps in and rides it — buying when prices are going up, and getting out before they fall.',
    whenToUse: 'When the market has clear momentum — big moves with strong volume. Think BTC breaking a new all-time high.',
    whenToAvoid: 'When the market is choppy and directionless. Trend followers get chopped up in sideways markets.',
    marketFit: { trending: 'excellent', ranging: 'poor', volatile: 'good', calm: 'fair' },
    params: [
      { key: 'fastEMA', label: 'Fast EMA', default: 12, min: 5, max: 50 },
      { key: 'slowEMA', label: 'Slow EMA', default: 26, min: 20, max: 200 },
      { key: 'signalThreshold', label: 'Threshold', default: 0.02, min: 0.005, max: 0.1 },
    ],
  },
  {
    id: 'meanReversion', name: 'Mean Reversion', risk: 'Medium', returnRange: '10-25% annual',
    bestMarket: 'Range-bound', aiValue: 'High',
    description: 'Trades statistical deviations using Bollinger Bands and z-scores. ML detects regime changes to pause during structural breaks.',
    beginnerDesc: 'What goes up must come down — and vice versa. Mean reversion bets that when a price moves too far from its average, it\'ll snap back. It buys dips and sells rallies.',
    whenToUse: 'In stable, range-bound markets where prices oscillate around a central value.',
    whenToAvoid: 'During strong trends or when a fundamental event breaks the old range (e.g., a major protocol hack).',
    marketFit: { trending: 'fair', ranging: 'excellent', volatile: 'good', calm: 'good' },
    params: [
      { key: 'bbPeriod', label: 'BB Period', default: 20, min: 10, max: 50 },
      { key: 'bbStdDev', label: 'BB Std Dev', default: 2, min: 1, max: 3 },
      { key: 'zScoreThreshold', label: 'Z-Score', default: 2, min: 1, max: 3 },
    ],
  },
  {
    id: 'sentiment', name: 'Sentiment Trading', risk: 'High', returnRange: '20-60% annual',
    bestMarket: 'News-driven', aiValue: 'Essential',
    description: 'NLP models analyze social media, news, and Fear & Greed. LLMs classify sentiment and generate contrarian signals.',
    beginnerDesc: 'This one reads the room. It scans Twitter, news headlines, and market sentiment to figure out how people are feeling — then does the opposite when everyone is too scared or too greedy.',
    whenToUse: 'Around major events, news, or when sentiment is at extremes (very high fear or greed).',
    whenToAvoid: 'In quiet markets with no news flow. Sentiment signals are noisy when nothing is happening.',
    marketFit: { trending: 'good', ranging: 'fair', volatile: 'excellent', calm: 'poor' },
    params: [
      { key: 'sentimentThreshold', label: 'Threshold', default: 0.6, min: 0.1, max: 0.9 },
      { key: 'lookbackHours', label: 'Lookback (hrs)', default: 24, min: 1, max: 168 },
      { key: 'contrarianWeight', label: 'Contrarian Wt', default: 0.3, min: 0, max: 1 },
    ],
  },
  {
    id: 'arbitrage', name: 'Cross-Exchange Arb', risk: 'Medium-Low', returnRange: '0.1-2% per trade',
    bestMarket: 'Fragmented liquidity', aiValue: 'High',
    description: 'Exploits price discrepancies across exchanges. AI predicts which gaps persist and optimizes routing across DEXs/bridges.',
    beginnerDesc: 'Buy BTC for $64,000 on one exchange, sell it for $64,200 on another. Arbitrage finds these tiny price differences and makes quick, low-risk trades to capture the gap.',
    whenToUse: 'When there\'s big volume but prices differ across exchanges — usually during high volatility or in fragmented markets.',
    whenToAvoid: 'When spreads are too thin to cover gas/transfer fees, or during network congestion.',
    marketFit: { trending: 'fair', ranging: 'good', volatile: 'excellent', calm: 'poor' },
    params: [
      { key: 'minSpread', label: 'Min Spread (%)', default: 0.3, min: 0.05, max: 2 },
      { key: 'maxLatency', label: 'Max Latency (ms)', default: 500, min: 50, max: 5000 },
      { key: 'feeBuffer', label: 'Fee Buffer (%)', default: 0.1, min: 0.01, max: 0.5 },
    ],
  },
];

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
