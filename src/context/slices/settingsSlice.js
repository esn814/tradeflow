import { useCallback } from 'react';

export const SETTINGS_DEFAULTS = {
  simpleMode: false,
  demoTrades: [],
  settings: {
    riskTolerance: 'moderate',
    notifications: true,
    darkMode: true,
    walletAuth: null,
    demoMode: true,
    hasCompletedOnboarding: false,
    selectedPlan: 'free',
    virtualBalance: 10000,
  },
};

export function useSettingsActions(store, setStore) {
  const updateSettings = useCallback((patch) => {
    setStore(prev => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, [setStore]);

  const setSimple = useCallback((val) => {
    setStore(prev => ({ ...prev, simpleMode: val }));
  }, [setStore]);

  const setDemoMode = useCallback((val) => {
    setStore(prev => ({ ...prev, settings: { ...prev.settings, demoMode: val } }));
  }, [setStore]);

  const setVirtualBalance = useCallback((val) => {
    setStore(prev => ({ ...prev, settings: { ...prev.settings, virtualBalance: val } }));
  }, [setStore]);

  const addDemoTrade = useCallback((trade) => {
    setStore(prev => ({
      ...prev,
      demoTrades: [...prev.demoTrades, { ...trade, id: `demo-${Date.now()}`, timestamp: Date.now() }].slice(-500),
    }));
  }, [setStore]);

  const resetDemo = useCallback((balance = 10000) => {
    setStore(prev => ({
      ...prev,
      settings: { ...prev.settings, virtualBalance: balance },
      demoTrades: [],
    }));
  }, [setStore]);

  return {
    updateSettings,
    setSimple,
    setDemoMode,
    setVirtualBalance,
    addDemoTrade,
    resetDemo,
    // Derived accessors (computed from store at render time)
    simple: store.simpleMode,
    demoMode: store.settings.demoMode,
    virtualBalance: store.settings.virtualBalance,
  };
}
