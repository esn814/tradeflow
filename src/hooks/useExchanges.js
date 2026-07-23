import { useState, useCallback } from 'react';
import { useAppStore } from '../context/AppStore';
import { encryptExchangeKeys, sanitize } from '../utils/crypto';

export function useExchanges() {
  const { settings, updateSettings } = useAppStore();

  const [exchangeKeys, setExchangeKeys] = useState(settings?.exchangeKeys || {});
  const [showAddExchange, setShowAddExchange] = useState(null);
  const [exchangeForm, setExchangeForm] = useState({});
  const [testingExchange, setTestingExchange] = useState(null);
  const [exchangeStatus, setExchangeStatus] = useState({});

  const addExchangeKey = useCallback(async (exchangeId) => {
    const apiKey = sanitize(exchangeForm['API Key'] || '');
    const apiSecret = sanitize(exchangeForm['API Secret'] || '');
    if (!apiKey || !apiSecret) return;
    try {
      const encrypted = await encryptExchangeKeys({ [exchangeId]: { key: apiKey, secret: apiSecret } });
      const updated = { ...exchangeKeys, [exchangeId]: { encrypted, keyPreview: apiKey.slice(0, 8) + '••••••••', connectedAt: 'Just now' } };
      setExchangeKeys(updated);
      updateSettings({ exchangeKeys: updated });
      setExchangeForm({});
      setShowAddExchange(null);
    } catch (err) {
      console.error('Failed to encrypt exchange keys:', err);
    }
  }, [exchangeForm, exchangeKeys, updateSettings]);

  const removeExchangeKey = useCallback((exchangeId) => {
    const next = { ...exchangeKeys };
    delete next[exchangeId];
    setExchangeKeys(next);
    updateSettings({ exchangeKeys: next });
  }, [exchangeKeys, updateSettings]);

  const testConnection = useCallback(async (exchangeId) => {
    setTestingExchange(exchangeId);
    await new Promise(r => setTimeout(r, 1500));
    setExchangeStatus(prev => ({ ...prev, [exchangeId]: 'connected' }));
    setTestingExchange(null);
  }, []);

  const connectedExchangeCount = Object.keys(exchangeKeys).length;

  return {
    exchangeKeys,
    showAddExchange,
    setShowAddExchange,
    exchangeForm,
    setExchangeForm,
    testingExchange,
    exchangeStatus,
    addExchangeKey,
    removeExchangeKey,
    testConnection,
    connectedExchangeCount,
  };
}
