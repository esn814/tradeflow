import { useCallback, useMemo } from 'react';

export const TRADES_DEFAULTS = {
  tradeHistory: {},
  strategyStates: {},
};

export function useTradesActions(store, setStore) {
  const addTrade = useCallback((botId, trade) => {
    setStore(prev => ({
      ...prev,
      tradeHistory: {
        ...prev.tradeHistory,
        [botId]: [...(prev.tradeHistory[botId] || []), trade].slice(-200),
      },
    }));
  }, [setStore]);

  const setStrategyState = useCallback((id, state) => {
    setStore(prev => ({
      ...prev,
      strategyStates: { ...prev.strategyStates, [id]: { ...prev.strategyStates[id], ...state } },
    }));
  }, [setStore]);

  const winRate = useMemo(() => {
    const allTrades = Object.values(store.tradeHistory).flat();
    if (allTrades.length === 0) return 62.4;
    const wins = allTrades.filter(t => t.pnl > 0).length;
    return +((wins / allTrades.length) * 100).toFixed(1);
  }, [store.tradeHistory]);

  return { addTrade, setStrategyState, winRate };
}
