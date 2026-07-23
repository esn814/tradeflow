/**
 * P&L analytics utilities for TradeFlow.
 * Computes realized/unrealized P&L, per-strategy breakdown, equity curves,
 * max drawdown, and trade-level summaries from the store's tradeHistory + bots.
 */

/**
 * Compute P&L stats for a single trade record.
 * Trade shape: { id, botId, pair, side, price, size, entryPrice?, pnl?, timestamp, closedAt?, exitPrice? }
 */
export function computeTradePnL(trade) {
  if (trade.pnl != null) return trade.pnl; // pre-computed
  if (trade.exitPrice != null && trade.entryPrice != null) {
    const dir = trade.side === 'sell' ? -1 : 1;
    return dir * (trade.exitPrice - trade.entryPrice) * trade.size;
  }
  return 0;
}

/**
 * Realized P&L: sum of closed trades (those with exitPrice/closedAt or explicit pnl).
 */
export function realizedPnL(trades) {
  return trades
    .filter(t => t.closedAt || t.exitPrice != null || (t.pnl != null && t.status === 'closed'))
    .reduce((sum, t) => sum + computeTradePnL(t), 0);
}

/**
 * Unrealized P&L: open positions valued against current market price.
 * Needs positions array: [{ entryPrice, size, side, currentPrice }]
 */
export function unrealizedPnL(positions) {
  return positions.reduce((sum, p) => {
    const dir = p.side === 'sell' ? -1 : 1;
    return sum + dir * (p.currentPrice - p.entryPrice) * p.size;
  }, 0);
}

/**
 * Per-strategy P&L breakdown. Returns:
 * [{ strategy, realized, unrealized, total, tradeCount, winRate, avgHoldTime }]
 */
export function strategyBreakdown(trades, positions, bots) {
  const botMap = Object.fromEntries((bots || []).map(b => [b.id, b]));
  const strategyGroups = {};

  // Group trades by strategy (via bot -> strategy)
  for (const trade of trades) {
    const bot = botMap[trade.botId];
    const strategy = bot?.strategy || trade.strategy || 'Unknown';
    if (!strategyGroups[strategy]) {
      strategyGroups[strategy] = { trades: [], positions: [] };
    }
    strategyGroups[strategy].trades.push(trade);
  }

  // Group positions by strategy
  for (const pos of positions || []) {
    const strategy = pos.strategy || 'Unknown';
    if (!strategyGroups[strategy]) {
      strategyGroups[strategy] = { trades: [], positions: [] };
    }
    strategyGroups[strategy].positions.push(pos);
  }

  return Object.entries(strategyGroups).map(([strategy, { trades: strades, positions: spos }]) => {
    const closedTrades = strades.filter(t => t.closedAt || t.exitPrice != null || t.status === 'closed');
    const wins = closedTrades.filter(t => computeTradePnL(t) > 0).length;
    const totalPnl = closedTrades.reduce((s, t) => s + computeTradePnL(t), 0);
    const unrealized = spos.reduce((s, p) => {
      const dir = p.side === 'sell' ? -1 : 1;
      return s + dir * ((p.currentPrice || p.entryPrice) - p.entryPrice) * p.size;
    }, 0);

    // Average hold time in hours
    const holdTimes = closedTrades
      .filter(t => t.timestamp && t.closedAt)
      .map(t => (new Date(t.closedAt) - new Date(t.timestamp)) / 3600000);
    const avgHoldTime = holdTimes.length > 0
      ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
      : 0;

    return {
      strategy,
      realized: +totalPnl.toFixed(2),
      unrealized: +unrealized.toFixed(2),
      total: +(totalPnl + unrealized).toFixed(2),
      tradeCount: strades.length,
      closedCount: closedTrades.length,
      winRate: closedTrades.length > 0 ? +((wins / closedTrades.length) * 100).toFixed(1) : 0,
      avgHoldTime: +avgHoldTime.toFixed(1),
    };
  }).sort((a, b) => b.total - a.total);
}

/**
 * Build an equity curve from trades (sorted by timestamp).
 * Returns [{ date, equity }] — each point is cumulative P&L + startingBalance.
 */
export function equityCurve(trades, startingBalance = 10000) {
  const sorted = [...trades]
    .filter(t => t.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let running = startingBalance;
  const points = [{ date: 'Start', equity: startingBalance }];

  for (const trade of sorted) {
    running += computeTradePnL(trade);
    const date = typeof trade.timestamp === 'string'
      ? trade.timestamp.slice(5, 10) // MM-DD
      : new Date(trade.timestamp).toISOString().slice(5, 10);
    points.push({ date, equity: +running.toFixed(2) });
  }

  return points;
}

/**
 * Max drawdown from peak. Returns { maxDrawdown, maxDrawdownPct, peakDate, troughDate }.
 */
export function maxDrawdown(curve) {
  if (curve.length < 2) return { maxDrawdown: 0, maxDrawdownPct: 0, peakDate: '', troughDate: '' };

  let peak = curve[0].equity;
  let peakDate = curve[0].date;
  let maxDD = 0;
  let maxDDPct = 0;
  let ddPeakDate = '';
  let ddTroughDate = '';

  for (const point of curve) {
    if (point.equity > peak) {
      peak = point.equity;
      peakDate = point.date;
    }
    const dd = peak - point.equity;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (ddPct > maxDDPct) {
      maxDD = dd;
      maxDDPct = ddPct;
      ddPeakDate = peakDate;
      ddTroughDate = point.date;
    }
  }

  return {
    maxDrawdown: +maxDD.toFixed(2),
    maxDrawdownPct: +maxDDPct.toFixed(1),
    peakDate: ddPeakDate,
    troughDate: ddTroughDate,
  };
}

/**
 * Sharpe ratio approximation (annualized, assuming daily returns).
 */
export function sharpeRatio(curve, riskFreeRate = 0.05) {
  if (curve.length < 3) return 0;
  const returns = [];
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1].equity > 0) {
      returns.push((curve[i].equity - curve[i - 1].equity) / curve[i - 1].equity);
    }
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  const dailyRf = riskFreeRate / 365;
  return +(((mean - dailyRf) / stdDev) * Math.sqrt(365)).toFixed(2);
}

/**
 * Summary stats for a set of trades.
 */
export function tradeSummary(trades) {
  const all = trades || [];
  const closed = all.filter(t => t.closedAt || t.exitPrice != null || t.status === 'closed');
  const pnls = closed.map(computeTradePnL);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);

  return {
    totalTrades: all.length,
    closedTrades: closed.length,
    openTrades: all.length - closed.length,
    winRate: closed.length > 0 ? +((wins.length / closed.length) * 100).toFixed(1) : 0,
    totalPnL: +pnls.reduce((a, b) => a + b, 0).toFixed(2),
    avgWin: wins.length > 0 ? +(wins.reduce((a, b) => a + b, 0) / wins.length).toFixed(2) : 0,
    avgLoss: losses.length > 0 ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(2) : 0,
    bestTrade: pnls.length > 0 ? +Math.max(...pnls).toFixed(2) : 0,
    worstTrade: pnls.length > 0 ? +Math.min(...pnls).toFixed(2) : 0,
    profitFactor: losses.length > 0 && wins.length > 0
      ? +Math.abs(wins.reduce((a, b) => a + b, 0) / losses.reduce((a, b) => a + b, 0)).toFixed(2)
      : wins.length > 0 ? Infinity : 0,
  };
}
