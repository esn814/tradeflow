import { useState } from 'react';
import {
  Zap, Brain, Lock, DollarSign, ChevronDown, ChevronRight,
  HelpCircle, BookOpen, Lightbulb
} from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge, PageHeader, Divider, Input, LinkCard } from '../components/ui';

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Zap,
    color: 'var(--color-accent)',
    items: [
      {
        q: 'How do I start trading?',
        a: 'Head to Invest → pick a bot strategy (DCA is great for beginners) → set your amount → hit Launch. That\'s it — your bot runs 24/7.',
      },
      {
        q: 'Do I need crypto experience?',
        a: 'No. Every bot comes with sensible defaults. Just pick one that matches your risk comfort — Low (DCA), Medium (Grid/Trend), or High (Arbitrage).',
      },
      {
        q: 'How much money do I need?',
        a: 'Start with as little as $100. Presets are available at $100, $250, $500, $1000, and $2500 — or enter any custom amount.',
      },
    ],
  },
  {
    id: 'bots',
    title: 'Trading Bots',
    icon: Brain,
    color: 'var(--color-purple)',
    items: [
      {
        q: 'DCA Bot — Dollar Cost Averaging',
        a: 'Buys a fixed amount at regular intervals regardless of price. Smooths out volatility over time. Best for: long-term accumulators who want low stress.',
        tag: 'Low Risk',
        tagColor: 'text-green-400 bg-green-400/10',
      },
      {
        q: 'Grid Bot — Range Trading',
        a: 'Places buy and sell orders at fixed price levels in a range. Profits from price bouncing up and down. Best for: sideways markets.',
        tag: 'Medium Risk',
        tagColor: 'text-yellow-400 bg-yellow-400/10',
      },
      {
        q: 'Trend Bot — Momentum',
        a: 'Follows price momentum using EMA crossovers and breakouts. Rides the wave up and exits when it fades. Best for: trending markets.',
        tag: 'Medium Risk',
        tagColor: 'text-yellow-400 bg-yellow-400/10',
      },
      {
        q: 'Arbitrage Bot — Price Gaps',
        a: 'Exploits tiny price differences across exchanges. Fast, frequent trades with small margins. Best for: fragmented liquidity conditions.',
        tag: 'High Risk',
        tagColor: 'text-red-400 bg-red-400/10',
      },
      {
        q: 'Sentiment Bot — News & Social',
        a: 'Reads social media, news, and Fear & Greed index using AI to predict price moves. Best for: news-driven markets.',
        tag: 'High Risk',
        tagColor: 'text-red-400 bg-red-400/10',
      },
      {
        q: 'Mean Reversion — Bollinger Bands',
        a: 'Buys when price drops below the expected range, sells when it rises above. Bets on prices returning to average. Best for: range-bound markets.',
        tag: 'Medium Risk',
        tagColor: 'text-yellow-400 bg-yellow-400/10',
      },
    ],
  },
  {
    id: 'pages',
    title: 'What Each Page Does',
    icon: BookOpen,
    color: 'var(--color-info)',
    items: [
      {
        q: 'Home',
        a: 'Your starting point. Live prices for BTC, ETH, SOL, and PAX with a quick-start button to launch a bot in 60 seconds.',
      },
      {
        q: 'Dashboard',
        a: 'Portfolio overview — see your active positions, live P&L, win rate, and BTC price chart at a glance.',
      },
      {
        q: 'Invest',
        a: 'Three-step wizard to launch a new trading bot. Choose strategy → set amount → launch.',
      },
      {
        q: 'My Bots',
        a: 'All your running bots in one place. Pause, resume, adjust settings, or stop any bot.',
      },
      {
        q: 'Strategies',
        a: 'Browse and customize 6 AI-powered strategies with adjustable parameters. Toggle them on/off individually.',
      },
      {
        q: 'Backtester',
        a: 'Test any strategy on simulated data. See equity curves, monthly returns, win rate, and trade logs before risking real money.',
      },
      {
        q: 'Alerts',
        a: 'Set price alerts, bot event notifications, and portfolio threshold warnings. Get notified before big moves.',
      },
      {
        q: 'Risk Manager',
        a: 'Position sizing calculator, Kelly Criterion, and portfolio allocation presets (Conservative / Balanced / Growth).',
      },
      {
        q: 'Connections',
        a: 'Connect your crypto wallet (MetaMask, Trust, Coinbase) and exchange API keys for live order execution.',
      },
      {
        q: 'Pricing',
        a: 'View plan tiers — Free (1 bot), Pro ($29/mo, 5 bots), Elite ($99/mo, unlimited). All plans have a 1% trade fee.',
      },
      {
        q: 'Security',
        a: 'Manage 2FA, API key permissions, session history, and login alerts. Your keys are encrypted at rest.',
      },
      {
        q: 'Settings',
        a: 'Theme, notifications, default currency, timezone, and data export preferences.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'How AI Helps',
    icon: Lightbulb,
    color: 'var(--color-warning)',
    items: [
      {
        q: 'Signal Filtering',
        a: 'ML classifiers reduce false buy/sell signals by analyzing order flow, volume profiles, and market microstructure.',
      },
      {
        q: 'Regime Detection',
        a: 'Detects when the market switches between trending, ranging, and volatile states — and adjusts strategy weights automatically.',
      },
      {
        q: 'Dynamic Tuning',
        a: 'Bayesian optimization continuously adjusts stop-losses, take-profits, and position sizes based on live volatility.',
      },
      {
        q: 'Sentiment Analysis',
        a: 'LLMs process news feeds, social media, and on-chain whale activity to generate alpha signals.',
      },
    ],
  },
  {
    id: 'fees',
    title: 'Fees & Costs',
    icon: DollarSign,
    color: 'var(--color-profit)',
    items: [
      {
        q: 'What does it cost?',
        a: '1% platform fee per automated trade + $0.50 network fee per on-chain transaction. No withdrawal fees. Free plan has 1 bot.',
      },
      {
        q: 'Are there hidden fees?',
        a: 'No. The only costs are the 1% trade fee and $0.50 network fee. What you see is what you pay.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Safety',
    icon: Lock,
    color: 'var(--color-loss)',
    items: [
      {
        q: 'Is my money safe?',
        a: 'Your funds stay in YOUR connected wallet — we never hold them. Exchange API keys are trade-only (no withdrawal permission). Keys are encrypted at rest.',
      },
      {
        q: 'Can I stop a bot anytime?',
        a: 'Yes. Every bot can be paused or stopped instantly from My Bots. Your funds return to your wallet.',
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }) {
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-surface-2)] transition-all"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isOpen ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'}`}>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
        <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1">{item.q}</span>
        {item.tag && (
          <Badge variant={item.tag === 'Low Risk' ? 'success' : item.tag === 'Medium Risk' ? 'warning' : 'danger'}>
            {item.tag}
          </Badge>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pl-[52px]">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.a}</p>
        </div>
      )}
    </Card>
  );
}

export default function Help({ onNavigate }) {
  const [openItems, setOpenItems] = useState(new Set(['getting-started-0']));
  const [search, setSearch] = useState('');

  const toggle = (id) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const matchesSearch = (item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <PageHeader icon={HelpCircle} title="Help & Guide" subtitle="Everything you need to know, in plain English" />

      {/* Search */}
      <Input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search topics..."
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Bot Types', value: '6', color: 'var(--color-purple)' },
          { label: 'Strategies', value: '6', color: 'var(--color-accent)' },
          { label: 'Pages', value: '12', color: 'var(--color-info)' },
        ].map(s => (
          <Card key={s.label} className="text-center">
            <CardBody>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">{s.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Divider />

      {/* Sections */}
      {SECTIONS.map(section => {
        const Icon = section.icon;
        const filteredItems = section.items.filter(matchesSearch);
        if (filteredItems.length === 0) return null;

        return (
          <div key={section.id} className="space-y-3">
            <SectionHeader
              icon={Icon}
              title={section.title}
              badge={`${filteredItems.length}`}
            />
            <div className="space-y-2">
              {filteredItems.map((item, i) => {
                const id = `${section.id}-${i}`;
                return (
                  <AccordionItem
                    key={id}
                    item={item}
                    isOpen={openItems.has(id)}
                    onToggle={() => toggle(id)}
                  />
                );
              })}
            </div>
            <Divider />
          </div>
        );
      })}

      {/* No results */}
      {search && SECTIONS.every(s => s.items.filter(matchesSearch).length === 0) && (
        <Card className="text-center">
          <CardBody>
            <HelpCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-[var(--color-text-muted)] text-sm">No results for "{search}"</p>
            <Btn variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-2">
              Clear search
            </Btn>
          </CardBody>
        </Card>
      )}

      {/* Footer tip */}
      <Card className="text-center">
        <CardBody>
          <p className="text-[var(--color-text-muted)] text-sm">
            Still stuck? Click the <span className="text-red-400 font-medium">bug icon</span> in the bottom-right corner to report an issue — we respond within 24 hours.
          </p>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={DollarSign} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LinkCard icon={DollarSign} title="Pricing" desc="Compare plans and find the right tier for your trading volume" color="var(--color-warning)" onClick={() => onNavigate('/pricing')} />
        <LinkCard icon={Lock} title="Privacy Policy" desc="How we collect, use, and protect your data" color="var(--color-purple)" onClick={() => onNavigate('/privacy')} />
        <LinkCard icon={Lock} title="Terms of Service" desc="Usage terms, risk disclosures, and liability" color="var(--color-loss)" onClick={() => onNavigate('/terms')} />
      </div>
    </div>
  );
}
