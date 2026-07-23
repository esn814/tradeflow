import { useState, useMemo } from 'react';
import { Zap, Shield, Clock, ArrowRight, DollarSign, Sparkles, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { useMode, useAppStore } from '../context/AppStore';
import { useLivePrices } from '../data/liveData';
import { Card, CardBody, SectionHeader, Btn, Badge, Stat, Divider, LinkCard } from '../components/ui';

const AMOUNTS = [50, 100, 250, 500, 1000];

export default function Home({ onNavigate }) {
  const { simple } = useMode();
  const { prices, loading } = useLivePrices(['btc', 'eth', 'sol', 'pax'], 30000);
  const [selectedAmount, setSelectedAmount] = useState(250);

  if (simple) {
    return <SimpleHome onNavigate={onNavigate} selectedAmount={selectedAmount} setSelectedAmount={setSelectedAmount} prices={prices} loading={loading} />;
  }

  return <AdvancedHome onNavigate={onNavigate} prices={prices} loading={loading} />;
}

function SimpleHome({ onNavigate, selectedAmount, setSelectedAmount }) {
  const { totalValue, totalPnL } = useAppStore();
  const earnings = useMemo(() => {
    const rate = totalPnL > 0 && totalValue > totalPnL ? (totalPnL / (totalValue - totalPnL)) : 0.05;
    return {
      monthly: Math.round(selectedAmount * rate),
      yearly: Math.round(selectedAmount * rate * 12),
    };
  }, [selectedAmount, totalPnL, totalValue]);

  return (
    <div className="max-w-xl mx-auto space-y-5 animate-fade-in">
      {/* Hero */}
      <div className="text-center pt-6 pb-2">
        <Badge variant="accent"><Sparkles size={11} /> AI trades for you 24/7</Badge>
        <h1 className="text-[32px] font-extrabold text-[var(--color-text-primary)] mt-4 mb-2 tracking-tight leading-tight">
          Put your money to work
        </h1>
        <p className="text-[var(--color-text-secondary)] text-base leading-relaxed">
          Pick an amount. The bot handles everything. Cash out anytime.
        </p>
      </div>

      <Divider />

      {/* Amount picker */}
      <Card>
        <CardBody>
          <SectionHeader icon={DollarSign} title="Choose your amount" />
          <div className="grid grid-cols-5 gap-2 mb-5">
            {AMOUNTS.map(a => (
              <Btn
                key={a}
                variant={selectedAmount === a ? 'primary' : 'secondary'}
                size="sm"
                className="justify-center"
                onClick={() => setSelectedAmount(a)}
              >
                ${a}
              </Btn>
            ))}
          </div>
          <input
            type="range"
            min={10}
            max={5000}
            step={10}
            value={selectedAmount}
            onChange={e => setSelectedAmount(+e.target.value)}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mt-1.5">
            <span>$10</span>
            <span className="text-[var(--color-text-primary)] font-bold text-sm">${selectedAmount.toLocaleString()}</span>
            <span>$5,000</span>
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* Earnings estimate */}
      <Card accent>
        <CardBody>
          <SectionHeader icon={DollarSign} title="Estimated earnings" />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Per month" value={`~$${earnings.monthly}`} color="text-[var(--color-accent)]" />
            <Stat label="Per year" value={`~$${earnings.yearly}`} />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-4 leading-relaxed">
            Based on average 5% monthly returns. Actual results vary — you can lose money too.
          </p>
        </CardBody>
      </Card>

      {/* CTA */}
      <Btn variant="primary" size="full" onClick={() => onNavigate('/invest')}>
        Start Earning <ArrowRight size={18} />
      </Btn>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-text-muted)] py-2">
        <span className="flex items-center gap-1.5"><Shield size={13} className="text-[var(--color-accent)]" /> Your wallet</span>
        <span className="flex items-center gap-1.5"><Clock size={13} className="text-[var(--color-accent)]" /> Pause anytime</span>
        <span className="flex items-center gap-1.5"><Zap size={13} className="text-[var(--color-accent)]" /> No lock-in</span>
      </div>

      <Divider />

      {/* How it works */}
      <Card>
        <CardBody>
          <SectionHeader icon={Zap} title="How it works" />
          <div className="space-y-5 stagger">
            {[
              { n: '1', text: 'Start with $10,000 in virtual funds — no wallet needed' },
              { n: '2', text: 'Our AI bot trades for you using real market data — buying low, selling high' },
              { n: '3', text: 'Track your simulated earnings anytime. Try different strategies risk-free.' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3.5 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center text-xs font-bold shrink-0">
                  {s.n}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pt-1">{s.text}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function AdvancedHome({ onNavigate, prices, loading }) {
  const coins = [
    { symbol: 'btc', name: 'Bitcoin', color: 'var(--color-btc)' },
    { symbol: 'eth', name: 'Ethereum', color: 'var(--color-eth)' },
    { symbol: 'sol', name: 'Solana', color: 'var(--color-sol)' },
    { symbol: 'pax', name: 'Paxeer', color: 'var(--color-accent)' },
  ];

  const [priceChanges] = useState(() => {
    const offsets = {};
    ['btc', 'eth', 'sol', 'pax'].forEach(s => { offsets[s] = (Math.random() * 6 - 2); });
    return offsets;
  });

  return (
    <div className="space-y-5 max-w-5xl animate-fade-in">
      {/* Hero */}
      <Card className="relative overflow-hidden">
        <div className="glow-orb w-72 h-72 bg-[var(--color-accent)] top-[-40%] right-[-10%]" />
        <CardBody className="lg:p-8 relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Badge variant="accent"><Zap size={11} /> Advanced Trading Platform</Badge>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-[var(--color-text-primary)] mt-3 mb-2 tracking-tight">
                Your Crypto, On Autopilot
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm max-w-md leading-relaxed">
                Choose a strategy, set your amount, and let AI handle the rest.
              </p>
            </div>
            <Badge variant={loading ? 'warning' : 'success'}>
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-success)]'} animate-pulse inline-block`} />
              {loading ? 'Updating...' : 'Live Prices'}
            </Badge>
          </div>

          <Btn variant="primary" size="full" onClick={() => onNavigate('/invest')}>
            <Zap size={18} /> Start in 60 Seconds
          </Btn>

          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5"><Shield size={13} className="text-[var(--color-accent)]" /> Your keys, your funds</span>
            <span className="flex items-center gap-1.5"><BarChart3 size={13} className="text-[var(--color-accent)]" /> AI-powered</span>
            <span className="hidden sm:flex items-center gap-1.5"><Zap size={13} className="text-[var(--color-accent)]" /> Pause anytime</span>
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* Live Prices */}
      <SectionHeader icon={TrendingUp} title="Live Prices" badge="Real-time" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        {coins.map(c => {
          const p = prices[c.symbol];
          const price = p?.price || p?.usd || null;
          const change = p?.change_24h || p?.change || priceChanges[c.symbol];
          const up = change >= 0;
          return (
            <Card key={c.symbol} hover className="animate-fade-in">
              <CardBody>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: c.color + '18', color: c.color }}>
                    {c.symbol.toUpperCase().slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-[var(--color-text-primary)] text-sm font-semibold">{c.name}</div>
                    <div className="text-[var(--color-text-muted)] text-[11px]">{c.symbol.toUpperCase()}/USD</div>
                  </div>
                </div>
                <div className="text-[var(--color-text-primary)] font-extrabold text-lg tracking-tight">
                  {price ? `${parseFloat(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                </div>
                <Badge variant={up ? 'success' : 'danger'}>
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {up ? '+' : ''}{typeof change === 'number' ? change.toFixed(2) : '0.00'}%
                  <span className="text-[var(--color-text-muted)] font-normal ml-1">24h</span>
                </Badge>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Divider />

      {/* Quick actions */}
      <SectionHeader icon={BarChart3} title="Quick Actions" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={BarChart3} title="Backtester" desc="Test strategies before risking money" color="var(--color-info)" onClick={() => onNavigate('/backtester')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Zap} title="Strategies" desc="6 AI-powered trading strategies" color="var(--color-purple)" onClick={() => onNavigate('/strategies')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Shield} title="Risk Manager" desc="Position sizing & allocation" color="var(--color-warning)" onClick={() => onNavigate('/risk')} />
        </div>
      </div>
    </div>
  );
}
