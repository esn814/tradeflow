import { Wallet, Unplug, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, Shield, Fingerprint, Wifi } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge } from '../components/ui';
import { CHAINS, WALLETS, shortAddr } from '../data/chains';

export default function WalletSection({
  connectedWallets, activeWalletIdx, setActiveWalletIdx,
  connecting, walletError, setWalletError,
  switchingChain, verifying,
  connectWallet, disconnectWallet, switchChain, verifyWallet, copyAddress,
  activeChain,
  signIn, isAuthenticated, authSignOut, getProviderFor,
}) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <SectionHeader icon={Wallet} title="Connected Wallets" badge={`${connectedWallets.length} Active`} />
        <p className="text-[var(--color-text-muted)] text-xs -mt-2">Connect multiple wallets across EVM-compatible chains. Paxeer (chain 125) is recommended for full functionality.</p>

        {/* SIWE Sign-In Banner */}
        {connectedWallets.length > 0 && !isAuthenticated && (
          <div className="flex items-center gap-3 bg-[var(--color-accent-8)] border border-[var(--color-accent-30)] rounded-xl p-3">
            <Shield className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Sign In with Ethereum</p>
              <p className="text-xs text-[var(--color-text-muted)]">Verify wallet ownership to access all features.</p>
            </div>
            <Btn
              onClick={async () => {
                const activeWallet = connectedWallets[activeWalletIdx];
                if (activeWallet) {
                  try {
                    const provider = getProviderFor(activeWallet.walletId) || window.ethereum;
                    await signIn(provider);
                  } catch (err) {
                    setWalletError(err.message || 'Sign-in rejected');
                  }
                }
              }}
            >
              <Fingerprint className="w-4 h-4" /> Sign In
            </Btn>
          </div>
        )}
        {isAuthenticated && (
          <div className="flex items-center gap-3 bg-[var(--color-success-8)] border border-[var(--color-success-30)] rounded-xl p-3">
            <CheckCircle className="w-5 h-5 text-[var(--color-success)] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Signed In</p>
              <p className="text-xs text-[var(--color-text-muted)]">Wallet verified via Sign-In with Ethereum.</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={authSignOut}>Sign Out</Btn>
          </div>
        )}

        {/* Network bar */}
        {CHAINS.map(chain => (
          <div key={chain.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${activeChain?.id === chain.id ? 'border' : ''}`} style={{ borderColor: chain.color + '60', background: chain.color + '10' }}>
            <span className="text-base">{chain.icon}</span>
            <span className="font-medium" style={{ color: chain.color }}>{chain.short}</span>
            {chain.isPrimary && <Badge variant="success" className="text-[10px] px-1.5 py-0">Primary</Badge>}
            <span className="text-[var(--color-text-muted)] ml-auto">Chain {chain.id}</span>
            {connectedWallets.some(w => w.chainId === chain.id) && <Wifi className="w-3 h-3" style={{ color: chain.color }} />}
          </div>
        ))}

        {/* Connected wallet cards */}
        {connectedWallets.map((wallet, idx) => {
          const chain = CHAINS.find(c => c.id === wallet.chainId);
          const isActive = idx === activeWalletIdx;
          return (
            <Card key={wallet.id} accent={isActive} className={`p-4 space-y-3 cursor-pointer ${isActive ? 'ring-1 ring-[var(--color-accent)]' : ''}`} onClick={() => setActiveWalletIdx(idx)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{wallet.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wallet.name}</span>
                      {isActive && <Badge variant="default" className="text-[10px]">Active</Badge>}
                      {wallet.verified && <Badge variant="success" className="text-[10px]"><Fingerprint className="w-3 h-3" /> Verified</Badge>}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">{shortAddr(wallet.address)}</span>
                      <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); copyAddress(wallet.address); }} title="Copy"><Copy className="w-3 h-3" /></Btn>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge style={{ background: chain?.color + '20', color: chain?.color }}>{chain?.icon} {chain?.short}</Badge>
                  <Btn variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.open(`${chain?.explorer}/address/${wallet.address}`, '_blank'); }}><ExternalLink className="w-4 h-4" /></Btn>
                  <Btn variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); disconnectWallet(idx); }}><Unplug className="w-3 h-3" /></Btn>
                </div>
              </div>

              {/* Chain switcher for active wallet */}
              {isActive && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="text-xs text-[var(--color-text-muted)] self-center mr-1">Switch to:</span>
                  {CHAINS.filter(c => c.id !== wallet.chainId).map(c => (
                    <Btn key={c.id} variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); switchChain(c.id); }} disabled={switchingChain}>
                      {c.icon} {c.short}
                    </Btn>
                  ))}
                  {!wallet.verified && (
                    <Btn variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); verifyWallet(idx); }} disabled={verifying === idx}>
                      {verifying === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Fingerprint className="w-3 h-3" />}
                      {verifying === idx ? 'Signing…' : 'Verify'}
                    </Btn>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {/* Add wallet buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {WALLETS.map(wallet => {
            const already = connectedWallets.some(w => w.walletId === wallet.id);
            const available = wallet.detect();
            return (
              <Btn
                key={wallet.id}
                variant="secondary"
                onClick={() => connectWallet(wallet.id)}
                disabled={connecting === wallet.id || already}
                className={`flex-col !items-center !gap-1 !p-3 ${!available ? 'opacity-40' : ''} ${already ? 'opacity-60' : ''}`}
              >
                <span className="text-xl">{wallet.icon}</span>
                <span className="text-xs font-medium">{wallet.name}</span>
                {already && <span className="text-[10px] text-[var(--color-accent)]">Connected</span>}
                {!available && !already && <span className="text-[10px] text-[var(--color-text-muted)]">Not detected</span>}
                {connecting === wallet.id && <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />}
              </Btn>
            );
          })}
        </div>

        {walletError && (
          <div className="flex items-center gap-2 text-[var(--color-danger)] text-sm bg-[var(--color-danger-10)] border border-[var(--color-danger-30)] rounded-xl p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {walletError}
            <Btn variant="ghost" size="sm" className="ml-auto" onClick={() => setWalletError(null)}>Dismiss</Btn>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
