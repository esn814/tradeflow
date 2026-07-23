import { useCallback } from 'react';

export const ALERTS_DEFAULTS = [
  { id: 1, type: 'price', asset: 'BTC', condition: 'above', value: 70000, active: true, triggered: false, createdAt: '2 hours ago' },
  { id: 2, type: 'price', asset: 'ETH', condition: 'below', value: 3200, active: true, triggered: false, createdAt: '5 hours ago' },
  { id: 3, type: 'price', asset: 'SOL', condition: 'above', value: 180, active: true, triggered: true, createdAt: '1 day ago' },
  { id: 4, type: 'bot', asset: 'Grid Bot #1', condition: 'stopped', value: null, active: true, triggered: true, createdAt: '3 hours ago' },
  { id: 5, type: 'portfolio', asset: 'Portfolio', condition: 'loss > 5%', value: -5, active: true, triggered: false, createdAt: '1 day ago' },
];

export function useAlertsActions(store, setStore) {
  const addAlert = useCallback((alert) => {
    setStore(prev => ({
      ...prev,
      alerts: [{ ...alert, id: Date.now(), createdAt: 'Just now' }, ...prev.alerts],
    }));
  }, [setStore]);

  const updateAlert = useCallback((id, patch) => {
    setStore(prev => ({
      ...prev,
      alerts: prev.alerts.map(a => a.id === id ? { ...a, ...patch } : a),
    }));
  }, [setStore]);

  const removeAlert = useCallback((id) => {
    setStore(prev => ({
      ...prev,
      alerts: prev.alerts.filter(a => a.id !== id),
    }));
  }, [setStore]);

  return { addAlert, updateAlert, removeAlert };
}
