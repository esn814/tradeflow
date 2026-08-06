const STORAGE_KEY_BOTS = 'tradeflow-sim-bots';
const STORAGE_KEY_TRADES = 'tradeflow-sim-trades';
const STORAGE_KEY_BALANCE = 'tradeflow-sim-balance';

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

/**
 * useSimulation — React hook that wraps SimulationEngine for live bot simulation.
 *
 * Replaces the fake random trade generation in Autopilot with real strategy logic.
 * Provides: start/stop individual bots, trade history, P&L, real price data.
 * Persists bot configs and trade history to localStorage.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { SimulationEngine } from '../engine/simulationEngine.js';
import { STRATEGY_META, RISK_PROFILES, mapAutopilotToEngine, DEFAULT_PARAMS } from '../strategies/index.js';

/**
 * @param {Object} options
 * @param {string[]} options.coins - Coins to track (default: BTC, ETH, SOL, AVAX, MATIC)
 * @param {number} options.startingBalance - Virtual balance per bot (default: 10000)
 * @param {number} options.tickIntervalMs - Engine tick interval (default: 1500)
 */
export function useSimulation(options = {}) {
  const coins = options.coins || ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];
  const startingBalance = options.startingBalance || 10000;
  const tickIntervalMs = options.tickIntervalMs || 1500;

  const engineRef = useRef(null);
  const [engineState, setEngineState] = useState(null);
  const [trades, setTrades] = useState(() => loadFromStorage(STORAGE_KEY_TRADES, []));
  const [bots, setBots] = useState(() => loadFromStorage(STORAGE_KEY_BOTS, []));

  // Persist trades to localStorage whenever they change
  useEffect(() => {
    if (trades.length > 0) saveToStorage(STORAGE_KEY_TRADES, trades.slice(0, 200));
  }, [trades]);

  // Restore saved bots into engine after init
  const restoredRef = useRef(false);

  // Initialize engine on mount
  useEffect(() => {
    const storeActions = {
      addDemoTrade: (trade) => {
        setTrades(prev => [trade, ...prev].slice(0, 500));
      },
      addTrade: () => {},
      updateBot: () => {},
      setStrategyState: () => {},
    };

    const engine = new SimulationEngine(storeActions, {
      coins,
      startingBalance,
      tickIntervalMs,
    });

    engineRef.current = engine;

    // Restore saved bots from localStorage
    const savedBots = loadFromStorage(STORAGE_KEY_BOTS, []);
    if (savedBots.length > 0 && !restoredRef.current) {
      restoredRef.current = true;
      savedBots.forEach(bot => {
        try {
          engine.addBot(bot);
        } catch { /* stale config */ }
      });
      engine.start();
    }

    // Poll engine state for UI updates
    const stateInterval = setInterval(() => {
      if (engineRef.current) {
        const state = engineRef.current.getState();
        setEngineState(state);
        setBots(state.bots);
      }
    }, 500);

    return () => {
      clearInterval(stateInterval);
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, []);

  // Persist bot configs to localStorage whenever they change
  useEffect(() => {
    if (bots.length > 0) {
      // Only persist essential config, not runtime state
      const configs = bots.map(b => ({
        strategy: b.strategy,
        coin: b.coin,
        name: b.name,
        balance: b.balance || b.initialBalance,
        params: b.params,
      }));
      saveToStorage(STORAGE_KEY_BOTS, configs);
    } else {
      localStorage.removeItem(STORAGE_KEY_BOTS);
    }
  }, [bots]);

  /**
   * Start a bot with an autopilot-style strategy selection.
   * Maps autopilot strategy IDs to engine strategies.
   *
   * @param {Object} config
   * @param {string} config.strategyId - Autopilot strategy ID (e.g., 'momentum', 'mean-revert')
   * @param {string} config.riskProfile - 'conservative' | 'moderate' | 'aggressive'
   * @param {string} config.coin - Coin to trade (default: random from coins list)
   * @param {number} config.tradeAmount - Starting balance for this bot
   * @param {Object} config.paramOverrides - Custom parameter overrides
   * @returns {Object|null} The created bot config
   */
  const startBot = useCallback((config) => {
    if (!engineRef.current) return null;

    const { strategyId, riskProfile = 'moderate', coin, tradeAmount, paramOverrides = {} } = config;

    // Map autopilot strategy to engine strategy
    const mapping = mapAutopilotToEngine(strategyId);
    const engineStrategyKey = mapping.engineStrategy;

    // Apply risk profile modifiers
    const profile = RISK_PROFILES.find(p => p.id === riskProfile) || RISK_PROFILES[1];
    const baseParams = { ...DEFAULT_PARAMS[engineStrategyKey] };

    // Scale trade percentage by risk multiplier
    if (baseParams.tradePct) {
      baseParams.tradePct = +(baseParams.tradePct * profile.sizeMultiplier).toFixed(4);
    }
    if (baseParams.buyPct) {
      baseParams.buyPct = +(baseParams.buyPct * profile.sizeMultiplier).toFixed(4);
    }
    if (baseParams.dipBuyPct) {
      baseParams.dipBuyPct = +(baseParams.dipBuyPct * profile.sizeMultiplier).toFixed(4);
    }
    if (baseParams.orderPct) {
      baseParams.orderPct = +(baseParams.orderPct * profile.sizeMultiplier).toFixed(4);
    }

    const selectedCoin = coin || coins[Math.floor(Math.random() * coins.length)];

    const botConfig = engineRef.current.addBot({
      strategy: engineStrategyKey,
      coin: selectedCoin,
      name: `${mapping.name} ${selectedCoin} Bot`,
      balance: tradeAmount || startingBalance,
      params: { ...baseParams, ...paramOverrides },
    });

    // Start the engine if not running
    if (!engineRef.current.running) {
      engineRef.current.start();
    }

    return botConfig;
  }, [coins, startingBalance]);

  /**
   * Start a bot directly with an engine strategy key.
   */
  const startEngineBot = useCallback((config) => {
    if (!engineRef.current) return null;

    const botConfig = engineRef.current.addBot(config);

    if (!engineRef.current.running) {
      engineRef.current.start();
    }

    return botConfig;
  }, []);

  /**
   * Stop and remove a bot.
   */
  const stopBot = useCallback((botId) => {
    if (!engineRef.current) return;
    engineRef.current.removeBot(botId);
  }, []);

  /**
   * Pause a bot (keeps it in the list but stops trading).
   */
  const pauseBot = useCallback((botId) => {
    if (!engineRef.current) return;
    engineRef.current.pauseBot(botId);
  }, []);

  /**
   * Resume a paused bot.
   */
  const resumeBot = useCallback((botId) => {
    if (!engineRef.current) return;
    engineRef.current.resumeBot(botId);
  }, []);

  /**
   * Stop the entire engine.
   */
  const stopAll = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
  }, []);

  /**
   * Start the engine (if bots are configured).
   */
  const startEngine = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.start();
  }, []);

  /**
   * Reset everything — stop engine, clear bots and trades.
   */
  const reset = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.reset();
    setTrades([]);
    setBots([]);
    setEngineState(null);
    localStorage.removeItem(STORAGE_KEY_BOTS);
    localStorage.removeItem(STORAGE_KEY_TRADES);
  }, []);

  /**
   * Get price history for charts.
   */
  const getPriceHistory = useCallback((symbol) => {
    if (!engineRef.current) return [];
    return engineRef.current.getPriceHistory(symbol);
  }, []);

  return {
    // State
    running: engineState?.running || false,
    tickCount: engineState?.tickCount || 0,
    uptime: engineState?.uptime || 0,
    prices: engineState?.prices || {},
    bots,
    trades,
    metrics: engineState?.metrics || { totalTrades: 0, totalVolume: 0, tradesPerSecond: '0.0' },

    // Actions
    startBot,
    startEngineBot,
    stopBot,
    pauseBot,
    resumeBot,
    stopAll,
    startEngine,
    reset,
    getPriceHistory,

    // Direct engine access (for advanced use)
    engine: engineRef,
  };
}
