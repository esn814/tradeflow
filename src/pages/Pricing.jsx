import { useState } from 'react';
import { useAppStore } from '../context/AppStore';
import { Check, X, Zap, Crown, Rocket, ArrowRight, DollarSign, HelpCircle } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, Btn, Badge, PageHeader, Divider, Toggle, LinkCard, SectionHeader } from '../components/ui';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    period: 'Free forever',
    icon: Zap,
    color: 'var(--color-text-muted)',
    desc: 'Try automated trading with zero commitment',
    features: [
      { text: '1 active bot', included: true },
      { text: 'Pre-built strategies only', included: true },
      { text: 'Basic price alerts (5)', included: true },
      { text: 'Community support', included: true },
      { text: 'Up to $500 invested', included: true },
      { text: 'Custom strategies', included: false },
      { text: 'Priority execution', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'API access', included: false },
      { text: 'Dedicated support', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: '/month',
    icon: Crown,
    color: 'var(--color-accent)',
    badge: 'Most Popular',
    desc: 'Serious tools for active traders',
    features: [
      { text: '5 active bots', included: true },
      { text: 'All pre-built strategies', included: true },
      { text: 'Unlimited price alerts', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Up to $25,000 invested', included: true },
      { text: 'Custom strategies', included: true },
      { text: 'Priority execution', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'API access', included: false },
      { text: 'Dedicated support', included: false },
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 99,
    period: '/month',
    icon: Rocket,
    color: 'var(--color-purple-bright)',
    desc: 'Unlimited power for professional portfolios',
    features: [
      { text: 'Unlimited bots', included: true },
      { text: 'All strategies + custom', included: true },
      { text: 'Unlimited alerts + SMS', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'Unlimited investment', included: true },
      { text: 'Custom strategies', included: true },
      { text: 'Priority execution', included: true },
      { text: 'Advanced analytics + exports', included: true },
      { text: 'Full API access', included: true },
      { text: 'White-glove onboarding', included: true },
    ],
  },
];

export default function Pricing({ onNavigate }) {
  const { settings, updateSettings } = useAppStore();
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState(settings.selectedPlan || null);

  const getPrice = (plan) => {
    if (plan.price === 0) return 0;
    return annual ? Math.round(plan.price * 10) : plan.price;
  };

  const getSavings = (plan) => {
    if (plan.price === 0) return null;
    return annual ? Math.round(plan.price * 12 - plan.price * 10) : null;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <PageHeader icon={DollarSign} title="Simple, Transparent Pricing" subtitle="Start free, upgrade when you're ready. No hidden fees — just a platform fee on trades.">
          <InfoTip text="Start free with 1 bot. Upgrade to Pro or Elite for more bots, strategies, and higher limits." />
        </PageHeader>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className={`text-sm ${!annual ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}>Monthly</span>
          <Toggle
            label=""
            checked={annual}
            onChange={setAnnual}
          />
          <span className={`text-sm ${annual ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}>Annual</span>
          {annual && <Badge variant="accent">Save 17%</Badge>}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const Icon = plan.icon;
          const price = getPrice(plan);
          const savings = getSavings(plan);
          const isSelected = selected === plan.id;

          return (
            <Card key={plan.id} accent={!!plan.badge} hover className="relative flex flex-col">
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-accent)] text-[var(--color-surface-deep)] text-xs font-bold px-4 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}

              <CardBody className="flex flex-col flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}20`, color: plan.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[var(--color-text-primary)] font-bold text-lg">{plan.name}</h3>
                    <p className="text-[var(--color-text-muted)] text-xs">{plan.desc}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-[var(--color-text-primary)]">${price}</span>
                    <span className="text-[var(--color-text-muted)] text-sm">{plan.period}</span>
                  </div>
                  {savings && <p className="text-[var(--color-accent)] text-xs mt-1">Save ${savings}/year vs monthly</p>}
                </div>

                <div className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      {f.included ? (
                        <Check className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                      )}
                      <span className={`text-sm ${f.included ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}`}>{f.text}</span>
                    </div>
                  ))}
                </div>

                <Btn
                  variant={plan.badge || isSelected ? 'primary' : 'secondary'}
                  size="full"
                  onClick={() => { setSelected(plan.id); updateSettings({ selectedPlan: plan.id }); }}
                >
                  {plan.price === 0 ? 'Get Started Free' : isSelected ? 'Selected' : `Choose ${plan.name}`}
                  {isSelected && <ArrowRight className="w-4 h-4" />}
                </Btn>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Fee Info */}
      <Card>
        <CardBody>
          <h3 className="text-[var(--color-text-primary)] font-semibold mb-3">Platform Fees on All Plans</h3>
          <Divider />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center text-sm font-bold">%</div>
              <div>
                <p className="text-[var(--color-text-primary)] text-sm font-medium">1% Trade Fee</p>
                <p className="text-[var(--color-text-muted)] text-xs">On each automated trade executed by your bots</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center text-sm font-bold">$</div>
              <div>
                <p className="text-[var(--color-text-primary)] text-sm font-medium">$0.50 Network Fee</p>
                <p className="text-[var(--color-text-muted)] text-xs">Per on-chain transaction (gas costs)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center text-sm font-bold">0</div>
              <div>
                <p className="text-[var(--color-text-primary)] text-sm font-medium">No Withdrawal Fees</p>
                <p className="text-[var(--color-text-muted)] text-xs">Withdraw your funds anytime at no extra cost</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={HelpCircle} title="Related" />
      <div className="grid grid-cols-1 gap-4">
        <LinkCard icon={HelpCircle} title="Help" desc="FAQs, guides, and support for getting started" color="var(--color-info)" onClick={() => onNavigate('/help')} />
      </div>
    </div>
  );
}
