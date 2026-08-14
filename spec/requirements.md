# TradeFlow — Requirements

## Overview
Full-stack crypto trading platform with React 19 frontend, Express 4 backend, SQLite database, real Binance data integration, and Capacitor Android mobile app.

## Core Requirements

### R1 — Signal Engine
- Plugin-based signal engine with 8 weighted indicators
- Confluence scoring with configurable thresholds
- Top-pick recommendations for automated trading

### R2 — Risk Management
- Kelly Criterion position sizing
- Trailing stop-loss
- Multi-level take-profit (2%, 4%, 8%)
- Circuit breaker at 15% portfolio drawdown
- Fee-aware profit targets
- ATR-based dynamic levels

### R3 — Live Trading
- Real Binance API integration (spot)
- Paper trading mode (same code path, simulated execution)
- Bot CRUD with start/stop lifecycle
- AES-256-GCM encrypted API key storage
- Auto-restore bots on server restart

### R4 — Real-Time Data
- WebSocket price streams from Binance
- Real-time P&L streaming per position
- System health monitoring

### R5 — Backtesting
- Server-side backtesting engine with real historical data
- Walk-forward optimization
- Monte Carlo simulation
- Realistic fee/slippage modeling

### R6 — Multi-Exchange
- CCXT-based unified exchange adapter
- Coinbase, Kraken, Bybit support
- Fee tier optimization across venues

### R7 — ML Intelligence
- XGBoost direction predictor (4h candles, 53-58% accuracy target)
- Order book analysis (OIB, depth)
- Ensemble model combining ML + confluence scoring

### R8 — Platform
- TradingView webhook integration
- Strategy marketplace (publish, browse, fork)
- i18n support (English + Chinese)
- Android APK via Capacitor
