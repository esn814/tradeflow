import { Wallet, Shield } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, SectionHeader, Stat, PageHeader, Divider, LinkCard } from '../components/ui';
import { EXCHANGES } from '../data/chains';
import { useWallets } from '../hooks/useWallets';
import { useExchanges } from '../hooks/useExchanges';
import WalletSection from '../components/WalletSection';
import ExchangeSection from '../components/ExchangeSection';

export default function Connections({ onNavigate }) {
  const wallets = useWallets();
  const exchanges = useExchanges();

  const { connectedWallets } = wallets;
  const { connectedExchangeCount } = exchanges;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        icon={Wallet}
        title="Wallet & Network Connections"
        subtitle="Connect multiple wallets across chains. Paxeer is the primary network."
      >
        <InfoTip text="Connect wallets on different chains to fund bots and receive payouts. Paxeer (chain 125) is the primary trading network." />
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Wallets Connected" value={`${connectedWallets.length}`} color={connectedWallets.length > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'} sub={connectedWallets.length > 0 ? connectedWallets.map(w => w.name).join(', ') : 'None'} />
        <Stat label="Exchanges" value={`${connectedExchangeCount}/${EXCHANGES.length}`} color={connectedExchangeCount > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'} sub={connectedExchangeCount > 0 ? 'Active' : 'None connected'} />
        <Stat label="Status" value={connectedWallets.length > 0 && connectedExchangeCount > 0 ? 'Healthy' : connectedWallets.length > 0 ? 'Partial' : 'Disconnected'} color={connectedWallets.length > 0 && connectedExchangeCount > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning-alt)]'} />
      </div>

      <Divider />

      {/* Wallet Section */}
      <WalletSection {...wallets} />

      <Divider />

      {/* Exchange Section */}
      <ExchangeSection {...exchanges} />

      <Divider />
      <SectionHeader icon={Shield} title="Related" />
      <div className="grid grid-cols-1 gap-4">
        <LinkCard icon={Shield} title="Security" desc="2FA, API keys, session management" color="var(--color-accent)" onClick={() => onNavigate('/security')} />
      </div>
    </div>
  );
}
