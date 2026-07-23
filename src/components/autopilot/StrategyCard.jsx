
export default function StrategyCard({ strat, selected, onSelect }) {
  const Icon = strat.icon;
  const active = selected === strat.id;
  return (
    <button
      onClick={() => onSelect(strat.id)}
      className={`text-left w-full p-4 rounded-xl border transition-all ${
        active
          ? 'bg-[var(--color-accent-10)] border-[var(--color-accent)] shadow-lg shadow-[var(--color-accent-10)]'
          : 'bg-[var(--color-surface-1)] border-[var(--color-border-default)] hover:border-[var(--color-border-hover)]'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-[var(--color-accent)]/20' : 'bg-[var(--color-surface-3)]'}`}>
          <Icon size={18} className={active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${strat.riskColor}`}>{strat.risk}</span>
      </div>
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{strat.name}</h4>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">{strat.desc}</p>
      <div className="flex items-center gap-4 text-[11px]">
        <span className="text-[var(--color-text-muted)]">Win: <span className="text-green-400 font-medium">{strat.winRate}%</span></span>
        <span className="text-[var(--color-text-muted)]">Return: <span className="text-[var(--color-text-primary)] font-medium">{strat.avgReturn}</span></span>
      </div>
    </button>
  );
}
