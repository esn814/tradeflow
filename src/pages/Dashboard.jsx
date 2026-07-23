import { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, Zap, LayoutDashboard, BarChart3, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { generateOHLCV, computeSMA } from '../data/marketData';
import { useLiveStream, fetchCandles } from '../data/liveData';
import { CHART_GRID, CHART_AXIS_TICK, CHART_AXIS, CHART_TOOLTIP_STYLE } from '../data/chartTheme';
import ExportPortfolio from '../components/ExportPortfolio';
import MarketPulse from '../components/MarketPulse';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, SectionHeader, Btn, Badge, PageHeader, Divider, LinkCard } from '../components/ui';
import { useMode, useAppStore } from '../context/AppStore';
import { useWalletPortfolio } from '../data/portfolio';

// Default positions with fallback prices
const DEFAULT_POSITIONS = [
  { pair: 'BTC/USDT', strategy: 'Trend Following', entry: 63200, size: 0.45, symbol: 'btc' },
  { pair: 'ETH/USDT', strategy: 'Smart DCA', entry: 3180, size: 4.2, symbol: 'eth' },
  { pair: 'SOL/USDT', strategy: 'Grid Trading', entry: 142, size: 35, symbol: 'sol' },
  { pair: 'PAX/USDT', strategy: 'Mean Reversion', entry: 12.4, size: 500, symbol: 'pax' },
];

export default function Dashboard({ onNavigate }) {
  const { simple, demoMode, virtualBalance } = useMode();
  const { activeBots, winRate, trades } = useAppStore();
  const [range, setRange] = useState('90');
  const { prices, connected: wsConnected } = useLiveStream(['btc', 'eth', 'sol', 'pax'], 30000);
  const { balances: walletBalances, connected: walletConnected } = useWalletPortfolio();

  // Build positions with live prices where available — prefer real wallet data when connected
  const positions = useMemo(() => {
    // If wallet is connected and has real balances, use those
    if (walletConnected && walletBalances.length > 0) {
      return walletBalances
        .filter(b => parseFloat(b.balanceFormatted) > 0)
        .map(b => {
          const sym = b.symbol.toLowerCase();
          const livePrice = prices[sym]?.price || prices[sym]?.usd || b.price || 0;
          const current = livePrice || parseFloat(b.balanceFormatted);
          const _value = parseFloat(b.balanceFormatted) * (livePrice || 1);
          return {
            pair: `${b.symbol}/USDT`,
            strategy: b.isNative ? 'Wallet' : 'Token Holdings',
            entry: livePrice || 0,
            current: +current.toFixed(2),
            size: parseFloat(b.balanceFormatted),
            symbol: sym,
            pnl: 0,
            pnlPct: 0,
            isReal: true,
            name: b.name,
          };
        });
    }
    // Fallback to demo positions
    return DEFAULT_POSITIONS.map(p => {
      const livePrice = prices[p.symbol]?.price || prices[p.symbol]?.usd || null;
      const current = livePrice ? parseFloat(livePrice) : p.entry * (1 + (Math.random() * 0.1 - 0.03));
      const pnl = (current - p.entry) * p.size;
      const pnlPct = ((current - p.entry) / p.entry * 100);
      return { ...p, current: +current.toFixed(2), pnl: +pnl.toFixed(2), pnlPct: +pnlPct.toFixed(1) };
    });
  }, [prices, walletConnected, walletBalances]);

  // Portfolio value from positions
  const portfolioValue = useMemo(() => {
    return positions.reduce((sum, p) => sum + p.current * p.size, 0);
  }, [positions]);

  const totalPnl = useMemo(() => positions.reduce((s, p) => s + p.pnl, 0), [positions]);

  const METRICS = [
    { label: 'Portfolio Value', value: `$${portfolioValue.toLocaleString(undefined, {maximumFractionDigits: 0})}`, change: `${totalPnl >= 0 ? '+' : ''}${((totalPnl / (portfolioValue - totalPnl)) * 100).toFixed(1)}%`, up: totalPnl >= 0, icon: DollarSign },
    { label: 'Today P&L', value: `${totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toLocaleString(undefined, {maximumFractionDigits: 0})}`, change: wsConnected ? 'Live (WS)' : 'Polling', up: totalPnl >= 0, icon: TrendingUp },
    { label: 'Active Bots', value: String(activeBots), change: activeBots > 0 ? 'Running' : 'None', up: activeBots > 0, icon: Zap },
    { label: 'Win Rate', value: `${winRate}%`, change: 'Last 30d', up: winRate > 50, icon: Activity },
  ];

  // Try real candle data from Paxeer Data API, fall back to synthetic OHLCV
  const [realCandles, setRealCandles] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const candles = await fetchCandles('btc', '1d', +range);
      if (!cancelled && candles && Array.isArray(candles) && candles.length > 0) {
        setRealCandles(candles);
      } else if (!cancelled) {
        setRealCandles(null);
      }
    })();
    return () => { cancelled = true; };
  }, [range]);

  const data = useMemo(() => {
    if (realCandles && realCandles.length > 0) {
      const normalised = realCandles.map(c => ({
        date: c.date || c.timestamp || c.time || c[0],
        open: c.open ?? c[1],
        high: c.high ?? c[2],
        low: c.low ?? c[3],
        close: c.close ?? c[4],
        volume: c.volume ?? c[5],
      }));
      return computeSMA(normalised, 20);
    }
    const ohlcv = generateOHLCV(+range, prices.btc?.price || prices.btc?.usd || 65000);
    return computeSMA(ohlcv, 20);
  }, [realCandles, range, prices.btc]);

  const chartData = data.slice(-30).map(d => ({ date: d.date.slice(5), price: d.close, sma: d.sma }));

  const allocationData = useMemo(() => {
    return positions.map(p => ({ name: p.pair.split('/')[0], value: p.current * p.size, color: { BTC: 'var(--color-btc)', ETH: 'var(--color-eth)', SOL: 'var(--color-sol)', PAX: 'var(--color-accent)' }[p.pair.split('/')[0]] || 'var(--color-fallback)' }));
  }, [positions]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {demoMode && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-accent-10)] border border-[var(--color-accent-25)]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--color-accent)]">Demo Mode</span>
          <span className="text-xs text-[var(--color-text-muted)]">Trading with virtual funds (${virtualBalance.toLocaleString()} balance). No real money at risk.</span>
        </div>
      )}
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Your portfolio overview — live positions, P&L, and bot performance">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${wsConnected ? 'bg-[var(--color-success-15)] text-[var(--color-success)]' : 'bg-[var(--color-warning-15)] text-[var(--color-warning)]'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-warning)]'}`} />
            {wsConnected ? 'Live' : 'Polling'}
          </div>
          {!simple && <ExportPortfolio positions={positions} />}
        </div>
        {!simple && (
          <div className="flex gap-1">
            {['30','60','90','180'].map(r => (
              <Btn key={r} variant={range === r ? 'primary' : 'ghost'} size="sm" onClick={() => setRange(r)}>
                {r}d
              </Btn>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map(m => {
          const Icon = m.icon;
          return (
            <Card key={m.label} hover>
              <CardBody>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{m.label}</span>
                  <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">{m.value}</div>
                <Badge variant={m.up ? 'success' : 'danger'}>
                  {m.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {m.change}
                </Badge>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Market Pulse */}
      <MarketPulse />

      {!simple && (
        <>
          <Divider />

          {/* Portfolio Chart */}
          <Card>
            <CardBody>
              <SectionHeader icon={TrendingUp} title="BTC Price" action={<InfoTip text="Bitcoin price movement with 20-day SMA overlay. Use the time range buttons above to zoom in or out." />} />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="date" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                  <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="price" stroke="var(--color-accent)" fill="url(#dashGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="sma" stroke="var(--color-warning)" fill="none" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Divider />
        </>
      )}

      {/* Active Positions Table */}
      <Card>
        <CardBody>
          <SectionHeader icon={Activity} title="Active Positions" action={!simple && <InfoTip text="Live positions opened by your trading bots. Entry is the buy price, Current is the market price now, and P&L shows your unrealised gain or loss." />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--color-text-muted)] text-xs border-b border-[var(--color-border-default)]">
                  <th className="text-left py-2 pr-4">Pair</th>
                  {!simple && <th className="text-left py-2 pr-4">Strategy</th>}
                  {!simple && <th className="text-right py-2 pr-4">Entry</th>}
                  <th className="text-right py-2 pr-4">Current</th>
                  {!simple && <th className="text-right py-2 pr-4">Size</th>}
                  <th className="text-right py-2 pr-4">P&L</th>
                  <th className="text-right py-2">Return</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.pair} className="border-b border-[var(--color-border-default)]/50 hover:bg-[var(--color-surface-3)]/30 transition-colors">
                    <td className="py-3 pr-4 text-[var(--color-text-primary)] font-medium">{p.pair}</td>
                    {!simple && <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{p.strategy}</td>}
                    {!simple && <td className="py-3 pr-4 text-right text-gray-300">${p.entry.toLocaleString()}</td>}
                    <td className="py-3 pr-4 text-right text-[var(--color-text-primary)]">${p.current.toLocaleString()}</td>
                    {!simple && <td className="py-3 pr-4 text-right text-gray-300">{p.size}</td>}
                    <td className={`py-3 pr-4 text-right font-medium ${p.pnl >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toLocaleString()}
                    </td>
                    <td className={`py-3 text-right font-medium ${p.pnlPct >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                      {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      {/* Portfolio Allocation + Activity Feed */}
      {!simple && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <Card>
            <CardBody>
              <SectionHeader icon={BarChart3} title="Portfolio Allocation" />
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {allocationData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toLocaleString()}`} contentStyle={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-hover)', borderRadius: 8, color: 'var(--color-text-on-dark)', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {allocationData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-[var(--color-text-secondary)]">{d.name}</span>
                      <span className="text-xs text-[var(--color-text-primary)] font-mono ml-auto">${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardBody>
              <SectionHeader icon={Clock} title="Recent Activity" />
              <div className="space-y-3">
                {trades && trades.length > 0 ? (
                  trades.slice(0, 8).map((t, i) => (
                    <div key={t.id || i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-2)]/50 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${t.side === 'buy' ? 'bg-[var(--color-success-18)]' : 'bg-[var(--color-danger-18)]'}`}>
                        {t.side === 'buy' ? <ArrowUpRight size={13} className="text-[var(--color-success)]" /> : <ArrowDownRight size={13} className="text-[var(--color-danger)]" />}
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)] flex-1">{t.coin || 'Unknown'} {t.side === 'buy' ? 'bought' : 'sold'} {t.amount || ''} {t.price ? `at ${t.price}` : ''}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No recent activity</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Quick Links */}
      <Divider />
      <SectionHeader icon={Zap} title="Quick Actions" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={Zap} title="Autopilot" desc="Let AI trade for you 24/7" color="var(--color-accent)" onClick={() => onNavigate('/autopilot')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={BarChart3} title="My Bots" desc="Monitor and control your bots" color="var(--color-info)" onClick={() => onNavigate('/my-bots')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={BarChart3} title="Strategies" desc="Browse 6 AI-powered strategies" color="var(--color-purple)" onClick={() => onNavigate('/strategies')} />
        </div>
      </div>
    </div>
  );
}
