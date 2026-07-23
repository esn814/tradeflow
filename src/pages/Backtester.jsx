import { useState, useEffect } from 'react';
import { BarChart3, Play, RotateCcw, Activity, Zap, Bot } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { CHART_GRID, CHART_AXIS_TICK, CHART_AXIS, CHART_TOOLTIP_STYLE } from '../data/chartTheme';
import { generateOHLCV, computeSMA, computeRSI, computeBollinger, STRATEGIES, calculateSortino, calculateCalmar } from '../data/marketData';
import { fetchCandles } from '../data/liveData';
import { Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader, Divider, EmptyState, LinkCard } from '../components/ui';

function runBacktest(data, strategy, { slippageBps = 5, feeBps = 10 } = {}) {
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

  // Compute monthly returns from equity curve
  const monthlyReturns = (() => {
    const months = {};
    equity.forEach(e => {
      const m = e.date?.slice(0, 7);
      if (m) {
        if (!months[m]) months[m] = { first: e.value, last: e.value, label: m };
        months[m].last = e.value;
      }
    });
    return Object.values(months).map(m => ({
      month: m.label,
      return: +((m.last - m.first) / m.first * 100).toFixed(2),
    }));
  })();

  const sortino = calculateSortino(dailyReturns);
  const calmar = calculateCalmar(totalReturn, Math.abs(maxDD), equity.length);

  return {
    equity,
    trades,
    monthlyReturns,
    stats: {
      totalReturn: +totalReturn.toFixed(2),
      finalValue: +finalVal.toFixed(2),
      totalTrades,
      winRate: totalTrades > 0 ? +(wins / totalTrades * 100).toFixed(1) : 0,
      maxDrawdown: +maxDD.toFixed(2),
      profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0,
      sharpe: +(totalReturn / (Math.abs(maxDD) || 1) * 0.8).toFixed(2),
      sortino,
      calmar,
      slippageBps,
      feeBps,
    },
  };
}

const selectClass = "w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors";

export default function Backtester({ onNavigate }) {
  const [strategy, setStrategy] = useState('trend');
  const [range, setRange] = useState('180');
  const [slippageBps, setSlippageBps] = useState(5);
  const [feeBps, setFeeBps] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const [data, setData] = useState([]);
  const [, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      let ohlcv = await fetchCandles('btc', '1d', +range);
      if (!ohlcv || !Array.isArray(ohlcv) || ohlcv.length === 0) {
        ohlcv = generateOHLCV(+range, 65000);
      }
      if (cancelled) return;
      const withSMA = computeSMA(ohlcv, 20);
      const withRSI = computeRSI(withSMA, 14);
      setData(computeBollinger(withRSI));
      setDataLoading(false);
    })();
    return () => { cancelled = true; };
  }, [range]);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const res = runBacktest(data, strategy, { slippageBps, feeBps });
      setResult(res);
      setRunning(false);
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader icon={BarChart3} title="Backtester" subtitle="Test strategies against real market data from Paxeer">
        <InfoTip text="Run backtests against real historical candle data from Paxeer to evaluate strategy performance before risking real capital." />
      </PageHeader>

      <Card>
        <CardBody>
          <SectionHeader icon={Play} title="Configuration" />
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Strategy</label>
              <select
                value={strategy}
                onChange={e => { setStrategy(e.target.value); setResult(null); }}
                className={selectClass}
              >
                {STRATEGIES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Period</label>
              <select
                value={range}
                onChange={e => { setRange(e.target.value); setResult(null); }}
                className={selectClass}
              >
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Initial Capital</label>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] font-medium">$100,000</div>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Slippage (bps)</label>
              <select
                value={slippageBps}
                onChange={e => { setSlippageBps(+e.target.value); setResult(null); }}
                className={selectClass}
              >
                <option value="0">0 (None)</option>
                <option value="1">1 (0.01%)</option>
                <option value="5">5 (0.05%)</option>
                <option value="10">10 (0.1%)</option>
                <option value="25">25 (0.25%)</option>
                <option value="50">50 (0.5%)</option>
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="text-xs text-[var(--color-text-secondary)] font-medium block mb-1.5">Fee (bps)</label>
              <select
                value={feeBps}
                onChange={e => { setFeeBps(+e.target.value); setResult(null); }}
                className={selectClass}
              >
                <option value="0">0 (Free)</option>
                <option value="5">5 (0.05%)</option>
                <option value="10">10 (0.1%)</option>
                <option value="15">15 (0.15%)</option>
                <option value="30">30 (0.3%)</option>
              </select>
            </div>
            <Btn variant="primary" size="md" onClick={handleRun} disabled={running}>
              {running ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Running...' : 'Run Backtest'}
            </Btn>
          </div>
        </CardBody>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
            {[
              { label: 'Total Return', value: `${result.stats.totalReturn}%`, color: result.stats.totalReturn >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]' },
              { label: 'Final Value', value: `${result.stats.finalValue.toLocaleString()}`, color: 'text-[var(--color-text-primary)]' },
              { label: 'Total Trades', value: result.stats.totalTrades, color: 'text-[var(--color-text-primary)]' },
              { label: 'Win Rate', value: `${result.stats.winRate}%`, color: result.stats.winRate >= 50 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]' },
              { label: 'Max Drawdown', value: `${result.stats.maxDrawdown}%`, color: 'text-[var(--color-danger-light)]' },
              { label: 'Profit Factor', value: result.stats.profitFactor, color: result.stats.profitFactor >= 1.5 ? 'text-[var(--color-profit)]' : 'text-[var(--color-warning)]' },
              { label: 'Sharpe Ratio', value: result.stats.sharpe, color: result.stats.sharpe >= 1 ? 'text-[var(--color-profit)]' : 'text-[var(--color-warning)]' },
              { label: 'Sortino Ratio', value: result.stats.sortino, color: result.stats.sortino >= 2 ? 'text-[var(--color-profit)]' : 'text-[var(--color-warning)]' },
              { label: 'Calmar Ratio', value: result.stats.calmar, color: result.stats.calmar >= 2 ? 'text-[var(--color-profit)]' : 'text-[var(--color-warning)]' },
            ].map(s => (
              <Stat key={s.label} label={s.label} value={s.value} color={s.color} />
            ))}
          </div>

          <Divider />

          <Card>
            <CardBody>
              <SectionHeader icon={BarChart3} title="Equity Curve" />
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={result.equity}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={result.stats.totalReturn >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={result.stats.totalReturn >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="day" tick={CHART_AXIS_TICK} {...CHART_AXIS} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => [`${v.toLocaleString()}`, 'Equity']} />
                  <Area type="monotone" dataKey="value" stroke={result.stats.totalReturn >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Divider />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <SectionHeader icon={Activity} title="Monthly Returns" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={result.monthlyReturns}>
                    <CartesianGrid {...CHART_GRID} />
                    <XAxis dataKey="month" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                    <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Return']} />
                    <Bar dataKey="return" radius={[3, 3, 0, 0]}>
                      {result.monthlyReturns.map((m, i) => <Cell key={i} fill={m.return >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <SectionHeader icon={Activity} title="Trade Log" badge="Last 10" />
                <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--color-surface-1)]">
                      <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
                        <th className="text-left py-2 pr-3">Day</th>
                        <th className="text-left py-2 pr-3">Type</th>
                        <th className="text-right py-2 pr-3">Price</th>
                        <th className="text-right py-2">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.slice(-10).reverse().map((t, i) => (
                        <tr key={i} className="border-b border-[var(--color-border-default)]/30">
                          <td className="py-2 pr-3 text-[var(--color-text-secondary)]">#{t.day}</td>
                          <td className="py-2 pr-3">
                            <Badge variant={t.type === 'buy' ? 'success' : 'danger'}>
                              {t.type.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2 pr-3 text-right text-[var(--color-text-primary)]">${t.price.toLocaleString()}</td>
                          <td className="py-2 text-right text-[var(--color-text-secondary)]">{t.size.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {!result && (
        <EmptyState
          icon={BarChart3}
          title="No Backtest Results"
          desc="Select a strategy and click 'Run Backtest' to see performance metrics, equity curve, and trade log."
          action={
            <Btn variant="primary" onClick={handleRun}>
              <Play className="w-4 h-4" /> Run Backtest
            </Btn>
          }
        />
      )}

      <Divider />
      <SectionHeader icon={Zap} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={Bot} title="Strategies" desc="Browse and configure 6 AI-powered trading strategies" color="var(--color-purple)" onClick={() => onNavigate('/strategies')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Zap} title="Autopilot" desc="Launch a live bot with your backtested strategy" color="var(--color-accent)" onClick={() => onNavigate('/autopilot')} />
        </div>
      </div>
    </div>
  );
}
