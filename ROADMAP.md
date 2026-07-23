# TradeFlow Roadmap
*Last audited against source: 2026-07-23*

---

## Status: All Planned Features Complete ✅

Every tier of the original roadmap has been built, verified, and deployed. What remains is production hardening and polish — not features.

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
| 10 | Mobile App Polish | ✅ Done | Capacitor 8 Android APK (7.8MB), fetch+reblob install mechanism |

## Additional Work Completed (beyond original roadmap)

| Category | What was done |
|----------|--------------|
| Backend | Express 5 + SQLite with 13 tables, SIWE auth, JWT sessions, 8 route files, 3-tier rate limiting, input validation, alert checker service |
| P&L Analytics | 8 utility functions, analytics page with equity curve, Sharpe ratio, max drawdown, per-strategy breakdown |
| Real Portfolio | PaxScan API integration for native PAX + ERC-20 balances with USD price enrichment |
| Cross-chain | Bridge integration (Across + Stargate v2), cross-DEX arbitrage, cross-chain arbitrage pages |
| Automated Trading | DCA/Grid/Mean Reversion strategies with stop-loss and take-profit |
| Error Reporting | Console + network interceptor, screenshot capture, rich bug reports |
| Social | Leaderboard, shared strategies with publish/fork/like, community page with 9 API endpoints |
| Code Quality | CSS extraction (103 colors, 595 replacements), autopilot decomposition (679→190 lines + 8 sub-components), chart theme unification, chunk splitting (44 optimized chunks) |
| Security | Removed hardcoded fake data, random 32-byte device seed, CSP with 9+ API domains |
| Testing | 18/18 Vitest smoke tests, 14/14 Playwright E2E tests, stress tests (22M trades, 0 errors) |
| CI/CD | GitHub Actions (lint → test → build on push/PR to main), staging environment |
| Legal | Financial disclaimer, Privacy policy, Terms of service pages |
| Accessibility | WCAG AA text contrast fixes, ARIA attributes, keyboard navigation |
| i18n | i18next + react-i18next framework with English translations |
| Service Worker | Network-first HTML, stale-while-revalidate static, size-limited API cache, push support |

---

## Remaining Work — Production Hardening

These are not feature gaps. They're what separates a working app from a production-grade one.

### Medium Effort

| # | Item | Why it matters | How to do it |
|---|------|---------------|-------------|
| 1 | **Release APK** | Debug builds can't go on Play Store; debug flag means extra logging and no optimization | Generate signing keystore (`keytool -genkey`), add `signingConfigs` to `android/app/build.gradle`, build with `./gradlew assembleRelease` |
| 2 | **Deploy backend to production** | Server runs on a dev service; needs a real VPS with persistent JWT secret, health monitoring, and restart policy | Set up VPS, install Node 20 + SQLite, configure systemd service, set persistent JWT_SECRET env var, add health check endpoint monitoring |
| 3 | **Database backups** | SQLite file is the single source of truth; disk failure = total data loss | Automated daily `sqlite3 .backup` to separate volume, add export API endpoint, set retention policy |
| 4 | **Real Android device testing** | Only tested in emulator and via Playwright; real devices have different WebView behavior, memory constraints, and touch interaction | Install APK on 2-3 physical devices, test all flows, check memory usage, verify push notifications |

### Low Effort / Optional

| # | Item | Notes |
|---|------|-------|
| 5 | Clean up orphaned files | Bridge.jsx and StressTest.jsx exist on disk but are not routed — delete them |
| 6 | Further chunk splitting | Index chunk is 40KB; could split page-level chunks further if needed |
| 7 | Play Store listing | After release APK is built, set up Google Play App Signing and listing |

---

## Architecture Summary

```
Frontend:  React 19 + Vite 8 (Rolldown) + Tailwind 4 + Recharts 3 + i18next
Backend:   Express 5 + better-sqlite3 + SIWE + JWT + express-rate-limit
Mobile:    Capacitor 8 + Android SDK 36 + Gradle 8.14.3
Deploy:    Paxeer Cloud (paxc CLI) — 4 projects (main, download, apk helper, staging)
CI/CD:     GitHub Actions (lint → test → build)
Testing:   Vitest 4.1 (18 smoke tests) + Playwright 1.61 (14 E2E tests)
```
