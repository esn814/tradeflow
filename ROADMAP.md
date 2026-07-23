# TradeFlow Roadmap
*Last audited against source: 2026-07-23*

---

## Status: All Planned Features Complete ✅ — Production Hardening Underway

Every tier of the original roadmap has been built, verified, and deployed. Security hardening is complete. What remains is infrastructure, UX polish, testing, and scale preparation.

---

## Tier 1 — High Impact (all done ✅)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Paper Trading / Demo Mode | ✅ Done | Onboarding wizard sets virtual balance; demo mode toggle in Settings |
| 2 | Guided Onboarding Wizard | ✅ Done | 4-step flow: experience, amount, hands-on level, strategy recommendation |
| 3 | Copy Trading / Social Signals | ✅ Done | 6 sample traders, follow/unfollow, risk filters, trader discovery page |
| 4 | Market Pulse Widget | ✅ Done | Fear & Greed, BTC dominance, AI market summary via live data hooks |

## Tier 2 — Medium Impact (all done ✅)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5 | Telegram/Discord Alerts | ✅ Done | Push notifications via web-push + VAPID keys, push subscription storage |
| 6 | Plain-English Strategy Explanations | ✅ Done | Beginner tab per strategy with plain English, market fit indicator |
| 7 | AI Market Context Widget | ✅ Done | Integrated into Market Pulse |

## Tier 3 — Differentiators (all done ✅)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 8 | Risk Scoring for Beginners | ✅ Done | Per-bot risk score, position sizing recommendations |
| 9 | Referral / Affiliate Program | ✅ Done | Referrals page with invite flow |
| 10 | Mobile App Polish | ✅ Done | Capacitor 8 Android APK (6.1MB signed release), fetch+reblob install mechanism |

## Security Hardening (all done ✅ — 2026-07-23)

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | JWT in localStorage | CRITICAL | Memory-only + httpOnly refresh cookie, auto-refresh on 401 |
| 2 | No security headers | HIGH | helmet (HSTS preload, X-Frame-Options, X-Content-Type-Options) |
| 3 | debug.keystore in repo | HIGH | Removed, *.keystore gitignored |
| 4 | JWT_SECRET file fallback | HIGH | Env var required at startup |
| 5 | 7-day JWT expiry | HIGH | 5-min JWT + 7-day httpOnly refresh token |
| 6 | No SIWE domain binding | HIGH | Domain verification on verify |
| 7 | JWT algorithm not set | MEDIUM | Explicitly HS256 |
| 8 | Nonce TOCTOU race | MEDIUM | Atomic check-and-delete |
| 9 | CSP unsafe-inline | MEDIUM | Removed from script-src, all scripts externalized |
| 10 | Write rate limits too high | MEDIUM | Trade 10/min, backup 2/hr |
| 11 | Backup path disclosure | MEDIUM | Removed from API response |
| 12 | Missing .gitignore rules | MEDIUM | *.keystore, .env added |

## Additional Work Completed (beyond original roadmap)

| Category | What was done |
|----------|--------------|
| Backend | Express 5 + SQLite with 13 tables, SIWE auth, JWT + refresh tokens, 8 route files, 3-tier rate limiting, input validation, alert checker, backups |
| P&L Analytics | 8 utility functions, analytics page with equity curve, Sharpe ratio, max drawdown, per-strategy breakdown |
| Real Portfolio | PaxScan API integration for native PAX + ERC-20 balances with USD price enrichment |
| Cross-chain | Bridge integration (Across + Stargate v2), cross-DEX arbitrage, cross-chain arbitrage pages |
| Automated Trading | DCA/Grid/Mean Reversion strategies with stop-loss and take-profit |
| Error Reporting | Console + network interceptor, screenshot capture, rich bug reports |
| Social | Leaderboard, shared strategies with publish/fork/like, community page with 9 API endpoints |
| Code Quality | CSS extraction (103 colors, 595 replacements), autopilot decomposition (679→190 lines), chart theme unification, chunk splitting (18 optimized chunks) |
| Security | Comprehensive hardening — 12 findings fixed (see table above) |
| Testing | 18/18 Vitest smoke tests, 14/14 Playwright E2E tests, stress tests (22M trades, 0 errors) |
| CI/CD | GitHub Actions (lint → test → build on push/PR to main), Render auto-deploy, staging environment |
| Legal | Financial disclaimer, Privacy policy, Terms of service pages |
| Accessibility | WCAG AA text contrast fixes, ARIA attributes, keyboard navigation |
| i18n | i18next + react-i18next framework with English translations |
| Service Worker | Network-first HTML, stale-while-revalidate static, size-limited API cache, push support |
| Backups | Daily VACUUM INTO, 7-day retention, GET/POST /api/backup endpoints, Render persistent disk |

---

## Improvement Roadmap (from quality audit — 2026-07-23)

### Step 1: Quick Wins (~4h total) — IN PROGRESS
- [ ] Move `playwright` to devDependencies (200MB production bloat)
- [ ] Complete `.env.example` with all 9 env vars
- [ ] Memoize AuthContext value (prevent unnecessary re-renders)
- [ ] Add backup on graceful shutdown
- [ ] Add composite DB indexes (trades, alerts)
- [ ] Add Prettier formatter
- [ ] Fix Dashboard hardcoded demo data
- [ ] Document uptime monitoring setup

### Step 2: Critical Infrastructure (~20h)
- [ ] DB migration system (schema evolution blocked without it)
- [ ] Persist refresh tokens in SQLite (lost on restart)
- [ ] Server-side Sentry error tracking
- [ ] Structured logging (pino — JSON, log levels, request IDs)
- [ ] Config validation at startup

### Step 3: UX & Performance (~15h)
- [ ] Split AppStore god context (6 slices → per-domain contexts or Zustand)
- [ ] Add React.memo to expensive components
- [ ] Skeleton loading states (replace "Loading…" text)
- [ ] Web Worker for Backtester computation
- [ ] Remove unused Analytics computations
- [ ] Accessibility pass (aria-labels, keyboard nav, focus management)

### Step 4: Code Quality (~25h)
- [ ] Test coverage (trade P&L calc, auth flow, bot CRUD, server routes)
- [ ] Refactor social.js monolith (434 lines, 5x duplicated format logic)
- [ ] Zod request validation on all write endpoints
- [ ] Split Connections.jsx (452 lines, 12 useState hooks)
- [ ] Server CI tests

### Step 5: Features (~20h)
- [ ] Verify trading strategies produce real results (not mockups)
- [ ] Onboarding flow improvements
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Staging environment

### Step 6: Scale Prep (~15h)
- [ ] SQLite → PostgreSQL migration (or Render Starter for spin-down)
- [ ] Android CI pipeline
- [ ] Backup restore function + off-site backup
- [ ] Clean up Dockerfile vs render.yaml inconsistency

---

## Remaining Original Work
- [ ] Real Android device testing — install on 2-3 physical devices, verify all flows
- [ ] Further index chunk splitting (currently 40KB)
- [ ] Play Store listing (after real device testing)

---

## Architecture Summary

```
Frontend:  React 19 + Vite 8 (Rolldown) + Tailwind 4 + Recharts 3 + i18next
Backend:   Express 5 + better-sqlite3 + SIWE + JWT (5min) + refresh cookie (7d) + helmet
Mobile:    Capacitor 8 + Android SDK 36 + Gradle 8.14.3
Deploy:    Paxeer Cloud (paxc CLI) — 4 projects (main, download, apk helper, staging)
Backend:   Render (free tier, Oregon) — auto-deploys on push to master
CI/CD:     GitHub Actions (lint → test → build)
Testing:   Vitest 4.1 (18 smoke tests) + Playwright 1.61 (14 E2E tests)
Backups:   Daily VACUUM INTO, 7-day retention, Render persistent disk
Security:  helmet (HSTS), CSP (no unsafe-inline), SIWE domain binding, 5-min JWT, memory-only tokens
```
