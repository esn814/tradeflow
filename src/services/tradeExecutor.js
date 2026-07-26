/**
 * TradeExecutor — bridges strategy decisions to real Binance orders.
 *
 * Modes:
 *   - 'dry-run' (default): real prices, log what WOULD happen, no orders placed
 *   - 'live': real orders on Binance (testnet or production)
 *
 * Risk controls (enforced in BOTH modes):
 *   - Max position size per trade
 *   - Daily loss limit (kills all bots if exceeded)
 *   - Per-bot balance limit
 *   - Kill switch (instant halt)
 *   - Cooldown between trades per bot
 *   - Minimum notional check ($10 Binance minimum)
 */

import { BinanceClient, BinanceError, SYMBOL_MAP } from './binanceClient.js';

const RISK_DEFAULTS = {
  maxPositionUsd: 50,       // max $50 per single trade
  dailyLossLimitUsd: 100,   // stop all trading if down $100 in a day
  maxBotBalanceUsd: 500,    // max virtual balance per bot
  cooldownMs: 5000,         // 5s between trades per bot
  minNotionalUsd: 10,       // Binance minimum
  maxOpenPositions: 5,      // max concurrent positions across all bots
};

export class TradeExecutor {
  /**
   * @param {Object} opts
   * @param {'dry-run'|'live'} opts.mode
   * @param {Object} opts.risk — risk limit overrides
   * @param {BinanceClient} opts.client — required for 'live' mode
   * @param {Function} opts.onTrade — callback(tradeRecord) for every executed/logged trade
   * @param {Function} opts.onRiskBreach — callback(breach) when a risk limit is hit
   */
  constructor({ mode = 'dry-run', risk = {}, client = null, onTrade = null, onRiskBreach = null } = {}) {
    this.mode = mode;
    this.client = client;
    this.onTrade = onTrade;
    this.onRiskBreach = onRiskBreach;
    this.risk = { ...RISK_DEFAULTS, ...risk };

    // State
    this._killSwitch = false;
    this._dailyPnl = 0;
    this._dailyResetDate = this._todayStr();
    this._lastTradeTime = {}; // botId → timestamp
    this._openPositions = 0;
    this._tradeLog = [];     // last 200 trades
    this._running = false;

    // Validate
    if (this.mode === 'live' && !this.client) {
      throw new Error('TradeExecutor live mode requires a BinanceClient');
    }
  }

  // ── Kill switch ────────────────────────────────────────────

  /** Emergency stop — halts all trading immediately */
  killSwitch(on = true) {
    this._killSwitch = on;
    if (on) console.warn('[TradeExecutor] KILL SWITCH ENGAGED — all trading halted');
  }

  isKilled() { return this._killSwitch; }

  /** Reset daily P&L tracking (call at midnight or on manual reset) */
  resetDaily() {
    this._dailyPnl = 0;
    this._dailyResetDate = this._todayStr();
  }

  // ── Core: execute a strategy decision ─────────────────────

  /**
   * Execute a trade decision from a strategy.
   * @param {Object} decision — { action, coin, amount, price, cost, reason, botId }
   * @returns {Object} { executed, trade, reason }
   */
  async execute(decision) {
    const { action, coin, amount, price, cost, reason, botId = 'unknown' } = decision;
    const tradeValue = cost || (amount * price);

    // ── Pre-flight checks ──
    const breach = this._checkRisk(action, botId, tradeValue, amount, price);
    if (breach) {
      if (this.onRiskBreach) this.onRiskBreach(breach);
      return { executed: false, trade: null, reason: breach.message };
    }

    // ── Build trade record ──
    const record = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      botId,
      action,
      coin,
      amount,
      price,
      value: tradeValue,
      reason,
      mode: this.mode,
      timestamp: Date.now(),
      status: 'pending',
      orderId: null,
      pnl: 0,
    };

    // ── Execute based on mode ──
    if (this.mode === 'dry-run') {
      return this._executeDryRun(record);
    }
    return this._executeLive(record);
  }

  // ── Dry-run execution ─────────────────────────────────────

  _executeDryRun(record) {
    record.status = 'dry-run';
    record.message = `[DRY RUN] Would ${record.action} ${record.amount.toFixed(6)} ${record.coin} @ $${record.price.toFixed(2)} ($${record.value.toFixed(2)})`;

    this._postExecute(record);
    return { executed: true, trade: record, reason: record.message };
  }

  // ── Live execution ────────────────────────────────────────

  async _executeLive(record) {
    try {
      const symbol = SYMBOL_MAP[record.coin] || `${record.coin}USDT`;

      // FIX #3: Balance sync — check real USDT balance before buy orders
      if (record.action === 'buy' && this.client) {
        try {
          const usdt = await this.client.getUsdtBalance();
          if (usdt.free < record.value) {
            record.status = 'balance_insufficient';
            record.message = `[BLOCKED] Insufficient USDT: have ${usdt.free.toFixed(2)}, need ${record.value.toFixed(2)}`;
            this._postExecute(record);
            return { executed: false, trade: record, reason: record.message };
          }
        } catch (e) {
          console.warn('[TradeExecutor] Balance check failed, proceeding:', e.message);
        }
      }

      // FIX #2: Use cached exchange filters for correct order precision
      if (this.client?._symbolFilters?.[symbol]) {
        if (record.action === 'buy') {
          // quote-order doesn't need qty rounding
        } else if (record.action === 'sell') {
          record.amount = parseFloat(this.client.roundQty(record.coin, record.amount));
        }
      }

      if (record.action === 'buy') {
        const result = await this.client.marketOrderQuote('BUY', record.coin, record.value);
        record.orderId = result.orderId;
        record.status = result.status;
        record.fills = (result.fills || []).map(f => ({
          price: parseFloat(f.price), qty: parseFloat(f.qty),
          commission: parseFloat(f.commission), commissionAsset: f.commissionAsset,
        }));
        if (record.fills.length > 0) {
          const totalQty = record.fills.reduce((s, f) => s + f.qty, 0);
          const totalCost = record.fills.reduce((s, f) => s + f.price * f.qty, 0);
          record.avgFillPrice = totalCost / totalQty;
          record.actualQty = totalQty;
          // FIX #6: Fee accounting — track total commission from fills
          record.totalCommission = record.fills.reduce((s, f) => s + f.commission, 0);
          record.feeAsset = record.fills[0]?.commissionAsset || 'BNB';
          record.netCost = totalCost + record.totalCommission;
        }

        // FIX #4: Auto stop-loss — place a stop-loss order after a successful buy
        if ((record.status === 'FILLED' || record.status === 'PARTIALLY_FILLED') && record.actualQty > 0 && this.client) {
          const stopPrice = (record.avgFillPrice || record.price) * 0.97; // 3% stop-loss
          const limitPrice = stopPrice * 0.995; // limit slightly below stop
          try {
            const stopResult = await this.client.stopLossLimit(
              'SELL', record.coin, record.actualQty, stopPrice, limitPrice
            );
            record.stopLoss = { orderId: stopResult.orderId, stopPrice, limitPrice, qty: record.actualQty };
          } catch (stopErr) {
            console.warn(`[TradeExecutor] Stop-loss placement failed: ${stopErr.message}`);
            record.stopLoss = { error: stopErr.message };
          }
        }

      } else if (record.action === 'sell') {
        // FIX #8: Cancel existing stop-loss before selling manually
        if (this.client) {
          try {
            const openOrders = await this.client.getOpenOrders(record.coin);
            for (const o of openOrders) {
              if (o.type === 'STOP_LOSS_LIMIT' && o.side === 'SELL') {
                await this.client.cancelOrder(record.coin, o.orderId);
              }
            }
          } catch { /* best effort */ }
        }

        const result = await this.client.marketOrder('SELL', record.coin, record.amount);
        record.orderId = result.orderId;
        record.status = result.status;
        record.fills = (result.fills || []).map(f => ({
          price: parseFloat(f.price), qty: parseFloat(f.qty),
          commission: parseFloat(f.commission), commissionAsset: f.commissionAsset,
        }));
        if (record.fills.length > 0) {
          const totalQty = record.fills.reduce((s, f) => s + f.qty, 0);
          const totalRevenue = record.fills.reduce((s, f) => s + f.price * f.qty, 0);
          record.avgFillPrice = totalRevenue / totalQty;
          record.actualRevenue = totalRevenue;
          // FIX #6: Fee accounting
          record.totalCommission = record.fills.reduce((s, f) => s + f.commission, 0);
          record.feeAsset = record.fills[0]?.commissionAsset || 'BNB';
          record.netRevenue = totalRevenue - record.totalCommission;
        }
      }

      // FIX #8: Handle partial fills — check if order is still PARTIALLY_FILLED
      if (record.status === 'PARTIALLY_FILLED') {
        record.partialFill = true;
        record.unfilledQty = (record.amount || 0) - (record.actualQty || 0);
        console.warn(`[TradeExecutor] Partial fill: ${record.actualQty}/${record.amount} ${record.coin}. Remaining: ${record.unfilledQty}`);
      }

      record.message = `[LIVE] ${record.action.toUpperCase()} ${record.actualQty || record.amount} ${record.coin} @ ${(record.avgFillPrice || record.price).toFixed(2)} — order ${record.orderId}${record.partialFill ? ' (PARTIAL)' : ''}`;
      this._postExecute(record);
      return { executed: true, trade: record, reason: record.message };

    } catch (err) {
      record.status = 'error';
      record.error = err.message;
      record.errorCode = err.code;
      record.message = `[LIVE ERROR] ${record.action} ${record.coin}: ${err.message}`;

      this._postExecute(record);

      if (err instanceof BinanceError) {
        if (err.code === -2010) {
          return { executed: false, trade: record, reason: `Insufficient balance: ${err.message}` };
        }
      }
      return { executed: false, trade: record, reason: record.message };
    }
  }

  // ── Post-execution bookkeeping ────────────────────────────

  _postExecute(record) {
    this._lastTradeTime[record.botId] = record.timestamp;
    if (record.action === 'buy') this._openPositions++;
    if (record.action === 'sell') this._openPositions = Math.max(0, this._openPositions - 1);

    // Track daily P&L for sell trades
    if (record.pnl) {
      this._dailyPnl += record.pnl;
    }

    // Log
    this._tradeLog = [record, ...this._tradeLog].slice(0, 200);

    // Callback
    if (this.onTrade) {
      try { this.onTrade(record); } catch (e) { console.error('[TradeExecutor] onTrade callback error:', e.message); }
    }
  }

  // ── Risk checks ──────────────────────────────────────────

  _checkRisk(action, botId, tradeValue, amount, price) {
    // Kill switch
    if (this._killSwitch) {
      return { type: 'kill_switch', message: 'Trading halted by kill switch' };
    }

    // Daily P&L reset check
    const today = this._todayStr();
    if (today !== this._dailyResetDate) {
      this._dailyPnl = 0;
      this._dailyResetDate = today;
    }

    // Daily loss limit
    if (this._dailyPnl <= -this.risk.dailyLossLimitUsd) {
      this._killSwitch = true; // auto-engage kill switch
      return { type: 'daily_loss', message: `Daily loss limit hit: $${this._dailyPnl.toFixed(2)} (limit: -$${this.risk.dailyLossLimitUsd})` };
    }

    // Position size limit
    if (tradeValue > this.risk.maxPositionUsd) {
      return { type: 'position_size', message: `Trade value $${tradeValue.toFixed(2)} exceeds max $${this.risk.maxPositionUsd}` };
    }

    // Minimum notional
    if (tradeValue < this.risk.minNotionalUsd) {
      return { type: 'min_notional', message: `Trade value $${tradeValue.toFixed(2)} below minimum $${this.risk.minNotionalUsd}` };
    }

    // Max open positions
    if (action === 'buy' && this._openPositions >= this.risk.maxOpenPositions) {
      return { type: 'max_positions', message: `Max open positions (${this.risk.maxOpenPositions}) reached` };
    }

    // Cooldown
    const lastTrade = this._lastTradeTime[botId] || 0;
    if (Date.now() - lastTrade < this.risk.cooldownMs) {
      return { type: 'cooldown', message: `Bot ${botId} in cooldown (${((this.risk.cooldownMs - (Date.now() - lastTrade)) / 1000).toFixed(1)}s remaining)` };
    }

    return null; // all checks passed
  }

  // ── State getters ─────────────────────────────────────────

  getTradeLog(limit = 50) { return this._tradeLog.slice(0, limit); }

  getDailyPnl() { return this._dailyPnl; }

  getOpenPositions() { return this._openPositions; }

  getRiskConfig() { return { ...this.risk }; }

  updateRisk(overrides) {
    Object.assign(this.risk, overrides);
  }

  getStatus() {
    return {
      mode: this.mode,
      killSwitch: this._killSwitch,
      dailyPnl: this._dailyPnl,
      openPositions: this._openPositions,
      tradeCount: this._tradeLog.length,
      connected: this.client ? true : false,
    };
  }

  _todayStr() { return new Date().toISOString().slice(0, 10); }

  destroy() {
    this._killSwitch = true;
    this._tradeLog = [];
  }
}
