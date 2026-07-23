import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SiweMessage } from 'siwe';
import { verifySiwe, restoreSession, logout as apiLogout, getWalletAddress } from '../services/apiClient';

const AUTH_KEY = 'tradeflow-siwe-session';
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

// FIX #1: Only persist metadata (address, chainId) — never the JWT or signature
function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Expire stale sessions
    if (Date.now() - session.signedAt > SESSION_TTL_MS) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    // FIX #1: Strip sensitive fields from any legacy stored session
    delete session.signature;
    delete session.message;
    return session;
  } catch { return null; }
}

function saveSession(session) {
  try {
    // FIX #1: Only store non-sensitive metadata
    const safe = {
      address: session.address,
      chainId: session.chainId,
      signedAt: session.signedAt,
      domain: session.domain,
      isDemo: session.isDemo || false,
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(safe));
  } catch (e) { console.warn(e); }
}

function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadSession());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState(null);

  // Derived state
  const isAuthenticated = !!session?.address;
  const address = session?.address || null;
  const chainId = session?.chainId || null;

  // FIX #1: On mount, try to restore session via httpOnly refresh token cookie
  useEffect(() => {
    (async () => {
      const saved = loadSession();
      if (saved && !saved.isDemo) {
        const restored = await restoreSession();
        if (restored) {
          setSession(saved);
        } else {
          // Refresh token expired or invalid — clear stale metadata
          clearSession();
          setSession(null);
        }
      }
      setIsRestoring(false);
    })();
  }, []);

  /**
   * Sign in with Ethereum.
   * FIX #1: JWT is stored in memory only via apiClient — never in localStorage.
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

      // 2. Get nonce from server (not client-generated)
      const nonce = await (await import('../services/apiClient')).getNonce();

      // 3. Build SIWE message
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

      // 4. Request signature from wallet
      const signature = await provider.request({
        method: 'personal_sign',
        params: [messageBody, addr],
      });

      // 5. Verify with server — JWT stored in memory by apiClient
      await verifySiwe(messageBody, signature);

      // 6. Build session (no JWT, no signature stored)
      const newSession = {
        address: addr,
        chainId: chain,
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
      signedAt: Date.now(),
      domain: window.location.host,
      isDemo: true,
    };
    setSession(demoSession);
    saveSession(demoSession);
    return demoSession;
  }, []);

  /** Sign out — revoke refresh token, clear memory + localStorage */
  const signOut = useCallback(async () => {
    await apiLogout(); // revoke refresh token cookie + clear in-memory JWT
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
    isRestoring,
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
