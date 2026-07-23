import { useAuth } from '../context/AuthContext';
import { Shield, Lock } from 'lucide-react';
import { Btn } from './ui';

/**
 * Route guard that shows a sign-in prompt overlay for unauthenticated users.
 * Does NOT block access — just encourages SIWE sign-in for full functionality.
 * Pass requireAuth={true} to make it a hard gate (blocks rendering children).
 */
export default function AuthGate({ children, requireAuth = false, feature = 'this feature' }) {
  const { isAuthenticated, isSigningIn } = useAuth();

  if (isAuthenticated) return children;

  if (requireAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-accent-18)' }}>
          <Lock size={24} color="var(--color-accent)" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Sign In Required</h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
          {feature} requires wallet verification. Connect a wallet and sign in with Ethereum on the Connections page.
        </p>
        <Btn onClick={() => window.location.href = '/connections'}>
          <Shield className="w-4 h-4" /> Go to Connections
        </Btn>
      </div>
    );
  }

  // Soft gate — show a dismissible banner, render children
  return (
    <>
      <div className="flex items-center gap-2 bg-[var(--color-accent-8)] border border-[var(--color-accent-20)] rounded-xl px-4 py-2.5 mb-4 text-xs">
        <Shield className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
        <span className="text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">Tip:</strong> Sign in with your wallet on the <a href="/connections" className="text-[var(--color-accent)] underline">Connections</a> page for full access.
        </span>
        {isSigningIn && <span className="ml-auto text-[var(--color-accent)] animate-pulse">Signing in…</span>}
      </div>
      {children}
    </>
  );
}
