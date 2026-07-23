import { useState } from 'react';
import { Gift, Copy, CheckCircle, Users, DollarSign, Share2, Crown, Zap, Star } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader, Divider, LinkCard } from '../components/ui';
import InfoTip from '../components/InfoTip';

const REFERRAL_REWARDS = [
  { milestone: 1, label: '1 friend joins', reward: '7 days Pro free', icon: Gift, color: 'var(--color-accent)' },
  { milestone: 3, label: '3 friends join', reward: '30 days Pro free', icon: Star, color: 'var(--color-warning)' },
  { milestone: 10, label: '10 friends join', reward: '3 months Pro free', icon: Crown, color: 'var(--color-purple)' },
];

const REFERRAL_HISTORY = [
  { name: 'Alex M.', joined: '2 days ago', status: 'active', earned: '7d Pro' },
  { name: 'Sarah K.', joined: '5 days ago', status: 'active', earned: '7d Pro' },
  { name: 'Jordan P.', joined: '1 week ago', status: 'pending', earned: '—' },
  { name: 'Chris L.', joined: '2 weeks ago', status: 'active', earned: '7d Pro' },
  { name: 'Maya R.', joined: '3 weeks ago', status: 'expired', earned: '—' },
];

export default function Referrals({ onNavigate }) {
  const [copied, setCopied] = useState(false);
  const [totalReferrals] = useState(12);
  const [activeReferrals] = useState(8);
  const [totalDaysEarned] = useState(56);

  const referralLink = 'https://tradeflow.app/invite/TF-7X4K9M';

  const handleCopy = () => {
    navigator.clipboard?.writeText(referralLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join me on TradeFlow',
        text: 'I\'ve been using TradeFlow for automated crypto trading. Use my link to get started and we both get rewards!',
        url: referralLink,
      }).catch(() => {});
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader icon={Gift} title="Referral Program" subtitle="Invite friends, both earn rewards. Grow the community and get free Pro time.">
        <Btn variant="primary" onClick={handleShare}>
          <Share2 className="w-4 h-4" /> Invite Friends
        </Btn>
      </PageHeader>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total Referrals" value={totalReferrals} color="text-[var(--color-accent)]" />
        <Stat label="Active Friends" value={activeReferrals} color="text-[var(--color-info)]" />
        <Stat label="Days Pro Earned" value={`${totalDaysEarned}d`} color="text-[var(--color-purple)]" />
        <Stat label="Your Tier" value="Silver" color="text-[var(--color-warning)]" sub="Next: Gold at 20 referrals" />
      </div>

      <Divider />

      {/* Referral Link */}
      <Card accent>
        <CardBody>
          <SectionHeader icon={Share2} title="Your Referral Link" action={<InfoTip text="Share this link with friends. When they sign up and connect an exchange, you both earn Pro days." />} />
          <div className="flex gap-2">
            <div className="flex-1 px-4 py-3 bg-[var(--color-surface-2)] rounded-xl text-sm text-[var(--color-text-primary)] font-mono truncate border border-[var(--color-border-strong)]">
              {referralLink}
            </div>
            <Btn variant={copied ? 'success' : 'primary'} onClick={handleCopy}>
              {copied ? <><CheckCircle className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
            </Btn>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-3">Your friend gets <span className="text-[var(--color-accent)] font-medium">7 days Pro free</span> on signup. You earn <span className="text-[var(--color-accent)] font-medium">7 days Pro free</span> when they connect their first exchange.</p>
        </CardBody>
      </Card>

      <Divider />

      {/* Reward Tiers */}
      <SectionHeader icon={Crown} title="Reward Milestones" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REFERRAL_REWARDS.map((tier, _i) => {
          const Icon = tier.icon;
          const reached = totalReferrals >= tier.milestone;
          return (
            <Card key={tier.milestone} hover className={reached ? '!border-[var(--color-accent)]/30' : ''}>
              <CardBody className="text-center">
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: tier.color + '18' }}>
                  <Icon size={24} style={{ color: tier.color }} />
                </div>
                <div className="text-2xl font-extrabold text-[var(--color-text-primary)] mb-1">{tier.milestone}</div>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">{tier.label}</p>
                <Badge variant={reached ? 'success' : 'accent'}>{reached ? '✓ Reached' : tier.reward}</Badge>
                {!reached && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min((totalReferrals / tier.milestone) * 100, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{totalReferrals}/{tier.milestone}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Divider />

      {/* Referral History */}
      <Card>
        <CardBody>
          <SectionHeader icon={Users} title="Referral History" badge={`${totalReferrals} total`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--color-text-muted)] text-xs border-b border-[var(--color-border-default)]">
                  <th className="text-left py-2 pr-4">Friend</th>
                  <th className="text-left py-2 pr-4">Joined</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-right py-2">Reward</th>
                </tr>
              </thead>
              <tbody>
                {REFERRAL_HISTORY.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border-default)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors">
                    <td className="py-3 pr-4 text-[var(--color-text-primary)] font-medium">{r.name}</td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{r.joined}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={r.status === 'active' ? 'success' : r.status === 'pending' ? 'warning' : 'danger'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3 text-right text-[var(--color-text-primary)] font-mono">{r.earned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* How It Works */}
      <Card>
        <CardBody>
          <SectionHeader icon={Zap} title="How It Works" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: 1, title: 'Share Your Link', desc: 'Send your unique referral link to friends via text, social media, or email.', color: 'var(--color-accent)' },
              { step: 2, title: 'Friend Signs Up', desc: 'They create a TradeFlow account using your link and get 7 days Pro free instantly.', color: 'var(--color-info)' },
              { step: 3, title: 'Both Get Rewarded', desc: 'When they connect their first exchange, you earn 7 days Pro free too.', color: 'var(--color-purple)' },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: s.color + '18', color: s.color }}>
                  {s.step}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{s.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={Gift} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={DollarSign} title="Pricing" desc="View plans and upgrade your account" color="var(--color-accent)" onClick={() => onNavigate('/pricing')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Users} title="Help" desc="FAQs about the referral program" color="var(--color-info)" onClick={() => onNavigate('/help')} />
        </div>
      </div>
    </div>
  );
}
