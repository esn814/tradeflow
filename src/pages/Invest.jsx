import { useState } from 'react';
import { Zap, Shield, TrendingUp, Repeat, Grid3x3, ArrowRight, ArrowLeft, CheckCircle, Wallet, DollarSign, AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, Btn, Badge, PageHeader, Divider, Input } from '../components/ui';
import { STRATEGIES } from '../data/marketData';
import { useAppStore } from '../context/AppStore';

const BOTS = [
  { id: 'dca', name: 'DCA Bot', desc: 'Buy a little every day — smooths out the ups and downs', icon: Repeat, risk: 'Low', riskColor: 'text-green-400 bg-green-400/10', popular: true, returns: '3–8%' },
  { id: 'grid', name: 'Grid Bot', desc: 'Profits from price bouncing up and down in a range', icon: Grid3x3, risk: 'Medium', riskColor: 'text-yellow-400 bg-yellow-400/10', popular: false, returns: '5–15%' },
  { id: 'trend', name: 'Trend Bot', desc: 'Rides the wave — buys when prices are climbing', icon: TrendingUp, risk: 'Medium', riskColor: 'text-yellow-400 bg-yellow-400/10', popular: false, returns: '8–20%' },
  { id: 'arb', name: 'Arbitrage Bot', desc: 'Grabs small profits from price differences across exchanges', icon: Shield, risk: 'High', riskColor: 'text-red-400 bg-red-400/10', popular: false, returns: '10–30%' },
];

const WALLETS = ['My MetaMask', 'My Trust Wallet', 'My Coinbase Wallet', '+ Add Wallet'];
const PRESETS = [100, 250, 500, 1000, 2500];

const StepIndicator = ({ step }) => (
  <div className="flex items-center justify-center gap-3 mb-8">
    {['Choose Bot', 'Set Amount', 'Launch'].map((label, i) => (
      <div key={i} className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > i ? 'bg-[var(--color-accent)] text-[var(--color-surface-deep)]' : step === i ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]' : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'}`}>
          {step > i ? <CheckCircle size={16} /> : i + 1}
        </div>
        <span className={`text-xs hidden sm:inline ${step >= i ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{label}</span>
        {i < 2 && <div className={`w-8 h-0.5 ${step > i ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'}`} />}
      </div>
    ))}
  </div>
);

export default function Invest({ onNavigate }) {
  const { addBot } = useAppStore();
  const [step, setStep] = useState(0);
  const [selectedBot, setSelectedBot] = useState(null);
  const [wallet, setWallet] = useState(WALLETS[0]);
  const [amount, setAmount] = useState(250);
  const [customMode, setCustomMode] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [riskDisclaimerOpen, setRiskDisclaimerOpen] = useState(false);

  const bot = BOTS.find(b => b.id === selectedBot);
  const strategy = STRATEGIES.find(s => s.id === selectedBot);

  // Build projection chart data from bot return range
  const projectionData = bot ? (() => {
    const parts = bot.returns.replace(/%/g, '').split('–').map(Number);
    const lowMonthly = (parts[0] || 3) / 100;
    const highMonthly = (parts[1] || parts[0] || 8) / 100;
    const baseMonthly = (lowMonthly + highMonthly) / 2;
    return Array.from({ length: 13 }, (_, i) => ({
      month: i === 0 ? 'Now' : `M${i}`,
      Conservative: +(amount * Math.pow(1 + lowMonthly * 0.6, i)).toFixed(0),
      Expected: +(amount * Math.pow(1 + baseMonthly, i)).toFixed(0),
      Optimistic: +(amount * Math.pow(1 + highMonthly * 1.2, i)).toFixed(0),
    }));
  })() : [];
  const platformFee = amount * 0.01;
  const networkFee = 0.50;
  const totalCost = amount + platformFee + networkFee;

  const handleLaunch = () => {
    addBot({ name: bot.name + ' Bot', type: bot.name.split(' ')[0], coin: 'BTC', invested: amount, currentValue: amount, status: 'active', strategy: selectedBot });
    setLaunched(true);
  };

  if (launched) return (
    <div className="min-h-screen bg-[var(--color-surface-deep)] flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardBody className="p-8">
          <div className="w-16 h-16 bg-[var(--color-accent)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-[var(--color-accent)]" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Bot Launched! 🎉</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">Your {bot?.name} is now running with ${amount} in virtual funds. You can pause or stop it anytime from My Bots.</p>
          <Btn variant="primary" size="full" onClick={() => onNavigate?.('/my-bots')}>
            View My Bots
          </Btn>
          <Btn variant="ghost" size="full" className="mt-3" onClick={() => { setLaunched(false); setStep(0); setSelectedBot(null); }}>
            Start Another
          </Btn>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-surface-deep)] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <PageHeader icon={Zap} title="Invest" subtitle="Set up an automated trading bot in 3 easy steps">
          <InfoTip text="Pick a strategy, choose your amount, and launch. You can pause or stop anytime." />
        </PageHeader>
        <StepIndicator step={step} />

        {/* Step 1: Choose Bot */}
        {step === 0 && (
          <div className="space-y-3">
            {BOTS.map(b => {
              const Icon = b.icon;
              return (
                <Card key={b.id} hover className={`cursor-pointer ${selectedBot === b.id ? '!border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30' : ''}`}>
                  <CardBody>
                    <button onClick={() => setSelectedBot(b.id)} className="w-full text-left">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-3)] flex items-center justify-center shrink-0"><Icon size={20} className="text-[var(--color-accent)]" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--color-text-primary)]">{b.name}</span>
                            {b.popular && <Badge variant="accent">MOST POPULAR</Badge>}
                            <Badge variant={b.risk === 'Low' ? 'success' : b.risk === 'Medium' ? 'warning' : 'danger'}>{b.risk} Risk</Badge>
                          </div>
                          <p className="text-[var(--color-text-secondary)] text-sm mt-1">{b.desc}</p>
                          <p className="text-[var(--color-accent)] text-xs mt-1">Typical monthly return: {b.returns}</p>
                        </div>
                      </div>
                    </button>
                  </CardBody>
                </Card>
              );
            })}
            {selectedBot && strategy && (
              <Card className="!border-[var(--color-accent)]/30">
                <CardBody className="p-4">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Strategy Details</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Monthly Return</p>
                      <p className="text-sm font-semibold text-[var(--color-accent)]">{strategy.returnRange}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Best Market</p>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{strategy.bestMarket}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">AI Value Rating</p>
                      <p className="text-sm font-semibold text-[var(--color-accent)]">{strategy.aiValue}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
            <Btn
              variant="primary"
              size="full"
              onClick={() => selectedBot && setStep(1)}
              className="mt-4"
              disabled={!selectedBot}
              style={!selectedBot ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
            >
              Continue <ArrowRight size={18} />
            </Btn>
          </div>
        )}

        {/* Step 2: Wallet & Amount */}
        {step === 1 && (
          <div className="space-y-5">
            <Card>
              <CardBody>
                <label className="text-sm text-[var(--color-text-secondary)] mb-2 flex items-center gap-2"><Wallet size={14} /> Select Wallet</label>
                <select value={wallet} onChange={e => setWallet(e.target.value)}
                  className="w-full bg-[var(--color-surface-3)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] rounded-lg p-3 mt-1 focus:outline-none focus:border-[var(--color-accent)]">
                  {WALLETS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <label className="text-sm text-[var(--color-text-secondary)] mb-3 flex items-center gap-2"><DollarSign size={14} /> Investment Amount</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESETS.map(p => (
                    <Btn key={p} variant={!customMode && amount === p ? 'primary' : 'secondary'} size="sm"
                      onClick={() => { setAmount(p); setCustomMode(false); }}>
                      ${p.toLocaleString()}
                    </Btn>
                  ))}
                  <Btn variant={customMode ? 'primary' : 'secondary'} size="sm" onClick={() => setCustomMode(true)}>
                    Custom
                  </Btn>
                </div>
                {customMode && (
                  <div className="mt-2">
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(Math.max(10, +e.target.value))}
                      min={10}
                    />
                    <input type="range" min={10} max={10000} step={10} value={amount} onChange={e => setAmount(+e.target.value)}
                      className="w-full accent-[var(--color-accent)] mt-3" />
                    <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1"><span>$10</span><span>$10,000</span></div>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                  Fee Breakdown
                  <InfoTip text="A 1% platform fee covers AI execution and monitoring. The network fee covers on-chain gas costs." />
                </h3>
                <Divider />
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm"><span className="text-[var(--color-text-secondary)]">Investment</span><span className="text-[var(--color-text-primary)]">${amount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[var(--color-text-secondary)]">Platform fee (1%)</span><span className="text-[var(--color-text-primary)]">${platformFee.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[var(--color-text-secondary)]">Network fee</span><span className="text-[var(--color-text-primary)]">~${networkFee.toFixed(2)}</span></div>
                  <Divider />
                  <div className="flex justify-between font-semibold"><span className="text-[var(--color-text-primary)]">Total</span><span className="text-[var(--color-accent)]">${totalCost.toFixed(2)}</span></div>
                </div>
                {bot && (
                  <div className="flex items-center gap-2 mt-3 p-3 bg-[var(--color-accent)]/5 rounded-lg">
                    <AlertCircle size={14} className="text-[var(--color-accent)] shrink-0" />
                    <span className="text-xs text-[var(--color-text-secondary)]">Expected monthly return: <span className="text-[var(--color-accent)] font-semibold">{bot.returns}</span> (${(amount * parseFloat(bot.returns.split('\u2013')[0]) / 100).toFixed(0)}–${(amount * parseFloat(bot.returns.split('–')[1]) / 100).toFixed(0)})</span>
                  </div>
                )}
              </CardBody>
            </Card>

            {bot && projectionData.length > 0 && (
              <Card>
                <CardBody>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                    Portfolio Projection (12 months)
                    <InfoTip text="Projected portfolio value based on the bot's historical return range. These are estimates, not guarantees." />
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={projectionData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradOptimistic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-eth)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-eth)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradConservative" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-btc)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--color-btc)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(1)}k`} width={40} />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-border-default)', border: '1px solid var(--color-border-tooltip)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: 'var(--color-text-chart)' }}
                        formatter={v => [`${v.toLocaleString()}`, undefined]}
                      />
                      <Area type="monotone" dataKey="Optimistic" stroke="var(--color-accent)" fill="url(#gradOptimistic)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="Expected" stroke="var(--color-eth)" fill="url(#gradExpected)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="Conservative" stroke="var(--color-btc)" fill="url(#gradConservative)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><span className="w-2 h-2 rounded-full bg-[var(--color-btc)]" /> Conservative</span>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><span className="w-2 h-2 rounded-full bg-[var(--color-eth)]" /> Expected</span>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" /> Optimistic</span>
                  </div>
                </CardBody>
              </Card>
            )}

            <div className="flex gap-3">
              <Btn variant="secondary" size="full" onClick={() => setStep(0)}>
                <ArrowLeft size={16} /> Back
              </Btn>
              <Btn variant="primary" size="full" onClick={() => setStep(2)}>
                Review <ArrowRight size={18} />
              </Btn>
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Launch */}
        {step === 2 && (
          <div className="space-y-5">
            <Card>
              <CardBody>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                  Review Your Setup
                  <InfoTip text="Double-check your paper trading setup. Your bot starts trading immediately with virtual funds." />
                </h3>
                <Divider />
                <div className="space-y-3 mt-3">
                  <div className="flex justify-between py-2 border-b border-[var(--color-border-default)]"><span className="text-[var(--color-text-secondary)]">Bot</span><span className="text-[var(--color-text-primary)] font-semibold">{bot?.name}</span></div>
                  <div className="flex justify-between py-2 border-b border-[var(--color-border-default)]"><span className="text-[var(--color-text-secondary)]">Risk Level</span><span className={`font-semibold ${bot?.risk === 'Low' ? 'text-green-400' : bot?.risk === 'Medium' ? 'text-yellow-400' : 'text-red-400'}`}>{bot?.risk}</span></div>
                  <div className="flex justify-between py-2 border-b border-[var(--color-border-default)]"><span className="text-[var(--color-text-secondary)]">Wallet</span><span className="text-[var(--color-text-primary)] font-semibold">{wallet}</span></div>
                  <div className="flex justify-between py-2 border-b border-[var(--color-border-default)]"><span className="text-[var(--color-text-secondary)]">Investment</span><span className="text-[var(--color-text-primary)] font-semibold">${amount.toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 border-b border-[var(--color-border-default)]"><span className="text-[var(--color-text-secondary)]">Total Cost</span><span className="text-[var(--color-accent)] font-bold">${totalCost.toFixed(2)}</span></div>
                  <div className="flex justify-between py-2"><span className="text-[var(--color-text-secondary)]">Expected Returns</span><span className="text-[var(--color-accent)] font-semibold">{bot?.returns}/mo</span></div>
                </div>
              </CardBody>
            </Card>

            <Card className="!border-yellow-500/30">
              <button
                onClick={() => setRiskDisclaimerOpen(!riskDisclaimerOpen)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-400">Risk Disclaimer</span>
                </div>
                {riskDisclaimerOpen ? <ChevronUp size={16} className="text-yellow-400" /> : <ChevronDown size={16} className="text-yellow-400" />}
              </button>
              {riskDisclaimerOpen && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    This is a paper trading simulation with virtual funds. No real money is at risk. Strategies use real market data but trades are simulated for learning and testing.
                  </p>
                </div>
              )}
            </Card>

            <Btn variant="primary" size="full" className="text-lg shadow-lg shadow-[var(--color-accent)]/20" onClick={handleLaunch}>
              <Zap size={22} /> Start Trading
            </Btn>

            <p className="text-center text-[var(--color-text-muted)] text-xs">You can pause or stop your bot at any time — no lock-in period.</p>

            <Btn variant="ghost" size="full" onClick={() => setStep(1)}>
              <ArrowLeft size={14} /> Go back and edit
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
