import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PaperTradingBanner from './components/PaperTradingBanner'
import BugReport from './components/BugReport'
import Disclaimer from './components/Disclaimer'
import ErrorBoundary from './components/ErrorBoundary'
import { AppStoreProvider, useAppStore, useMode } from './context/AppStore'
import { AuthProvider, useAuth } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'

/* ── Lazy-load all pages for faster initial render ── */
const Home        = lazy(() => import('./pages/Home'))
const Autopilot   = lazy(() => import('./pages/Autopilot'))
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Invest      = lazy(() => import('./pages/Invest'))
const MyBots      = lazy(() => import('./pages/MyBots'))
const Strategies  = lazy(() => import('./pages/Strategies'))
const Backtester  = lazy(() => import('./pages/Backtester'))
const Alerts      = lazy(() => import('./pages/Alerts'))
const RiskManager = lazy(() => import('./pages/RiskManager'))
const Connections = lazy(() => import('./pages/Connections'))
const Pricing     = lazy(() => import('./pages/Pricing'))
const Security    = lazy(() => import('./pages/Security'))
const Settings    = lazy(() => import('./pages/Settings'))
const Help        = lazy(() => import('./pages/Help'))
const Scheduler   = lazy(() => import('./pages/Scheduler'))
const Referrals   = lazy(() => import('./pages/Referrals'))
const Analytics   = lazy(() => import('./pages/Analytics'))
const CopyTrading = lazy(() => import('./pages/CopyTrading'))
const CrossDexArbitrage = lazy(() => import('./pages/CrossDexArbitrage'))
const CrossChainArbitrage = lazy(() => import('./pages/CrossChainArbitrage'))
const AutomatedTrading = lazy(() => import('./pages/AutomatedTrading'))
const Community    = lazy(() => import('./pages/Community'))
const Privacy     = lazy(() => import('./pages/Privacy'))
const Terms       = lazy(() => import('./pages/Terms'))

function Loading() {
  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-6 space-y-4">
      {/* Page header skeleton */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
        <div className="h-5 w-40 rounded bg-[var(--color-surface-2)] animate-pulse" />
      </div>
      {/* Card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-2xl p-5">
            <div className="h-3 w-20 rounded bg-[var(--color-surface-2)] animate-pulse mb-3" />
            <div className="h-7 w-28 rounded bg-[var(--color-surface-2)] animate-pulse" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border-default)] rounded-2xl p-5">
        <div className="h-3 w-32 rounded bg-[var(--color-surface-2)] animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 rounded bg-[var(--color-surface-2)] animate-pulse" style={{ width: `${100 - i * 10}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function NotFound({ onNavigate }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
      <div style={{ fontSize:64, fontWeight:800, color:'var(--color-accent)' }}>404</div>
      <div style={{ fontSize:16, color:'var(--color-text-secondary)' }}>Page not found</div>
      <button onClick={() => onNavigate('/')} style={{ padding:'8px 20px', borderRadius:8, background:'var(--color-accent)', color:'#fff', border:'none', cursor:'pointer', fontWeight:600, fontSize:14 }}>Go Home</button>
    </div>
  )
}

function AnimatedPage({ children }) {
  return <div className="page-fade-in">{children}</div>
}

function AppContent() {
  const [_sidebarOpen, _setSidebarOpen] = [false, () => {}] // simplified — toggled below
  const [sidebarOpenState, setSidebarOpenState] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, updateSettings } = useAppStore()
  const { setDemoMode, setVirtualBalance } = useMode()
  const { isAuthenticated, signInDemo } = useAuth()

  /* Apply theme from store */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.darkMode === false ? 'light' : 'dark')
  }, [settings.darkMode])

  /* Scroll to top + Plausible pageview on route change */
  useEffect(() => {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' })
    if (typeof window.plausible === 'function') {
      window.plausible('pageview')
    }
  }, [location.pathname])

  /* Auto sign-in as demo user so sidebar shows demo state on every page */
  useEffect(() => {
    if (!isAuthenticated) {
      signInDemo()
    }
    setDemoMode(true)
    setVirtualBalance(settings.virtualBalance || 10000)
    if (!settings.hasCompletedOnboarding) {
      updateSettings({ hasCompletedOnboarding: true, demoMode: true, virtualBalance: settings.virtualBalance || 10000 })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigate = (p) => {
    navigate(p)
    setSidebarOpenState(false)
  }

  const toggleSidebar = () => setSidebarOpenState(prev => !prev)
  const sidebarOpen2 = sidebarOpenState

  const routeProps = { onNavigate: handleNavigate }

  return (
    <>
      <PaperTradingBanner />
      <div className="app-layout">
        <Sidebar page={location.pathname} onNavigate={handleNavigate} isOpen={sidebarOpen2} onToggle={toggleSidebar} />
        <main className="app-main">
          <Suspense fallback={<Loading />}>
            <Routes location={location} key={location.pathname}>
                <Route path="/"             element={<AnimatedPage><Home {...routeProps} /></AnimatedPage>} />
                <Route path="/autopilot"    element={<AnimatedPage><RequireAuth><Autopilot {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/dashboard"    element={<AnimatedPage><RequireAuth><Dashboard {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/invest"       element={<AnimatedPage><RequireAuth><Invest {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/my-bots"      element={<AnimatedPage><RequireAuth><MyBots {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/scheduler"    element={<AnimatedPage><RequireAuth><Scheduler {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/referrals"    element={<AnimatedPage><RequireAuth><Referrals {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/strategies"   element={<AnimatedPage><RequireAuth><Strategies {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/backtester"   element={<AnimatedPage><RequireAuth><Backtester {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/alerts"       element={<AnimatedPage><RequireAuth><Alerts {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/risk"         element={<AnimatedPage><RequireAuth><RiskManager {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/analytics"    element={<AnimatedPage><RequireAuth><Analytics {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/copy-trading" element={<AnimatedPage><RequireAuth><CopyTrading {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/automated-trading" element={<AnimatedPage><RequireAuth><AutomatedTrading {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/cross-dex-arb" element={<AnimatedPage><RequireAuth><CrossDexArbitrage {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/cross-chain-arb" element={<AnimatedPage><RequireAuth><CrossChainArbitrage {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/community"      element={<AnimatedPage><RequireAuth><Community {...routeProps} /></RequireAuth></AnimatedPage>} />
                <Route path="/connections"  element={<AnimatedPage><Connections {...routeProps} /></AnimatedPage>} />
                <Route path="/pricing"      element={<AnimatedPage><Pricing {...routeProps} /></AnimatedPage>} />
                <Route path="/security"     element={<AnimatedPage><Security {...routeProps} /></AnimatedPage>} />
                <Route path="/settings"     element={<AnimatedPage><Settings {...routeProps} /></AnimatedPage>} />
                <Route path="/help"         element={<AnimatedPage><Help {...routeProps} /></AnimatedPage>} />
                <Route path="/privacy"      element={<AnimatedPage><Privacy {...routeProps} /></AnimatedPage>} />
                <Route path="/terms"        element={<AnimatedPage><Terms {...routeProps} /></AnimatedPage>} />
                <Route path="*"             element={<AnimatedPage><NotFound onNavigate={handleNavigate} /></AnimatedPage>} />
              </Routes>
          </Suspense>
        </main>
      </div>
      <BugReport />
      <Disclaimer />
    </>
  )
}

export default function App() {
  // v2025.07.22 — force bundle hash change for SW cache bust
  return (
    <AppStoreProvider>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </AppStoreProvider>
  )
}
