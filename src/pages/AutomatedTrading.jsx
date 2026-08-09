import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Play, Pause, Settings2, Loader2, Zap, Trash2,
  TrendingUp, TrendingDown, Activity, Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InfoTip from '../components/InfoTip';
import {
  Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader,
  Divider, EmptyState, Input, StatusPill,
} from '../components/ui';
import { ALL_STRATEGIES, getStrategy } from '../strategies/index.js';
import { apiFetch } from '../services/apiClient.js';

/* ─── Param schemas per strategy ─── */
const STRATEGY_PARAMS = {
  dca: [
    { key: 'amount', label: 'Buy Amount (USD)', type: 'number', default: 50, min: 10, step: 10 },
    { key: 'interval', label: 'Interval (hours)', type: 'number', default: 4, min: 1, step: 1 },
    { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 15, min: 1, max: 50, step: 1 },
    { key: 'takeProfit', label: 'Take Profit (%)', type: 'number', default: 25, min: 1, max: 100, step: 1 },
  ],
  grid: [
    { key: 'upperPrice', label: 'Upper Price', type: 'number', default: 0, min: 0, step: 100 },
    { key: 'lowerPrice', label: 'Lower Price', type: 'number', default: 0, min: 0, step: 100 },
    { key: 'gridCount', label: 'Grid Levels', type: 'number', default: 10, min: 3, max: 50, step: 1 },
    { key: 'investPerGrid', label: 'Invest/Grid (USD)', type: 'number', default: 100, min: 10, step: 10 },
    { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 10, min: 1, max: 50, step: 1 },
  ],
  meanReversion: [
    { key: 'lookback', label: 'MA Lookback (periods)', type: 'number', default: 20, min: 5, max: 100, step: 1 },
    { key: 'entryZScore', label: 'Entry Z-Score', type: 'number', default: -2, min: -4, max: -0.5, step: 0.1 },
    { key: 'exitZScore', label: 'Exit Z-Score', type: 'number', default: 0.5, min: -1, max: 3, step: 0.1 },
    { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 10, min: 1, max: 50, step: 1 },
    { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 12, min: 1, max: 50, step: 1 },
  ],
  trailingStop: [
    { key: 'trailPct', label: 'Trail Distance (%)', type: 'number', default: 5, min: 1, max: 30, step: 0.5 },
    { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 20, min: 1, max: 100, step: 1 },
    { key: 'takeProfit', label: 'Take Profit (%)', type: 'number', default: 30, min: 1, max: 200, step: 1 },
  ],
  aiConfluence: [
    { key: 'confidence', label: 'Min Confidence (%)', type: 'number', default: 60, min: 40, max: 90, step: 5 },
    { key: 'positionSize', label: 'Position Size (%)', type: 'number', default: 10, min: 1, max: 50, step: 1 },
    { key: 'stopLoss', label: 'Stop Loss (%)', type: 'number', default: 5, min: 1, max: 20, step: 0.5 },
    { key: 'takeProfit', label: 'Take Profit (%)', type: 'number', default: 10, min: 2, max: 50, step: 1 },
  ],
};

/* Color map by risk level */
const RISK_COLORS = {
  'Low': 'var(--color-success)',
  'Low-Medium': 'var(--color-success)',
  'Medium': 'var(--color-warning-alt)',
  'Medium-High': 'var(--color-warning-alt)',
  'High': 'var(--color-danger)',
};

const COINS = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', icon: '⟠' },
  { symbol: 'SOL', name: 'Solana', icon: '◎' },
  { symbol: 'BNB', name: 'BNB', icon: '🔶' },
  { symbol: 'AVAX', name: 'Avalanche', icon: '🔺' },
  { symbol: 'LINK', name: 'Chainlink', icon: '🔗' },
];

/* Build strategy list from registry + param schemas */
const STRATEGIES = ALL_STRATEGIES
  .filter(s => STRATEGY_PARAMS[s.id])
  .map(s => ({
    id: s.id,
    name: s.name,
    desc: s.description,
    icon: s.icon,
    color: RISK_COLORS[s.risk] || 'var(--color-accent)',
    risk: s.risk,
    params: STRATEGY_PARAMS[s.id],
    tips: `Best for: ${s.whenToUse} Avoid: ${s.whenToAvoid}`,
  }));

export default function AutomatedTrading({ onNavigate: _onNavigate }) {
  const { isAuthenticated } = useAuth();
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
  const [params, setParams] = useState({});
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [showParamHints, setShowParamHints] = useState(false);
  const [error, setError] = useState(null);

  /* ── Fetch bots from backend ── */
  const fetchBots = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const data = await apiFetch('/live-trading/bots');
      setBots(data || []);
    } catch (err) {
      console.warn('[AutomatedTrading] Failed to fetch bots:', err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  /* ── Derived stats ── */
  const activeBots = bots.filter(b => b.status === 'running').length;
  const totalPnl = bots.reduce((s, b) => s + (b.totalPnl || 0), 0);
  const totalTrades = bots.reduce((s, b) => s + (b.totalTrades || 0), 0);
  const winRate = totalTrades > 0
    ? Math.round(bots.reduce((s, b) => s + (b.winCount || 0), 0) / totalTrades * 100)
    : 0;

  /* ── Handlers ── */
  const handleSelectStrategy = (strat) => {
    setSelectedStrategy(strat);
    const defaults = {};
    strat.params.forEach(p => { defaults[p.key] = p.default; });
    setParams(defaults);
    setError(null);
  };

  const handleDeploy = async () => {
    if (!selectedStrategy || !selectedCoin) return;
    setDeploying(true);
    setError(null);
    try {
      const botName = `${selectedStrategy.name} — ${selectedCoin.symbol}`;
      const res = await apiFetch('/live-trading/bots', {
        method: 'POST',
        body: JSON.stringify({
          name: botName,
          coin: selectedCoin.symbol,
          strategy: selectedStrategy.id,
          config: params,
          intervalMs: 60000,
        }),
      });
      if (res.error) throw new Error(res.error);
      // Refresh bot list
      await fetchBots();
      setSelectedStrategy(null);
      setParams({});
    } catch (err) {
      setError(err.message || 'Failed to create bot');
    } finally {
      setDeploying(false);
    }
  };

  const toggleBot = async (bot) => {
    try {
      const endpoint = bot.status === 'running'
        ? `/live-trading/bots/${bot.id}/stop`
        : `/live-trading/bots/${bot.id}/start`;
      await apiFetch(endpoint, { method: 'POST' });
      await fetchBots();
    } catch (err) {
      setError(err.message || 'Failed to toggle bot');
    }
  };

  const removeBot = async (bot) => {
    if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/live-trading/bots/${bot.id}`, { method: 'DELETE' });
      await fetchBots();
    } catch (err) {
      setError(err.message || 'Failed to delete bot');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader icon={Bot} title="Automated Trading" badge="LIVE"
        subtitle="Deploy AI-powered trading bots on Binance testnet with real market data">
        <InfoTip text="Bots execute real trades on Binance testnet using your API keys. All strategies use the server-side signal engine for confluence scoring." />
      </PageHeader>

      {/* Error banner */}
      {error && (
        <div className="p-3 rounded-lg bg-[var(--color-danger-18)] text-[var(--color-danger)] text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline ml-2">Dismiss</button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Active Bots" value={activeBots} sub={`${bots.length} total`} color="text-[var(--color-accent)]" />
        <Stat label="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`} color={totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'} />
        <Stat label="Total Trades" value={totalTrades} />
        <Stat label="Win Rate" value={`${winRate}%`} color="text-[var(--color-info)]" />
      </div>

      <Divider />

      {/* Strategy Selector */}
      <SectionHeader icon={Zap} title="Choose Strategy" subtitle="Pick a strategy to deploy a new bot" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STRATEGIES.map(strat => {
          const Icon = strat.icon;
          const sel = selectedStrategy?.id === strat.id;
          return (
            <button key={strat.id} onClick={() => handleSelectStrategy(strat)}
              className={`card p-4 text-left transition-all ${sel ? 'ring-2 ring-[var(--color-accent)]' : 'hover:border-[var(--color-border-hover)]'}`}>
              <div className="flex items-center gap-2 mb-2 min-w-0">
                <Icon size={18} style={{ color: strat.color }} className="flex-shrink-0" />
                <span className="font-semibold text-sm text-[var(--color-text)] truncate">{strat.name}</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2 line-clamp-2">{strat.desc}</p>
              <Badge className="flex-shrink-0" color={strat.risk === 'Low' ? 'var(--color-success)' : strat.risk === 'Medium' ? 'var(--color-warning-alt)' : 'var(--color-danger)'}>{strat.risk} Risk</Badge>
            </button>
          );
        })}
      </div>

      {/* Config Panel */}
      {selectedStrategy && (
        <Card>
          <CardBody>
            <SectionHeader icon={Settings2} title={`Configure: ${selectedStrategy.name}`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 overflow-hidden">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Coin</label>
                <select className="input w-full" value={selectedCoin?.symbol || ''}
                  onChange={e => setSelectedCoin(COINS.find(c => c.symbol === e.target.value))}>
                  {COINS.map(c => <option key={c.symbol} value={c.symbol}>{c.icon} {c.symbol} — {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Strategy</label>
                <div className="input w-full bg-[var(--color-surface-2)]">{selectedStrategy.name}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {selectedStrategy.params.map(p => (
                <div key={p.key}>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{p.label}</label>
                  <Input type="number" value={params[p.key] ?? p.default}
                    min={p.min} max={p.max} step={p.step}
                    onChange={e => setParams(prev => ({ ...prev, [p.key]: +e.target.value }))} />
                </div>
              ))}
            </div>

            {/* Param hints toggle */}
            <button onClick={() => setShowParamHints(v => !v)}
              className="text-xs text-[var(--color-accent)] hover:underline mb-4">
              {showParamHints ? 'Hide' : 'Show'} parameter tips
            </button>
            {showParamHints && (
              <div className="p-3 rounded-lg bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)] mb-4">
                {selectedStrategy.tips}
              </div>
            )}

            {/* Risk disclaimer */}
            <div className="p-3 rounded-lg bg-[var(--color-warning-18)] text-[var(--color-warning)] text-xs mb-4 flex items-start gap-2">
              <span className="text-base mt-0.5">⚠️</span>
              <span>Trading involves risk. Bots will execute real orders on Binance testnet. Monitor your positions regularly.</span>
            </div>

            <div className="flex gap-3">
              <Btn variant="primary" onClick={handleDeploy} disabled={deploying || !selectedStrategy}>
                {deploying ? <><Loader2 size={16} className="animate-spin mr-2" /> Deploying...</> : <><Zap size={16} className="mr-2" /> Deploy Bot</>}
              </Btn>
              <Btn variant="ghost" onClick={() => { setSelectedStrategy(null); setParams({}); }}>Cancel</Btn>
            </div>
          </CardBody>
        </Card>
      )}

      <Divider />

      {/* Active Bots */}
      <SectionHeader icon={Activity} title="Your Bots" subtitle={loading ? 'Loading...' : `${bots.length} bot${bots.length !== 1 ? 's' : ''}`} />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-[var(--color-accent)]" /></div>
      ) : bots.length === 0 ? (
        <EmptyState icon={Bot} title="No bots yet"
          desc="Choose a strategy above to deploy your first trading bot"
          action={<Btn variant="primary" onClick={() => document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth' })}><Plus size={16} className="mr-1" /> Create Bot</Btn>} />
      ) : (
        <div className="space-y-3">
          {bots.map(bot => {
            const strat = getStrategy(bot.strategy);
            const Icon = strat?.icon || Bot;
            const isRunning = bot.status === 'running';
            const pnl = bot.totalPnl || 0;
            const pnlPct = bot.totalTrades > 0 ? ((pnl / 1000) * 100).toFixed(1) : '0.0';
            return (
              <Card key={bot.id}>
                <CardBody>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isRunning ? 'var(--color-accent-18)' : 'var(--color-surface-3)' }}>
                        <Icon size={18} className={isRunning ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[var(--color-text)] truncate">{bot.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{bot.coin} · {strat?.name || bot.strategy} · {bot.totalTrades || 0} trades</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </div>
                        <div className={`text-xs ${pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          {pnl >= 0 ? '+' : ''}{pnlPct}%
                        </div>
                      </div>
                      <StatusPill status={bot.status} />
                      <button onClick={() => toggleBot(bot)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isRunning ? 'bg-[var(--color-warning-18)] text-[var(--color-warning)] hover:bg-[var(--color-warning-30)]' : 'bg-[var(--color-success-18)] text-[var(--color-success)] hover:bg-[var(--color-success-30)]'}`}>
                        {isRunning ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button onClick={() => removeBot(bot)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-danger-18)] text-[var(--color-danger)] hover:bg-[var(--color-danger-30)] transition-all">
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
