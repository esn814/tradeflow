import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SiweMessage } from 'siwe';

const AUTH_KEY = 'tradeflow-siwe-session';
const NONCE_KEY = 'tradeflow-siwe-nonce';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEMO_SESSION = {
  address: '0xDemo000000000000000000000000000000000000',
  chainId: 125,
  message: 'Demo Mode — TradeFlow',
  signature: 'demo-mode',
  nonce: 'demo',
  signedAt: Date.now(),
  domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
  isDemo: true,
};

function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { ...DEMO_SESSION };
    const session = JSON.parse(raw);
    // Expire stale sessions
    if (Date.now() - session.signedAt > SESSION_TTL_MS) {
      localStorage.removeItem(AUTH_KEY);
      return { ...DEMO_SESSION };
    }
    return session;
  } catch (e) { console.warn(e); return { ...DEMO_SESSION }; }
}

function saveSession(session) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } catch (e) { console.warn(e); }
}

function clearSession() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(NONCE_KEY);
}

function generateNonce() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const nonce = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(NONCE_KEY, nonce);
  return nonce;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState(null);

  // Derived state
  const isAuthenticated = !!session?.address;
  const address = session?.address || null;
  const chainId = session?.chainId || null;

  /**
   * Sign in with Ethereum.
   * Expects an EIP-1193 provider (window.ethereum or a wallet-specific provider).
   */
  const signIn = useCallback(async (provider) => {
    if (!provider) throw new Error('No wallet provider available');
    setIsSigningIn(true);
    setError(null);

    try {
      // 1. Get accounts and chain
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      const rawChainId = await provider.request({ method: 'eth_chainId' });
      const addr = accounts[0];
      const chain = parseInt(rawChainId, 16);

      // 2. Build SIWE message
      const nonce = generateNonce();
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = 'Sign in to TradeFlow — Automated Crypto Trading Platform';

      const siweMessage = new SiweMessage({
        domain,
        address: addr,
        statement,
        uri: origin,
        version: '1',
        chainId: chain,
        nonce,
      });
      const messageBody = siweMessage.prepareMessage();

      // 3. Request signature
      const signature = await provider.request({
        method: 'personal_sign',
        params: [messageBody, addr],
      });

      // 4. Build session (client-side verification — a production app would
      //    also verify the signature server-side, but TradeFlow is client-only)
      const newSession = {
        address: addr,
        chainId: chain,
        message: messageBody,
        signature,
        nonce,
        signedAt: Date.now(),
        domain,
      };

      setSession(newSession);
      saveSession(newSession);
      return newSession;
    } catch (err) {
      const msg = err.message || 'Sign-in failed';
      setError(msg);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  /** Sign in as demo user — no wallet needed */
  const signInDemo = useCallback(() => {
    const demoSession = {
      address: '0xDemo000000000000000000000000000000000000',
      chainId: 125,
      message: 'Demo Mode — TradeFlow',
      signature: 'demo-mode',
      nonce: 'demo',
      signedAt: Date.now(),
      domain: window.location.host,
      isDemo: true,
    };
    setSession(demoSession);
    saveSession(demoSession);
    return demoSession;
  }, []);

  /** Sign out — clear session and nonce */
  const signOut = useCallback(() => {
    setSession(null);
    setError(null);
    clearSession();
  }, []);

  /** Clear any displayed error */
  const clearError = useCallback(() => setError(null), []);

  // Listen for account/chain changes and invalidate session if they diverge
  useEffect(() => {
    if (!window.ethereum || !session) return;

    const handleAccounts = (accounts) => {
      if (accounts.length === 0 || accounts[0].toLowerCase() !== session.address?.toLowerCase()) {
        signOut();
      }
    };
    const handleChain = (chainIdHex) => {
      const newChain = parseInt(chainIdHex, 16);
      if (newChain !== session.chainId) {
        // Update session chain but keep auth
        const updated = { ...session, chainId: newChain };
        setSession(updated);
        saveSession(updated);
      }
    };

    window.ethereum.on('accountsChanged', handleAccounts);
    window.ethereum.on('chainChanged', handleChain);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccounts);
      window.ethereum.removeListener('chainChanged', handleChain);
    };
  }, [session, signOut]);

  const value = {
    isAuthenticated,
    address,
    chainId,
    session,
    isSigningIn,
    error,
    signIn,
    signInDemo,
    signOut,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
