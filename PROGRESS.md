# TradeFlow Progress Log
*Last updated: 2026-07-24*

## Current State (verified 2026-07-23)

| Metric | Value |
|--------|-------|
| Pages routed | 24 (26 files on disk) |
| Smoke tests | 18/18 passing |
| E2E tests | 14/14 (Playwright) |
| Lint | 0 warnings, 0 errors (oxlint) |
| Build | ~1.0s, zero errors, 18 optimized chunks |
| Server files | 8 route files, 13 DB tables |
| APK | 6.1MB signed release (was 7.8MB debug) |
| Backend | Live on Render: https://tradeflow-api-i2o1.onrender.com |
| Frontend | Live on Paxeer Cloud: https://tradeflow.cloud.hyperpaxeer.com |
| GitHub | https://github.com/esn814/tradeflow (public) |

---

## Deployed Architecture

```
Frontend:  Paxeer Cloud (paxc) → https://tradeflow.cloud.hyperpaxeer.com
Backend:   Render (free tier, Oregon) → https://tradeflow-api-i2o1.onrender.com
Repo:      GitHub → https://github.com/esn814/tradeflow (master)
CI/CD:     GitHub Actions (lint → test → build) + Render auto-deploys on push to master
Backups:   Daily VACUUM INTO, 7-day retention, stored on Render persistent disk
```

### Deployment History
- **2026-07-23:** Backend deployed to Render. Frontend rebuilt with `VITE_API_URL`, CSP updated, deployed to Paxeer Cloud.
- **2026-07-23:** All project files pushed to GitHub repo `esn814/tradeflow`. Render auto-deploys on push.
- **2026-07-23:** Database backup strategy implemented — daily VACUUM INTO, 7-day retention, `GET/POST /api/backup` endpoints.
- **2026-07-23:** Release APK built — 6.1MB signed release (was 7.8MB debug), 2048-bit RSA keystore.
- **2026-07-23:** Comprehensive security hardening — 12 findings fixed across auth, CSP, headers, rate limits.
- **2026-07-23:** CSP `unsafe-inline` removed from `script-src`, JWT reduced to 5min, all scripts externalized.

---

## Enhancement Audit (2026-07-24)

All 25 findings from a comprehensive codebase audit have been implemented and pushed:

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 4 | 2 | 0 | 0 | 6 |
| Backend | 1 | 4 | 5 | 1 | 11 |
| Frontend | 0 | 2 | 2 | 0 | 4 |
| DevOps | 1 | 1 | 2 | 1 | 5 |
| **Total** | **5** | **7** | **9** | **2** | **25** |

Key changes: SQL injection fix, VAPID keys to env vars, SameSite cookie hardening, Zod validation on all write endpoints, pino logger throughout, pagination on all list endpoints, multi-stage Dockerfile, X-Request-Id middleware, enriched health check.

---

## Completed Work

### Core App
- Full React 19 + Vite 8 + Tailwind 4 scaffold
- 24 routed pages: Home, Autopilot, Dashboard, Invest, MyBots, Strategies, Backtester, Alerts, RiskManager, Connections, Pricing, Security, Settings, Help, Scheduler, Referrals, Analytics, CopyTrading, CrossDexArbitrage, CrossChainArbitrage, AutomatedTrading, Community, Privacy, Terms
- Sidebar navigation with 4 groups (Overview, Trading, Tools, Account)
- Onboarding wizard, error boundary, bug report component with diagnostics
- Multi-wallet support (MetaMask, Coinbase, WalletConnect, Phantom)
- Paxeer chain integration (chain ID 125)
- i18n framework (i18next + react-i18next, English translations)
- Financial disclaimer component with localStorage persistence
- Privacy policy page (/privacy — 6 sections)
- Terms of service page (/terms — 7 sections)

### Authentication & Security (comprehensive hardening — 2026-07-23)
- SIWE authentication with cryptographically random nonces (128-bit entropy, 5-min expiry)
- SIWE domain binding verification (prevents cross-domain replay attacks)
- JWT stored in memory only — never in localStorage or cookies (XSS can't exfiltrate)
- JWT 5-minute expiry with httpOnly refresh token cookie (7-day, SameSite=None, Secure)
- Auto-refresh on 401 — transparent to users, no re-auth needed
- JWT algorithm explicitly set to HS256 (prevents algorithm confusion attacks)
- Nonce TOCTOU race condition fixed (atomic check-and-delete before verification)
- `JWT_SECRET` env var required at startup — no silent file-based fallback
- `helmet` middleware — HSTS (1-year preload), X-Frame-Options, X-Content-Type-Options, COOP, CORP, referrer-policy
- CSP `unsafe-inline` removed from `script-src` — all inline scripts externalized
- Vite modulePreload polyfill disabled (prevents inline script injection at build time)
- CORS `credentials: true` for httpOnly cookie support
- 3-tier rate limiting (global 100/15min, auth 20/15min, trade 10/min, backup 2/hr)
- No uptime or filesystem path disclosure in API responses
- Route guards — RequireAuth wraps 16/24 routes (soft guard: auto-demo mode)
- Input validation middleware (sanitize HTML, requireFields, validateNumber, validateEnum)
- `debug.keystore` removed from repo, `*.keystore` and `.env` gitignored

### Features
- P&L Analytics — 8 utility functions, analytics page with equity curve, Sharpe ratio, max drawdown
- Real portfolio tracking — PaxScan API, native PAX + ERC-20, USD price enrichment
- Copy Trading — 6 sample traders, follow/unfollow, risk filters
- Cross-chain bridge integration (Across + Stargate v2)
- Automated trading (DCA/Grid/Mean Reversion, stop-loss, take-profit)
- Cross-DEX and cross-chain arbitrage pages
- Social features — leaderboard, shared strategies, publish/fork/like (9 API endpoints)
- Community page, referral program, scheduler, alerts system
- Error reporting — console + network interceptor, screenshot capture

### Code Quality
- CSS color extraction — 103 colors → custom properties, 595 replacements
- Autopilot decomposition — 679 lines → 190 + 8 sub-components
- Chart theme unification — shared across 5 chart pages
- Chunk splitting — 18 optimized chunks via manualChunks
- Service worker — network-first HTML, stale-while-revalidate static, API cache, push notifications
- Matrix Design System integration (brand.matrixmcl.com) — StatusPill, ConfirmDialog, Tip, Shimmer components wired into MyBots, Alerts, Settings

### Backend (Express 5 + SQLite)
- 13 database tables
- SIWE auth + JWT sessions + refresh tokens (httpOnly cookie)
- 8 route files (bots, trades, alerts, schedules, settings, copy-trading, social, push)
- 3-tier rate limiting (global, auth, trade, backup)
- Alert checker service (polls every 60s)
- Web push notifications
- Database backups — daily VACUUM INTO, 7-day retention, `GET/POST /api/backup` endpoints
- `helmet` security headers middleware
- `cookie-parser` for refresh token cookies
- Graceful shutdown with DB close

### APK & Deployment
- **6.1MB signed release APK** (was 7.8MB debug, 22% smaller)
- 2048-bit RSA signing keystore (`tradeflow-release.jks`)
- APK download page with fetch+reblob mechanism
- Web app deployed: https://tradeflow.cloud.hyperpaxeer.com
- Download page deployed: https://tradeflow-dl.cloud.hyperpaxeer.com
- APK helper deployed: https://tradeflow-apk.cloud.hyperpaxeer.com
- Staging environment: https://tradeflow-staging.cloud.hyperpaxeer.com
- Backend live on Render: https://tradeflow-api-i2o1.onrender.com

### Testing & CI
- 18/18 Vitest smoke tests
- 14/14 Playwright E2E tests
- 0 lint warnings/errors (oxlint)
- GitHub Actions CI (lint → test → build on push/PR)
- Stress test: 500 bots, 5M trades, 0 errors
- Pressure test: 1000 bots, 3 engines, 22M trades, 0 errors
- Production hard stress: rapid nav, concurrent sessions, memory, reload — all PASS

### Accessibility & Responsiveness
- WCAG AA text contrast fixes
- ARIA attributes on Toggle, LinkCard
- Media queries at 768px and 640px
- Mobile sidebar with hamburger menu, backdrop, escape key
- Focus-visible ring for keyboard navigation (2px accent outline)
- Sidebar link touch targets — 44px min-height (WCAG minimum)
- Sidebar Sign Out/Sign In buttons padding upgraded to px-3 py-2
- Mobile pie chart stacking — allocation-layout flexes column on ≤640px
- Table scroll affordance — mask-image gradient signals horizontal scroll
- Card hover accent glow — ::after pseudo-element with gradient fade-in
- Scrollbar styling — thin 6px themed scrollbar for .app-main
- Fixed pre-existing JSX bugs: duplicate div in Dashboard, missing Btn/Card/CardBody/SectionHeader/Badge imports
- Fixed pre-existing lucide-react import: Grid3X → Grid3x3 in autopilotData.js

---


## APK Distribution Strategy

**Decision: Direct sideloading — skip Google Play Store.**

The APK is distributed via direct download from our own infrastructure, not through the Google Play Store. This is a deliberate choice:

- **No Play Store fees or review delays** — we ship when ready, no 2-week review cycles
- **No 30% revenue share** on any future in-app purchases
- **Full control** over the download experience, install flow, and versioning
- **Faster iteration** — push an APK update and it's live immediately

### How it works
1. User visits **tradeflow-dl.cloud.hyperpaxeer.com** (download page)
2. Page fetches `/tradeflow.bin` via JavaScript fetch + reblob with correct Android MIME type
3. Browser downloads the file as `tradeflow.apk` with `application/vnd.android.package-archive` Content-Type
4. User opens the file to install (requires "Install from unknown sources" enabled)

### The `.bin` extension trick
Android browsers will unzip `.apk` files instead of offering to install them. Using `.bin` + JavaScript reblob bypasses this: the browser fetches raw bytes, creates a Blob with the correct MIME type, and triggers a download with the `.apk` filename.

### Live URLs
- **Download page:** https://tradeflow-dl.cloud.hyperpaxeer.com
- **APK helper:** https://tradeflow-apk.cloud.hyperpaxeer.com (same mechanism, different deploy)
- **APK file:** Hosted on Paxeer Cloud alongside the download page
## Remaining Work

### Real Device Testing
- [ ] Install release APK on 2-3 physical Android devices, verify all flows + push notifications

### API Documentation + Postgres Migration (2026-07-24)

- **Commit `b9c0d73`** — 7 files, 2488 insertions, pushed to GitHub
- **API Docs**: `docs/openapi.yaml` (1321 lines, 42 operations, 27 paths, 9 resource groups) + `docs/API.md` (250 lines, developer guide with curl examples)
- **Postgres Migration**: `server/db/migrations/001_initial_schema.sql` (14 tables), `002_indexes.sql` (14 composite indexes), `server/db/postgres.js` (SQLite-compatible adapter), `server/db/migrate.js` (runner with --dry-run), `POSTGRES_MIGRATION.md` (8-step guide)
- **Render**: auto-deploys on push to master

### Low Effort / Optional
- [ ] Further index chunk splitting (currently 40KB)
- [x] ~~Play Store listing~~ — Decision: sideload APK via direct download (skip Google Play)
