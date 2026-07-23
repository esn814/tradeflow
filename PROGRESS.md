# TradeFlow Progress Log
*Last updated: 2026-07-23*

## Current State (verified against source on 2026-07-23)

| Metric | Value |
|--------|-------|
| Pages routed | 24 (26 files on disk — Bridge.jsx and StressTest.jsx exist but are not routed) |
| Smoke tests | 18/18 passing |
| E2E tests | 14/14 (Playwright) |
| Lint | 0 warnings, 0 errors (oxlint) |
| Build | ~567ms, zero errors, 44 optimized chunks |
| Server files | 8 route files, 13 DB tables |
| APK | 7.8MB debug build, Capacitor 8, SDK 36 |

---

## Completed Work

### Core App
- Full React 19 + Vite 8 + Tailwind 4 scaffold
- 24 routed pages: Home, Autopilot, Dashboard, Invest, MyBots, Strategies, Backtester, Alerts, RiskManager, Connections, Pricing, Security, Settings, Help, Scheduler, Referrals, Analytics, CopyTrading, CrossDexArbitrage, CrossChainArbitrage, AutomatedTrading, Community, Privacy, Terms
- Sidebar navigation with 4 groups (Overview 3, Trading 7, Tools 5, Account 6 + overflow)
- Onboarding wizard, error boundary, bug report component with diagnostics
- Multi-wallet support (MetaMask, Coinbase, WalletConnect, Phantom)
- Paxeer chain integration (chain ID 125)
- i18n framework (i18next + react-i18next, English translations loaded)

### Authentication & Security
- SIWE authentication system (nonce generation, signature verification, JWT 7-day expiry)
- Route guards — `RequireAuth` wraps 17 of 24 routes (soft guard: auto-enables demo mode for unauthenticated visitors)
- AuthGatePrompt for feature-level gating
- Sidebar auth status (signed-in address or guest mode)
- Security hardening: removed all hardcoded fake data, fixed crypto seed with random 32-byte device seed
- CSP meta tag with 9+ API domains in connect-src

### Features
- P&L Analytics — `src/utils/pnl.js` (8 functions: realized/unrealized P&L, strategy breakdown, equity curve, max drawdown, Sharpe ratio, trade summary)
- Analytics page with period filter, KPI cards, equity curve chart, per-strategy breakdown
- Real portfolio tracking — `src/data/portfolio.js` (PaxScan API, native PAX + ERC-20 tokens, USD price enrichment, polling)
- Copy Trading — 6 sample traders, follow/unfollow, risk filters, trader discovery page
- Cross-chain bridge integration (Across + Stargate v2)
- Automated trading (DCA/Grid/Mean Reversion, stop-loss, take-profit)
- Cross-DEX arbitrage and cross-chain arbitrage pages
- Social features — leaderboard, shared strategies, publish/fork/like
- Community page with backend API
- Error reporting — console interceptor (200-entry ring buffer), network error interceptor (50-entry buffer), screenshot capture via html2canvas
- Referral program, scheduler, alerts system

### Code Quality
- CSS color extraction — 103 unique colors → CSS custom properties, 595 replacements across 34 files
- Autopilot decomposition — 679 lines → 190 + 8 sub-components in `src/components/autopilot/`
- Chart theme unification — `src/data/chartTheme.js` shared across 5 chart pages
- Chunk splitting — manualChunks in vite.config.js splits vendor-react, vendor-recharts, vendor-lucide, vendor-ethers (7 sub-chunks), vendor-noble-curves, vendor-noble-hashes, vendor-siwe, vendor-html2canvas, vendor-capacitor, vendor-misc
- Menu cleanup — removed Bridge + StressTest from routes/sidebar (22 → 20 sidebar items)
- Financial disclaimer component with localStorage persistence

### Backend (Node.js + Express 5 + SQLite)
- `server/db.js` — 13 tables: users, bots, trades, alerts, schedules, settings, demo_trades, followed_traders, copy_trade_history, push_subscriptions, shared_strategies, strategy_forks, strategy_likes
- `server/auth.js` — SIWE nonce + verify + JWT issuance + authMiddleware
- `server/index.js` — Express app with CORS, 8 route mounts, health endpoint, global error handler
- 3-tier rate limiting (global 100/15min, auth 20/15min, write 30/15min)
- `server/routes/` — 8 files: bots, trades, alerts, schedules, settings, copy-trading, social, push
- `server/middleware/validate.js` — sanitize (HTML stripping), requireFields, validateNumber, validateEnum
- `server/services/alertChecker.js` — polls alerts every 60s
- `server/push-sender.js` + `server/vapid-keys.json` — web push notifications
- Frontend integration: `src/services/apiClient.js` (full REST client), `src/services/storeSync.js` (bidirectional sync with 2s debounce)

### APK & Deployment
- Android APK built (7.8MB debug, Capacitor 8, SDK 36, Gradle 8.14.3)
- APK download page with fetch+reblob (prevents Android unzip-instead-of-install)
- Install helper page with correct MIME reblob
- Service worker — network-first for HTML, stale-while-revalidate for static, size-limited API cache, push notification support
- **Web App:** https://tradeflow.cloud.hyperpaxeer.com (`tradeflow` project)
- **Download Page:** https://tradeflow-dl.cloud.hyperpaxeer.com (`tradeflow-dl` project)
- **APK Helper:** https://tradeflow-apk.cloud.hyperpaxeer.com (`tradeflow-apk` project)
- **Staging:** https://tradeflow-staging.cloud.hyperpaxeer.com (`tradeflow-staging` project)

### Testing
- 18/18 Vitest smoke tests passing
- 14/14 Playwright E2E tests (navigation, pages, disclaimer, mobile viewport, 404, sidebar, API health check)
- 0 lint warnings/errors (oxlint)
- GitHub Actions CI workflow (lint → test → build on push/PR to main)
- Stress test: 500 bots, 5M trades, 0 errors
- Pressure test: 1000 bots, 3 engines, 22M trades, 0 errors
- Playwright hard stress on production: rapid nav (66 navigations), concurrent sessions, memory monitoring, rapid reload — all PASS

### Accessibility & Responsiveness
- Fixed text-muted contrast for WCAG AA compliance
- ARIA attributes on Toggle (role=switch, aria-checked), LinkCard (role=link, tabIndex=0, keyboard handler)
- Media queries at 768px and 640px with mobile-specific adjustments
- Tables wrapped in overflow-x-auto, sidebar has hamburger + backdrop + escape key + ARIA labels

---

## Remaining Work

### Medium Effort
- Build release APK (currently debug — needs signing keystore)
- Deploy backend to production (VPS with SQLite backups, persistent JWT secret, health monitoring)
- Database backup strategy (automated SQLite backups, export mechanism)
- Real user testing on Android device

### Low Effort / Optional
- Further index chunk splitting (currently 40KB)
- Clean up orphaned files: Bridge.jsx, StressTest.jsx (not routed but still on disk)
- Extract 124 hardcoded hex colors remaining (most already done, may be residuals)
- Decompose Autopilot further (already down to 190 lines orchestrator)

---

## Stress Test Results

### V3 (2026-07-21)
- 500 bots, 1 engine, 100ms tick, 8 coins, 1 hour
- 4,972,216 trades, $12.7B volume, ~1,380 avg TPS, 65% profitable, 0 errors

### Pressure (2026-07-21)
- 1,000 bots, 3 engines, 50ms tick, 13 coins, 1 hour
- 21,860,173 trades, $3.46T volume, 6,072 avg TPS, 66.1% profitable, 0 errors
- 4.4× throughput vs v3, linear scaling, <2.5% TPS degradation over full hour

---

## Build Environment
- Java: OpenJDK 21 (`/usr/lib/jvm/java-21-openjdk-amd64`)
- Android SDK: `/opt/android-sdk` (platforms;android-36, build-tools;36.0.0)
- Gradle: 8.14.3 (bundled)
- Capacitor: 8.x with `@capacitor/android`
- Node.js 20, Vite 8 (Rolldown), Vitest 4.1, Playwright 1.61

## paxc Project IDs
- `tradeflow` → `prj_kg7tm3f5n2kh` (main site)
- `tradeflow-dl` → `prj_3l3dokfnaazy` (download page)
- `tradeflow-apk` → `prj_6dcsuscokenj` (APK helper)
- `tradeflow-staging` → `prj_7y5runyav4ia` (staging)
- `tradeflow-app` → `prj_weeej6musq5v` (alternate main URL)
