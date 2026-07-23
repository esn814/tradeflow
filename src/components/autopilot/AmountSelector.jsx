import InfoTip from '../InfoTip';

export default function AmountSelector({ value, onChange }) {
  const presets = [50, 100, 250, 500, 1000];
  return (
    <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border-default)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--color-accent)] font-bold text-sm">$</span>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Trading Amount</h3>
        <InfoTip text="How much USD to allocate per trade. The bot splits this across trades based on the strategy." />
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold text-[var(--color-accent)]">$</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onFocus={e => e.target.select()}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            const num = parseInt(raw, 10);
            if (!isNaN(num)) onChange(Math.max(10, Math.min(50000, num)));
          }}
          className="w-full max-w-[160px] bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-xl px-4 py-3 text-xl font-bold text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none transition min-h-[48px]"
        />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition min-h-[44px] ${
              value === p
                ? 'bg-[var(--color-accent)] text-[var(--color-surface-deep)]'
                : 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-hover)]'
            }`}
          >
            ${p}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={10}
        max={5000}
        step={10}
        value={Math.min(value, 5000)}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
        style={{
          background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${((Math.min(value, 5000) - 10) / (5000 - 10)) * 100}%, var(--color-border-subtle) ${((Math.min(value, 5000) - 10) / (5000 - 10)) * 100}%, var(--color-border-subtle) 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
        <span>$10</span>
        <span>$5,000</span>
      </div>
    </div>
  );
}
