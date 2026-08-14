# AGENTS.md — Codify Agent Guide for TradeFlow

## Project Overview
TradeFlow is a full-stack crypto trading platform.

- **Frontend**: React 19 + Vite 8 + Tailwind CSS 4 — 26 pages in `src/pages/`, 16+ components in `src/components/`
- **Backend**: Express 4 + better-sqlite3 — 10 route files in `server/routes/`, 8 service files in `server/services/`
- **Mobile**: Capacitor 8 Android project in `android/`
- **Tests**: Vitest (92 unit tests) + Playwright (14 E2E tests)

## Directory Map

```
tradeflow/
├── src/                      # Frontend source
│   ├── pages/                # 26 page components (Dashboard, Backtester, Strategies, etc.)
│   ├── components/           # Reusable UI components (Sidebar, AuthGate, RiskScore, etc.)
│   ├── hooks/                # React hooks (useLiveTrading, useExchanges, etc.)
│   ├── services/             # Frontend API clients
│   ├── data/                 # Data fetching utilities
│   ├── engine/               # Client-side backtest engine
│   ├── strategies/           # Strategy definitions (client-side)
│   └── i18n/                 # Internationalization (en, zh)
│
├── server/                   # Backend source
│   ├── routes/               # Express route handlers (10 files)
│   │   ├── liveTrading.js    # Bot CRUD, start/stop, risk-stats
│   │   ├── binance.js        # Binance API proxy
│   │   ├── bots.js           # Bot management
│   │   ├── trades.js         # Trade history
│   │   └── ...
│   ├── services/             # Business logic (8 files)
│   │   ├── signalEngine.js   # 8-indicator confluence scoring
│   │   ├── autoTrader.js     # Bot execution orchestrator
│   │   ├── riskManager.js    # Kelly, trailing stops, multi-TP
│   │   ├── strategies.js     # Strategy registry (RSI, MACD, Grid, etc.)
│   │   ├── indicators.js     # Technical indicator calculations
│   │   ├── binanceServer.js  # Binance API client
│   │   └── crypto.js         # AES-256-GCM encryption
│   ├── migrations/           # Database migrations
│   └── index.js              # Server entry point
│
├── spec/                     # Codify specification files
│   ├── workflow.kvx          # Master task board (7 phases)
│   ├── requirements.md       # Feature requirements
│   └── design.md             # Technical architecture
│
└── e2e/                      # Playwright E2E tests
```

## Build & Run

```bash
# Frontend
npm install
npm run dev          # Vite dev server on :5173
npm run build        # Production build → dist/

# Backend
cd server
npm install
node index.js        # Express server on :3001

# Tests
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E tests

# Codify
cg init              # Initialize code graph
cg sync              # Index the codebase
cg spec              # View task board
cg spec next         # Get next task
```

## Entry Points

- **Frontend**: `index.html` → `src/main.jsx` → `src/App.jsx` → routes
- **Backend**: `server/index.js` → Express app → route handlers
- **Signal Engine**: `server/services/signalEngine.js` — core trading logic
- **Auto Trader**: `server/services/autoTrader.js` — bot execution loop

## Key Routes (Express)

| Route | File | Purpose |
|---|---|---|
| `/api/live-trading/*` | liveTrading.js | Bot CRUD, start/stop, risk stats |
| `/api/binance/*` | binance.js | Market data, klines, ticker |
| `/api/bots/*` | bots.js | Bot configuration |
| `/api/trades/*` | trades.js | Trade history |
| `/api/alerts/*` | alerts.js | Price alerts |
| `/api/settings/*` | settings.js | User preferences |
| `/api/social/*` | social.js | Copy trading |
| `/api/health` | index.js | Health check |

## Framework Detection

- **Frontend**: React (JSX), Vite (vite.config.js), Tailwind CSS
- **Backend**: Express (server/index.js), SQLite (better-sqlite3)
- **Mobile**: Capacitor (capacitor.config.json, android/)
- **Testing**: Vitest (vitest.config.server.js), Playwright (playwright.config.ts)
