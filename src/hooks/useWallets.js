import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../context/AppStore';
import { useAuth } from '../context/AuthContext';
import { CHAINS, WALLETS, getChainById, shortAddr } from '../data/chains';

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
  const match =
    (walletId === 'metamask' && eth.isMetaMask) ||
    (walletId === 'coinbase' && eth.isCoinbaseWallet) ||
    (walletId === 'trust' && eth.isTrust) ||
    (walletId === 'phantom' && eth.isPhantom) ||
    (walletId === 'rabby' && eth.isRabby) ||
    (walletId === 'rainbow' && eth.isRainbow);
  return match ? eth : null;
}

export function useWallets() {
  const { settings, updateSettings } = useAppStore();
  const { signIn, isAuthenticated, signOut: authSignOut } = useAuth();

  const [connectedWallets, setConnectedWallets] = useState(settings?.connectedWallets || []);
  const [activeWalletIdx, setActiveWalletIdx] = useState(0);
  const [connecting, setConnecting] = useState(null);
  const [walletError, setWalletError] = useState(null);
  const [switchingChain, setSwitchingChain] = useState(false);
  const [, setChainPickerOpen] = useState(false);
  const [verifying, setVerifying] = useState(null);

  // Persist connected wallets to store
  useEffect(() => {
    updateSettings({ connectedWallets });
  }, [connectedWallets, updateSettings]);

  // Detect already-connected wallets on mount
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

  // Listen for account/chain changes on all providers
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

  const connectWallet = useCallback(async (walletId) => {
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
      setActiveWalletIdx(connectedWallets.length);
    } catch (err) {
      setWalletError(err.message || 'Connection rejected');
    } finally {
      setConnecting(null);
    }
  }, [connectedWallets.length]);

  const disconnectWallet = useCallback((idx) => {
    setConnectedWallets(prev => prev.filter((_, i) => i !== idx));
    if (activeWalletIdx >= connectedWallets.length - 1) {
      setActiveWalletIdx(Math.max(0, connectedWallets.length - 2));
    }
  }, [activeWalletIdx, connectedWallets.length]);

  const switchChain = useCallback(async (targetChainId) => {
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
  }, [activeWalletIdx]);

  const verifyWallet = useCallback(async (idx) => {
    const wallet = connectedWallets[idx];
    if (!wallet?.address) return;
    setVerifying(idx);
    try {
      const provider = getProviderFor(wallet.walletId) || window.ethereum;
      await signIn(provider);
      setConnectedWallets(prev => prev.map((w, i) => i === idx ? { ...w, verified: true } : w));
    } catch (err) {
      setWalletError(err.message || 'Signature rejected');
    } finally {
      setVerifying(null);
    }
  }, [connectedWallets, signIn]);

  const copyAddress = useCallback((addr) => {
    if (addr) navigator.clipboard.writeText(addr);
  }, []);

  const activeWallet = connectedWallets[activeWalletIdx] || null;
  const activeChain = activeWallet ? getChainById(activeWallet.chainId) : null;

  return {
    connectedWallets,
    activeWalletIdx,
    setActiveWalletIdx,
    connecting,
    walletError,
    setWalletError,
    switchingChain,
    verifying,
    connectWallet,
    disconnectWallet,
    switchChain,
    verifyWallet,
    copyAddress,
    activeWallet,
    activeChain,
    signIn,
    isAuthenticated,
    authSignOut,
    getProviderFor,
  };
}
