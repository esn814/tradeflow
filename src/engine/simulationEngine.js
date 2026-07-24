/**
 * Simulation Engine — orchestrates trading bots against the price simulator.
 *
 * Each bot runs a strategy on every tick. The engine manages:
 * - Bot lifecycle (create, start, pause, stop, remove)
 * - Virtual balance tracking per bot
 * - Trade execution through store actions
 * - Metrics collection (trades/sec, volume, errors, uptime)
 *
 * The engine does NOT import the React store directly.
 * Store actions are injected via the constructor.
 */

import { RealPriceProvider } from './realPriceProvider.js';
import { PriceSimulator } from './priceSimulator.js';
import { STRATEGIES, DEFAULT_BOT_CONFIGS } from './strategies.js';

export class SimulationEngine {
  /**
   * @param {Object} storeActions - { addDemoTrade, addTrade, updateBot, setStrategyState }
   * @param {Object} options - { coins, tickIntervalMs, startingBalance }
   */
  constructor(storeActions, options = {}) {
    this.storeActions = storeActions;
    this.coins = options.coins || ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];
    this.startingBalance = options.startingBalance || 10000;
    this.tickIntervalMs = options.tickIntervalMs || 1000; // 1s default for fast strategies
    this.fastTickMs = options.fastTickMs || 400; // 400ms for scalping/sniper bots

    this.useSimulator = options.useSimulator || false;
    this.priceSim = this.useSimulator
      ? new PriceSimulator(this.coins)
      : new RealPriceProvider(this.coins);
    this.bots = new Map(); // id → { config, state, strategy, balance, holdings, metrics }
    this.intervalId = null;
    this.tickCount = 0;
    this.running = false;

    // Global metrics
    this.metrics = {
      totalTrades: 0,
      totalVolume: 0,
      totalErrors: 0,
      startTime: null,
      tradesPerSecond: 0,
      recentTrades: [], // last 50 trades for the feed
    };

    this._tradeTimestamps = []; // for TPS calculation
  }

  /** Create a bot with a given strategy */
  addBot(config) {
    const id = config.id || `sim-bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const strategyKey = config.strategy || 'dca';
    const strategy = STRATEGIES[strategyKey];
    if (!strategy) {
      console.warn(`Unknown strategy: ${strategyKey}`);
      return null;
    }

    const coin = config.coin || this.coins[Math.floor(Math.random() * this.coins.length)];
    const botConfig = {
      id,
      name: config.name || `${strategy.name} ${coin} Bot`,
      type: strategy.name,
      coin,
      strategy: strategyKey,
      params: { ...DEFAULT_BOT_CONFIGS[strategyKey], ...(config.params || {}) },
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const botState = {
      config: botConfig,
      strategy: strategy.fn,
      balance: config.balance || this.startingBalance,
      initialBalance: config.balance || this.startingBalance,
      holdings: 0,        // coin units held
      holdingsValue: 0,   // USD value of holdings
      invested: config.balance || this.startingBalance,
      tradeCount: 0,
      wins: 0,
      losses: 0,
      pnl: 0,
      errors: 0,
      state: {},           // strategy-specific state
      status: 'active',
    };

    this.bots.set(id, botState);
    return botConfig;
  }

  /** Remove a bot */
  removeBot(id) {
    this.bots.delete(id);
  }

  /** Pause a single bot */
  pauseBot(id) {
    const bot = this.bots.get(id);
    if (bot) bot.status = 'paused';
  }

  /** Resume a single bot */
  resumeBot(id) {
    const bot = this.bots.get(id);
    if (bot) bot.status = 'active';
  }

  /** Start the simulation loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.metrics.startTime = this.metrics.startTime || Date.now();

    this.intervalId = setInterval(() => {
      this._tick().catch(err => {
        this.metrics.totalErrors++;
        console.error('Tick error:', err.message);
      });
    }, this.tickIntervalMs);
  }

  /** Stop the simulation loop */
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Reset everything */
  reset() {
    this.stop();
    this.priceSim.reset();
    this.bots.clear();
    this.tickCount = 0;
    this.metrics = {
      totalTrades: 0,
      totalVolume: 0,
      totalErrors: 0,
      startTime: null,
      tradesPerSecond: 0,
      recentTrades: [],
    };
    this._tradeTimestamps = [];
  }

  /** Get current state for UI */
  getState() {
    const botList = [];
    for (const [id, bot] of this.bots) {
      const currentPrice = this.priceSim.getPrice(bot.config.coin);
      const holdingsValue = bot.holdings * currentPrice;
      const totalValue = bot.balance + holdingsValue;
      const pnl = totalValue - bot.initialBalance;
      const pnlPct = bot.initialBalance > 0 ? (pnl / bot.initialBalance) * 100 : 0;

      botList.push({
        id,
        name: bot.config.name,
        type: bot.config.type,
        coin: bot.config.coin,
        strategy: bot.config.strategy,
        status: bot.status,
        balance: bot.balance,
        holdings: bot.holdings,
        holdingsValue,
        totalValue,
        invested: bot.initialBalance,
        pnl,
        pnlPct,
        tradeCount: bot.tradeCount,
        winRate: bot.tradeCount > 0 ? ((bot.wins / bot.tradeCount) * 100).toFixed(1) : '0.0',
        errors: bot.errors,
      });
    }

    // Calculate TPS
    const now = Date.now();
    this._tradeTimestamps = this._tradeTimestamps.filter(t => now - t < 10000);
    const tps = this._tradeTimestamps.length / 10;

    return {
      running: this.running,
      tickCount: this.tickCount,
      uptime: this.metrics.startTime ? now - this.metrics.startTime : 0,
      prices: this.priceSim.getAllPrices(),
      bots: botList,
      metrics: {
        ...this.metrics,
        tradesPerSecond: tps.toFixed(1),
      },
    };
  }

  /** Get price history for charts */
  getPriceHistory(symbol) {
    return this.priceSim.getHistory(symbol);
  }

  /** Internal: run one simulation tick */
  async _tick() {
    this.tickCount++;

    // 1. Update all prices (async for RealPriceProvider, sync for PriceSimulator)
    const prices = await this.priceSim.tick();
    // Augment prices with history for strategies that need it
    const pricesWithHistory = {};
    for (const [symbol, priceData] of Object.entries(prices)) {
      pricesWithHistory[symbol] = {
        ...priceData,
        history: this.priceSim.getHistory(symbol).map(h => h.price),
      };
    }

    // 2. Run each active bot's strategy
    for (const [id, bot] of this.bots) {
      if (bot.status !== 'active') continue;

      try {
        const result = bot.strategy({
          prices: pricesWithHistory,
          bot: bot.config,
          tickCount: this.tickCount,
          balance: bot.balance,
          state: bot.state,
        });

        if (!result) continue;

        // Handle state-only updates (no trade)
        if (result._setState) {
          bot.state = { ...bot.state, ...result._setState };
          if (!result.action) continue;
        }

        if (result.action === 'buy') {
          this._executeBuy(id, bot, result);
        } else if (result.action === 'sell') {
          this._executeSell(id, bot, result);
        }
      } catch (err) {
        bot.errors++;
        this.metrics.totalErrors++;
        console.error(`Bot ${id} strategy error:`, err.message);
      }
    }
  }

  /** Execute a buy trade */
  _executeBuy(botId, bot, trade) {
    if (bot.balance < trade.cost) return;

    bot.balance -= trade.cost;
    bot.holdings += trade.amount;
    bot.tradeCount++;

    const tradeRecord = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      botId,
      type: 'buy',
      coin: trade.coin,
      amount: trade.amount,
      price: trade.price,
      value: trade.cost,
      reason: trade.reason,
      timestamp: Date.now(),
      pnl: 0,
    };

    this._recordTrade(botId, bot, tradeRecord);
  }

  /** Execute a sell trade */
  _executeSell(botId, bot, trade) {
    if (bot.holdings < trade.amount) return;

    bot.holdings -= trade.amount;
    const revenue = trade.amount * trade.price;
    bot.balance += revenue;

    // Calculate PnL for this trade (simplified: compare to average cost)
    const avgCost = bot.initialBalance > 0 ? (bot.initialBalance - bot.balance) / Math.max(bot.holdings, 0.0001) : trade.price;
    const pnl = (trade.price - avgCost) * trade.amount;

    if (pnl > 0) bot.wins++;
    else bot.losses++;
    bot.tradeCount++;

    const tradeRecord = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      botId,
      type: 'sell',
      coin: trade.coin,
      amount: trade.amount,
      price: trade.price,
      value: revenue,
      reason: trade.reason,
      timestamp: Date.now(),
      pnl,
    };

    this._recordTrade(botId, bot, tradeRecord);
  }

  /** Record a trade in metrics and push to store */
  _recordTrade(botId, bot, trade) {
    // Update metrics
    this.metrics.totalTrades++;
    this.metrics.totalVolume += trade.value;
    this._tradeTimestamps.push(trade.timestamp);
    this.metrics.recentTrades = [trade, ...this.metrics.recentTrades].slice(0, 50);

    // Push to store (demo trades and per-bot trade history)
    try {
      if (this.storeActions.addDemoTrade) {
        this.storeActions.addDemoTrade(trade);
      }
      if (this.storeActions.addTrade) {
        this.storeActions.addTrade(botId, trade);
      }
    } catch (err) {
      this.metrics.totalErrors++;
      console.error('Failed to record trade to store:', err.message);
    }
  }
}

/**
 * Quick helper: create a pre-configured simulation with N bots spread across strategies.
 */
export function createDefaultSimulation(storeActions, options = {}) {
  const engine = new SimulationEngine(storeActions, options);

  const botCount = options.botCount || 6;
  const strategyKeys = Object.keys(STRATEGIES);
  const coins = options.coins || ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];

  for (let i = 0; i < botCount; i++) {
    const strategy = strategyKeys[i % strategyKeys.length];
    const coin = coins[i % coins.length];
    engine.addBot({
      strategy,
      coin,
      name: `${STRATEGIES[strategy].name} ${coin} #${Math.floor(i / strategyKeys.length) + 1}`,
      balance: options.startingBalance || 10000,
    });
  }

  return engine;
}
