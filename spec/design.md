# TradeFlow — Technical Design

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Vite 8)                  │
│  React 19 · Tailwind 4 · Recharts 3 · i18next       │
│  26 pages · 16+ components · Capacitor (Android)     │
└──────────────────────┬──────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────┐
│                  Backend (Express 4)                  │
│  10 routes · 8 services · SQLite (better-sqlite3)    │
│  AES-256-GCM · JWT · SIWE auth · Zod validation     │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    Binance API    Signal Engine   Risk Manager
    (REST + WS)    (8 indicators)  (Kelly, trailing)
```

## Key Modules

### Signal Engine (`server/services/signalEngine.js`)
- Plugin architecture: each indicator is a weighted plugin
- 8 indicators: RSI, MACD, Bollinger Bands, ATR, Stochastic, ADX, OBV, EMA crossover
- Confluence scoring: weighted sum → confidence level → top-pick recommendation
- Regime detection: trending / ranging / volatile market classification

### Risk Manager (`server/services/riskManager.js`)
- Kelly Criterion: optimal fraction = (p * b - q) / b
- Trailing stop: ATR-based, tightens as profit increases
- Multi-TP: 3-level partial exits at configurable percentages
- Circuit breaker: global portfolio drawdown threshold

### Auto Trader (`server/services/autoTrader.js`)
- Orchestrates signal engine → risk manager → order execution
- Manages bot lifecycle (start, tick, stop)
- Integrates trailing stops and multi-TP on every price update

### Binance Integration (`server/services/binanceServer.js`)
- REST API for order management and historical data
- WebSocket streams for real-time prices (Phase 2)
- HMAC-SHA256 request signing
- Rate limiting and retry logic

## Database Schema (SQLite)

Core tables:
- `bots` — bot configuration, strategy, risk params
- `trades` — executed trades with entry/exit prices
- `positions` — open positions with P&L
- `daily_pnl` — daily profit/loss snapshots
- `exchange_keys` — AES-256-GCM encrypted API keys
- `alerts` — price and indicator alerts
- `settings` — user preferences

## Deployment

- **Frontend**: Vercel (tradeflow-black.vercel.app)
- **Backend**: Render (free tier, SQLite on persistent disk)
- **Mobile**: Capacitor APK (signed, Android SDK 36)
- **CI/CD**: GitHub Actions (lint → test → build)
- **Two-stage Dockerfile**: esbuild bundles ESM→CJS for Render compatibility

## Security

- AES-256-GCM encryption for API keys with HKDF key derivation
- JWT auth with SIWE (Sign-In with Ethereum) wallet verification
- authMiddleware on all private routes
- Demo token with 1-hour expiry
- Path traversal guards on backup operations
