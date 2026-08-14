# TradeFlow — Task Board

## Phase 1: Risk Management 🔴 Critical

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 1.1 | Create riskManager.js | ⬜ pending | riskManager | server/services/riskManager.js |
| 1.2 | Enhance autoTrader.js | ⬜ pending | autoTrader | server/services/autoTrader.js |
| 1.3 | Add StepGrid strategy | ⬜ pending | stepGridStrategy | server/services/strategies.js |
| 1.4 | Risk-stats API + config | ⬜ pending | — | server/routes/liveTrading.js |

## Phase 2: Real-Time Data 🟠 High

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 2.1 | WebSocket price streams | ⬜ pending | websocketManager | server/services/websocketManager.js |
| 2.2 | Frontend WebSocket push | ⬜ pending | useWebSocket | src/data/liveData.js |
| 2.3 | SQLite → PostgreSQL | ⬜ pending | — | server/db.js |
| 2.4 | Monitoring dashboard | ⬜ pending | — | src/pages/ |

## Phase 3: Data Signals 🟡 Medium

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 3.1 | Funding rate + OI | ⬜ pending | fundingRateService | server/services/fundingRateService.js |
| 3.2 | Sentiment integration | ⬜ pending | — | server/services/signalEngine.js |
| 3.3 | On-chain analytics | ⬜ pending | — | server/services/ |

## Phase 4: Multi-Exchange 🟡 Medium

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 4.1 | CCXT unified adapter | ⬜ pending | exchangeAdapter | server/services/exchangeAdapter.js |
| 4.2 | Cross-exchange arb | ⬜ pending | — | server/services/ |

## Phase 5: ML / AI 🟡 Medium

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 5.1 | XGBoost predictor | ⬜ pending | mlEngine | server/services/mlEngine.js |
| 5.2 | Order book analysis | ⬜ pending | — | server/services/ |
| 5.3 | Ensemble model | ⬜ pending | — | server/services/signalEngine.js |

## Phase 6: Platform 🟢 Lower

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 6.1 | Backtesting improvements | ⬜ pending | — | src/pages/Backtester.jsx |
| 6.2 | TradingView webhook | ⬜ pending | — | server/routes/liveTrading.js |
| 6.3 | Strategy marketplace | ⬜ pending | — | server/routes/ |
| 6.4 | Paper trading realism | ⬜ pending | — | server/services/ |

## Phase 7: Execution 🟢 Lower

| ID | Task | Status | Symbols | Files |
|---|---|---|---|---|
| 7.1 | Advanced order types | ⬜ pending | — | server/services/binanceServer.js |
| 7.2 | TWAP/VWAP/routing | ⬜ pending | — | server/services/ |

---
*Generated from spec/workflow.kvx — use `cg spec` for live status*
