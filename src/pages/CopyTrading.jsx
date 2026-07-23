import { useState, useMemo } from 'react';
import { Users, TrendingUp, Shield, Copy, ChevronDown, ChevronUp, Search, Zap, Award, Clock, BarChart3 } from 'lucide-react';
import { Card, CardBody, Btn, Stat, PageHeader } from '../components/ui';
import { useAppStore } from '../context/AppStore';

const RISK_COLORS = { low: '#22d68a', medium: '#ffa502', high: '#ff4d6a' };
const RISK_LABELS = { low: 'Low Risk', medium: 'Medium Risk', high: 'High Risk' };

function TraderCard({ trader, isFollowing, _followSettings, onFollow, onUnfollow, onSettings }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card hover className="overflow-hidden">
      <CardBody>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center text-lg">
              {trader.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[var(--color-text-primary)] text-sm">{trader.name}</span>
                {trader.verified && <Shield size={12} className="text-[var(--color-accent)]" />}
                {trader.topTrader && <Award size={12} className="text-[var(--color-warning)]" />}
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{trader.strategy}</span>
            </div>
          </div>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold`} style={{ background: `${RISK_COLORS[trader.risk]}15`, color: RISK_COLORS[trader.risk] }}>
            {RISK_LABELS[trader.risk]}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className={`text-sm font-bold ${trader.pnl30d >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {trader.pnl30d >= 0 ? '+' : ''}{trader.pnlPct30d}%
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">30d P&L</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-[var(--color-text-primary)]">{trader.winRate}%</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Win Rate</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-[var(--color-text-primary)]">{trader.followers.toLocaleString()}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Followers</div>
          </div>
        </div>

        {/* Assets */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {trader.assets.map(a => (
            <span key={a} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[10px] font-medium text-[var(--color-text-secondary)]">{a}</span>
          ))}
          <span className="text-[10px] text-[var(--color-text-muted)] ml-auto flex items-center gap-1">
            <Clock size={10} /> {trader.avgHoldTime}
          </span>
        </div>

        {/* Expandable details */}
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors mb-2 cursor-pointer">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Less' : 'More'} details
        </button>
        {expanded && (
          <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg bg-[var(--color-surface-2)] text-xs">
            <div><span className="text-[var(--color-text-muted)]">30d P&L:</span> <span className={`font-mono ${trader.pnl30d >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>${trader.pnl30d.toLocaleString()}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Trades:</span> <span className="font-mono">{trader.trades30d}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Strategy:</span> <span>{trader.strategy}</span></div>
            <div><span className="text-[var(--color-text-muted)]">Avg Hold:</span> <span className="font-mono">{trader.avgHoldTime}</span></div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isFollowing ? (
            <>
              <Btn variant="secondary" size="sm" className="flex-1" onClick={() => onUnfollow(trader.id)}>
                <Copy size={12} /> Following
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => onSettings(trader.id)}>
                Settings
              </Btn>
            </>
          ) : (
            <Btn variant="primary" size="sm" className="flex-1" onClick={() => onFollow(trader.id)}>
              <Copy size={12} /> Copy Trader
            </Btn>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
// CONTINUE_PAGE

export default function CopyTrading({ onNavigate: _onNavigate }) {
  const { traders, followTrader, unfollowTrader, isFollowing, followedTraders, followedCount } = useAppStore();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('pnl');

  const filtered = useMemo(() => {
    let list = [...(traders || [])];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.strategy.toLowerCase().includes(q) || t.assets.some(a => a.toLowerCase().includes(q)));
    }
    if (riskFilter !== 'all') list = list.filter(t => t.risk === riskFilter);
    if (sortBy === 'pnl') list.sort((a, b) => b.pnlPct30d - a.pnlPct30d);
    else if (sortBy === 'winRate') list.sort((a, b) => b.winRate - a.winRate);
    else if (sortBy === 'followers') list.sort((a, b) => b.followers - a.followers);
    return list;
  }, [traders, search, riskFilter, sortBy]);

  const topPnl = useMemo(() => {
    if (!traders || traders.length === 0) return { name: '-', pnlPct30d: 0 };
    return [...traders].sort((a, b) => b.pnlPct30d - a.pnlPct30d)[0];
  }, [traders]);

  const avgWinRate = useMemo(() => {
    if (!traders || traders.length === 0) return 0;
    return +(traders.reduce((s, t) => s + t.winRate, 0) / traders.length).toFixed(1);
  }, [traders]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader icon={Users} title="Copy Trading" subtitle="Discover top-performing traders and automatically copy their strategies">
        <Btn variant="primary" size="sm" onClick={() => {}}>
          <Zap size={12} /> Auto-Copy {followedCount > 0 && `(${followedCount} active)`}
        </Btn>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Top Trader P&L" value={`+${topPnl.pnlPct30d}%`} sublabel={topPnl.name} icon={TrendingUp} up />
        <Stat label="Avg Win Rate" value={`${avgWinRate}%`} icon={BarChart3} up={avgWinRate > 50} />
        <Stat label="Following" value={String(followedCount)} icon={Copy} />
        <Stat label="Available" value={String((traders || []).length)} icon={Users} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search traders, strategies, assets..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border-default)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-40)] transition-colors"
          />
        </div>
        <div className="flex items-center gap-1">
          {[{ key: 'all', label: 'All' }, { key: 'low', label: 'Low' }, { key: 'medium', label: 'Med' }, { key: 'high', label: 'High' }].map(r => (
            <Btn key={r.key} variant={riskFilter === r.key ? 'primary' : 'ghost'} size="sm" onClick={() => setRiskFilter(r.key)}>
              {r.label}
            </Btn>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[{ key: 'pnl', label: 'P&L' }, { key: 'winRate', label: 'Win%' }, { key: 'followers', label: 'Popular' }].map(s => (
            <Btn key={s.key} variant={sortBy === s.key ? 'secondary' : 'ghost'} size="sm" onClick={() => setSortBy(s.key)}>
              {s.label}
            </Btn>
          ))}
        </div>
      </div>

      {/* Trader Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(trader => (
          <TraderCard
            key={trader.id}
            trader={trader}
            isFollowing={isFollowing(trader.id)}
            followSettings={followedTraders[trader.id]}
            onFollow={followTrader}
            onUnfollow={unfollowTrader}
            onSettings={() => {}}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Users size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">No traders match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
