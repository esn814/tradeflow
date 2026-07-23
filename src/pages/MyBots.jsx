import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_AXIS_TICK, CHART_AXIS, CHART_TOOLTIP_STYLE } from '../data/chartTheme';
import { TrendingUp, Grid3x3, Timer, Pause, Play, StopCircle, Bot, Wallet, ArrowUpRight, ArrowDownRight, Plus, ChevronLeft, BarChart3, Clock } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader, Divider, EmptyState } from '../components/ui';
import { useAppStore } from '../context/AppStore';
import { useMode } from '../context/AppStore';
import { RiskBadge, calculateRiskScore, RiskScoreCard, PositionSizingAdvice } from '../components/RiskScore';
import { useLiveStream } from '../data/liveData';

/* ── Trade generator for detail view (uses real prices when available) ── */
function generateTrades(bot, livePrices) {
  const pairs = { BTC: 'BTC/USDT', ETH: 'ETH/USDT', SOL: 'SOL/USDT' };
  const pair = pairs[bot.coin] || 'BTC/USDT';
  // Use real live price if available, otherwise fallback
  const fallbackPrices = { BTC: 64000, ETH: 3200, SOL: 155, AVAX: 28, MATIC: 0.72, LINK: 14.5, DOT: 6.8, PAX: 1.0 };
  const livePrice = livePrices?.[bot.coin]?.price || livePrices?.[bot.coin?.toLowerCase()]?.price;
  const basePrice = livePrice || fallbackPrices[bot.coin] || 100;
  const trades = [];
  let cumPnl = 0;
  for (let i = 0; i < 10; i++) {
    const price = basePrice * (1 + (Math.random() - 0.45) * 0.06);
    const qty = (0.005 + Math.random() * 0.1).toFixed(4);
    const side = Math.random() > 0.42 ? 'buy' : 'sell';
    const raw = (Math.random() - 0.38) * price * parseFloat(qty) * 0.03;
    cumPnl += raw;
    const now = new Date();
    now.setDate(now.getDate() - (10 - i));
    const dateStr = now.toISOString().slice(0, 10);
    trades.push({
      id: i + 1,
      date: dateStr,
      pair, side, price: +price.toFixed(2), qty: +qty, pnl: +raw.toFixed(2), cumPnl: +cumPnl.toFixed(2),
    });
  }
  return trades;
}

/* ── Bot Detail View ── */
function BotDetail({ bot, onBack, onToggle, onStop, livePrices }) {
  const trades = useMemo(() => generateTrades(bot, livePrices), [bot, livePrices]);
  const pnl = bot.current - bot.invested;
  const pct = ((pnl / bot.invested) * 100).toFixed(1);
  const Icon = bot.icon;
  const chartData = trades.map(t => ({ date: t.date, pnl: t.cumPnl }));

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
        <ChevronLeft size={16} /> Back to All Bots
      </button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-accent)]/10">
            <Icon size={20} className="text-[var(--color-accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)]">{bot.name}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{bot.type} Strategy · Trading {bot.coin} · Since {bot.since}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={bot.status === 'running' ? 'success' : bot.status === 'paused' ? 'warning' : 'danger'}>{bot.status}</Badge>
          {bot.status !== 'stopped' && (
            <>
              <Btn variant="secondary" size="sm" onClick={() => onToggle(bot.id)}>
                {bot.status === 'running' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
              </Btn>
              <Btn variant="danger" size="sm" onClick={() => onStop(bot.id)}>
                <StopCircle size={13} /> Stop
              </Btn>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Invested" value={`${bot.invested.toLocaleString()}`} />
        <Stat label="Current Value" value={`${bot.current.toLocaleString()}`} />
        <Stat label="Total P&L" value={`${pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}`} color={pnl >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'} />
        <Stat label="Return" value={`${pnl >= 0 ? '+' : ''}${pct}%`} color={pnl >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'} />
      </div>

      {/* Risk Score */}
      <RiskScoreCard bot={bot} />

      {/* Position Sizing Advice */}
      <PositionSizingAdvice bot={bot} />

      {/* Cumulative P&L Chart */}
      <Card>
        <CardBody>
          <SectionHeader icon={BarChart3} title="Cumulative P&L" />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="botPnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={CHART_AXIS_TICK} {...CHART_AXIS} />
              <YAxis tick={CHART_AXIS_TICK} {...CHART_AXIS} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="pnl" stroke="var(--color-accent)" fill="url(#botPnlGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* Trade History */}
      <Card>
        <CardBody>
          <SectionHeader icon={Clock} title="Trade History" badge={`${trades.length} trades`} />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-left py-2 pr-3">Pair</th>
                  <th className="text-left py-2 pr-3">Side</th>
                  <th className="text-right py-2 pr-3">Price</th>
                  <th className="text-right py-2 pr-3">Qty</th>
                  <th className="text-right py-2 font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className="border-b border-[var(--color-border-default)]/50 hover:bg-[var(--color-surface-2)]/30">
                    <td className="py-2 pr-3 text-[var(--color-text-secondary)] font-mono">{t.date}</td>
                    <td className="py-2 pr-3 text-[var(--color-text-primary)] font-medium">{t.pair}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.side === 'buy' ? 'bg-green-400/15 text-green-400' : 'bg-red-400/15 text-red-400'}`}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-300 font-mono">${t.price.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-right text-gray-300 font-mono">{t.qty}</td>
                    <td className={`py-2 text-right font-medium font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

const iconMap = { DCA: Timer, Grid: Grid3x3, Trend: TrendingUp };

function mapStoreBot(b) {
  return {
    ...b,
    current: b.currentValue,
    since: b.createdAt,
    status: b.status === 'active' ? 'running' : b.status,
    icon: iconMap[b.type] || Bot,
  };
}

export default function MyBots({ onNavigate }) {
  const { demoMode, virtualBalance } = useMode();
  const { bots: storeBots, updateBot, activeBots, totalInvested } = useAppStore();
  const [selectedId, setSelectedId] = useState(null);
  const { prices: livePrices } = useLiveStream(['btc', 'eth', 'sol', 'avax', 'matic', 'link', 'dot', 'pax'], 15000);

  /* Derive bot values from live prices — pure computation, no side-effects */
  const refPrices = useMemo(() => ({ BTC: 67500, ETH: 3450, SOL: 148, AVAX: 28, MATIC: 0.72, LINK: 14.5, DOT: 6.8, PAX: 1.0 }), []);
  const bots = useMemo(() => {
    return storeBots.map(bot => {
      const sym = bot.coin?.toLowerCase();
      const livePrice = livePrices?.[sym]?.price;
      const refPrice = refPrices[bot.coin];
      let currentValue = bot.currentValue;
      if (livePrice && refPrice && bot.invested) {
        const seed = bot.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const entryOffset = 1 + ((seed % 20) - 10) / 100;
        const entryPrice = refPrice * entryOffset;
        const holdings = bot.invested / entryPrice;
        currentValue = +(holdings * livePrice).toFixed(2);
      }
      return mapStoreBot({ ...bot, currentValue });
    });
  }, [storeBots, livePrices, refPrices]);

  const totalValue = bots.reduce((s, b) => s + b.current, 0);
  const totalPnL = totalValue - totalInvested;

  const toggle = (id) => {
    const bot = bots.find(b => b.id === id);
    if (!bot) return;
    const newStatus = bot.status === 'running' ? 'paused' : 'running';
    updateBot(id, { status: newStatus });
  };
  const stop = (id) => updateBot(id, { status: 'stopped' });

  const totalCurrent = totalValue;

  if (bots.every(b => b.status === 'stopped')) {
    return (
      <div className="animate-fade-in">
        <PageHeader icon={Bot} title="My Bots" subtitle="Monitor and control your active trading bots" />
        <EmptyState
          icon={Bot}
          title="No Active Bots"
          desc="You don't have any trading bots running yet. Start investing to put your money to work!"
          action={<Btn variant="primary" onClick={() => onNavigate?.('/invest')}><Plus size={16} /> Start Investing</Btn>}
        />
      </div>
    );
  }

  const selectedBot = bots.find(b => b.id === selectedId);
  if (selectedBot) {
    return <BotDetail bot={selectedBot} onBack={() => setSelectedId(null)} onToggle={toggle} onStop={stop} livePrices={livePrices} />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {demoMode && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--color-accent-10)] border border-[var(--color-accent-25)]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
          <span className="text-xs font-semibold text-[var(--color-accent)]">Demo Mode</span>
          <span className="text-xs text-[var(--color-text-muted)]">Trading with virtual funds (${virtualBalance.toLocaleString()} balance). No real money at risk.</span>
        </div>
      )}
      <PageHeader icon={Bot} title="My Bots" subtitle="Monitor and control your active trading bots">
        <InfoTip text="Pause to temporarily stop trading, or stop a bot to exit all positions." />
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Invested" value={`$${totalInvested.toLocaleString()}`} />
        <Stat label="Current Value" value={`$${totalCurrent.toLocaleString()}`} />
        <Stat label="Total P&L" value={`${totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}`} color={totalPnL >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'} />
        <Stat label="Active Bots" value={activeBots} color="text-[var(--color-accent)]" />
      </div>

      <Divider />

      <SectionHeader icon={Bot} title="Active Bots" badge={`${activeBots} running`} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger">
        {bots.map(bot => {
          const pnl = bot.current - bot.invested;
          const pct = ((pnl / bot.invested) * 100).toFixed(1);
          const Icon = bot.icon;
          return (
            <Card key={bot.id} hover className="animate-fade-in">
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-accent)]/10">
                      <Icon size={16} className="text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--color-text-primary)]">{bot.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{bot.type} Strategy</p>
                    </div>
                  </div>
                  <Badge variant={bot.status === 'running' ? 'success' : bot.status === 'paused' ? 'warning' : 'danger'}>
                    {bot.status}
                  </Badge>
                </div>

                {/* Risk Score Badge */}
                <RiskBadge score={calculateRiskScore(bot)} />

                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <Wallet size={13} /> Trading {bot.coin} · Since {bot.since}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Invested" value={`$${bot.invested.toLocaleString()}`} />
                  <Stat label="Value" value={`$${bot.current.toLocaleString()}`} />
                </div>

                <Badge variant={pnl >= 0 ? 'success' : 'danger'}>
                  {pnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()} ({pct}%)
                </Badge>

                <Divider />
                <div className="flex gap-2">
                  <Btn variant="ghost" size="sm" className="flex-1" onClick={() => setSelectedId(bot.id)}>
                    <BarChart3 size={13} /> Details
                  </Btn>
                  {bot.status !== 'stopped' && (
                    <>
                      <Btn variant="secondary" size="sm" onClick={() => toggle(bot.id)}>
                        {bot.status === 'running' ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => stop(bot.id)}>
                        <StopCircle size={13} />
                      </Btn>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
