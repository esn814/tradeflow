import { Settings2, Shield, TrendingUp } from 'lucide-react';

export default function ConfigPanel({ strat, onClose, stopLoss, takeProfit, onStopLossChange, onTakeProfitChange }) {
  if (!strat) return null;
  const params = strat.params;
  const sliderKeys = ['stopLoss', 'takeProfit'];
  const sliderValues = { stopLoss, takeProfit };
  const sliderSetters = { stopLoss: onStopLossChange, takeProfit: onTakeProfitChange };
  const sliderRanges = {
    stopLoss: { min: 0.5, max: 20, step: 0.5 },
    takeProfit: { min: 1, max: 50, step: 0.5 },
  };

  return (
    <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-accent-33)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{strat.name} Settings</h3>
        </div>
        <button onClick={onClose} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Close</button>
      </div>

      <div className="space-y-4 mb-4">
        {sliderKeys.map(k => {
          const label = k === 'stopLoss' ? 'Stop Loss' : 'Take Profit';
          const val = sliderValues[k];
          const setter = sliderSetters[k];
          const range = sliderRanges[k];
          const isLoss = k === 'stopLoss';
          return (
            <div key={k} className="bg-[var(--color-surface-2)] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                  {isLoss ? <Shield size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-green-400" />}
                  {label}
                </label>
                <span className={`text-sm font-bold ${isLoss ? 'text-red-400' : 'text-green-400'}`}>
                  {val}%
                </span>
              </div>
              <input
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={val}
                onChange={e => setter(parseFloat(e.target.value))}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isLoss ? 'accent-red-400' : 'accent-green-400'}`}
                style={{
                  background: `linear-gradient(to right, ${isLoss ? 'var(--color-danger-alt)' : 'var(--color-success-alt)'} 0%, ${isLoss ? 'var(--color-danger-alt)' : 'var(--color-success-alt)'} ${((val - range.min) / (range.max - range.min)) * 100}%, var(--color-border-subtle) ${((val - range.min) / (range.max - range.min)) * 100}%, var(--color-border-subtle) 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
                <span>{range.min}%</span>
                <span className="text-[var(--color-text-secondary)]">
                  {isLoss ? 'Max loss per trade before auto-exit' : 'Target gain before taking profit'}
                </span>
                <span>{range.max}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--color-border-default)] pt-4">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Strategy Parameters</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(params)
            .filter(([k]) => !sliderKeys.includes(k))
            .map(([k, v]) => (
              <div key={k} className="bg-[var(--color-surface-2)] rounded-lg p-3">
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide block mb-1">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{v}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
