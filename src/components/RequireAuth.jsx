import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Route guard: shows children with an inline auth prompt banner.
 * No redirect — users can browse all pages and see what's available.
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoading, signInDemo } = useAuth()
  const navigate = useNavigate()
  const [promptGuest, setPromptGuest] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Don't auto-sign in — show a guest mode prompt instead
      setPromptGuest(true)
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12, color:'var(--color-text-muted)', fontSize:14 }}>
        Loading…
      </div>
    )
  }

  if (promptGuest && !isAuthenticated) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
        <p style={{ fontSize:15, color:'var(--color-text-primary)', fontWeight:600 }}>You're not signed in.</p>
        <div style={{ display:'flex', gap:12 }}>
          <button
            onClick={() => signInDemo()}
            style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--color-primary-50)', background:'var(--color-primary)', color:'#fff', cursor:'pointer', fontSize:14 }}
          >
            Continue as Guest
          </button>
          <button
            onClick={() => navigate('/connections')}
            style={{ padding:'8px 20px', borderRadius:8, border:'1px solid var(--color-border)', background:'var(--color-surface)', color:'var(--color-text-primary)', cursor:'pointer', fontSize:14 }}
          >
            Sign In with Wallet
          </button>
        </div>
      </div>
    )
  }

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
