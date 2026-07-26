/**
 * useBinance — React hook for Binance connection lifecycle.
 *
 * Manages: client instantiation, real-time price streaming,
 * trade executor state, API key persistence (encrypted),
 * and connection health monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { BinanceClient } from '../services/binanceClient.js';
import { TradeExecutor } from '../services/tradeExecutor.js';
import { encryptExchangeKeys, decryptExchangeKeys } from '../utils/crypto.js';
import { recordTrade } from '../services/apiClient.js';

const STORAGE_KEY = 'tradeflow-exchange-config';
const ENCRYPTED_KEY = 'tradeflow-exchange-keys';

// Backend proxy URL — routes Binance API calls server-to-server to avoid CORS
const PROXY_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/binance';

// Default tracked coins (subset of what BinanceClient supports)
const DEFAULT_COINS = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT'];

/**
 * Load saved exchange config from localStorage (non-sensitive parts only).
 */
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { environment: 'testnet', mode: 'dry-run', riskOverrides: {} };
}

function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* ignore */ }
}

/**
 * useBinance hook.
 *
 * Returns:
 *   - connected: boolean
 *   - connecting: boolean
 *   - prices: { [coin]: { price, priceChange, high24h, low24h, volume24h, timestamp } }
 *   - balances: [{ asset, free, locked, total }]
 *   - executorStatus: { mode, killSwitch, dailyPnl, openPositions, tradeCount }
 *   - wsStatus: { wsConnected, subscriptionCount }
 *   - error: string | null
 *   - connect(apiKey, apiSecret, environment?): void
 *   - disconnect(): void
 *   - switchMode(mode): void — toggle 'dry-run' / 'live'
 *   - updateRisk(overrides): void
 *   - killSwitch(on): void
 *   - refreshBalances(): Promise
 *   - getTradeLog(): TradeRecord[]
 *   - executeDecision(decision): Promise<result>
 *   - client: BinanceClient | null (for advanced use)
 *   - executor: TradeExecutor | null
 *   - config: { environment, mode }
 */
export function useBinance(coins = DEFAULT_COINS) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [prices, setPrices] = useState({});
  const [balances, setBalances] = useState([]);
  const [error, setError] = useState(null);
  const [executorStatus, setExecutorStatus] = useState(null);
  const [wsStatus, setWsStatus] = useState(null);

  const clientRef = useRef(null);
  const executorRef = useRef(null);
  const configRef = useRef(loadConfig());
  const unsubPricesRef = useRef(null);
  const statusIntervalRef = useRef(null);

  // Update executor status periodically
  const _startStatusPolling = useCallback(() => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(() => {
      if (executorRef.current) setExecutorStatus(executorRef.current.getStatus());
      if (clientRef.current) setWsStatus(clientRef.current.getStatus());
    }, 2000);
  }, []);

  const _stopStatusPolling = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }, []);

  /**
   * Connect to Binance with API credentials.
   */
  const connect = useCallback(async (apiKey, apiSecret, environment) => {
    const env = environment || configRef.current.environment || 'testnet';
    setConnecting(true);
    setError(null);

    try {
      // Clean up previous connection
      if (unsubPricesRef.current) { unsubPricesRef.current(); unsubPricesRef.current = null; }
      if (clientRef.current) { clientRef.current.destroy(); clientRef.current = null; }

      // Create client
      const client = new BinanceClient({ apiKey, apiSecret, environment: env, proxyUrl: PROXY_URL });

      // Verify key works
      const verify = await client.verifyKey();
      if (!verify.ok) {
        throw new Error(`API key verification failed: ${verify.error} (code: ${verify.code})`);
      }

      // Create executor
      const executor = new TradeExecutor({
        mode: configRef.current.mode || 'dry-run',
        risk: configRef.current.riskOverrides || {},
        client,
        onTrade: (record) => {
          console.log(`[TradeExecutor] ${record.message || `${record.action} ${record.coin}`}`);
        },
        onRiskBreach: (breach) => {
          console.warn(`[TradeExecutor] RISK BREACH: ${breach.message}`);
        },
      });

      clientRef.current = client;
      executorRef.current = executor;

      // FIX #2: Load exchange info filters (LOT_SIZE, PRICE_FILTER) for correct order precision
      try {
        const filterCount = await client.loadExchangeInfo();
        console.log(`[useBinance] Loaded ${filterCount} symbol filters from exchangeInfo`);
      } catch (e) {
        console.warn('[useBinance] exchangeInfo load failed:', e.message);
      }

      // FIX #5: Wire onTrade callback to persist live trades to backend
      executor.onTrade = async (record) => {
        console.log(`[TradeExecutor] ${record.message || `${record.action} ${record.coin}`}`);
        // Persist to backend (best-effort)
        try {
          await recordTrade({
            botId: record.botId,
            type: record.action,
            coin: record.coin,
            amount: record.actualQty || record.amount,
            price: record.avgFillPrice || record.price,
            value: record.value,
            reason: record.reason,
            orderId: record.orderId,
            mode: record.mode,
            fee: record.totalCommission || 0,
            feeAsset: record.feeAsset,
            pnl: record.pnl || 0,
            timestamp: record.timestamp,
          });
        } catch (e) {
          console.warn('[useBinance] Trade persist failed:', e.message);
        }
      };

      // FIX #7: Save encrypted API keys for session restore
      try {
        const encrypted = await encryptExchangeKeys({ apiKey, apiSecret, environment: env });
        localStorage.setItem(ENCRYPTED_KEY, encrypted);
      } catch (e) {
        console.warn('[useBinance] Key encryption failed:', e.message);
      }

      // Save config (environment + mode only, NOT keys)
      configRef.current = { ...configRef.current, environment: env };
      saveConfig(configRef.current);

      // Start WebSocket price streaming
      unsubPricesRef.current = client.subscribePrices(coins, (ticker) => {
        setPrices(prev => ({
          ...prev,
          [ticker.coin]: {
            price: ticker.price,
            priceChange: ticker.priceChange,
            high24h: ticker.high24h,
            low24h: ticker.low24h,
            volume24h: ticker.volume24h,
            quoteVolume24h: ticker.quoteVolume24h,
            timestamp: ticker.timestamp,
          },
        }));
      });

      // Fetch initial balances
      try {
        const bals = await client.getBalances();
        setBalances(bals);
      } catch (e) {
        console.warn('[useBinance] Initial balance fetch failed:', e.message);
        setBalances([]);
      }

      setConnected(true);
      setConnecting(false);
      setExecutorStatus(executor.getStatus());
      setWsStatus(client.getStatus());
      _startStatusPolling();

      return { ok: true, environment: env };

    } catch (err) {
      setConnecting(false);
      setError(err.message);
      setConnected(false);
      return { ok: false, error: err.message };
    }
  }, [coins, _startStatusPolling]);

  /**
   * Disconnect from Binance.
   */
  const disconnect = useCallback(() => {
    if (unsubPricesRef.current) { unsubPricesRef.current(); unsubPricesRef.current = null; }
    if (clientRef.current) { clientRef.current.destroy(); clientRef.current = null; }
    if (executorRef.current) { executorRef.current.destroy(); executorRef.current = null; }
    setConnected(false);
    setConnecting(false);
    setPrices({});
    setBalances([]);
    setExecutorStatus(null);
    setWsStatus(null);
    _stopStatusPolling();
  }, [_stopStatusPolling]);

  /**
   * Switch executor mode between 'dry-run' and 'live'.
   */
  const switchMode = useCallback((mode) => {
    if (executorRef.current) {
      executorRef.current.mode = mode;
      setExecutorStatus(executorRef.current.getStatus());
    }
    configRef.current = { ...configRef.current, mode };
    saveConfig(configRef.current);
  }, []);

  /**
   * Update risk limits on the executor.
   */
  const updateRisk = useCallback((overrides) => {
    if (executorRef.current) {
      executorRef.current.updateRisk(overrides);
      setExecutorStatus(executorRef.current.getStatus());
    }
    configRef.current = { ...configRef.current, riskOverrides: { ...configRef.current.riskOverrides, ...overrides } };
    saveConfig(configRef.current);
  }, []);

  /**
   * Toggle kill switch.
   */
  const killSwitch = useCallback((on = true) => {
    if (executorRef.current) {
      executorRef.current.killSwitch(on);
      setExecutorStatus(executorRef.current.getStatus());
    }
  }, []);

  /**
   * Refresh account balances from Binance.
   */
  const refreshBalances = useCallback(async () => {
    if (!clientRef.current) return [];
    try {
      const bals = await clientRef.current.getBalances();
      setBalances(bals);
      return bals;
    } catch (err) {
      console.warn('[useBinance] Balance refresh failed:', err.message);
      return [];
    }
  }, []);

  /**
   * Get the trade log from the executor.
   */
  const getTradeLog = useCallback((limit = 50) => {
    return executorRef.current?.getTradeLog(limit) || [];
  }, []);

  /**
   * Execute a strategy decision through the executor.
   */
  const executeDecision = useCallback(async (decision) => {
    if (!executorRef.current) return { executed: false, reason: 'Not connected' };
    return executorRef.current.execute(decision);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubPricesRef.current) unsubPricesRef.current();
      if (clientRef.current) clientRef.current.destroy();
      if (executorRef.current) executorRef.current.destroy();
      _stopStatusPolling();
    };
  }, [_stopStatusPolling]);

  return {
    connected,
    connecting,
    prices,
    balances,
    error,
    executorStatus,
    wsStatus,
    config: configRef.current,
    client: clientRef.current,
    executor: executorRef.current,
    connect,
    disconnect,
    switchMode,
    updateRisk,
    killSwitch,
    refreshBalances,
    getTradeLog,
    executeDecision,
  };
}
