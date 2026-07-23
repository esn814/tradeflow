import { TrendingUp, TrendingDown, Eye } from 'lucide-react';
import InfoTip from '../InfoTip';

export default function MarketScanner({ prices, loading }) {
  const items = [
    { sym: 'btc', label: 'Bitcoin', icon: '\u20bf' },
    { sym: 'eth', label: 'Ethereum', icon: '\u039e' },
    { sym: 'sol', label: 'Solana', icon: '\u25ce' },
    { sym: 'pax', label: 'Paxeer', icon: 'P' },
  ];

  return (
    <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border-default)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={16} className="text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Market Scanner</h3>
        <InfoTip text="Live prices from the Paxeer data feed. The autopilot uses these to make real-time trading decisions." />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(({ sym, label, icon }) => {
          const p = prices?.[sym];
          const price = p?.price;
          const change = p?.change24h ?? 0;
          const up = change >= 0;
          return (
            <div key={sym} className="bg-[var(--color-surface-2)] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
              </div>
              {loading || !price ? (
                <div className="h-5 bg-[var(--color-surface-3)] rounded animate-pulse mt-1" />
              ) : (
                <>
                  <div className="text-base font-bold text-[var(--color-text-primary)]">
                    ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-xs font-medium flex items-center gap-1 ${up ? 'text-green-400' : 'text-red-400'}`}>
                    {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(change).toFixed(2)}%
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
