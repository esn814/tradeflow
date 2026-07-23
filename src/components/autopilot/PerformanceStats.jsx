export default function PerformanceStats({ trades }) {
  const totalPnl = trades.reduce((s, t) => s + parseFloat(t.pnl), 0);
  const wins = trades.filter(t => parseFloat(t.pnl) > 0).length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  const vol = trades.reduce((s, t) => s + parseFloat(t.price) * parseFloat(t.qty), 0);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: 'Total P\u0026L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
        { label: 'Win Rate', value: `${winRate}%`, color: 'text-[var(--color-text-primary)]' },
        { label: 'Trades', value: trades.length, color: 'text-[var(--color-text-primary)]' },
        { label: 'Volume', value: `$${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: 'text-[var(--color-text-primary)]' },
      ].map(c => (
        <div key={c.label} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border-default)] p-4">
          <div className="text-[11px] text-[var(--color-text-muted)] mb-1">{c.label}</div>
          <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
