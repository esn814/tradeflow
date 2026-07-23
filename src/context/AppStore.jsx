import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { BOTS_DEFAULTS, useBotsActions } from './slices/botsSlice';
import { ALERTS_DEFAULTS, useAlertsActions } from './slices/alertsSlice';
import { TRADES_DEFAULTS, useTradesActions } from './slices/tradesSlice';
import { SCHEDULES_DEFAULTS, useSchedulesActions } from './slices/schedulesSlice';
import { SETTINGS_DEFAULTS, useSettingsActions } from './slices/settingsSlice';
import { COPY_TRADING_DEFAULTS, useCopyTradingActions } from './slices/copyTradingSlice';
import { loadFromBackend, scheduleBackendPush } from '../services/storeSync';

const STORE_KEY = 'tradeflow-store';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn(e); }
  return null;
}

// Compose defaults from all slices
const DEFAULTS = {
  bots: BOTS_DEFAULTS,
  alerts: ALERTS_DEFAULTS,
  strategyStates: TRADES_DEFAULTS.strategyStates,
  tradeHistory: TRADES_DEFAULTS.tradeHistory,
  schedules: SCHEDULES_DEFAULTS,
  simpleMode: SETTINGS_DEFAULTS.simpleMode,
  demoTrades: SETTINGS_DEFAULTS.demoTrades,
  settings: SETTINGS_DEFAULTS.settings,
  followedTraders: COPY_TRADING_DEFAULTS.followedTraders,
  copyTradeHistory: COPY_TRADING_DEFAULTS.copyTradeHistory,
};

const AppStoreContext = createContext(null);

export function AppStoreProvider({ children }) {
  const [store, setStore] = useState(() => {
    const saved = loadStore();
    return saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
  });

  // Load from backend on mount (merge with localStorage defaults)
  useEffect(() => {
    let cancelled = false;
    loadFromBackend().then((backendData) => {
      if (cancelled || !backendData) return;
      setStore((prev) => {
        const merged = { ...prev };
        // Only override slices that the backend returned non-empty data for
        if (backendData.bots) merged.bots = backendData.bots;
        if (backendData.alerts) merged.alerts = backendData.alerts;
        if (backendData.schedules) merged.schedules = backendData.schedules;
        if (backendData.settings) merged.settings = { ...merged.settings, ...backendData.settings };
        if (backendData.followedTraders) merged.followedTraders = backendData.followedTraders;
        return merged;
      });
    }).catch((err) => console.warn('[AppStore] Backend load failed:', err.message));
    return () => { cancelled = true; };
  }, []);

  // Persist to localStorage with debounce to avoid jank on rapid updates
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
      } catch (e) { console.warn(e); }
    }, 300);
    // Also push changed slices to backend (debounced separately at 2s)
    scheduleBackendPush(store);
    return () => clearTimeout(debounceRef.current);
  }, [store]);

  // Compose actions from all slices
  const botsActions = useBotsActions(store, setStore);
  const alertsActions = useAlertsActions(store, setStore);
  const tradesActions = useTradesActions(store, setStore);
  const schedulesActions = useSchedulesActions(store, setStore);
  const settingsActions = useSettingsActions(store, setStore);
  const copyTradingActions = useCopyTradingActions(store, setStore);

  const value = useMemo(() => ({
    ...store,
    ...botsActions,
    ...alertsActions,
    ...tradesActions,
    ...schedulesActions,
    ...settingsActions,
    ...copyTradingActions,
  }), [store, botsActions, alertsActions, tradesActions, schedulesActions, settingsActions, copyTradingActions]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}

/**
 * Compatibility wrapper — consumers that used useMode() can switch to this
 * without changing their destructuring. All state now lives in AppStore.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useMode() {
  const store = useAppStore();
  return {
    simple: store.simple,
    setSimple: store.setSimple,
    demoMode: store.demoMode,
    setDemoMode: store.setDemoMode,
    virtualBalance: store.virtualBalance,
    setVirtualBalance: store.setVirtualBalance,
    demoTrades: store.demoTrades,
    addDemoTrade: store.addDemoTrade,
    resetDemo: store.resetDemo,
  };
}
