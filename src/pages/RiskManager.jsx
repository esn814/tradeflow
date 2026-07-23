import { useState, useMemo } from 'react';
import { Shield, AlertTriangle, Gauge, Bell, Bot, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { CHART_GRID, CHART_AXIS_TICK, CHART_AXIS, CHART_TOOLTIP_STYLE } from '../data/chartTheme';
import { RISK_METRICS, generateOHLCV, calculateKelly, calculatePositionSize, calculateATR } from '../data/marketData';
import { Card, CardBody, SectionHeader, Badge, Stat, PageHeader, Divider, LinkCard } from '../components/ui';

const DRAWDOWN_DATA = Array.from({ length: 60 }, (_, i) => ({
  day: i + 1,
  drawdown: -Math.abs(Math.sin(i / 8) * 12 + Math.random() * 3),
}));

const DAILY_RETURNS = Array.from({ length: 90 }, (_, i) => {
  const ret = (Math.random() - 0.46) * 4;
  return { day: i + 1, return: +ret.toFixed(2) };
});

const EXPOSURE_DATA = [
  { name: 'BTC', exposure: 35, limit: 40, color: 'var(--color-btc)' },
  { name: 'ETH', exposure: 25, limit: 30, color: 'var(--color-eth)' },
  { name: 'SOL', exposure: 15, limit: 20, color: 'var(--color-sol)' },
  { name: 'PAX', exposure: 10, limit: 15, color: 'var(--color-accent)' },
  { name: 'Others', exposure: 8, limit: 15, color: 'var(--color-purple)' },
];

const RISK_ALERTS = [
  { level: 'warning', msg: 'BTC position at 87.5% of max exposure limit', time: '2 min ago' },
  { level: 'info', msg: 'Portfolio VaR (95%) within acceptable range: $3,420', time: '15 min ago' },
  { level: 'critical', msg: 'PAX/USDT stop-loss triggered at $11.80 (-4.8%)', time: '1 hr ago' },
  { level: 'info', msg: 'Correlation spike detected: ETH-SOL = 0.91', time: '2 hr ago' },
];

function RiskGauge({ label, value, max, unit, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <Card>
      <CardBody>
        <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-2xl font-bold text-[var(--color-text-primary)]">{value}<span className="text-sm text-[var(--color-text-muted)] ml-1">{unit}</span></span>
          <Gauge className="w-5 h-5" style={{ color }} />
        </div>
        <div className="mt-2 h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
          <span>0</span><span>{max}{unit}</span>
        </div>
      </CardBody>
    </Card>
  );
}

export default function RiskManager({ onNavigate }) {
  const [capital] = useState(100000);
  const kelly = useMemo(() => calculateKelly(0.62, 1.4, 1), []);
  const posSize = useMemo(() => calculatePositionSize(capital, 2, 65000, 63500), [capital]);
  const ohlcv = useMemo(() => generateOHLCV(30, 65000), []);
  const atr = useMemo(() => calculateATR(ohlcv), [ohlcv]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader icon={Shield} title="Risk Manager" subtitle="Real-time portfolio risk monitoring and position sizing">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-profit)] animate-pulse" />
          <Badge variant="success">Monitoring Active</Badge>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskGauge label="Value at Risk (95%)" value={3420} max={10000} unit="$" color="var(--color-warning)" />
        <RiskGauge label="Max Drawdown" value={8.2} max={20} unit="%" color="var(--color-danger-light)" />
        <RiskGauge label="Portfolio Beta" value={1.15} max={2} unit="" color="var(--color-accent)" />
        <RiskGauge label="Leverage" value={1.3} max={3} unit="x" color="var(--color-purple)" />
      </div>

      <Divider />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <SectionHeader icon={Shield} title="Drawdown History" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DRAWDOWN_DATA}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="day" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="drawdown" radius={[2, 2, 0, 0]}>
                  {DRAWDOWN_DATA.map((d, i) => (
                    <Cell key={i} fill={d.drawdown < -10 ? 'var(--color-loss)' : d.drawdown < -5 ? 'var(--color-warning)' : 'var(--color-accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <SectionHeader icon={Shield} title="Daily Returns Distribution" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={DAILY_RETURNS}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="day" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="return" radius={[2, 2, 0, 0]}>
                  {DAILY_RETURNS.map((d, i) => (
                    <Cell key={i} fill={d.return >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{m.name}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{m.desc}</p>
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
            {RISK_ALERTS.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{
                background: a.level === 'critical' ? 'var(--color-loss-12)' : a.level === 'warning' ? 'var(--color-warning-12)' : 'var(--color-accent-8)',
                borderLeft: `3px solid ${a.level === 'critical' ? 'var(--color-loss)' : a.level === 'warning' ? 'var(--color-warning)' : 'var(--color-accent)'}`,
              }}>
                {a.level === 'critical' ? <AlertTriangle className="w-4 h-4 text-[var(--color-loss)] mt-0.5 flex-shrink-0" /> :
                 a.level === 'warning' ? <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" /> :
                 <Shield className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm text-gray-200">{a.msg}</p>
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
