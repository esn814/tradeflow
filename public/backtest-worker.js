// public/backtest-worker.js — Web Worker for CPU-intensive backtesting
// Keeps the main thread free during computation

self.onmessage = function (e) {
  const { data, strategy, slippageBps = 5, feeBps = 10 } = e.data;
  const slipMult = slippageBps / 10000;
  const feeRate = feeBps / 10000;
  let cash = 100000;
  let position = 0;
  const equity = [];
  const trades = [];
  const dailyReturns = [];
  let wins = 0;
  let totalTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let prevEquity = 100000;

  for (let i = 1; i < data.length; i++) {
    const d = data[i];
    const prev = data[i - 1];
    let signal = null;

    if (strategy === 'trend') {
      if (d.sma && prev.sma) {
        if (d.close > d.sma && prev.close <= prev.sma && position === 0) signal = 'buy';
        if (d.close < d.sma && prev.close >= prev.sma && position > 0) signal = 'sell';
      }
    } else if (strategy === 'meanReversion') {
      if (d.bb_lower && d.close < d.bb_lower && position === 0) signal = 'buy';
      if (d.bb_upper && d.close > d.bb_upper && position > 0) signal = 'sell';
    } else if (strategy === 'dca') {
      if (i % 5 === 0 && cash > 1000) {
        const buyAmt = Math.min(2000, cash);
        position += buyAmt / d.close;
        cash -= buyAmt;
        trades.push({ day: i, type: 'buy', price: d.close, size: buyAmt / d.close });
      }
      if (position > 0 && d.rsi && d.rsi > 75) {
        const sellAmt = position * 0.3;
        const proceeds = sellAmt * d.close;
        const entry = trades.length > 0 ? trades[trades.length - 1].price : d.close;
        const pnl = proceeds - (sellAmt * entry);
        if (pnl > 0) { wins++; grossProfit += pnl; } else { grossLoss += Math.abs(pnl); }
        totalTrades++;
        cash += proceeds;
        position -= sellAmt;
        trades.push({ day: i, type: 'sell', price: d.close, size: sellAmt });
      }
    } else {
      if (i % 10 === 0 && position === 0) signal = 'buy';
      if (i % 10 === 5 && position > 0) signal = 'sell';
    }

    if (signal === 'buy' && cash > 1000) {
      const buyAmt = cash * 0.5;
      const slipPrice = d.close * (1 + slipMult);
      const feeCost = buyAmt * feeRate;
      position = (buyAmt - feeCost) / slipPrice;
      cash -= buyAmt;
      trades.push({ day: i, type: 'buy', price: +slipPrice.toFixed(2), size: position });
    } else if (signal === 'sell' && position > 0) {
      const slipPrice = d.close * (1 - slipMult);
      const proceeds = position * slipPrice;
      const feeCost = proceeds * feeRate;
      const netProceeds = proceeds - feeCost;
      const entry = trades.length > 0 ? trades[trades.length - 1].price : d.close;
      const pnl = netProceeds - (position * entry);
      if (pnl > 0) { wins++; grossProfit += pnl; } else { grossLoss += Math.abs(pnl); }
      totalTrades++;
      cash += netProceeds;
      trades.push({ day: i, type: 'sell', price: +slipPrice.toFixed(2), size: position });
      position = 0;
    }

    const currentEquity = +(cash + position * d.close).toFixed(2);
    equity.push({ day: i, date: d.date, value: currentEquity });
    if (prevEquity > 0) {
      dailyReturns.push((currentEquity - prevEquity) / prevEquity);
    }
    prevEquity = currentEquity;
  }

  const finalVal = equity[equity.length - 1]?.value || 100000;
  const totalReturn = ((finalVal - 100000) / 100000 * 100);
  const maxDD = (() => {
    let peak = 0;
    return equity.reduce((max, e) => {
      if (e.value > peak) peak = e.value;
      const dd = (e.value - peak) / peak * 100;
      return Math.min(max, dd);
    }, 0);
  })();

  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const stdDev = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 0;
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  self.postMessage({
    equity,
    trades,
    totalReturn: +totalReturn.toFixed(2),
    maxDrawdown: +maxDD.toFixed(2),
    sharpe: +sharpe.toFixed(2),
    totalTrades,
    winRate: +winRate.toFixed(1),
    profitFactor: +profitFactor.toFixed(2),
    finalValue: +finalVal.toFixed(2),
  });
};
