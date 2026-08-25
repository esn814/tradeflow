import { useState, useMemo, useEffect } from 'react';
import { Shield, AlertTriangle, Gauge, Bell, Bot, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { CHART_GRID, CHART_AXIS_TICK, CHART_AXIS, CHART_TOOLTIP_STYLE } from '../data/chartTheme';
import { RISK_METRICS, calculateKelly, calculatePositionSize, calculateATR, computeSMA } from '../data/marketData';
import { fetchCandles, useLivePrices } from '../data/liveData';
import { Card, CardBody, SectionHeader, Badge, Stat, PageHeader, Divider, LinkCard } from '../components/ui';

// Exposure data derived from real positions (placeholder until portfolio API is wired)
const EXPOSURE_DATA = [
  { name: 'BTC', exposure: 35, limit: 40, color: 'var(--color-btc)' },
  { name: 'ETH', exposure: 25, limit: 30, color: 'var(--color-eth)' },
  { name: 'SOL', exposure: 15, limit: 20, color: 'var(--color-sol)' },
  { name: 'PAX', exposure: 10, limit: 15, color: 'var(--color-accent)' },
  { name: 'Others', exposure: 8, limit: 15, color: 'var(--color-purple)' },
];

function RiskGauge({ label, value, max, unit, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <Card className="overflow-hidden">
      <CardBody>
        <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="text-2xl font-bold text-[var(--color-text-primary)] truncate min-w-0">{value}<span className="text-sm text-[var(--color-text-muted)] ml-1">{unit}</span></span>
          <Gauge className="w-5 h-5" style={{ color }} />
        </div>
        <div className="mt-2 h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
          <span>0</span><span>{max}{unit}</span>
        </div>
      </CardBody>
    </Card>
  );
}

export default function RiskManager({ onNavigate }) {
  const [capital] = useState(100000);
  const { prices } = useLivePrices(['btc', 'eth', 'sol', 'pax'], 30000);
  const [realCandles, setRealCandles] = useState(null);

  // Fetch real BTC candle data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const candles = await fetchCandles('btc', '1d', 90);
      if (!cancelled && candles && Array.isArray(candles) && candles.length > 0) {
        setRealCandles(candles);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compute real drawdown from candle closes
  const drawdownData = useMemo(() => {
    if (!realCandles || realCandles.length === 0) return null;
    const closes = realCandles.map(c => c.close ?? c[4] ?? 0).filter(v => v > 0);
    if (closes.length < 5) return null;
    let peak = closes[0];
    return closes.map((c, i) => {
      if (c > peak) peak = c;
      const dd = peak > 0 ? ((c - peak) / peak * 100) : 0;
      return { day: i + 1, drawdown: +dd.toFixed(2) };
    });
  }, [realCandles]);

  // Compute real daily returns from candle closes
  const dailyReturns = useMemo(() => {
    if (!realCandles || realCandles.length < 2) return null;
    const closes = realCandles.map(c => c.close ?? c[4] ?? 0).filter(v => v > 0);
    if (closes.length < 5) return null;
    return closes.slice(1).map((c, i) => ({
      day: i + 1,
      return: +((c - closes[i]) / closes[i] * 100).toFixed(2),
    }));
  }, [realCandles]);

  // Real ATR from candle data
  const atr = useMemo(() => {
    if (!realCandles || realCandles.length < 15) return null;
    const normalised = realCandles.map(c => ({
      high: c.high ?? c[2] ?? 0,
      low: c.low ?? c[3] ?? 0,
      close: c.close ?? c[4] ?? 0,
    }));
    return calculateATR(normalised);
  }, [realCandles]);

  // Real BTC price for position sizing
  const btcPrice = prices?.btc?.price || prices?.btc?.usd || null;

  // Kelly criterion â€” use real win rate from recent returns if available
  const kelly = useMemo(() => {
    if (!dailyReturns || dailyReturns.length < 10) return null;
    const wins = dailyReturns.filter(d => d.return > 0);
    const losses = dailyReturns.filter(d => d.return < 0);
    const winRate = wins.length / dailyReturns.length;
    const avgWin = wins.length > 0 ? wins.reduce((s, d) => s + d.return, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, d) => s + d.return, 0) / losses.length) : 1;
    return calculateKelly(winRate, avgWin, avgLoss);
  }, [dailyReturns]);

  // Position sizing with real price + ATR
  const posSize = useMemo(() => {
    if (!btcPrice || !atr) return null;
    const entry = btcPrice;
    const stopLoss = entry - 2 * atr; // 2x ATR stop
    return calculatePositionSize(capital, 2, entry, stopLoss);
  }, [capital, btcPrice, atr]);

  // Real risk alerts derived from data
  const riskAlerts = useMemo(() => {
    const alerts = [];
    if (drawdownData && drawdownData.length > 0) {
      const worstDD = Math.min(...drawdownData.map(d => d.drawdown));
      if (worstDD < -10) {
        alerts.push({ level: 'critical', msg: `Max drawdown reached ${worstDD.toFixed(1)}% â€” exceeds -10% threshold`, time: 'Recent' });
      } else if (worstDD < -5) {
        alerts.push({ level: 'warning', msg: `Drawdown at ${worstDD.toFixed(1)}% â€” approaching -10% limit`, time: 'Recent' });
      }
    }
    if (dailyReturns && dailyReturns.length > 0) {
      const lastReturn = dailyReturns[dailyReturns.length - 1]?.return;
      if (lastReturn !== undefined && lastReturn < -3) {
        alerts.push({ level: 'warning', msg: `Last daily return: ${lastReturn.toFixed(1)}% â€” significant single-day loss`, time: '1d ago' });
      }
    }
    if (btcPrice) {
      alerts.push({ level: 'info', msg: `BTC live price: $${btcPrice.toLocaleString()} â€” ATR-based stop at $${atr ? (btcPrice - 2 * atr).toLocaleString() : '...'}`, time: 'Now' });
    }
    if (alerts.length === 0) {
      alerts.push({ level: 'info', msg: 'All risk metrics within acceptable range', time: 'Active' });
    }
    return alerts;
  }, [drawdownData, dailyReturns, btcPrice, atr]);

  // Compute real VaR (95th percentile of daily returns)
  const var95 = useMemo(() => {
    if (!dailyReturns || dailyReturns.length < 10) return null;
    const sorted = [...dailyReturns].sort((a, b) => a.return - b.return);
    const idx = Math.floor(sorted.length * 0.05);
    const varPct = Math.abs(sorted[idx]?.return || 0);
    return +(capital * varPct / 100).toFixed(0);
  }, [dailyReturns, capital]);

  // Compute real max drawdown
  const maxDrawdown = useMemo(() => {
    if (!drawdownData) return null;
    return Math.abs(Math.min(...drawdownData.map(d => d.drawdown))).toFixed(1);
  }, [drawdownData]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader icon={Shield} title="Risk Manager" subtitle="Real-time portfolio risk monitoring and position sizing">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-[var(--color-profit)] animate-pulse flex-shrink-0" />
          <Badge variant="success" className="flex-shrink-0">Monitoring Active</Badge>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskGauge label="Value at Risk (95%)" value={var95 !== null ? var95.toLocaleString() : '...'} max={10000} unit="$" color="var(--color-warning)" />
        <RiskGauge label="Max Drawdown" value={maxDrawdown !== null ? maxDrawdown : '...'} max={20} unit="%" color="var(--color-danger-light)" />
        <RiskGauge label="ATR (14-period)" value={atr !== null ? atr.toLocaleString() : '...'} max={5000} unit="$" color="var(--color-accent)" />
        <RiskGauge label="BTC Price" value={btcPrice !== null ? btcPrice.toLocaleString() : '...'} max={200000} unit="$" color="var(--color-purple)" />
      </div>

      <Divider />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <SectionHeader icon={Shield} title="Drawdown History" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={drawdownData || [{ day: 1, drawdown: 0 }]}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="day" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Drawdown']} />
                <Bar dataKey="drawdown" radius={[2, 2, 0, 0]}>
                  {(drawdownData || []).map((d, i) => (
                    <Cell key={i} fill={d.drawdown < -10 ? 'var(--color-loss)' : d.drawdown < -5 ? 'var(--color-warning)' : 'var(--color-accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {!drawdownData && <p className="text-xs text-[var(--color-text-muted)] text-center mt-2">Loading real BTC drawdown data...</p>}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader icon={Shield} title="Daily Returns Distribution" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyReturns || [{ day: 1, return: 0 }]}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="day" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Return']} />
                <Bar dataKey="return" radius={[2, 2, 0, 0]}>
                  {(dailyReturns || []).map((d, i) => (
                    <Cell key={i} fill={d.return >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {!dailyReturns && <p className="text-xs text-[var(--color-text-muted)] text-center mt-2">Loading real BTC daily returns...</p>}
          </CardBody>
        </Card>
      </div>

      <Divider />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardBody>
            <SectionHeader icon={Shield} title="Position Exposure vs Limits" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={EXPOSURE_DATA} layout="vertical">
                <CartesianGrid {...CHART_GRID} />
                <XAxis type="number" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-text-on-dark)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="exposure" radius={[0, 4, 4, 0]}>
                  {EXPOSURE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader icon={Gauge} title="Position Sizing Calculator" />
            <div className="space-y-3">
              <Stat label="Kelly Criterion" value={`${(kelly * 100).toFixed(1)}%`} color="text-[var(--color-accent)]" sub="Optimal risk per trade" />
              <Stat label="Recommended Size (2% risk)" value={`${posSize} BTC`} sub="Entry $65,000 / Stop $63,500" />
              <Stat label="ATR (14-period)" value={`$${atr}`} color="text-[var(--color-warning)]" sub="Volatility-adjusted stops" />
            </div>
          </CardBody>
        </Card>
      </div>

      <Divider />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(RISK_METRICS).map(m => (
          <Card key={m.name}>
            <CardBody>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">{m.name}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">{m.desc}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)]">Target: <span className="text-[var(--color-profit)]">{m.good}</span></span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Divider />

      <Card>
        <CardBody>
          <SectionHeader icon={AlertTriangle} title="Risk Alerts" />
          <div className="space-y-2">
            {riskAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg min-w-0" style={{
                background: a.level === 'critical' ? 'var(--color-loss-12)' : a.level === 'warning' ? 'var(--color-warning-12)' : 'var(--color-accent-8)',
                borderLeft: `3px solid ${a.level === 'critical' ? 'var(--color-loss)' : a.level === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)'}`,
              }}>
                {a.level === 'critical' ? <AlertTriangle className="w-4 h-4 text-[var(--color-loss)] mt-0.5 flex-shrink-0" /> :
                 a.level === 'warning' ? <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" /> :
                 <Shield className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 break-words">{a.msg}</p>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={BarChart3} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={Bell} title="Alerts" desc="Set up price, bot, and portfolio alerts" color="var(--color-danger)" onClick={() => onNavigate('/alerts')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Bot} title="Strategies" desc="View and configure your trading strategies" color="var(--color-purple)" onClick={() => onNavigate('/strategies')} />
        </div>
      </div>
    </div>
  );
}
