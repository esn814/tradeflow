import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Route guard: shows children with an inline auth prompt banner.
 * No redirect — users can browse all pages and see what's available.
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoading, signInDemo } = useAuth()

  /* Auto-enter demo mode for first-time visitors — no wallet needed */
  useEffect(() => {
    if (!isAuthenticated) {
      signInDemo()
      try {
        const raw = localStorage.getItem('tradeflow-store')
        const store = raw ? JSON.parse(raw) : {}
        store.settings = { ...(store.settings || {}), demoMode: true, virtualBalance: 10000, hasCompletedOnboarding: true }
        localStorage.setItem('tradeflow-store', JSON.stringify(store))
      } catch { /* ignore */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, color:'var(--color-text-muted)', fontSize:14 }}>
        Loading…
      </div>
    )
  }

  // Always render children — demo mode is auto-enabled
  return children
}

/**
 * Gate prompt shown inline when a feature requires auth.
 */
export function AuthGatePrompt({ feature = 'this feature' }) {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 12,
      background: 'var(--color-danger-8)', border: '1px solid var(--color-danger-30)',
      marginBottom: 12
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Sign in required
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
          Connect and verify your wallet in Connections to access {feature}.
        </p>
      </div>
    </div>
  )
}
