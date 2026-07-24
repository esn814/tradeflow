import { useEffect } from 'react'
import {
  Home, Zap, BarChart3, Shield, TrendingUp, Settings, X, Menu, HelpCircle,
  LayoutDashboard, Bell, Layers, FlaskConical, Link2, DollarSign, ShieldAlert,
  CalendarClock, Gift, Users, ArrowRightLeft, Bot, Globe
} from 'lucide-react'
import { useAppStore } from '../context/AppStore'
import { useAuth } from '../context/AuthContext'

const navGroups = [
  {
    label: 'Overview',
    links: [
      { to: '/', icon: Home, label: 'Home' },
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/autopilot', icon: Zap, label: 'Autopilot', badge: 'AI' },
    ]
  },
  {
    label: 'Trading',
    links: [
      { to: '/invest', icon: TrendingUp, label: 'Invest' },
      { to: '/my-bots', icon: BarChart3, label: 'My Bots' },
      { to: '/automated-trading', icon: Bot, label: 'Auto Trading', badge: 'LIVE' },
      { to: '/strategies', icon: Layers, label: 'Strategies' },
      { to: '/backtester', icon: FlaskConical, label: 'Backtester' },
      { to: '/cross-dex-arb', icon: ArrowRightLeft, label: 'Cross-DEX Arb', badge: 'NEW' },
      { to: '/cross-chain-arb', icon: Globe, label: 'Cross-Chain Arb', badge: 'BETA' },
    ]
  },
  {
    label: 'Tools',
    links: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/alerts', icon: Bell, label: 'Alerts' },
      { to: '/risk', icon: ShieldAlert, label: 'Risk Manager' },
      { to: '/copy-trading', icon: Users, label: 'Copy Trading', badge: 'NEW' },
      { to: '/community', icon: Users, label: 'Community', badge: 'NEW' },
      { to: '/scheduler', icon: CalendarClock, label: 'Scheduler' },
    ]
  },
  {
    label: 'Account',
    links: [
      { to: '/connections', icon: Link2, label: 'Connections' },
      { to: '/security', icon: Shield, label: 'Security' },
      { to: '/settings', icon: Settings, label: 'Settings' },
      { to: '/pricing', icon: DollarSign, label: 'Pricing' },
      { to: '/referrals', icon: Gift, label: 'Referrals', badge: 'NEW' },
      { to: '/help', icon: HelpCircle, label: 'Help' },
    ]
  }
]

export default function Sidebar({ page, onNavigate, isOpen, onToggle }) {
  const { settings } = useAppStore()
  const { isAuthenticated, address, signOut } = useAuth()
  const shortAuth = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const planLabel = { starter: 'Starter Plan', pro: 'Pro Plan', enterprise: 'Enterprise Plan' }
  const planName = planLabel[settings?.selectedPlan] || 'Free Plan'

  /* Close on Escape key */
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && isOpen) onToggle(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onToggle]);

  return (
    <>
      <button
        className="sidebar-hamburger"
        onClick={onToggle}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isOpen && <div className="sidebar-backdrop" onClick={onToggle} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <img src="/logo.jpg" alt="TradeFlow" style={{ width: 28, height: 28, borderRadius: 6 }} />
            </div>
            <div>
              <div className="sidebar-logo-text">TradeFlow</div>
              <div className="sidebar-logo-sub">Automated Trading</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
          {navGroups.map(group => (
            <div key={group.label}>
              <div className="sidebar-section-label">{group.label}</div>
              {group.links.map(l => {
                const active = page === l.to
                const Icon = l.icon
                return (
                  <button
                    key={l.to}
                    onClick={() => onNavigate(l.to)}
                    className={`sidebar-link ${active ? 'sidebar-link--active' : ''}`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                    <span>{l.label}</span>
                    {l.badge && <span className="sidebar-badge">{l.badge}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {isAuthenticated ? (
            <div className="sidebar-user">
              <div className="sidebar-avatar" style={{ background: 'var(--color-accent-20)', color: 'var(--color-accent)', fontSize: 12 }}>✓</div>
              <div>
                <div className="sidebar-username">{shortAuth}</div>
                <div className="sidebar-plan">Signed In</div>
              </div>
              <button
                onClick={signOut}
                className="px-3 py-2 rounded-md text-xs font-bold cursor-pointer"
                style={{ marginLeft: 'auto', background: 'var(--color-danger-18)', color: 'var(--color-danger-light)', border: 'none' }}
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="sidebar-user">
              <div className="sidebar-avatar">U</div>
              <div>
                <div className="sidebar-username">Guest</div>
                <div className="sidebar-plan">{planName}</div>
              </div>
              <button
                onClick={() => onNavigate('/connections')}
                className="px-3 py-2 rounded-md text-xs font-bold cursor-pointer"
                style={{ marginLeft: 'auto', background: 'var(--color-accent-18)', color: 'var(--color-accent)', border: 'none' }}
                title="Sign In"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
