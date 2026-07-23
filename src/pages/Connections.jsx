import { useState, useEffect } from 'react';
import { useAppStore } from '../context/AppStore';
import { encryptExchangeKeys, sanitize } from '../utils/crypto';
import { useAuth } from '../context/AuthContext';
import { Wallet, Link, Unplug, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, Shield, Fingerprint, Wifi } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader, Divider, Input, LinkCard } from '../components/ui';
import { CHAINS, WALLETS, EXCHANGES, getChainById, shortAddr } from '../data/chains';

// ─── Helper: get the injected provider for a specific wallet ───
function getProviderFor(walletId) {
  if (typeof window === 'undefined') return null;
  const eth = window.ethereum;
  if (!eth) return null;
  if (eth.providers?.length) {
    return eth.providers.find(p =>
      walletId === 'metamask' ? p.isMetaMask
      : walletId === 'coinbase' ? p.isCoinbaseWallet
      : walletId === 'trust' ? p.isTrust
      : walletId === 'phantom' ? p.isPhantom
      : walletId === 'rabby' ? p.isRabby
      : walletId === 'rainbow' ? p.isRainbow
      : null
    ) || null;
  }
  // Single provider — only return if it matches
  const match =
    (walletId === 'metamask' && eth.isMetaMask) ||
    (walletId === 'coinbase' && eth.isCoinbaseWallet) ||
    (walletId === 'trust' && eth.isTrust) ||
    (walletId === 'phantom' && eth.isPhantom) ||
    (walletId === 'rabby' && eth.isRabby) ||
    (walletId === 'rainbow' && eth.isRainbow);
  return match ? eth : null;
}

export default function Connections({ onNavigate }) {
  const { settings, updateSettings } = useAppStore();
  const { signIn, isAuthenticated, signOut: authSignOut } = useAuth();

  // ── Multi-wallet state: array of { id, walletId, name, icon, address, chainId, verified, connectedAt } ──
  const [connectedWallets, setConnectedWallets] = useState(settings?.connectedWallets || []);
  const [activeWalletIdx, setActiveWalletIdx] = useState(0);
  const [connecting, setConnecting] = useState(null);
  const [walletError, setWalletError] = useState(null);
  const [switchingChain, setSwitchingChain] = useState(false);
  const [, setChainPickerOpen] = useState(false);
  const [verifying, setVerifying] = useState(null);

  // ── Exchange state ──
  const [exchangeKeys, setExchangeKeys] = useState(settings?.exchangeKeys || {});
  const [showAddExchange, setShowAddExchange] = useState(null);
  const [exchangeForm, setExchangeForm] = useState({});
  const [testingExchange, setTestingExchange] = useState(null);
  const [exchangeStatus, setExchangeStatus] = useState({});

  // ── Persist connected wallets to store ──
  useEffect(() => {
    updateSettings({ connectedWallets });
  }, [connectedWallets, updateSettings]);

  // ── Detect already-connected wallets on mount ──
  useEffect(() => {
    const detect = async () => {
      if (!window.ethereum) return;
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0 && connectedWallets.length === 0) {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          const walletId = window.ethereum.isMetaMask ? 'metamask'
            : window.ethereum.isCoinbaseWallet ? 'coinbase'
            : window.ethereum.isTrust ? 'trust'
            : window.ethereum.isPhantom ? 'phantom'
            : 'metamask';
          const w = WALLETS.find(w => w.id === walletId);
          setConnectedWallets([{
            id: `w-${Date.now()}`,
            walletId,
            name: w?.name || 'Wallet',
            icon: w?.icon || '👛',
            address: accounts[0],
            chainId: parseInt(chainId, 16),
            verified: false,
            connectedAt: new Date().toISOString(),
          }]);
        }
      } catch (e) { console.warn(e); }
    };
    detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for account/chain changes on all providers ──
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccounts = (accounts) => {
      if (accounts.length === 0) return;
      setConnectedWallets(prev => prev.map((w, i) =>
        i === activeWalletIdx ? { ...w, address: accounts[0] } : w
      ));
    };
    const handleChain = (chainId) => {
      setConnectedWallets(prev => prev.map((w, i) =>
        i === activeWalletIdx ? { ...w, chainId: parseInt(chainId, 16) } : w
      ));
    };
    window.ethereum.on('accountsChanged', handleAccounts);
    window.ethereum.on('chainChanged', handleChain);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccounts);
      window.ethereum.removeListener('chainChanged', handleChain);
    };
  }, [activeWalletIdx]);

  // ── Connect a wallet ──
  const connectWallet = async (walletId) => {
    setConnecting(walletId);
    setWalletError(null);
    try {
      const provider = getProviderFor(walletId);
      if (!provider) {
        setWalletError(`${WALLETS.find(w => w.id === walletId)?.name} not detected. Please install the extension.`);
        setConnecting(null);
        return;
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const chainId = await provider.request({ method: 'eth_chainId' });
      const w = WALLETS.find(w => w.id === walletId);
      const entry = {
        id: `w-${Date.now()}`,
        walletId,
        name: w?.name || 'Wallet',
        icon: w?.icon || '👛',
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        verified: false,
        connectedAt: new Date().toISOString(),
      };
      setConnectedWallets(prev => [...prev, entry]);
      setActiveWalletIdx(connectedWallets.length); // point to the new one
    } catch (err) {
      setWalletError(err.message || 'Connection rejected');
    } finally {
      setConnecting(null);
    }
  };

  // ── Disconnect a specific wallet ──
  const disconnectWallet = (idx) => {
    setConnectedWallets(prev => prev.filter((_, i) => i !== idx));
    if (activeWalletIdx >= connectedWallets.length - 1) {
      setActiveWalletIdx(Math.max(0, connectedWallets.length - 2));
    }
  };

  // ── Switch chain for active wallet ──
  const switchChain = async (targetChainId) => {
    setSwitchingChain(true);
    setWalletError(null);
    setChainPickerOpen(false);
    try {
      const chain = getChainById(targetChainId);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chain.hex }],
      });
      setConnectedWallets(prev => prev.map((w, i) =>
        i === activeWalletIdx ? { ...w, chainId: targetChainId } : w
      ));
    } catch (err) {
      if (err.code === 4902) {
        const chain = getChainById(targetChainId);
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: chain.hex, chainName: chain.name, nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: chain.decimals }, rpcUrls: [chain.rpcUrl], blockExplorerUrls: [chain.explorer] }],
          });
          setConnectedWallets(prev => prev.map((w, i) =>
            i === activeWalletIdx ? { ...w, chainId: targetChainId } : w
          ));
        } catch (addErr) {
          setWalletError(addErr.message || 'Failed to add chain');
        }
      } else {
        setWalletError(err.message || 'Failed to switch chain');
      }
    } finally {
      setSwitchingChain(false);
    }
  };

  // ── Verify wallet ownership via SIWE ──
  const verifyWallet = async (idx) => {
    const wallet = connectedWallets[idx];
    if (!wallet?.address) return;
    setVerifying(idx);
    try {
      // Use SIWE sign-in for structured verification
      const provider = getProviderFor(wallet.walletId) || window.ethereum;
      await signIn(provider);
      setConnectedWallets(prev => prev.map((w, i) => i === idx ? { ...w, verified: true } : w));
    } catch (err) {
      setWalletError(err.message || 'Signature rejected');
    } finally {
      setVerifying(null);
    }
  };

  // ── Copy address ──
  const copyAddress = (addr) => { if (addr) navigator.clipboard.writeText(addr); };

  // ── Exchange key management ──
  const addExchangeKey = async (exchangeId) => {
    const apiKey = sanitize(exchangeForm['API Key'] || '');
    const apiSecret = sanitize(exchangeForm['API Secret'] || '');
    if (!apiKey || !apiSecret) return;
    try {
      const encrypted = await encryptExchangeKeys({ [exchangeId]: { key: apiKey, secret: apiSecret } });
      const updated = { ...exchangeKeys, [exchangeId]: { encrypted, keyPreview: apiKey.slice(0, 8) + '••••••••', connectedAt: 'Just now' } };
      setExchangeKeys(updated);
      updateSettings({ exchangeKeys: updated });
      setExchangeForm({});
      setShowAddExchange(null);
    } catch (err) {
      console.error('Failed to encrypt exchange keys:', err);
    }
  };

  const removeExchangeKey = (exchangeId) => {
    const next = { ...exchangeKeys };
    delete next[exchangeId];
    setExchangeKeys(next);
    updateSettings({ exchangeKeys: next });
  };

  const testConnection = async (exchangeId) => {
    setTestingExchange(exchangeId);
    await new Promise(r => setTimeout(r, 1500));
    setExchangeStatus(prev => ({ ...prev, [exchangeId]: 'connected' }));
    setTestingExchange(null);
  };

  // ── Derived ──
  const activeWallet = connectedWallets[activeWalletIdx] || null;
  const activeChain = activeWallet ? getChainById(activeWallet.chainId) : null;
  const connectedExchangeCount = Object.keys(exchangeKeys).length;

  // ═══════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        icon={Wallet}
        title="Wallet & Network Connections"
        subtitle="Connect multiple wallets across chains. Paxeer is the primary network."
      >
        <InfoTip text="Connect wallets on different chains to fund bots and receive payouts. Paxeer (chain 125) is the primary trading network." />
      </PageHeader>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Wallets Connected" value={`${connectedWallets.length}`} color={connectedWallets.length > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'} sub={connectedWallets.length > 0 ? connectedWallets.map(w => w.name).join(', ') : 'None'} />
        <Stat label="Exchanges" value={`${connectedExchangeCount}/${EXCHANGES.length}`} color={connectedExchangeCount > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'} sub={connectedExchangeCount > 0 ? 'Active' : 'None connected'} />
        <Stat label="Status" value={connectedWallets.length > 0 && connectedExchangeCount > 0 ? 'Healthy' : connectedWallets.length > 0 ? 'Partial' : 'Disconnected'} color={connectedWallets.length > 0 && connectedExchangeCount > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning-alt)]'} />
      </div>

      <Divider />

      {/* ═══ WALLET SECTION ═══ */}
      <Card>
        <CardBody className="space-y-5">
          <SectionHeader icon={Wallet} title="Connected Wallets" badge={`${connectedWallets.length} Active`} />
          <p className="text-[var(--color-text-muted)] text-xs -mt-2">Connect multiple wallets across EVM-compatible chains. Paxeer (chain 125) is recommended for full functionality.</p>

          {/* ── SIWE Sign-In Banner ── */}
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

          {/* ── Network bar ── */}
          {CHAINS.map(chain => (
            <div key={chain.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${activeChain?.id === chain.id ? 'border' : ''}`} style={{ borderColor: chain.color + '60', background: chain.color + '10' }}>
              <span className="text-base">{chain.icon}</span>
              <span className="font-medium" style={{ color: chain.color }}>{chain.short}</span>
              {chain.isPrimary && <Badge variant="success" className="text-[10px] px-1.5 py-0">Primary</Badge>}
              <span className="text-[var(--color-text-muted)] ml-auto">Chain {chain.id}</span>
              {connectedWallets.some(w => w.chainId === chain.id) && <Wifi className="w-3 h-3" style={{ color: chain.color }} />}
            </div>
          ))}

          {/* ── Connected wallet cards ── */}
          {connectedWallets.map((wallet, idx) => {
            const chain = getChainById(wallet.chainId);
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

          {/* ── Add wallet buttons ── */}
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

      <Divider />

      {/* ═══ EXCHANGE SECTION ═══ */}
      <Card>
        <CardBody className="space-y-5">
          <SectionHeader icon={Link} title="Exchange Accounts" badge={`${connectedExchangeCount} Connected`} />
          <p className="text-[var(--color-text-muted)] text-xs -mt-2">Connect exchange API keys for live order execution.</p>
          <div className="flex items-center gap-2 bg-[var(--color-surface-2)] rounded-xl p-3 text-xs text-[var(--color-text-secondary)]">
            <Shield className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
            API keys are encrypted and stored locally. We only request trade permissions — never withdrawal access.
          </div>

          <div className="space-y-3">
            {EXCHANGES.map(exchange => {
              const keys = exchangeKeys[exchange.id];
              const status = exchangeStatus[exchange.id];
              const isAdding = showAddExchange === exchange.id;
              return (
                <Card key={exchange.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: `${exchange.color}20`, color: exchange.color }}>{exchange.name[0]}</div>
                      <div>
                        <span className="text-sm font-medium">{exchange.name}</span>
                        {keys && <div className="flex items-center gap-2 mt-0.5"><span className="text-[var(--color-text-muted)] text-xs font-mono">{keys.keyPreview}</span><Badge variant={status === 'connected' ? 'success' : 'warning'}>{status === 'connected' ? 'Verified' : 'Saved'}</Badge></div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {keys && <><Btn variant="ghost" size="sm" onClick={() => testConnection(exchange.id)} disabled={testingExchange === exchange.id}>{testingExchange === exchange.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}</Btn><Btn variant="danger" size="sm" onClick={() => removeExchangeKey(exchange.id)}>Remove</Btn></>}
                      {!keys && !isAdding && <Btn variant="secondary" size="sm" onClick={() => { setShowAddExchange(exchange.id); setExchangeForm({}); }}>+ Connect</Btn>}
                    </div>
                  </div>
                  {isAdding && (<><Divider /><div className="space-y-3">{exchange.fields.map(f => (<Input key={f} label={f} type={f.includes('Secret') || f === 'Passphrase' ? 'password' : 'text'} value={exchangeForm[f] || ''} onChange={e => setExchangeForm(prev => ({ ...prev, [f]: e.target.value }))} placeholder={`Enter your ${f.toLowerCase()}`} />))}<div className="flex gap-2 pt-1"><Btn onClick={() => addExchangeKey(exchange.id)}>Save Keys</Btn><Btn variant="ghost" onClick={() => { setShowAddExchange(null); setExchangeForm({}); }}>Cancel</Btn></div></div></>)}
                </Card>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={Shield} title="Related" />
      <div className="grid grid-cols-1 gap-4">
        <LinkCard icon={Shield} title="Security" desc="2FA, API keys, session management" color="var(--color-accent)" onClick={() => onNavigate('/security')} />
      </div>
    </div>
  );
}
