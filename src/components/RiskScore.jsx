import { useMemo } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

/* ── Risk scoring engine ── */

const STRATEGY_BASE_RISK = {
  grid: 4,
  dca: 3,
  trend: 6,
  meanReversion: 5,
  sentiment: 8,
  arbitrage: 3,
};

const RISK_LEVELS = [
  { max: 2, label: 'Very Low', color: 'var(--color-success)', bg: 'var(--color-success-18)', advice: 'Conservative. Good for capital preservation.' },
  { max: 4, label: 'Low', color: 'var(--color-profit)', bg: 'var(--color-profit-18)', advice: 'Low risk. Suitable for cautious investors.' },
  { max: 5, label: 'Moderate', color: 'var(--color-profit-light)', bg: 'var(--color-profit-light-18)', advice: 'Balanced risk/reward. Good for most portfolios.' },
  { max: 7, label: 'Medium-High', color: 'var(--color-warning)', bg: 'var(--color-warning-18)', advice: 'Elevated risk. Only use with funds you can afford to lose.' },
  { max: 9, label: 'High', color: 'var(--color-danger-light)', bg: 'var(--color-danger-light-18)', advice: 'High risk. Significant drawdowns possible.' },
  { max: 10, label: 'Very High', color: 'var(--color-loss)', bg: 'var(--color-loss-18)', advice: 'Extreme risk. For experienced traders only.' },
];

function getRiskLevel(score) {
  return RISK_LEVELS.find(l => score <= l.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

// eslint-disable-next-line react-refresh/only-export-components
export function calculateRiskScore(bot) {
  const strategyType = (bot.strategy || bot.type || '').toLowerCase().replace(/[\s-]/g, '');
  const base = STRATEGY_BASE_RISK[strategyType] || 5;

  // Adjust for position size relative to portfolio
  let adjustment = 0;
  const investRatio = bot.invested / 10000; // assume $10K portfolio
  if (investRatio > 0.5) adjustment += 2;
  else if (investRatio > 0.3) adjustment += 1;
  else if (investRatio < 0.1) adjustment -= 1;

  // Adjust for P&L performance (losing bots are riskier)
  const pnlPct = ((bot.currentValue - bot.invested) / bot.invested) * 100;
  if (pnlPct < -10) adjustment += 2;
  else if (pnlPct < -5) adjustment += 1;
  else if (pnlPct > 15) adjustment -= 1;

  return Math.max(1, Math.min(10, base + adjustment));
}

/* ── Visual risk badge (inline, for bot cards) ── */
export function RiskBadge({ score, compact = false }) {
  const level = getRiskLevel(score);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>
        {score}/10 {level.label}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold" style={{ color: level.color }}>{score}/10</span>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: level.bg, color: level.color }}>{level.label}</span>
    </div>
  );
}

/* ── Risk score card (detailed, for bot detail view) ── */
export function RiskScoreCard({ bot }) {
  const score = useMemo(() => calculateRiskScore(bot), [bot]);
  const level = getRiskLevel(score);
  const angle = (score / 10) * 180 - 90;
  const circumference = Math.PI * 60;
  const filled = (score / 10) * circumference;

  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: level.color + '30', background: level.bg }}>
      <div className="flex items-center gap-4">
        {/* Gauge */}
        <div className="flex-shrink-0">
          <svg width="100" height="65" viewBox="0 0 120 68">
            <path d="M 10 62 A 50 50 0 0 1 110 62" fill="none" stroke="var(--color-border-strong)" strokeWidth="8" strokeLinecap="round" />
            <path d="M 10 62 A 50 50 0 0 1 110 62" fill="none" stroke={level.color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
            <line x1="60" y1="62" x2={60 + 35 * Math.cos((angle * Math.PI) / 180)} y2={62 - 35 * Math.sin((-angle * Math.PI) / 180)}
              stroke={level.color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="60" cy="62" r="3" fill={level.color} />
            <text x="60" y="55" textAnchor="middle" fill={level.color} fontSize="16" fontWeight="800">{score}</text>
          </svg>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-extrabold" style={{ color: level.color }}>{level.label}</span>
            <span className="text-xs text-[var(--color-text-muted)]">Risk Score</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{level.advice}</p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
            <span>Strategy: {bot.type || bot.strategy}</span>
            <span>•</span>
            <span>Invested: ${bot.invested?.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Position sizing recommendation ── */
export function PositionSizingAdvice({ bot, portfolioValue = 10000 }) {
  const score = useMemo(() => calculateRiskScore(bot), [bot]);
  const _level = getRiskLevel(score);

  // Max recommended allocation based on risk score
  const maxAllocation = score <= 3 ? 30 : score <= 5 ? 20 : score <= 7 ? 15 : score <= 9 ? 10 : 5;
  const recommendedAmount = Math.round((portfolioValue * maxAllocation) / 100);
  const currentPct = ((bot.invested / portfolioValue) * 100).toFixed(1);
  const isOverAllocated = (bot.invested / portfolioValue) * 100 > maxAllocation;

  return (
    <div className="p-3 bg-[var(--color-surface-2)] rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        {isOverAllocated ? <AlertTriangle size={13} className="text-[var(--color-warning)]" /> : <Shield size={13} className="text-[var(--color-profit)]" />}
        <span className="text-xs font-bold text-[var(--color-text-primary)]">Position Sizing Advice</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-[var(--color-text-muted)] block">Current</span>
          <span className={`font-mono font-bold ${isOverAllocated ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-primary)]'}`}>{currentPct}%</span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)] block">Max Rec.</span>
          <span className="font-mono font-bold text-[var(--color-profit)]">{maxAllocation}%</span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)] block">Rec. Amount</span>
          <span className="font-mono font-bold text-[var(--color-text-primary)]">${recommendedAmount.toLocaleString()}</span>
        </div>
      </div>
      {isOverAllocated && (
        <p className="text-[10px] text-[var(--color-warning)]">This bot is over-allocated for its risk level. Consider reducing position size.</p>
      )}
    </div>
  );
}
