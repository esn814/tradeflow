# TradeFlow TODO — Master Task Tracker

*Last updated: 2026-08-12*
*Source: Competitive analysis + codebase audit*

---

## 🔴 Phase 1 — Quick Wins (Highest Impact, Lowest Effort)

### Risk Management (NEW — code written, needs pushing)
- [ ] **Create `server/services/riskManager.js`** — Kelly Criterion, trailing stops, multi-TP, circuit breaker, fee-aware targets, ATR-based levels. ⚠️ FILE WRITTEN IN SANDBOX — needs manual creation on device.
- [ ] **Enhance `server/services/autoTrader.js`** — integrate trailing stops + multi-TP execution, entry price tracking, Kelly sizing warnings, fee-aware logging. ⚠️ CHANGES WRITTEN IN SANDBOX — needs manual patch.
- [ ] **Add StepGrid strategy** to `server/services/strategies.js` — ATR-dynamic grid spacing, trend-aware pausing, scale-up on dips. ⚠️ CODE WRITTEN IN SANDBOX — needs manual insertion.
- [ ] **Register stepGrid in STRATEGIES registry** — add entry to the export object.
- [ ] **Add `risk-stats/:botId` endpoint** to `server/routes/liveTrading.js` — returns Kelly sizing, win/loss stats, fee analysis, TP levels.
- [ ] **Add new risk config fields** to bot creation: `trailPct`, `kellyFraction`, `useKelly`.

### What These Do
| Feature | What It Solves |
|---|---|
| Kelly Criterion | Mathematically optimal position sizing — prevents over-sizing losing strategies |
| Trailing stop-loss | Locks in gains as price rises — every competitor has this |
| Multi-TP levels | Scale out at +2%, +4%, +8% — reduces risk on winning trades |
| Circuit breaker | Auto-pause all bots at 15% portfolio drawdown |
| Fee-aware targets | Ensures trades are profitable after Binance round-trip fees |
| StepGrid strategy | ATR-adaptive grid — Gunbot's best performer |

---

## 🟠 Phase 2 — Real-Time Data Infrastructure

### WebSocket Price Streams
- [ ] **Add `ws` package** to server dependencies
- [ ] **Create `server/services/websocketManager.js`** — Binance WebSocket streams for real-time price, order book, trade data
- [ ] **Auto-reconnection** with exponential backoff (1s → 2s → 4s → 8s → 16s)
- [ ] **Replace REST polling** in autoTrader.js with WebSocket price feed
- [ ] **Replace frontend polling** in `src/data/liveData.js` with WebSocket push

### Database Upgrade
- [ ] **Migrate SQLite → PostgreSQL** (migration infrastructure already exists in codebase)
- [ ] **Add TimescaleDB extension** for time-series optimization
- [ ] **Add Redis** for caching current prices, order states, bot states

### Monitoring
- [ ] **Real-time P&L streaming** per position and per strategy
- [ ] **System health dashboard** — WebSocket connection status, API rate limits, order latency
- [ ] **Strategy performance metrics** — rolling Sharpe, win rate, max drawdown, profit factor

---

## 🟠 Phase 3 — New Data Signals

### Funding Rate + Open Interest
- [ ] **Create `server/services/fundingRateService.js`** — fetch from Binance Futures API (free)
- [ ] **Add funding rate signal** to signalEngine.js — extreme rates (>0.1%/8h) = contrarian signal
- [ ] **Add open interest tracking** — rising OI + falling price = trend continuation
- [ ] **CoinGlass API integration** ($29/mo) for liquidation data and OI-weighted funding

### Sentiment Data
- [ ] **LunarCrush API integration** ($50/mo) — social volume, social dominance, weighted sentiment
- [ ] **Fear & Greed Index** — free API, good sentiment filter
- [ ] **Add sentiment as position sizing filter** — reduce size during extreme fear/greed

### On-Chain Analytics (Lower Priority)
- [ ] **Exchange inflow/outflow** via CryptoQuant API ($29/mo)
- [ ] **Whale transaction tracking** via Whale Alert API (free tier)
- [ ] **MVRV Z-Score** for macro cycle identification

---

## 🟡 Phase 4 — Multi-Exchange Support

### CCXT Integration
- [ ] **Add `ccxt` package** to server dependencies (JS-native, 103+ exchanges)
- [ ] **Create `server/services/exchangeAdapter.js`** — unified interface over CCXT
- [ ] **Refactor BinanceServer** to use CCXT internally
- [ ] **Add Coinbase, Kraken, Bybit adapters**
- [ ] **Fee tier optimization** — track 30d volume per exchange, route to lowest-fee venue

### Cross-Exchange Arbitrage
- [ ] **Monitor price discrepancies** across exchanges in real-time
- [ ] **Simultaneous buy/sell execution** on different venues
- [ ] **Requires pre-funded accounts** on multiple exchanges

---

## 🟡 Phase 5 — ML / AI Intelligence

### XGBoost Direction Predictor
- [ ] **Create `server/services/mlEngine.js`** — XGBoost classifier for 4h direction prediction
- [ ] **Feature engineering** — combine 8 indicators + funding rate + sentiment + order book imbalance
- [ ] **Walk-forward optimization** — rolling training window, prevent overfitting
- [ ] **53-58% directional accuracy target** — enough for alpha with proper sizing
- [ ] **npm install `xgboost.js`** or use Python subprocess

### Order Book Analysis
- [ ] **Bid/ask imbalance (OIB)** — short-term predictive power (seconds to minutes)
- [ ] **Depth analysis** — large resting orders as support/resistance
- [ ] **L2 order book via exchange WebSocket** — free, requires real-time processing

### Advanced Signal Fusion
- [ ] **Ensemble model** — weighted average of XGBoost + existing confluence scoring
- [ ] **Regime detection** as meta-feature — model switches behavior by market regime
- [ ] **Backtest ML models** with realistic fees, slippage, survivorship bias

---

## 🟢 Phase 6 — Platform Features

### Backtesting Improvements
- [ ] **Walk-forward optimization** — training → validation → roll forward
- [ ] **Monte Carlo simulation** — confidence intervals on returns/drawdown
- [ ] **Realistic fee/slippage modeling** — maker/taker by tier, spread, funding rates
- [ ] **Survivorship bias handling** — include delisted coins, dead pairs
- [ ] **Regime-segmented results** — show performance by trending/ranging/volatile

### TradingView Integration
- [ ] **Webhook endpoint** — `POST /api/live-trading/webhook`
- [ ] **TradingView alert → TradeFlow execution** — parse alert JSON, map to bot action
- [ ] **1-2 days effort, high demand from traders**

### Strategy Marketplace
- [ ] **Community strategy sharing** — publish, browse, fork strategies
- [ ] **Strategy versioning** — Git-based with performance history per version
- [ ] **Copy strategy configs** — not just copy trading, copy entire strategy setups

### Paper Trading Realism
- [ ] **Same code path as live** — only execution layer differs
- [ ] **Realistic slippage** based on order book depth
- [ ] **Simulate execution latency** (50-200ms random delay)
- [ ] **Support partial fills**, respect lot size/tick size rules

---

## ⚪ Phase 7 — Execution Enhancements

### Advanced Order Types
- [ ] **OCO orders** (One-Cancels-Other) — Binance native support
- [ ] **Stop-limit orders** — already in BinanceServer but not wired to strategies
- [ ] **Trailing stop orders** at exchange level (Binance native trailing stop)
- [ ] **Iceberg orders** — large orders split into smaller visible chunks

### Execution Algorithms
- [ ] **TWAP** (Time-Weighted Average Price) — split orders over time. 1-2 days.
- [ ] **VWAP** (Volume-Weighted Average Price) — split by volume profile. 1 week.
- [ ] **Smart order routing** — split across venues for best execution

---

## ❌ Do NOT Build (Researched, Decided Against)

| Feature | Why Skip |
|---|---|
| Reinforcement learning bots | Overfitting, unreliable in production. Good backtests, terrible live. |
| Transformer models | Marginal improvement over XGBoost at 100x complexity. |
| High-frequency trading | Not feasible with current architecture, edge shrinking. |
| Custom scripting language | HaasScript took years. Use JS/Python plugin system instead. |
| Native mobile app | Capacitor APK is sufficient. Native = 2x maintenance. |
| DeFi yield farming | Separate product, dilutes focus. |
| NFT trading | Different market, different expertise. |
| "AI-powered" marketing | Users see through it. Substance > buzzwords. |

---

## 📊 Competitive Gap Summary

| Gap | TradeFlow | Competitors | Priority |
|---|---|---|---|
| Trailing stop-loss | ❌ Basic SL/TP only | All have it | 🔴 Critical |
| Multi-exchange | Binance only | 15-30+ exchanges | 🟠 High |
| Futures/Leverage | ❌ Spot only | Most support | 🟠 High |
| WebSocket data | ❌ REST polling | All use WS | 🟠 High |
| Paper trading | ❌ | All have it | 🟠 High |
| Position sizing | Fixed % | Kelly/ATR-based | 🔴 Critical |
| Funding rate signals | ❌ | Institutional bots | 🟡 Medium |
| Sentiment data | ❌ | Some platforms | 🟡 Medium |
| TradingView webhook | ❌ | 3Commas, Cryptohopper, etc. | 🟡 Medium |
| Strategy marketplace | ❌ | 3Commas, Cryptohopper, Gunbot | 🟢 Lower |
| Visual strategy builder | ❌ | HaasOnline, Gunbot | 🟢 Lower |
| Mobile app | ❌ | 3Commas, Cryptohopper | 🟢 Lower |

---

## 📁 Files Changed / Created (Sandbox Only — Need Manual Push)

| File | Status | What Changed |
|---|---|---|
| `server/services/riskManager.js` | **NEW** (360 lines) | Kelly, trailing stops, multi-TP, circuit breaker, fee-aware, ATR levels |
| `server/services/autoTrader.js` | **MODIFIED** | Import risk manager, trailing stop + TP execution on every tick, entry price tracking, Kelly warnings |
| `server/services/strategies.js` | **MODIFIED** | New `stepGridStrategy` (108 lines), registered in STRATEGIES |
| `server/routes/liveTrading.js` | **MODIFIED** | New `risk-stats/:botId` endpoint, new risk config fields on bot creation |

---

*Full competitive analysis: `knowledge/analysis/tradeflow-competitive-analysis.md`*
