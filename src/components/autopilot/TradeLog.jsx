import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

export default function TradeLog({ trades, expanded, onToggle }) {
  if (!trades.length) return null;
  const shown = expanded ? trades : trades.slice(0, 6);
  return (
    <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border-default)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Trade Log</h3>
          <span className="text-[10px] bg-[var(--color-accent-15)] text-[var(--color-accent)] px-2 py-0.5 rounded-full font-medium">{trades.length} trades</span>
        </div>
        <button onClick={onToggle} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Collapse' : 'Show all'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border-default)]">
              <th className="text-left py-2 pr-3 font-medium">Time</th>
              <th className="text-left py-2 pr-3 font-medium">Pair</th>
              <th className="text-left py-2 pr-3 font-medium">Side</th>
              <th className="text-right py-2 pr-3 font-medium">Price</th>
              <th className="text-right py-2 pr-3 font-medium">Qty</th>
              <th className="text-right py-2 pr-3 font-medium">SL/TP</th>
              <th className="text-right py-2 font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(t => (
              <tr key={t.id} className="border-b border-[var(--color-border-default)]/50">
                <td className="py-2 pr-3 text-[var(--color-text-secondary)] font-mono">{t.time.toLocaleTimeString()}</td>
                <td className="py-2 pr-3 text-[var(--color-text-primary)] font-medium">{t.pair}</td>
                <td className="py-2 pr-3">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.side === 'BUY' ? 'bg-green-400/15 text-green-400' : 'bg-red-400/15 text-red-400'}`}>
                    {t.side}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-gray-300 font-mono">${parseFloat(t.price).toLocaleString()}</td>
                <td className="py-2 pr-3 text-right text-gray-300 font-mono">{t.qty}</td>
                <td className="py-2 pr-3 text-right text-[var(--color-text-muted)] font-mono text-[10px]">{t.sl}%/{t.tp}%</td>
                <td className={`py-2 text-right font-medium font-mono ${parseFloat(t.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {parseFloat(t.pnl) >= 0 ? '+' : ''}{t.pnl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
