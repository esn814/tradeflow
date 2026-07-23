import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { App as CapApp } from '@capacitor/app'
import { initSentry } from './utils/sentry'
import { interceptConsole, interceptNetworkErrors } from './utils/diagnostics'
import './i18n'
import App from './App'
import './index.css'
import './App.css'

// ── Break service-worker cache trap ──────────────────────────────────
// Old SWs cache index.html (with the old register script), so the
// browser never fetches the new index.html that contains unregister.
// By putting unregister HERE (in the JS bundle whose hash changes
// every build), the old SW is forced to fetch this file from the
// network and the stale registration is removed.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Unregister old stale SWs, then register the new one with push support
  navigator.serviceWorker.getRegistrations()
    .then(regs => {
      regs.forEach(r => r.unregister());
      return navigator.serviceWorker.register('/sw.js', { scope: '/' });
    })
    .then()
    .catch(err => console.warn('[SW] Registration failed:', err.message));
  // Nuke old caches so stale assets can't linger
  caches?.keys?.().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
}

// Initialize Sentry error tracking before anything else
initSentry()

// Start capturing console logs and network errors for bug report diagnostics
interceptConsole()
interceptNetworkErrors()

// Initialize Capacitor native plugins
if (typeof window !== 'undefined' && window.Capacitor) {
  try {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    StatusBar.setBackgroundColor({ color: '#0b0f1a' }).catch(() => {})
    SplashScreen.hide().catch(() => {})
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) CapApp.exitApp()
      else window.history.back()
    }).catch(() => {})
  } catch (e) {
    console.warn('[Capacitor] Plugin init failed:', e)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
