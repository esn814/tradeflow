import { useCallback, useMemo } from 'react';

export const BOTS_DEFAULTS = [
  {
    id: 'btc-dca',
    name: 'BTC Accumulator',
    type: 'DCA',
    coin: 'BTC',
    invested: 5000,
    currentValue: 5840,
    status: 'active',
    createdAt: '2025-04-01',
    strategy: 'dca',
  },
  {
    id: 'eth-grid',
    name: 'ETH Grid Master',
    type: 'Grid',
    coin: 'ETH',
    invested: 3000,
    currentValue: 3210,
    status: 'active',
    createdAt: '2025-03-15',
    strategy: 'grid',
  },
  {
    id: 'sol-trend',
    name: 'SOL Trend Rider',
    type: 'Trend',
    coin: 'SOL',
    invested: 2000,
    currentValue: 1870,
    status: 'paused',
    createdAt: '2025-04-10',
    strategy: 'trend',
  },
];

export function useBotsActions(store, setStore) {
  const addBot = useCallback((bot) => {
    setStore(prev => ({
      ...prev,
      bots: [...prev.bots, { ...bot, id: bot.id || `bot-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) }],
    }));
  }, [setStore]);

  const updateBot = useCallback((id, patch) => {
    setStore(prev => ({
      ...prev,
      bots: prev.bots.map(b => b.id === id ? { ...b, ...patch } : b),
    }));
  }, [setStore]);

  const removeBot = useCallback((id) => {
    setStore(prev => ({
      ...prev,
      bots: prev.bots.filter(b => b.id !== id),
    }));
  }, [setStore]);

  const derived = useMemo(() => {
    const active = store.bots.filter(b => b.status === 'active').length;
    const invested = store.bots.reduce((s, b) => s + b.invested, 0);
    const value = store.bots.reduce((s, b) => s + b.currentValue, 0);
    return { activeBots: active, totalInvested: invested, totalValue: value, totalPnL: value - invested };
  }, [store.bots]);

  return { addBot, updateBot, removeBot, ...derived };
}
