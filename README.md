# TradeFlow

AI-powered crypto trading platform — paper trading, automated strategies, real portfolio tracking, and social trading.

## Live

| Service | URL |
|---------|-----|
| Frontend | https://tradeflow.cloud.hyperpaxeer.com |
| Backend API | https://tradeflow-api-i2o1.onrender.com |
| Download | https://tradeflow-dl.cloud.hyperpaxeer.com |
| Staging | https://tradeflow-staging.cloud.hyperpaxeer.com |

## Stack

- **Frontend:** React 19, Vite 8 (Rolldown), Tailwind CSS 4, Recharts 3, i18next
- **Backend:** Express 5, better-sqlite3, SIWE authentication, JWT (5min) + httpOnly refresh cookie (7d), helmet security headers
- **Mobile:** Capacitor 8, Android SDK 36, 6.1MB signed release APK
- **Testing:** Vitest (18 smoke + 56 unit + 18 server tests), Playwright (14 E2E tests)
- **Deploy:** Paxeer Cloud (paxc CLI) for frontend, Render (free tier) for backend
- **CI/CD:** GitHub Actions (lint → test → build on push/PR)

## Features

- **Autopilot Trading** — 3 strategies (DCA, Grid, Mean Reversion) with stop-loss and take-profit
- **Copy Trading** — follow traders, risk filters, trader discovery
- **Cross-DEX & Cross-Chain Arbitrage** — real-time opportunity scanning
- **Real Portfolio Tracking** — PaxScan API integration for native PAX + ERC-20 tokens
- **P&L Analytics** — equity curve, Sharpe ratio, max drawdown, per-strategy breakdown
- **Risk Management** — per-bot risk score, position sizing recommendations
- **Alerts & Scheduler** — configurable alerts with web push notifications
- **Social Features** — leaderboard, shared strategies with publish/fork/like
- **Paper Trading** — demo mode with virtual balance for safe learning
- **Multi-Wallet** — MetaMask, Coinbase, WalletConnect, Phantom

## Quick Start

```bash
# Frontend
npm install
npm run dev

# Backend
cd server
npm install
npm start
```

## Environment Variables

See [.env.example](.env.example) for all required variables.

## Security

- SIWE authentication with cryptographic nonces (128-bit entropy, 5-min expiry)
- JWT stored in memory only — never in localStorage or cookies
- Helmet security headers (HSTS preload, CSP without unsafe-inline, X-Frame-Options)
- 3-tier rate limiting (global, auth, trade, backup)
- Input validation with Zod schemas on all write endpoints
- 12 security findings identified and fixed (see [PROGRESS.md](PROGRESS.md))

## Testing

```bash
npm test              # Frontend smoke + unit tests
npm run test:server   # Server tests
npx playwright test   # E2E tests
```

## Documentation

- [PROGRESS.md](PROGRESS.md) — current state, completed work, remaining items
- [TODOLIST.md](TODOLIST.md) — task tracker with improvement roadmap
- [ROADMAP.md](ROADMAP.md) — feature tiers, security audit, architecture summary
- [MONITORING.md](MONITORING.md) — uptime monitoring and error tracking setup

## License

Private — All rights reserved.
