import { useState } from 'react';
import {
  Bot, Play, Pause, Settings2, TrendingUp,
  Shield, Loader2,
  Zap, Target, BarChart3,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InfoTip from '../components/InfoTip';
import {
  Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader,
  Divider, EmptyState, Input,
} from '../components/ui';

/* ─── Strategy definitions with real-swap params ─── */
const STRATEGIES = [
  {
    id: 'dca',
    name: 'DCA (Dollar Cost Average)',
    desc: 'Automatically buy a fixed dollar amount at regular intervals. Smooths volatility, reduces timing risk.',
    icon: TrendingUp,
    color: 'var(--color-success)',
    risk: 'Low',
    params: [
      { key: 'amount', label: 'Buy Amount (USD)', type: 'number', default: 50, min: 10, step: 10 },
      { key: 'interval', label: 'Interval (hours)', type: 'number', default: 4, min: 1, step: 1 },
      { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 15, min: 1, max: 50, step: 1 },
      { key: 'takeProfit', label: 'Take Profit (%)', type: 'number', default: 25, min: 1, max: 100, step: 1 },
    ],
    tips: 'Best for: long-term accumulation, volatile markets. Avoid in strong downtrends.',
  },
  {
    id: 'grid',
    name: 'Grid Trading',
    desc: 'Place buy/sell orders at evenly-spaced price levels. Profits from price oscillation in a range.',
    icon: BarChart3,
    color: 'var(--color-info)',
    risk: 'Medium',
    params: [
      { key: 'upperPrice', label: 'Upper Price', type: 'number', default: 0, min: 0, step: 100 },
      { key: 'lowerPrice', label: 'Lower Price', type: 'number', default: 0, min: 0, step: 100 },
      { key: 'gridCount', label: 'Grid Levels', type: 'number', default: 10, min: 3, max: 50, step: 1 },
      { key: 'investPerGrid', label: 'Invest/Grid (USD)', type: 'number', default: 100, min: 10, step: 10 },
      { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 10, min: 1, max: 50, step: 1 },
    ],
    tips: 'Best for: sideways/ranging markets. Avoid in strong trending markets.',
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    desc: 'Buy when price dips below its moving average, sell when it rallies back. Mean-reverting assets only.',
    icon: Target,
    color: 'var(--color-purple)',
    risk: 'Medium',
    params: [
      { key: 'lookback', label: 'MA Lookback (periods)', type: 'number', default: 20, min: 5, max: 100, step: 1 },
      { key: 'entryZScore', label: 'Entry Z-Score', type: 'number', default: -2, min: -4, max: -0.5, step: 0.1 },
      { key: 'exitZScore', label: 'Exit Z-Score', type: 'number', default: 0.5, min: -1, max: 3, step: 0.1 },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 10, min: 1, max: 50, step: 1 },
      { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 12, min: 1, max: 50, step: 1 },
    ],
    tips: 'Best for: established, liquid pairs with mean-reverting behavior. Avoid meme coins.',
  },
  {
    id: 'trailing-stop',
    name: 'Trailing Stop',
    desc: 'Hold a position and automatically sell when price drops by a set percentage from its peak.',
    icon: Shield,
    color: 'var(--color-warning-alt)',
    risk: 'Low',
    params: [
      { key: 'trailPct', label: 'Trail Distance (%)', type: 'number', default: 5, min: 1, max: 30, step: 0.5 },
      { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 20, min: 1, max: 100, step: 1 },
      { key: 'takeProfit', label: 'Take Profit (%)', type: 'number', default: 30, min: 1, max: 200, step: 1 },
    ],
    tips: 'Best for: protecting gains in uptrends. Set tight trails for volatile assets.',
  },
];

const COINS = [
  { symbol: 'BTC', name: 'Bitcoin', price: 67420, icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', price: 3450, icon: '⟠' },
  { symbol: 'SOL', name: 'Solana', price: 148, icon: '◎' },
  { symbol: 'PAX', name: 'Paxeer', price: 0.52, icon: '⚡' },
  { symbol: 'BNB', name: 'BNB', price: 585, icon: '🔶' },
  { symbol: 'AVAX', name: 'Avalanche', price: 28, icon: '🔺' },
];

export default function AutomatedTrading({ onNavigate: _onNavigate }) {
  
  const { isAuthenticated } = useAuth();
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
  const [params, setParams] = useState({});
  const [bots, setBots] = useState([
    { id: 1, strategy: 'dca', coin: 'ETH', status: 'running', pnl: 127.50, pnlPct: 5.1, trades: 14, params: { amount: 50, interval: 4, stopLoss: 15, takeProfit: 25 }, startedAt: Date.now() - 86400000 * 3 },
    { id: 2, strategy: 'grid', coin: 'SOL', status: 'running', pnl: -32.10, pnlPct: -1.3, trades: 28, params: { upperPrice: 160, lowerPrice: 130, gridCount: 10, investPerGrid: 50, stopLoss: 10 }, startedAt: Date.now() - 86400000 },
    { id: 3, strategy: 'mean-reversion', coin: 'BTC', status: 'paused', pnl: 342.80, pnlPct: 3.4, trades: 7, params: { lookback: 20, entryZScore: -2, exitZScore: 0.5, positionSize: 10, stopLoss: 12 }, startedAt: Date.now() - 86400000 * 7 },
  ]);
  const [showParamHints, setShowParamHints] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const totalPnl = bots.reduce((s, b) => s + b.pnl, 0);
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalTrades = bots.reduce((s, b) => s + b.trades, 0);

  const handleSelectStrategy = (strat) => {
    setSelectedStrategy(strat);
    const defaults = {};
    strat.params.forEach(p => { defaults[p.key] = p.default; });
    setParams(defaults);
  };

  const handleDeploy = async () => {
    if (!selectedStrategy || !selectedCoin) return;
    setDeploying(true);
    await new Promise(r => setTimeout(r, 1500));
    setBots(prev => [{
      id: Date.now(),
      strategy: selectedStrategy.id,
      coin: selectedCoin.symbol,
      status: 'running',
      pnl: 0, pnlPct: 0, trades: 0,
      params: { ...params },
      startedAt: Date.now(),
    }, ...prev]);
    setDeploying(false);
    setSelectedStrategy(null);
    setParams({});
  };

  const toggleBot = (id) => {
    setBots(prev => prev.map(b =>
      b.id === id ? { ...b, status: b.status === 'running' ? 'paused' : 'running' } : b
    ));
  };

  const removeBot = (id) => {
    setBots(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={Bot} title="Automated Trading" badge="DEMO"
        subtitle="Deploy DCA, Grid, Mean Reversion and Trailing Stop strategies in demo mode">
        <InfoTip text="These strategies simulate trades using live market data but do not place real orders. Real exchange integration is on the roadmap." />
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Active Bots" value={activeBots} sub={`${bots.length} total`} color="text-[var(--color-accent)]" />
        <Stat label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'} />
        <Stat label="Total Trades" value={totalTrades} />
        <Stat label="Win Rate" value={bots.length > 0 ? `${Math.round(bots.filter(b => b.pnl > 0).length / bots.length * 100)}%` : '—'} color="text-[var(--color-info)]" />
      </div>

      <Divider />

      {/* Strategy Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STRATEGIES.map(strat => {
          const Icon = strat.icon;
          const sel = selectedStrategy?.id === strat.id;
          return (
            <button key={strat.id} onClick={() => handleSelectStrategy(strat)}
              className={`card p-4 text-left transition-all ${sel ? 'ring-2 ring-[var(--color-accent)]' : 'hover:border-[var(--color-border-hover)]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} style={{ color: strat.color }} />
                <span className="font-semibold text-sm text-[var(--color-text)]">{strat.name}</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">{strat.desc}</p>
              <div className="flex items-center gap-2">
                <Badge color={strat.risk === 'Low' ? 'var(--color-success)' : strat.risk === 'Medium' ? 'var(--color-warning-alt)' : 'var(--color-danger)'}>{strat.risk} Risk</Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* Config Panel */}
      {selectedStrategy && (
        <Card>
          <CardBody>
            <SectionHeader icon={Settings2} title={`Configure: ${selectedStrategy.name}`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Coin</label>
                <select className="input w-full" value={selectedCoin?.symbol || ''}
                  onChange={e => setSelectedCoin(COINS.find(c => c.symbol === e.target.value))}>
                  {COINS.map(c => <option key={c.symbol} value={c.symbol}>{c.icon} {c.symbol} — {c.name}</option>)}
                </select>
              </div>
              {selectedStrategy.params.map(p => (
                <div key={p.key}>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
                    {p.label}
                    {showParamHints && <span className="text-[var(--color-text-muted)]">({p.min}–{p.max || '∞'})</span>}
                  </label>
                  <Input type="number" value={params[p.key] || p.default}
                    min={p.min} max={p.max} step={p.step}
                    onChange={e => setParams(prev => ({ ...prev, [p.key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mb-4 italic">💡 {selectedStrategy.tips}</div>
            <div className="flex items-center gap-3">
              <Btn onClick={handleDeploy} disabled={deploying || !isAuthenticated}>
                {deploying ? <><Loader2 size={14} className="animate-spin" /> Deploying…</> : <><Play size={14} /> Deploy Bot</>}
              </Btn>
              <button onClick={() => setShowParamHints(h => !h)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                {showParamHints ? 'Hide' : 'Show'} parameter hints
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Active Bots */}
      <SectionHeader icon={Zap} title="Active Bots" count={bots.length} />
      {bots.length === 0 ? (
        <EmptyState icon={Bot} title="No bots deployed" subtitle="Select a strategy above to deploy your first automated trading bot." />
      ) : (
        <div className="space-y-3">
          {bots.map(bot => {
            const strat = STRATEGIES.find(s => s.id === bot.strategy);
            const coin = COINS.find(c => c.symbol === bot.coin);
            const Icon = strat?.icon || Bot;
            const running = bot.status === 'running';
            return (
              <Card key={bot.id}>
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: strat?.color + '20' }}>
                        <Icon size={20} style={{ color: strat?.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[var(--color-text)]">{strat?.name} · {coin?.icon} {bot.coin}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{bot.trades} trades · {running ? 'Running' : 'Paused'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`font-mono font-bold text-sm ${bot.pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {bot.pnl >= 0 ? '+' : ''}{bot.pnl.toFixed(2)} USD
                        </div>
                        <div className={`text-xs ${bot.pnlPct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {bot.pnlPct >= 0 ? '+' : ''}{bot.pnlPct.toFixed(1)}%
                        </div>
                      </div>
                      <button onClick={() => toggleBot(bot.id)} className="btn-icon" title={running ? 'Pause' : 'Resume'}>
                        {running ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button onClick={() => removeBot(bot.id)} className="btn-icon text-[var(--color-danger)]" title="Remove">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
