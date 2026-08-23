/**
 * AutoTrader — Server-side auto-trading engine.
 *
 * Lifecycle:
 *   1. User creates a live_bot via API (with strategy, coin, config, risk limits)
 *   2. User starts the bot → AutoTrader.startBot(botId)
 *   3. Every interval_ms, the engine:
 *      a. Fetches current price from Binance
 *      b. Fetches klines for indicator calculation
 *      c. Runs the strategy function with current state
 *      d. If strategy returns a trade signal → executes via BinanceServer
 *      e. Records trade in live_trades, updates position in live_positions
 *      f. Enforces risk limits (daily loss, max drawdown, position size)
 *      g. Updates bot stats (total_pnl, win/loss count)
 *   4. User stops the bot → AutoTrader.stopBot(botId)
 *
 * Risk enforcement is HARD — if any limit is hit, the bot auto-stops.
 */

import { randomBytes } from 'crypto';
import { getDb } from '../db.js';
import { BinanceServer } from './binanceServer.js';
import { STRATEGIES } from './strategies.js';
import { computeSignals } from './signalEngine.js';
import { logger } from '../logger.js';
import {
  kellyPositionSize,
  calculateWinLossStats,
  updateTrailingStop,
  checkTakeProfitLevels,
  DEFAULT_TP_LEVELS,
  checkCircuitBreaker,
  atrBasedLevels,
  updatePositionState,
  createPositionState,
  calculateBreakEvenTarget,
} from './riskManager.js';
import {
  createOrderIntent,
  markIntentSubmitted,
  markIntentError,
  applyExchangeOrder,
  markIntentQuantityApplied,
  listReconciliationCandidates,
  isTerminalStatus,
  ORDER_STATES,
} from './orderExecution.js';

// ── In-memory bot runtimes ────────────────────────────────────

/** @type {Map<string, BotRuntime>} */
const runtimes = new Map();
const botLocks = new Map();

export class BotRuntime {
  constructor(bot, binance, userId) {
    this.botId = bot.id;
    this.userId = userId;
    this.binance = binance;
    this.strategy = STRATEGIES[bot.strategy]?.fn;
    this.strategyName = bot.strategy;
    this.coin = bot.coin;
    this.config = JSON.parse(bot.config || '{}');
    this.riskConfig = JSON.parse(bot.risk_config || '{}');
    this.intervalMs = bot.interval_ms || 60_000;

    // Restore persisted state from DB (survives server restarts)
    const savedState = JSON.parse(bot.strategy_state || '{}');
    this.state = savedState.holdings !== undefined ? savedState : { holdings: 0 };
    this.tickCount = savedState._tickCount || 0;
    this._priceHistory = JSON.parse(bot.price_history || '[]');

    this.dailyPnl = 0;
    this.dailyTradeCount = 0;
    this.sessionStartTime = Date.now();
    this.state.highWaterEquity = Number(savedState.highWaterEquity) || 0;
    this.lastError = null;
    this._timer = null;
    this._running = false;
    this._saveCounter = 0;
    this._lastTradeDate = new Date().toISOString().slice(0, 10);
    this._reconcileCounter = 0;
    this._activeIntentId = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    logger.info({ botId: this.botId, strategy: this.strategyName, coin: this.coin }, '[AutoTrader] Bot started');
    this._tick().finally(() => {
      if (this._running) this._startLoop();
    });
  }

  /** Use setTimeout with re-scheduling to prevent overlapping ticks */
  _startLoop() {
    this._timer = setTimeout(() => {
      if (!this._running) return;
      this._tick().finally(() => {
        if (this._running) this._startLoop();
      });
    }, this.intervalMs);
  }

  stop(reason = 'manual') {
    this._running = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    // Persist final state before stopping
    this._persistState();
    this._updateBotStatus('stopped', null, reason);
    logger.info({ botId: this.botId, reason }, '[AutoTrader] Bot stopped');
  }

  /** Persist strategy state and price history to DB immediately */
  _persistState() {
    try {
      const db = getDb();
      const stateToSave = { ...this.state, _tickCount: this.tickCount };
      const historyToSave = this._priceHistory.slice(-200);
      db.prepare(
        'UPDATE live_bots SET strategy_state = ?, price_history = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).run(JSON.stringify(stateToSave), JSON.stringify(historyToSave), this.botId);
    } catch (err) {
      logger.warn({ botId: this.botId, err: err.message }, '[AutoTrader] Failed to persist state');
    }
  }

  async _tick() {
    if (!this._running || this._tickInFlight) return;
    this._tickInFlight = true;
    try {
      await this._runTick();
    } finally {
      this._tickInFlight = false;
    }
  }

  async _runTick() {
    if (!this._running) return;
    const startTime = Date.now();

    try {
      // Reconcile durable order state before making new decisions. Never place a
      // new order while an earlier intent is still unresolved.
      this._reconcileCounter++;
      // Any unresolved intent blocks new decisions. Reconcile immediately on
      // every tick while one exists; the normal path performs no exchange call.
      const pendingIntents = listReconciliationCandidates(this.botId);
      if (pendingIntents.length > 0) {
        const reconciled = await this._reconcileOrders();
        if (!reconciled.ok || listReconciliationCandidates(this.botId).length > 0) return;
      }

      // 1. Fetch current price
      const price = await this.binance.getPrice(this.coin);
      if (!price || price <= 0) {
        logger.warn({ botId: this.botId, coin: this.coin }, '[AutoTrader] Invalid price, skipping tick');
        return;
      }

      // 2. Fetch klines for indicators
      let klines = [];
      try {
        klines = await this.binance.getKlines(this.coin, '1h', 100);
      } catch (err) {
        logger.warn({ botId: this.botId, err: err.message }, '[AutoTrader] Klines fetch failed, using cached');
      }

      // Build price history for strategies
      if (klines.length > 0) {
        this._priceHistory = klines.map(k => k.close);
        if (this._priceHistory[this._priceHistory.length - 1] !== price) {
          this._priceHistory.push(price);
        }
      } else if (this._priceHistory[this._priceHistory.length - 1] !== price) {
        this._priceHistory.push(price);
        if (this._priceHistory.length > 200) this._priceHistory = this._priceHistory.slice(-200);
      }

      // 3. Build priceData object for strategies
      const volume24h = klines.length > 0 ? klines.reduce((s, k) => s + k.quoteVolume, 0) : 0;
      const volumeHistory = klines.map(k => k.quoteVolume);

      const strategyPriceData = {
        price,
        history: this._priceHistory,
        volume24h,
        volumeHistory,
      };

      // 4. Get current balance
      let balance = 0;
      try {
        const usdt = await this.binance.getUsdtBalance();
        balance = usdt.free || 0;
      } catch (err) {
        logger.warn({ botId: this.botId, err: err.message }, '[AutoTrader] Balance fetch failed');
      }

      // 5. Run strategy
      if (!this.strategy) {
        logger.error({ botId: this.botId, strategy: this.strategyName }, '[AutoTrader] Strategy not found');
        this.stop('strategy_not_found');
        return;
      }

      const botConfig = {
        ...this.bot,
        config: this.config,
        coin: this.coin,
      };

      const signal = this.strategy({
        price,
        priceData: strategyPriceData,
        bot: botConfig,
        tickCount: this.tickCount,
        balance,
        state: this.state,
      });

      this.tickCount++;

      if (!signal) {
        this._updateBotTick(price);
        return;
      }

      // Handle _setState even if no trade action
      if (signal._setState && !signal.action) {
        this.state = { ...this.state, ...signal._setState };
        this._updateBotTick(price);
        return;
      }

      if (!signal.action || (signal.action !== 'buy' && signal.action !== 'sell')) {
        this._updateBotTick(price);
        return;
      }

      // 6. Check risk limits before executing
      const riskCheck = this._checkRiskLimits(signal, price, balance);
      if (!riskCheck.ok) {
        logger.warn({ botId: this.botId, reason: riskCheck.reason }, '[AutoTrader] Risk limit hit — stopping bot');
        this.stop(`risk_limit: ${riskCheck.reason}`);
        return;
      }

      // 7. Execute trade
      const tradeResult = await this._executeTrade(signal, price);

      // 8. Advanced risk management — trailing stops + multi-TP
      if (this.state.holdings > 0.0001 && this.state.entryPrice) {
        const riskResult = updatePositionState(
          {
            entryPrice: this.state.entryPrice,
            trailingStop: this.state.trailingStop,
            trailPct: this.state.trailPct || 0.025,
            tpLevels: this.state.tpLevels || DEFAULT_TP_LEVELS,
            hitTpLevels: new Set(this.state.hitTpLevels || []),
            highestPrice: this.state.highestPrice,
          },
          price,
          this.state.holdings
        );

        // Update state with risk manager changes
        this.state.trailingStop = riskResult.state.trailingStop;
        this.state.highestPrice = riskResult.state.highestPrice;
        if (riskResult.state.hitTpLevels) {
          this.state.hitTpLevels = [...riskResult.state.hitTpLevels];
        }

        // Execute any risk-triggered sells (trailing stop or TP)
        for (const action of riskResult.actions) {
          if (action.type === 'trailing_stop_hit' || action.type === 'take_profit') {
            const sellSignal = {
              action: 'sell',
              coin: this.coin,
              amount: action.sellAmount,
              price,
              reason: action.reason,
            };
            const riskTradeResult = await this._executeTrade(sellSignal, price);
            if (riskTradeResult) {
              this._recordTrade(sellSignal, price, riskTradeResult);
              this._updatePosition(sellSignal, price, riskTradeResult);
              this.state.holdings = Math.max(0, this.state.holdings - action.sellAmount);
            }
          }
        }
      }

      // 10. Record trade
      if (tradeResult) {
        const filledQty = tradeResult.filledQty || signal.amount;
        const previousHoldings = this.state.holdings || 0;
        this._recordTrade(signal, price, tradeResult);
        this._updatePosition(signal, price, tradeResult);

        // Apply strategy metadata only after a confirmed fill. Holdings are
        // derived from the actual filled quantity, never the requested amount.
        if (signal._setState) {
          this.state = {
            ...this.state,
            ...signal._setState,
            holdings: signal.action === 'buy'
              ? previousHoldings + filledQty
              : Math.max(0, previousHoldings - filledQty),
          };
        } else {
          this.state.holdings = signal.action === 'buy'
            ? previousHoldings + filledQty
            : Math.max(0, previousHoldings - filledQty);
        }

        // Track entry price for trailing stops and multi-TP
        if (signal.action === 'buy') {
          if (!this.state.entryPrice) {
            this.state.entryPrice = tradeResult.avgFillPrice || price;
            this.state.trailPct = this.riskConfig.trailPct || 0.025;
            this.state.highestPrice = price;
          } else {
            // Average into existing position
            const existingQty = this.state.holdings || 0;
            const newQty = tradeResult.filledQty || signal.amount;
            const existingCost = this.state.entryPrice * existingQty;
            const newCost = (tradeResult.avgFillPrice || price) * newQty;
            this.state.entryPrice = (existingCost + newCost) / (existingQty + newQty);
          }
        }

        // Reset entry tracking on full close
        if (signal.action === 'sell' && (this.state.holdings || 0) < 0.0001) {
          this.state.entryPrice = null;
          this.state.trailingStop = 0;
          this.state.hitTpLevels = [];
          this.state.highestPrice = 0;
        }
      }

      this._updateBotTick(price);
      this.lastError = null;

    } catch (err) {
      this.lastError = err.message;
      logger.error({ botId: this.botId, err: err.message, stack: err.stack }, '[AutoTrader] Tick error');
      // Don't stop on transient errors — just log and retry next tick
      // But stop if it's an auth error
      if (err.code === -2015 || err.code === -2014 || err.message?.includes('API key')) {
        this.stop('auth_error');
      }
    }
  }

  async _reconcileOrders() {
    const candidates = listReconciliationCandidates(this.botId);
    for (const intent of candidates) {
      if (!intent.exchange_order_id && !intent.client_order_id) {
        logger.error({ botId: this.botId, intentId: intent.id }, '[AutoTrader] Unresolved order intent has no exchange identifier');
        this.lastError = `Unresolved order intent: ${intent.id}`;
        this.stop('unknown_order_state');
        return { ok: false };
      }
      try {
        const exchangeOrder = await this.binance.getOrder(this.coin, intent.exchange_order_id, intent.client_order_id);
        const updated = applyExchangeOrder(intent, exchangeOrder);
        const newlyFilledQty = Math.max(0, Number(updated.executed_qty || 0) - Number(intent.applied_qty || 0));
        if (newlyFilledQty > 0) {
          const fillPrice = Number(updated.avg_fill_price || intent.signal_price || 0);
          const fillResult = {
            orderId: updated.exchange_order_id,
            filledQty: newlyFilledQty,
            filledQuote: newlyFilledQty * fillPrice,
            avgFillPrice: fillPrice,
            slippagePct: fillPrice > 0 && intent.signal_price > 0
              ? Math.abs(fillPrice - intent.signal_price) / intent.signal_price
              : 0,
          };
          const signal = {
            action: intent.action,
            coin: intent.coin,
            amount: newlyFilledQty,
            price: Number(intent.signal_price || fillPrice),
            reason: intent.reason,
          };
          this._recordTrade(signal, fillPrice, fillResult);
          this._updatePosition(signal, fillPrice, fillResult);
          const previousHoldings = Number(this.state.holdings || 0);
          this.state.holdings = intent.action === 'buy'
            ? previousHoldings + newlyFilledQty
            : Math.max(0, previousHoldings - newlyFilledQty);
          if (intent.action === 'buy' && !this.state.entryPrice) {
            this.state.entryPrice = fillPrice;
            this.state.trailPct = this.riskConfig.trailPct || 0.025;
            this.state.highestPrice = fillPrice;
          }
          if (intent.action === 'sell' && this.state.holdings < 0.0001) {
            this.state.entryPrice = null;
            this.state.trailingStop = 0;
            this.state.hitTpLevels = [];
            this.state.highestPrice = 0;
          }
          markIntentQuantityApplied(updated, Number(updated.executed_qty || 0));
        }
        if (isTerminalStatus(updated.status) && this._activeIntentId === intent.id) this._activeIntentId = null;
        if (!isTerminalStatus(updated.status)) {
          logger.warn({ botId: this.botId, intentId: intent.id, status: updated.status }, '[AutoTrader] Order still unresolved');
          this.lastError = `Order ${intent.exchange_order_id} is ${updated.status}`;
          return { ok: false };
        }
      } catch (err) {
        logger.error({ botId: this.botId, intentId: intent.id, err: err.message }, '[AutoTrader] Order reconciliation failed');
        this.lastError = `Reconciliation failed: ${err.message}`;
        return { ok: false };
      }
    }
    return { ok: true };
  }

  async _executeTrade(signal, price) {
    const { action, coin, amount, reason } = signal;
    const maxSlippagePct = this.riskConfig.maxSlippagePct || 0.005; // default 0.5%

    if (!amount || amount <= 0) {
      logger.warn({ botId: this.botId, action, amount }, '[AutoTrader] Invalid trade amount, skipping');
      return null;
    }

    let intent;
    try {
      const quoteAmount = action === 'buy' ? amount * price : null;
      if (quoteAmount !== null && quoteAmount < 10) {
        logger.warn({ botId: this.botId, quoteAmount }, '[AutoTrader] Below minimum notional ($10), skipping');
        return null;
      }

      intent = createOrderIntent({
        botId: this.botId,
        userId: this.userId,
        coin,
        action,
        amount,
        price,
        reason,
      });
      this._activeIntentId = intent.id;

      let result;
      if (action === 'buy') {
        result = await this.binance.marketOrderQuote(coin, quoteAmount, intent.client_order_id);
      } else {
        result = await this.binance.marketOrder(coin, 'SELL', amount, intent.client_order_id);
      }

      // Persist the exchange acknowledgement before local position updates.
      const persistedIntent = markIntentSubmitted(intent, result);
      if (!isTerminalStatus(persistedIntent.status)) {
        this.lastError = `Order ${persistedIntent.client_order_id} is ${persistedIntent.status}`;
        logger.warn({ botId: this.botId, intentId: intent.id, status: persistedIntent.status }, '[AutoTrader] Order requires reconciliation');
        return null;
      }
      this._activeIntentId = null;

      // Extract actual fill data from Binance response
      const filledQty = parseFloat(result.executedQty) || amount;
      const filledQuote = parseFloat(result.cummulativeQuoteQty) || (amount * price);
      const avgFillPrice = filledQty > 0 ? filledQuote / filledQty : price;

      // Slippage check
      const slippagePct = Math.abs(avgFillPrice - price) / price;
      if (slippagePct > maxSlippagePct) {
        logger.warn({
          botId: this.botId, action, coin,
          expectedPrice: price, fillPrice: avgFillPrice,
          slippage: (slippagePct * 100).toFixed(2) + '%',
          max: (maxSlippagePct * 100).toFixed(2) + '%',
        }, '[AutoTrader] ⚠️ High slippage detected');
        // Don't block — the order already filled. Log for monitoring.
      }

      logger.info({
        botId: this.botId, action, coin,
        expectedPrice: price, fillPrice: avgFillPrice,
        expectedQty: amount, filledQty,
        slippage: (slippagePct * 100).toFixed(3) + '%',
        orderId: result.orderId, reason,
      }, `[AutoTrader] ${action.toUpperCase()} executed`);

      // Return enriched result with actual fill data
      return {
        ...result,
        filledQty,
        filledQuote,
        avgFillPrice,
        slippagePct,
      };

    } catch (err) {
      if (intent) markIntentError(intent, err, ORDER_STATES.UNKNOWN);
      logger.error({ botId: this.botId, action, coin, amount, err: err.message }, '[AutoTrader] Order execution failed');
      this.lastError = `Order failed: ${err.message}`;
      // A timeout may have happened after exchange submission. Reconcile before
      // allowing a future tick to submit another order.
      return null;
    }
  }

  _checkRiskLimits(signal, price, balance) {
    const rc = this.riskConfig;

    // Daily loss limit (the route normalizes maxDailyLoss to this field)
    const dailyLossLimit = Number(rc.dailyLossLimitUsd ?? rc.maxDailyLoss);
    if (dailyLossLimit > 0 && this.dailyPnl <= -dailyLossLimit) {
      return { ok: false, reason: `Daily loss limit reached: $${this.dailyPnl.toFixed(2)}` };
    }

    // Track peak equity and enforce maximum drawdown.
    const equity = Number(balance || 0) + (Number(this.state.holdings || 0) * Number(price || 0));
    if (equity > (this.state.highWaterEquity || 0)) this.state.highWaterEquity = equity;
    const maxDrawdownPct = Number(rc.maxDrawdown);
    if (maxDrawdownPct > 0 && this.state.highWaterEquity > 0) {
      const drawdownPct = ((this.state.highWaterEquity - equity) / this.state.highWaterEquity) * 100;
      if (drawdownPct >= maxDrawdownPct) {
        return { ok: false, reason: `Maximum drawdown reached: ${drawdownPct.toFixed(2)}%` };
      }
    }

    // Max daily trades
    if (rc.maxDailyTrades && this.dailyTradeCount >= rc.maxDailyTrades) {
      return { ok: false, reason: `Max daily trades reached: ${this.dailyTradeCount}` };
    }

    // Reset daily counters if UTC date has changed
    const today = new Date().toISOString().slice(0, 10);
    if (this._lastTradeDate && this._lastTradeDate !== today) {
      this.dailyPnl = 0;
      this.dailyTradeCount = 0;
    }
    this._lastTradeDate = today;

    // Kelly Criterion position sizing (if enabled and we have trade history)
    if (signal.action === 'buy' && rc.useKelly !== false) {
      const trades = this._getRecentTrades(50);
      const stats = calculateWinLossStats(trades, 50);
      if (!stats.insufficient) {
        const kelly = kellyPositionSize({
          winRate: stats.winRate,
          avgWin: stats.avgWin,
          avgLoss: stats.avgLoss,
          balance,
          kellyFraction: rc.kellyFraction || 0.25,
          maxAllocation: rc.maxKellyAllocation || 0.25,
        });
        if (kelly.positionSize > 0) {
          const tradeValue = signal.amount * price;
          if (tradeValue > kelly.positionSize * 1.5) {
            // Allow 50% tolerance over Kelly to avoid blocking small trades
            logger.info({
              botId: this.botId,
              tradeValue,
              kellySize: kelly.positionSize,
              kellyReason: kelly.reason,
            }, '[AutoTrader] Trade exceeds Kelly size (warning, not blocking)');
          }
        }
      }
    }

    // Fee-aware profit check for sells
    if (signal.action === 'sell' && this.state.entryPrice) {
      const breakEven = calculateBreakEvenTarget();
      const gainPct = (price - this.state.entryPrice) / this.state.entryPrice;
      if (gainPct > 0 && gainPct < breakEven) {
        logger.info({
          botId: this.botId,
          gainPct: (gainPct * 100).toFixed(3),
          breakEven: (breakEven * 100).toFixed(3),
        }, '[AutoTrader] Sell below break-even (warning, not blocking)');
      }
    }

    // Max position size (in USD)
    if (signal.action === 'buy' && rc.maxPositionUsd) {
      const currentPositionUsd = (this.state.holdings || 0) * price;
      const tradeValue = signal.amount * price;
      if (currentPositionUsd + tradeValue > rc.maxPositionUsd) {
        return { ok: false, reason: `Would exceed max position: $${(currentPositionUsd + tradeValue).toFixed(2)} > $${rc.maxPositionUsd}` };
      }
    }

    // Max single trade size
    if (rc.maxTradeUsd) {
      const tradeValue = signal.action === 'buy' ? signal.amount * price : (signal.amount || 0) * price;
      if (tradeValue > rc.maxTradeUsd) {
        return { ok: false, reason: `Trade too large: $${tradeValue.toFixed(2)} > $${rc.maxTradeUsd}` };
      }
    }

    // Min balance floor
    if (rc.minBalanceUsd && signal.action === 'buy') {
      const tradeValue = signal.amount * price;
      if (balance - tradeValue < rc.minBalanceUsd) {
        return { ok: false, reason: `Would leave balance below minimum: $${(balance - tradeValue).toFixed(2)}` };
      }
    }

    return { ok: true };
  }

  /** Get recent trades for Kelly calculation */
  _getRecentTrades(limit = 50) {
    try {
      const db = getDb();
      return db.prepare(
        'SELECT action, pnl FROM live_trades WHERE bot_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(this.botId, limit);
    } catch {
      return [];
    }
  }

  _recordTrade(signal, price, tradeResult) {
    try {
      const db = getDb();
      const tradeId = `lt-${Date.now()}-${randomBytes(8).toString('hex')}`;

      // Use actual fill data when available, fall back to expected
      const fillPrice = tradeResult.avgFillPrice || price;
      const fillQty = tradeResult.filledQty || signal.amount;
      const fillValue = tradeResult.filledQuote || (fillPrice * fillQty);
      const slippagePct = tradeResult.slippagePct || 0;

      const entryPrice = Number(this.state.entryPrice);
      const pnl = signal.action === 'sell' && entryPrice > 0
        ? (fillPrice - entryPrice) * fillQty
        : 0;

      db.prepare(`
        INSERT INTO live_trades (id, bot_id, user_id, action, coin, price, qty, value, pnl, reason, order_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tradeId, this.botId, this.userId, signal.action, this.coin,
        fillPrice, fillQty, fillValue, pnl, signal.reason,
        tradeResult.orderId?.toString() || null, 'filled'
      );

      // Log slippage for monitoring
      if (slippagePct > 0.001) {
        logger.info({
          botId: this.botId, tradeId, action: signal.action,
          expectedPrice: price, fillPrice, slippage: (slippagePct * 100).toFixed(3) + '%',
        }, '[AutoTrader] Trade recorded with slippage');
      }

      // Update daily P&L
      this.dailyPnl += pnl;
      this.dailyTradeCount++;

      // Update bot stats
      const isWin = pnl > 0;
      db.prepare(`
        UPDATE live_bots SET
          total_trades = total_trades + 1,
          total_pnl = total_pnl + ?,
          win_count = win_count + ?,
          loss_count = loss_count + ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(pnl, isWin ? 1 : 0, isWin ? 0 : 1, this.botId);

      // Update daily P&L snapshot
      this._updateDailyPnlSnapshot(pnl);

    } catch (err) {
      logger.error({ botId: this.botId, err: err.message }, '[AutoTrader] Failed to record trade');
    }
  }

  _updatePosition(signal, price, tradeResult) {
    try {
      const db = getDb();
      // Use actual fill data
      const fillPrice = tradeResult.avgFillPrice || price;
      const fillQty = tradeResult.filledQty || signal.amount;

      if (signal.action === 'buy') {
        const existing = db.prepare('SELECT * FROM live_positions WHERE bot_id = ? AND coin = ?').get(this.botId, this.coin);

        if (existing) {
          const newQty = existing.qty + fillQty;
          const newCost = existing.total_cost + (fillQty * fillPrice);
          const newAvg = newCost / newQty;
          db.prepare(`
            UPDATE live_positions SET qty = ?, avg_entry_price = ?, total_cost = ?, current_price = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(newQty, newAvg, newCost, fillPrice, existing.id);
        } else {
          db.prepare(`
            INSERT INTO live_positions (bot_id, user_id, coin, qty, avg_entry_price, total_cost, current_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(this.botId, this.userId, this.coin, fillQty, fillPrice, fillQty * fillPrice, fillPrice);
        }
      }

      if (signal.action === 'sell') {
        const existing = db.prepare('SELECT * FROM live_positions WHERE bot_id = ? AND coin = ?').get(this.botId, this.coin);
        if (existing) {
          const newQty = Math.max(0, existing.qty - fillQty);
          if (newQty < 0.000001) {
            db.prepare('DELETE FROM live_positions WHERE id = ?').run(existing.id);
          } else {
            const newCost = existing.avg_entry_price * newQty;
            db.prepare(`
              UPDATE live_positions SET qty = ?, total_cost = ?, current_price = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(newQty, newCost, fillPrice, existing.id);
          }
        }
      }

      // Update unrealized P&L on all positions
      const positions = db.prepare('SELECT * FROM live_positions WHERE bot_id = ?').all(this.botId);
      for (const pos of positions) {
        const unrealized = (price - pos.avg_entry_price) * pos.qty;
        db.prepare('UPDATE live_positions SET current_price = ?, unrealized_pnl = ? WHERE id = ?').run(price, unrealized, pos.id);
      }

    } catch (err) {
      logger.error({ botId: this.botId, err: err.message }, '[AutoTrader] Failed to update position');
    }
  }

  _updateDailyPnlSnapshot(tradePnl) {
    try {
      const db = getDb();
      const today = new Date().toISOString().split('T')[0];
      const existing = db.prepare('SELECT * FROM daily_pnl WHERE user_id = ? AND bot_id = ? AND date = ?').get(this.userId, this.botId, today);

      const isWin = tradePnl > 0;

      if (existing) {
        db.prepare(`
          UPDATE daily_pnl SET
            realized_pnl = realized_pnl + ?,
            trade_count = trade_count + 1,
            win_count = win_count + ?,
            loss_count = loss_count + ?
          WHERE id = ?
        `).run(tradePnl, isWin ? 1 : 0, isWin ? 0 : 1, existing.id);
      } else {
        db.prepare(`
          INSERT INTO daily_pnl (user_id, bot_id, date, realized_pnl, trade_count, win_count, loss_count)
          VALUES (?, ?, ?, ?, 1, ?, ?)
        `).run(this.userId, this.botId, today, tradePnl, isWin ? 1 : 0, isWin ? 0 : 1);
      }
    } catch (err) {
      logger.error({ botId: this.botId, err: err.message }, '[AutoTrader] Failed to update daily P&L');
    }
  }

  _updateBotTick(price) {
    try {
      const db = getDb();
      this._saveCounter++;

      // Persist strategy state every 5 ticks (not every tick — too much I/O)
      if (this._saveCounter % 5 === 0) {
        const stateToSave = { ...this.state, _tickCount: this.tickCount };
        // Cap price history to last 200 entries for storage
        const historyToSave = this._priceHistory.slice(-200);
        db.prepare(
          'UPDATE live_bots SET last_tick_at = datetime(\'now\'), updated_at = datetime(\'now\'), strategy_state = ?, price_history = ? WHERE id = ?'
        ).run(JSON.stringify(stateToSave), JSON.stringify(historyToSave), this.botId);
      } else {
        db.prepare('UPDATE live_bots SET last_tick_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?').run(this.botId);
      }
    } catch (err) { logger.warn({ botId: this.botId, err: err.message }, '[AutoTrader] _persistState error'); }
  }

  _updateBotStatus(status, errorMessage, reason) {
    try {
      const db = getDb();
      db.prepare('UPDATE live_bots SET status = ?, error_message = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(status, errorMessage || reason || null, this.botId);
    } catch (err) { logger.warn({ botId: this.botId, err: err.message }, '[AutoTrader] _updateBotStatus error'); }
  }

  getStatus() {
    return {
      botId: this.botId,
      running: this._running,
      strategy: this.strategyName,
      coin: this.coin,
      tickCount: this.tickCount,
      dailyPnl: this.dailyPnl,
      dailyTradeCount: this.dailyTradeCount,
      holdings: this.state.holdings || 0,
      lastError: this.lastError,
      uptime: Date.now() - this.sessionStartTime,
    };
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Start a live bot. Creates BinanceServer from stored keys, initializes runtime.
 */
export async function startBot(botId, userId) {
  // Stop if already running
  if (runtimes.has(botId)) {
    runtimes.get(botId).stop('restart');
    runtimes.delete(botId);
  }

  const db = getDb();
  const bot = db.prepare('SELECT * FROM live_bots WHERE id = ? AND user_id = ?').get(botId, userId);
  if (!bot) throw new Error('Bot not found');

  // AutoTrader currently supports Binance only. Select the exact environment
  // requested by the bot, never an arbitrary key from the user's account.
  const requestedEnvironment = bot.environment || JSON.parse(bot.config || '{}').environment || 'testnet';
  const keys = db.prepare(
    "SELECT * FROM exchange_keys WHERE user_id = ? AND lower(exchange) = 'binance' AND environment = ? ORDER BY verified_at DESC, updated_at DESC LIMIT 1"
  ).get(userId, requestedEnvironment);
  if (!keys) throw new Error(`No Binance ${requestedEnvironment} API keys configured. Add them in Connections first.`);

  // Decrypt keys (AES-256-GCM only — no legacy fallback)
  const { decrypt } = await import('./crypto.js');
  let apiKey, apiSecret;
  try {
    apiKey = decrypt(keys.api_key_encrypted);
    apiSecret = decrypt(keys.api_secret_encrypted);
  } catch {
    throw new Error('API key decryption failed. Please re-enter your exchange keys in Settings → Connections.');
  }

  // Verify strategy exists
  if (!STRATEGIES[bot.strategy]) {
    throw new Error(`Strategy "${bot.strategy}" not found. Available: ${Object.keys(STRATEGIES).join(', ')}`);
  }

  // Create BinanceServer
  const binance = new BinanceServer({
    apiKey,
    apiSecret,
    environment: keys.environment || 'testnet',
  });

  // Load exchange info for proper order sizing
  try {
    await binance.loadExchangeInfo();
    const count = Object.keys(binance._symbolFilters).length;
    logger.info({ botId, symbols: count }, '[AutoTrader] Exchange info loaded');
  } catch (err) {
    logger.warn({ botId, err: err.message }, '[AutoTrader] Failed to load exchange info (non-fatal)');
  }

  // Verify the key works
  const verification = await binance.verifyKey();
  if (!verification.ok) {
    throw new Error(`API key verification failed: ${verification.error}`);
  }

  // Create and start runtime
  const runtime = new BotRuntime(bot, binance, userId);
  runtimes.set(botId, runtime);

  // Load existing position state
  const positions = db.prepare('SELECT * FROM live_positions WHERE bot_id = ?').all(botId);
  if (positions.length > 0) {
    runtime.state.holdings = positions.reduce((sum, p) => sum + p.qty, 0);
    runtime.state.entryPrice = positions[0].avg_entry_price;
  }

  // Update bot status
  db.prepare('UPDATE live_bots SET status = \'running\', error_message = NULL, updated_at = datetime(\'now\') WHERE id = ?').run(botId);

  runtime.start();
  return runtime.getStatus();
}

/**
 * Stop a live bot.
 */
export function stopBot(botId, reason = 'manual') {
  const runtime = runtimes.get(botId);
  if (!runtime) {
    // Update DB status even if runtime not in memory (server restart case)
    try {
      const db = getDb();
      db.prepare('UPDATE live_bots SET status = \'stopped\', updated_at = datetime(\'now\') WHERE id = ?').run(botId);
    } catch (err) { logger.warn({ botId, err: err.message }, '[AutoTrader] stopBot DB update error'); }
    return { botId, running: false, reason };
  }

  runtime.stop(reason);
  runtimes.delete(botId);
  return runtime.getStatus();
}

/**
 * Get status of a running bot.
 */
export function getBotStatus(botId) {
  const runtime = runtimes.get(botId);
  if (!runtime) return { botId, running: false };
  return runtime.getStatus();
}

/**
 * Get status of all running bots for a user.
 */
export function getAllRunningBots(userId) {
  const results = [];
  for (const [botId, runtime] of runtimes) {
    if (runtime.userId === userId) {
      results.push(runtime.getStatus());
    }
  }
  return results;
}

/**
 * Restore running bots after server restart.
 * Reads all bots with status='running' from DB and restarts them.
 */
export async function restoreRunningBots() {
  try {
    const db = getDb();
    const bots = db.prepare("SELECT * FROM live_bots WHERE status = 'running'").all();
    logger.info({ count: bots.length }, '[AutoTrader] Restoring running bots');

    for (const bot of bots) {
      try {
        await startBot(bot.id, bot.user_id);
        logger.info({ botId: bot.id }, '[AutoTrader] Restored bot');
      } catch (err) {
        logger.error({ botId: bot.id, err: err.message }, '[AutoTrader] Failed to restore bot');
        try {
          db.prepare("UPDATE live_bots SET status = 'error', error_message = ? WHERE id = ?").run(err.message, bot.id);
        } catch (dbErr) { logger.warn({ botId: bot.id, err: dbErr.message }, '[AutoTrader] Failed to update error status'); }
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, '[AutoTrader] Failed to restore bots');
  }
}

/**
 * Get list of available strategies with their descriptions.
 */
export function getAvailableStrategies() {
  return Object.entries(STRATEGIES).map(([key, val]) => ({
    id: key,
    name: val.name,
    description: val.description,
  }));
}

/**
 * Reset daily counters (called at midnight UTC).
 */
export function resetDailyCounters() {
  for (const [, runtime] of runtimes) {
    runtime.dailyPnl = 0;
    runtime.dailyTradeCount = 0;
  }
  logger.info('[AutoTrader] Daily counters reset');
}
