import { useState } from 'react';
import { Bot, ChevronRight, Play, Pause, Settings2, Zap, TrendingUp, Shield, BarChart3, Brain, Network, BookOpen, CheckCircle, XCircle, Target, Copy } from 'lucide-react';
import { STRATEGIES } from '../data/marketData';
import { Card, CardBody, SectionHeader, Btn, Badge, PageHeader, Divider, LinkCard } from '../components/ui';
import { useMode, useAppStore } from '../context/AppStore';

const ICONS = {
  grid: Network,
  dca: TrendingUp,
  trend: Zap,
  meanReversion: BarChart3,
  sentiment: Brain,
  arbitrage: Bot,
};

const _RISK_COLORS = {
  'Low-Medium': 'var(--color-profit)',
  'Medium': 'var(--color-warning)',
  'Medium-Low': 'var(--color-profit)',
  'Medium-High': 'var(--color-danger-light)',
  'High': 'var(--color-loss)',
};

const RISK_BADGE_VARIANTS = {
  'Low-Medium': 'success',
  'Medium': 'warning',
  'Medium-Low': 'success',
  'Medium-High': 'danger',
  'High': 'danger',
};

/* ─── Simple mode: compact strategy row ─── */
function SimpleStrategyCard({ s, isRunning, onToggle }) {
  const Icon = ICONS[s.id] || Bot;
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-[var(--color-accent-15)] flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[var(--color-accent)]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{s.name}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">{s.description}</p>
        </div>
      </div>
      <button
        onClick={() => onToggle(s.id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex-shrink-0 ml-3 ${
          isRunning
            ? 'bg-[var(--color-profit-22)] text-[var(--color-profit)] border border-[var(--color-profit-44)]'
            : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] border border-[var(--color-border-strong)]'
        }`}
      >
        {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {isRunning ? 'On' : 'Off'}
      </button>
    </div>
  );
}

export default function Strategies({ onNavigate }) {
  const { simple } = useMode();
  const { strategyStates, setStrategyState } = useAppStore();
  const [active, setActive] = useState(null);
  const [running, setRunning] = useState(() => {
    const init = {};
    STRATEGIES.forEach(s => {
      init[s.id] = strategyStates[s.id]?.enabled ?? true;
    });
    return init;
  });
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const [paramValues, setParamValues] = useState(() => {
    const init = {};
    STRATEGIES.forEach(s => {
      const saved = strategyStates[s.id]?.params;
      s.params.forEach(p => { init[p.key] = saved?.[p.key] ?? p.default; });
    });
    return init;
  });

  const toggleRun = (id) => {
    setRunning(prev => {
      const newVal = !prev[id];
      setStrategyState(id, { enabled: newVal });
      return { ...prev, [id]: newVal };
    });
  };
  const updateParam = (key, val) => setParamValues(prev => ({ ...prev, [key]: val }));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader icon={Bot} title="Trading Strategies" subtitle="Configure and manage AI-powered trading strategies">
        {!simple && (
          <Btn variant="primary" size="md" onClick={() => onNavigate('/autopilot')}>
            <Bot className="w-4 h-4" /> New Strategy
          </Btn>
        )}
      </PageHeader>

      {simple ? (
        /* ─── Simple mode: compact list with toggles ─── */
        <div className="space-y-3">
          {STRATEGIES.map(s => (
            <SimpleStrategyCard key={s.id} s={s} isRunning={running[s.id]} onToggle={toggleRun} />
          ))}
        </div>
      ) : (
        /* ─── Full mode: detailed strategy cards ─── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {STRATEGIES.map(s => {
            const Icon = ICONS[s.id] || Bot;
            const isActive = active === s.id;
            const isRunning = running[s.id];
            return (
              <Card
                key={s.id}
                hover={!isActive}
                className={`cursor-pointer ${isActive ? '!border-[var(--color-accent-66)] ring-1 ring-[var(--color-accent-33)]' : ''}`}
                onClick={() => setActive(isActive ? null : s.id)}
              >
                <CardBody>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-15)] flex items-center justify-center">
                        <Icon className="w-5 h-5 text-[var(--color-accent)]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{s.name}</h3>
                        <Badge variant={RISK_BADGE_VARIANTS[s.risk] || 'warning'}>{s.risk} Risk</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleRun(s.id); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isRunning ? 'bg-[var(--color-profit-22)] text-[var(--color-profit)]' : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <ChevronRight className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${isActive ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">{s.description}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[var(--color-surface-2)] rounded-lg p-2">
                      <span className="text-[var(--color-text-muted)] block">Return</span>
                      <span className="text-[var(--color-profit)] font-medium">{s.returnRange}</span>
                    </div>
                    <div className="bg-[var(--color-surface-2)] rounded-lg p-2">
                      <span className="text-[var(--color-text-muted)] block">Market</span>
                      <span className="text-[var(--color-text-primary)] font-medium">{s.bestMarket}</span>
                    </div>
                    <div className="bg-[var(--color-surface-2)] rounded-lg p-2">
                      <span className="text-[var(--color-text-muted)] block">AI Value</span>
                      <span className="text-[var(--color-purple)] font-medium">{s.aiValue}</span>
                    </div>
                  </div>
                </CardBody>

                {isActive && (
                  <div className="border-t border-[var(--color-border-default)] p-5 space-y-4">
                    {/* Beginner Explanation */}
                    {s.beginnerDesc && (
                      <div className="p-3 bg-[var(--color-purple-10)] border border-[var(--color-purple-25)] rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen size={14} className="text-[var(--color-purple)]" />
                          <span className="text-xs font-bold text-[var(--color-purple)]">In Plain English</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{s.beginnerDesc}</p>
                      </div>
                    )}

                    {/* Market Fit Indicator */}
                    {s.marketFit && (
                      <div className="p-3 bg-[var(--color-surface-2)] rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Target size={14} className="text-[var(--color-info)]" />
                          <span className="text-xs font-bold text-[var(--color-info)]">Market Fit</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(s.marketFit).map(([cond, fit]) => (
                            <div key={cond} className="text-center">
                              <div className={`text-lg mb-0.5 ${fit === 'excellent' ? 'text-[var(--color-profit)]' : fit === 'good' ? 'text-[var(--color-profit-light)]' : fit === 'fair' ? 'text-[var(--color-warning)]' : 'text-[var(--color-loss)]'}`}>
                                {fit === 'excellent' ? '●●●' : fit === 'good' ? '●●○' : fit === 'fair' ? '●○○' : '○○○'}
                              </div>
                              <span className="text-[10px] text-[var(--color-text-muted)] capitalize">{cond}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* When to use / avoid */}
                    {(s.whenToUse || s.whenToAvoid) && (
                      <div className="grid grid-cols-1 gap-2">
                        {s.whenToUse && (
                          <div className="flex items-start gap-2">
                            <CheckCircle size={13} className="text-[var(--color-profit)] mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-[var(--color-text-secondary)]"><span className="text-[var(--color-profit)] font-medium">Use when:</span> {s.whenToUse}</p>
                          </div>
                        )}
                        {s.whenToAvoid && (
                          <div className="flex items-start gap-2">
                            <XCircle size={13} className="text-[var(--color-loss)] mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-[var(--color-text-secondary)]"><span className="text-[var(--color-loss)] font-medium">Avoid when:</span> {s.whenToAvoid}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <SectionHeader icon={Settings2} title="Parameters" />
                    {s.params.map(p => (
                      <div key={p.key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--color-text-secondary)]">{p.label}</span>
                          <span className="text-[var(--color-text-primary)] font-mono">{paramValues[p.key] ?? p.default}</span>
                        </div>
                        <input
                          type="range"
                          min={p.min}
                          max={p.max}
                          value={paramValues[p.key] ?? p.default}
                          step={typeof p.default === 'number' && p.default < 1 ? 0.005 : 1}
                          className="w-full h-1.5 bg-[var(--color-surface-3)] rounded-full appearance-none cursor-pointer accent-[var(--color-accent)]"
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); updateParam(p.key, +e.target.value); }}
                        />
                        <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          <span>{p.min}</span>
                          <span>{p.max}</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Btn variant="primary" size="sm" className="flex-1" onClick={e => { e.stopPropagation(); const stratParams = {}; s.params.forEach(p => { stratParams[p.key] = paramValues[p.key] ?? p.default; }); localStorage.setItem('tradeflow-strategy-' + s.id, JSON.stringify(stratParams)); setStrategyState(s.id, { params: stratParams }); setSaveSuccess(s.id); setTimeout(() => setSaveSuccess(null), 2000); }}>
                        {saveSuccess === s.id ? '✓ Saved!' : 'Save & Apply'}
                      </Btn>
                      <Btn variant="success" size="sm" onClick={e => { e.stopPropagation(); const stratParams = {}; s.params.forEach(p => { stratParams[p.key] = paramValues[p.key] ?? p.default; }); const cloned = { id: `clone-${s.id}-${Date.now()}`, name: `${s.name} (Copy)`, type: s.name.split(' ')[0], strategy: s.id, params: stratParams, copiedFrom: s.name, copiedAt: Date.now() }; localStorage.setItem('tradeflow-copied-strategy', JSON.stringify(cloned)); setCopySuccess(s.id); setTimeout(() => setCopySuccess(null), 2000); }}>
                        <Copy size={13} /> {copySuccess === s.id ? '✓ Copied!' : 'Copy'}
                      </Btn>
                      <Btn variant="secondary" size="sm" onClick={e => { e.stopPropagation(); const defaults = {}; s.params.forEach(p => { defaults[p.key] = p.default; }); setParamValues(prev => ({ ...prev, ...defaults })); }}>
                        Reset
                      </Btn>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!simple && (
        <>
          <Divider />

          <Card>
            <CardBody>
              <SectionHeader icon={Brain} title="How AI Enhances Each Strategy" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Shield className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-[var(--color-text-primary)] font-medium">Signal Filtering</h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">ML classifiers reduce false signals by analyzing order flow, volume profiles, and market microstructure patterns that humans miss.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Brain className="w-4 h-4 text-[var(--color-purple)] mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-[var(--color-text-primary)] font-medium">Regime Detection</h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">Hidden Markov Models and transformer-based classifiers detect market regime changes (trending, ranging, volatile) and switch strategy weights accordingly.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Zap className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-[var(--color-text-primary)] font-medium">Dynamic Parameter Tuning</h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">Bayesian optimization continuously tunes stop-losses, take-profits, and position sizes based on evolving volatility and correlation structures.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <TrendingUp className="w-4 h-4 text-[var(--color-profit)] mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-[var(--color-text-primary)] font-medium">Sentiment Integration</h3>
                      <p className="text-xs text-[var(--color-text-secondary)]">LLMs process news feeds, social sentiment, and on-chain whale activity to generate alpha signals that complement technical strategies.</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Quick Links */}
          <Divider />
          <SectionHeader icon={BarChart3} title="Next Steps" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
            <div className="animate-fade-in">
              <LinkCard icon={BarChart3} title="Backtester" desc="Test these strategies with historical data before going live" color="var(--color-info)" onClick={() => onNavigate('/backtester')} />
            </div>
            <div className="animate-fade-in">
              <LinkCard icon={Zap} title="Autopilot" desc="Launch a strategy and let AI trade for you" color="var(--color-accent)" onClick={() => onNavigate('/autopilot')} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
