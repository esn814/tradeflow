import { Target } from 'lucide-react';
import { RISK_PROFILES } from './autopilotData';
import InfoTip from '../InfoTip';

export default function RiskSelector({ selected, onSelect, strategy }) {
  return (
    <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border-default)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-[var(--color-accent)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Risk Style</h3>
        <InfoTip text="Choose how aggressively the bot trades. Conservative protects capital, Aggressive amplifies gains but also losses." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {RISK_PROFILES.map(profile => {
          const active = selected === profile.id;
          const Icon = profile.icon;
          const baseSl = strategy ? strategy.params.stopLoss : 3;
          const baseTp = strategy ? strategy.params.takeProfit : 6;
          const adjSl = (baseSl * profile.slMultiplier).toFixed(1);
          const adjTp = (baseTp * profile.tpMultiplier).toFixed(1);
          return (
            <button
              key={profile.id}
              onClick={() => onSelect(profile.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                active
                  ? `${profile.activeBorder} ${profile.activeBg} shadow-lg`
                  : `border-[var(--color-border-default)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-hover)]`
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} className={active ? profile.color : 'text-[var(--color-text-muted)]'} />
                <span className={`text-sm font-bold ${active ? profile.color : 'text-gray-300'}`}>
                  {profile.name}
                </span>
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${profile.bg} ${profile.color}`}>
                  {profile.label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mb-3">{profile.desc}</p>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-[var(--color-text-muted)]">SL: <span className="text-red-400 font-medium">{adjSl}%</span></span>
                <span className="text-[var(--color-text-muted)]">TP: <span className="text-green-400 font-medium">{adjTp}%</span></span>
                <span className="text-[var(--color-text-muted)]">Size: <span className="text-[var(--color-text-primary)] font-medium">{profile.sizeMultiplier}x</span></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
