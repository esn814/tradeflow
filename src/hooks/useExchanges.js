import { useState, useCallback } from 'react';
import { useAppStore } from '../context/AppStore';
import { encryptExchangeKeys, sanitize } from '../utils/crypto';
import { apiFetch } from '../services/apiClient';

export function useExchanges() {
  const { settings, updateSettings } = useAppStore();

  const [exchangeKeys, setExchangeKeys] = useState(settings?.exchangeKeys || {});
  const [showAddExchange, setShowAddExchange] = useState(null);
  const [exchangeForm, setExchangeForm] = useState({});
  const [testingExchange, setTestingExchange] = useState(null);
  const [exchangeStatus, setExchangeStatus] = useState({});
  const [exchangeError, setExchangeError] = useState(null);
  const [savingExchange, setSavingExchange] = useState(null);

  const addExchangeKey = useCallback(async (exchangeId) => {
    const apiKey = sanitize(exchangeForm['API Key'] || '');
    const apiSecret = sanitize(exchangeForm['API Secret'] || '');
    if (!apiKey || !apiSecret) {
      setExchangeError('Please enter both API Key and API Secret.');
      return;
    }
    setSavingExchange(exchangeId);
    setExchangeError(null);

    // Save to backend (encrypted server-side with AES-256-GCM)
    let backendSaved = false;
    try {
      const res = await apiFetch('/live-trading/keys', {
        method: 'POST',
        body: JSON.stringify({
          exchange: exchangeId,
          apiKey,
          apiSecret,
          environment: 'testnet',
        }),
      });
      if (res.error) {
        setExchangeError(`Backend error: ${res.error}`);
      } else {
        backendSaved = true;
      }
    } catch (backendErr) {
      setExchangeError(`Backend unavailable: ${backendErr.message}. Keys saved locally only.`);
    }

    // Also save locally for the UI
    try {
      const encrypted = await encryptExchangeKeys({ [exchangeId]: { key: apiKey, secret: apiSecret } });
      const updated = {
        ...exchangeKeys,
        [exchangeId]: {
          encrypted,
          keyPreview: apiKey.slice(0, 8) + '••••••••',
          connectedAt: 'Just now',
          backendSaved,
        },
      };
      setExchangeKeys(updated);
      updateSettings({ exchangeKeys: updated });
      setExchangeForm({});
      setShowAddExchange(null);
    } catch (err) {
      setExchangeError(`Local encryption failed: ${err.message}`);
    } finally {
      setSavingExchange(null);
    }
  }, [exchangeForm, exchangeKeys, updateSettings]);

  const removeExchangeKey = useCallback((exchangeId) => {
    const next = { ...exchangeKeys };
    delete next[exchangeId];
    setExchangeKeys(next);
    updateSettings({ exchangeKeys: next });
    setExchangeError(null);
  }, [exchangeKeys, updateSettings]);

  const testConnection = useCallback(async (exchangeId) => {
    setTestingExchange(exchangeId);
    setExchangeError(null);
    try {
      const res = await apiFetch(`/live-trading/keys/test`, {
        method: 'POST',
        body: JSON.stringify({ exchange: exchangeId }),
      });
      if (res.error) {
        setExchangeStatus(prev => ({ ...prev, [exchangeId]: 'error' }));
        setExchangeError(`Connection test failed: ${res.error}`);
      } else {
        setExchangeStatus(prev => ({ ...prev, [exchangeId]: 'connected' }));
      }
    } catch (err) {
      setExchangeStatus(prev => ({ ...prev, [exchangeId]: 'error' }));
      setExchangeError(`Connection test failed: ${err.message}`);
    } finally {
      setTestingExchange(null);
    }
  }, []);

  const clearExchangeError = useCallback(() => setExchangeError(null), []);

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
    exchangeError,
    savingExchange,
    clearExchangeError,
  };
}
