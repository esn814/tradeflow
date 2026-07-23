import { useState } from 'react';
import { Rocket, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Btn, Card, CardBody, Badge } from './ui';
import { STRATEGIES } from '../data/marketData';

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'New to crypto trading', icon: '🌱' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Some trading experience', icon: '📊' },
  { id: 'advanced', label: 'Advanced', desc: 'Experienced trader', icon: '🔥' },
];

const INVESTMENT_AMOUNTS = [
  { id: '100', label: '$100', desc: 'Getting started' },
  { id: '500', label: '$500', desc: 'Small portfolio' },
  { id: '1000', label: '$1,000', desc: 'Medium portfolio' },
  { id: '5000', label: '$5,000+', desc: 'Serious investor' },
];

const AUTOMATION_LEVELS = [
  { id: 'auto', label: 'Fully Automated', desc: 'Set and forget — AI handles everything', icon: '🤖' },
  { id: 'semi', label: 'Semi-Automated', desc: 'Get signals, you decide when to trade', icon: '⚡' },
  { id: 'manual', label: 'Manual Signals', desc: 'Receive alerts, execute trades yourself', icon: '🎯' },
];

function recommendStrategy(experience, automation) {
  if (automation === 'auto') {
    if (experience === 'beginner') return 'dca';
    if (experience === 'intermediate') return 'grid';
    return 'trend';
  }
  if (automation === 'semi') {
    return experience === 'beginner' ? 'dca' : 'meanReversion';
  }
  return 'sentiment';
}


export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    experience: null,
    amount: null,
    automation: null,
  });

  const canNext = () => {
    if (step === 0) return !!answers.experience;
    if (step === 1) return !!answers.amount;
    if (step === 2) return !!answers.automation;
    return true;
  };

  const handleNext = () => {
    if (step < 3) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFinish = () => {
    const recommended = recommendStrategy(answers.experience, answers.automation);
    const strategy = STRATEGIES.find(s => s.id === recommended);
    onComplete({
      ...answers,
      recommendedStrategy: recommended,
      strategyName: strategy?.name || 'Smart DCA',
      virtualBalance: parseInt(answers.amount) || 1000,
    });
  };

  const steps = ['Experience', 'Budget', 'Style', 'Launch'];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', padding:16 }}>
      <Card className="w-full max-w-lg">
        <CardBody className="space-y-6">
          {/* Progress */}
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-full h-1.5 rounded-full transition-colors ${i <= step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            {steps.map((s, i) => (
              <span key={s} className={`text-[10px] font-medium ${i === step ? 'text-[var(--color-accent)]' : i < step ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>{s}</span>
            ))}
          </div>

          {/* Content */}
          <div key={step} className="onboarding-slide">
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">What's your trading experience?</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">We'll customize the experience for you.</p>
                  </div>
                  <div className="space-y-3">
                    {EXPERIENCE_LEVELS.map(level => (
                      <button
                        key={level.id}
                        onClick={() => setAnswers(a => ({ ...a, experience: level.id }))}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          answers.experience === level.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-focus)]'
                        }`}
                      >
                        <span className="text-2xl">{level.icon}</span>
                        <div>
                          <div className="text-sm font-bold text-[var(--color-text-primary)]">{level.label}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{level.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">How much would you start with?</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">This sets your virtual balance for demo trading.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {INVESTMENT_AMOUNTS.map(amt => (
                      <button
                        key={amt.id}
                        onClick={() => setAnswers(a => ({ ...a, amount: amt.id }))}
                        className={`flex flex-col items-center gap-1 p-4 rounded-xl border transition-all ${
                          answers.amount === amt.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-focus)]'
                        }`}
                      >
                        <div className="text-lg font-extrabold text-[var(--color-text-primary)]">{amt.label}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{amt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">How hands-on do you want to be?</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">Choose your level of automation.</p>
                  </div>
                  <div className="space-y-3">
                    {AUTOMATION_LEVELS.map(level => (
                      <button
                        key={level.id}
                        onClick={() => setAnswers(a => ({ ...a, automation: level.id }))}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          answers.automation === level.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-focus)]'
                        }`}
                      >
                        <span className="text-2xl">{level.icon}</span>
                        <div>
                          <div className="text-sm font-bold text-[var(--color-text-primary)]">{level.label}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{level.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center mx-auto">
                    <Rocket size={32} className="text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">You're all set!</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">We've configured a demo bot for you.</p>
                  </div>
                  <Card accent className="p-4 text-left">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Experience</span>
                        <span className="text-[var(--color-text-primary)] font-medium capitalize">{answers.experience}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Starting Balance</span>
                        <span className="text-[var(--color-text-primary)] font-medium">${parseInt(answers.amount || '1000').toLocaleString()} (Demo)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Automation</span>
                        <span className="text-[var(--color-text-primary)] font-medium capitalize">{answers.automation === 'auto' ? 'Fully Automated' : answers.automation === 'semi' ? 'Semi-Automated' : 'Manual'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Recommended Strategy</span>
                        <Badge variant="accent">{recommendStrategy(answers.experience, answers.automation) === 'dca' ? 'Smart DCA' : recommendStrategy(answers.experience, answers.automation) === 'grid' ? 'Grid Trading' : recommendStrategy(answers.experience, answers.automation) === 'trend' ? 'Trend Following' : recommendStrategy(answers.experience, answers.automation) === 'meanReversion' ? 'Mean Reversion' : 'Sentiment Trading'}</Badge>
                      </div>
                    </div>
                  </Card>
                  <p className="text-xs text-[var(--color-text-muted)]">Paper trading mode will be enabled. No real funds at risk.</p>
                </div>
              )}
            </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            {step > 0 ? (
              <Btn variant="ghost" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Btn>
            ) : <div />}
            {step < 3 ? (
              <Btn onClick={handleNext} disabled={!canNext()}>
                Next <ChevronRight className="w-4 h-4" />
              </Btn>
            ) : (
              <Btn onClick={handleFinish}>
                <Sparkles className="w-4 h-4" /> Launch Demo
              </Btn>
            )}
          </div>

          {/* Skip */}
          {step < 3 && (
            <button onClick={() => onComplete({ skipped: true })} className="w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
              Skip setup
            </button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
