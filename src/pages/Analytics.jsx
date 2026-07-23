import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { CHART_GRID, CHART_AXIS_TICK, CHART_AXIS, CHART_TOOLTIP_STYLE } from '../data/chartTheme';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, Target, ArrowUpRight, ArrowDownRight, Clock, Award } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Stat, PageHeader } from '../components/ui';
import { useAppStore } from '../context/AppStore';
import {
  realizedPnL, unrealizedPnL, strategyBreakdown,
  equityCurve, maxDrawdown, sharpeRatio, tradeSummary,
} from '../utils/pnl';

/* ── Sample data for demo / empty states ── */
const SAMPLE_TRADES = [
  { id: 't1', botId: 'b1', pair: 'BTC/USDT', side: 'buy', entryPrice: 62800, exitPrice: 64200, price: 62800, size: 0.3, timestamp: '2025-01-05T10:00:00Z', closedAt: '2025-01-06T14:00:00Z', status: 'closed' },
  { id: 't2', botId: 'b1', pair: 'BTC/USDT', side: 'buy', entryPrice: 64100, exitPrice: 63500, price: 64100, size: 0.2, timestamp: '2025-01-08T09:00:00Z', closedAt: '2025-01-08T18:00:00Z', status: 'closed' },
  { id: 't3', botId: 'b2', pair: 'ETH/USDT', side: 'buy', entryPrice: 3100, exitPrice: 3350, price: 3100, size: 2.5, timestamp: '2025-01-10T08:00:00Z', closedAt: '2025-01-12T16:00:00Z', status: 'closed' },
  { id: 't4', botId: 'b2', pair: 'ETH/USDT', side: 'buy', entryPrice: 3320, exitPrice: 3280, price: 3320, size: 1.8, timestamp: '2025-01-14T11:00:00Z', closedAt: '2025-01-14T20:00:00Z', status: 'closed' },
  { id: 't5', botId: 'b3', pair: 'SOL/USDT', side: 'buy', entryPrice: 138, exitPrice: 152, price: 138, size: 25, timestamp: '2025-01-16T07:00:00Z', closedAt: '2025-01-18T15:00:00Z', status: 'closed' },
  { id: 't6', botId: 'b3', pair: 'SOL/USDT', side: 'sell', entryPrice: 155, exitPrice: 148, price: 155, size: 20, timestamp: '2025-01-20T09:00:00Z', closedAt: '2025-01-21T12:00:00Z', status: 'closed' },
  { id: 't7', botId: 'b1', pair: 'BTC/USDT', side: 'buy', entryPrice: 63800, exitPrice: 65100, price: 63800, size: 0.5, timestamp: '2025-01-22T06:00:00Z', closedAt: '2025-01-24T18:00:00Z', status: 'closed' },
  { id: 't8', botId: 'b2', pair: 'ETH/USDT', side: 'buy', entryPrice: 3250, exitPrice: 3400, price: 3250, size: 3.0, timestamp: '2025-01-25T08:00:00Z', closedAt: '2025-01-27T14:00:00Z', status: 'closed' },
  { id: 't9', botId: 'b4', pair: 'PAX/USDT', side: 'buy', entryPrice: 12.0, exitPrice: 13.5, price: 12.0, size: 400, timestamp: '2025-01-28T10:00:00Z', closedAt: '2025-01-30T16:00:00Z', status: 'closed' },
  { id: 't10', botId: 'b1', pair: 'BTC/USDT', side: 'buy', entryPrice: 65200, exitPrice: 64800, price: 65200, size: 0.15, timestamp: '2025-02-01T09:00:00Z', closedAt: '2025-02-01T22:00:00Z', status: 'closed' },
  { id: 't11', botId: 'b3', pair: 'SOL/USDT', side: 'buy', entryPrice: 145, exitPrice: 158, price: 145, size: 30, timestamp: '2025-02-03T07:00:00Z', closedAt: '2025-02-05T15:00:00Z', status: 'closed' },
  { id: 't12', botId: 'b2', pair: 'ETH/USDT', side: 'buy', entryPrice: 3380, exitPrice: 3290, price: 3380, size: 1.5, timestamp: '2025-02-06T11:00:00Z', closedAt: '2025-02-06T23:00:00Z', status: 'closed' },
];

const SAMPLE_POSITIONS = [
  { entryPrice: 64500, currentPrice: 65800, size: 0.8, side: 'buy', strategy: 'Trend Following' },
  { entryPrice: 3300, currentPrice: 3420, size: 5.0, side: 'buy', strategy: 'Smart DCA' },
  { entryPrice: 150, currentPrice: 156, size: 40, side: 'buy', strategy: 'Grid Trading' },
];

const SAMPLE_BOTS = [
  { id: 'b1', strategy: 'Trend Following' },
  { id: 'b2', strategy: 'Smart DCA' },
  { id: 'b3', strategy: 'Grid Trading' },
  { id: 'b4', strategy: 'Mean Reversion' },
];

const STRATEGY_COLORS = ['#00d4aa', '#627eea', '#f7931a', '#9945ff', '#ff4d6a', '#ffa502'];

export default function Analytics({ onNavigate: _onNavigate }) {
  const { tradeHistory = [], bots = [] } = useAppStore() || {};

  // Use store data if present, otherwise fall back to samples
  const trades = tradeHistory.length > 0 ? tradeHistory : SAMPLE_TRADES;
  const positions = tradeHistory.length > 0 ? SAMPLE_POSITIONS : SAMPLE_POSITIONS; // always sample for now
  const botList = bots.length > 0 ? bots : SAMPLE_BOTS;
  const isSample = tradeHistory.length === 0;

  // ── Computed analytics (filtered by period — unfiltered removed to avoid wasted computation) ──
  const unRealPnL = useMemo(() => unrealizedPnL(positions), [positions]);
  const strategies = useMemo(() => strategyBreakdown(trades, positions, botList), [trades, positions, botList]);
  const curve = useMemo(() => equityCurve(trades, 10000), [trades]);

  // ── Period filter ──
  const [period, setPeriod] = useState('all');

  const filteredTrades = useMemo(() => {
    if (period === 'all') return trades;
    const now = new Date();
    const cutoff = { '7d': 7, '30d': 30, '90d': 90 }[period] || 365;
    const cutoffDate = new Date(now.getTime() - cutoff * 86400000);
    return trades.filter(t => new Date(t.timestamp) >= cutoffDate);
  }, [trades, period]);

  const filteredSummary = useMemo(() => tradeSummary(filteredTrades), [filteredTrades]);
  const filteredRealPnL = useMemo(() => realizedPnL(filteredTrades), [filteredTrades]);
  const filteredCurve = useMemo(() => equityCurve(filteredTrades, 10000), [filteredTrades]);
  const filteredDD = useMemo(() => maxDrawdown(filteredCurve), [filteredCurve]);
  const filteredSR = useMemo(() => sharpeRatio(filteredCurve), [filteredCurve]);

  const chartData = filteredCurve.slice(-60);

  const periods = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Demo badge */}
      {isSample && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-warning-10)] border border-[var(--color-warning-25)]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-warning)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--color-warning)]">Demo Data</span>
          <span className="text-xs text-[var(--color-text-muted)]">Showing sample trades. Connect and trade to see your real analytics.</span>
        </div>
      )}

      <PageHeader icon={BarChart3} title="Analytics" subtitle="P&L breakdown, equity curve, and per-strategy performance">
        <div className="flex items-center gap-1">
          {periods.map(p => (
            <Btn key={p.key} variant={period === p.key ? 'primary' : 'ghost'} size="sm" onClick={() => setPeriod(p.key)}>
              {p.label}
            </Btn>
          ))}
        </div>
      </PageHeader>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Realized P&L" value={`${filteredRealPnL >= 0 ? '+' : ''}${filteredRealPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={DollarSign} up={filteredRealPnL >= 0} />
        <Stat label="Unrealized P&L" value={`${unRealPnL >= 0 ? '+' : ''}${unRealPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} icon={TrendingUp} up={unRealPnL >= 0} />
        <Stat label="Sharpe Ratio" value={filteredSR.toFixed(2)} icon={Activity} up={filteredSR > 1} />
        <Stat label="Max Drawdown" value={`${filteredDD.maxDrawdownPct}%`} icon={TrendingDown} up={false} />
      </div>

      {/* ── Equity Curve ── */}
      <Card>
        <CardBody>
          <SectionHeader icon={TrendingUp} title="Equity Curve" badge={`From $10,000`} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="date" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} domain={['auto', 'auto']} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={{ color: 'var(--color-text-chart-label)' }} formatter={v => `${v.toLocaleString()}`} />
                <Area type="monotone" dataKey="equity" stroke="var(--color-accent)" fill="url(#equityGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* ── Trade Summary Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Win Rate" value={`${filteredSummary.winRate}%`} icon={Target} up={filteredSummary.winRate > 50} />
        <Stat label="Profit Factor" value={filteredSummary.profitFactor === Infinity ? '∞' : filteredSummary.profitFactor.toFixed(2)} icon={Award} up={filteredSummary.profitFactor > 1} />
        <Stat label="Best Trade" value={`+${filteredSummary.bestTrade.toLocaleString()}`} icon={ArrowUpRight} up />
        <Stat label="Worst Trade" value={`-${Math.abs(filteredSummary.worstTrade).toLocaleString()}`} icon={ArrowDownRight} up={false} />
      </div>

      {/* ── Per-Strategy Breakdown ── */}
      <Card>
        <CardBody>
          <SectionHeader icon={Target} title="Strategy Breakdown" badge={`${strategies.length} strategies`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--color-text-muted)] text-xs border-b border-[var(--color-border-strong)]">
                  <th className="text-left py-2.5 pr-4 font-medium">Strategy</th>
                  <th className="text-right py-2.5 px-3 font-medium">Realized</th>
                  <th className="text-right py-2.5 px-3 font-medium">Unrealized</th>
                  <th className="text-right py-2.5 px-3 font-medium">Total</th>
                  <th className="text-right py-2.5 px-3 font-medium">Trades</th>
                  <th className="text-right py-2.5 px-3 font-medium">Win Rate</th>
                  <th className="text-right py-2.5 pl-3 font-medium">Avg Hold</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, i) => (
                  <tr key={s.strategy} className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: STRATEGY_COLORS[i % STRATEGY_COLORS.length] }} />
                        <span className="font-medium text-[var(--color-text-primary)]">{s.strategy}</span>
                      </div>
                    </td>
                    <td className={`text-right py-3 px-3 font-mono ${s.realized >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {s.realized >= 0 ? '+' : ''}{s.realized.toLocaleString()}
                    </td>
                    <td className={`text-right py-3 px-3 font-mono ${s.unrealized >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {s.unrealized >= 0 ? '+' : ''}{s.unrealized.toLocaleString()}
                    </td>
                    <td className={`text-right py-3 px-3 font-mono font-bold ${s.total >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {s.total >= 0 ? '+' : ''}{s.total.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-3 text-[var(--color-text-secondary)]">{s.closedCount}/{s.tradeCount}</td>
                    <td className="text-right py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.winRate >= 50 ? 'bg-[var(--color-success-15)] text-[var(--color-success)]' : 'bg-[var(--color-danger-15)] text-[var(--color-danger)]'}`}>
                        {s.winRate}%
                      </span>
                    </td>
                    <td className="text-right py-3 pl-3 text-[var(--color-text-muted)]">
                      <div className="flex items-center justify-end gap-1">
                        <Clock size={12} />
                        {s.avgHoldTime < 1 ? `${Math.round(s.avgHoldTime * 60)}m` : `${s.avgHoldTime.toFixed(1)}h`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* ── P&L Distribution Bar Chart ── */}
      <Card>
        <CardBody>
          <SectionHeader icon={BarChart3} title="P&L by Strategy" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategies.map(s => ({ name: s.strategy.length > 12 ? s.strategy.slice(0, 12) + '…' : s.strategy, pnl: s.total }))}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="name" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => `${v.toLocaleString()}`} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {strategies.map((s, _i) => (
                    <Cell key={s.strategy} fill={s.total >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* ── Detailed Trade Stats ── */}
      <Card>
        <CardBody>
          <SectionHeader icon={Activity} title="Trade Statistics" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Trades', value: filteredSummary.totalTrades },
              { label: 'Closed', value: filteredSummary.closedTrades },
              { label: 'Open', value: filteredSummary.openTrades },
              { label: 'Avg Win', value: `+${filteredSummary.avgWin.toLocaleString()}`, color: 'text-[var(--color-success)]' },
              { label: 'Avg Loss', value: `-${Math.abs(filteredSummary.avgLoss).toLocaleString()}`, color: 'text-[var(--color-danger)]' },
              { label: 'Net P&L', value: `${filteredSummary.totalPnL >= 0 ? '+' : ''}${filteredSummary.totalPnL.toLocaleString()}`, color: filteredSummary.totalPnL >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className={`text-lg font-bold ${item.color || 'text-[var(--color-text-primary)]'}`}>{item.value}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
