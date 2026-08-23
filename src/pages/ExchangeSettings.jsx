import { useState, useEffect } from 'react';
import { useBinance } from '../hooks/useBinance.js';
import { SYMBOL_MAP } from '../services/binanceClient.js';

const RISK_FIELDS = [
  { key: 'maxPositionUsd', label: 'Max Position Size ($)', type: 'number', min: 1, max: 10000, hint: 'Maximum USD value per single trade' },
  { key: 'dailyLossLimitUsd', label: 'Daily Loss Limit ($)', type: 'number', min: 1, max: 100000, hint: 'Auto-kill-switch when daily losses hit this amount' },
  { key: 'maxBotBalanceUsd', label: 'Max Bot Balance ($)', type: 'number', min: 1, max: 100000, hint: 'Maximum virtual balance per bot' },
  { key: 'cooldownMs', label: 'Trade Cooldown (ms)', type: 'number', min: 1000, max: 300000, hint: 'Minimum time between trades per bot' },
  { key: 'maxOpenPositions', label: 'Max Open Positions', type: 'number', min: 1, max: 50, hint: 'Maximum concurrent buy positions across all bots' },
];

function Field({ label, hint, error, children }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function StatusDot({ active, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-400' : 'bg-gray-600'}`} />
      {label}
    </span>
  );
}

export default function ExchangeSettings({ useBinanceHook }) {
  const defaultBinanceHook = useBinance();
  const {
    connected, connecting, prices, balances, error, executorStatus, wsStatus,
    config, connect, disconnect, switchMode, updateRisk, killSwitch, refreshBalances,
  } = useBinanceHook || defaultBinanceHook;

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [environment, setEnvironment] = useState(config?.environment || 'testnet');
  const [showSecret, setShowSecret] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [riskValues, setRiskValues] = useState(executorStatus ? {} : {});

  // Sync risk values from executor
  useEffect(() => {
    if (executorStatus) {
      setRiskValues(prev => ({ ...prev }));
    }
  }, [executorStatus]);

  const handleConnect = async () => {
    setConnectError(null);
    if (!apiKey.trim() || !apiSecret.trim()) {
      setConnectError('Both API key and secret are required');
      return;
    }
    const result = await connect(apiKey.trim(), apiSecret.trim(), environment);
    if (!result.ok) {
      setConnectError(result.error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setApiKey('');
    setApiSecret('');
  };

  const handleModeSwitch = (mode) => {
    if (mode === 'live' && config?.environment === 'testnet') {
      if (!confirm('You are in TESTNET mode. Switch to LIVE will use real money. Are you sure?')) return;
    }
    if (mode === 'live') {
      if (!confirm('LIVE MODE: Real orders will be placed on Binance with real money. Proceed?')) return;
    }
    switchMode(mode);
  };

  const handleRiskUpdate = (key, value) => {
    setRiskValues(prev => ({ ...prev, [key]: value }));
    updateRisk({ [key]: Number(value) });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Exchange Connection</h1>
        <p className="text-gray-400 text-sm">Connect your Binance account to trade with real market data and orders.</p>
      </div>

      {/* Connection Status */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Status</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <StatusDot active={connected} label={connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'} />
          <StatusDot active={wsStatus?.wsConnected} label={`WebSocket ${wsStatus?.wsConnected ? 'Live' : 'Off'}`} />
          <StatusDot active={executorStatus?.mode === 'live'} label={executorStatus?.mode === 'dry-run' ? 'Dry Run' : 'Live Trading'} />
        </div>
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300 mb-3">{error}</div>
        )}
        {executorStatus?.killSwitch && (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-300 mb-3">
            Kill switch is active — all trading is halted.
          </div>
        )}
        {connected && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 text-xs">Daily P&L</div>
              <div className={`font-mono font-bold ${executorStatus?.dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${executorStatus?.dailyPnl?.toFixed(2) ?? '0.00'}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 text-xs">Open Positions</div>
              <div className="font-mono font-bold text-white">{executorStatus?.openPositions ?? 0}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 text-xs">Total Trades</div>
              <div className="font-mono font-bold text-white">{executorStatus?.tradeCount ?? 0}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-500 text-xs">Environment</div>
              <div className="font-mono font-bold text-blue-400">{config?.environment ?? 'testnet'}</div>
            </div>
          </div>
        )}
      </div>

      {/* API Key Form */}
      {!connected ? (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Connect to Binance</h2>

          <Field label="Environment">
            <div className="flex gap-2">
              {['testnet', 'production'].map(env => (
                <button key={env}
                  onClick={() => setEnvironment(env)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition border ${
                    environment === env
                      ? env === 'testnet' ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-orange-600/20 border-orange-500 text-orange-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  {env === 'testnet' ? 'Testnet (Fake Money)' : 'Production (Real Money)'}
                </button>
              ))}
            </div>
            {environment === 'production' && (
              <p className="text-xs text-orange-400 mt-2">Production mode uses real funds. Start small ($50-100) and use dry-run mode first.</p>
            )}
          </Field>

          <Field label="API Key" error={connectError && !apiKey ? 'Required' : null}>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="Your Binance API key"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" />
          </Field>

          <Field label="API Secret" error={connectError && !apiSecret ? 'Required' : null}>
            <div className="relative">
              <input type={showSecret ? 'text' : 'password'} value={apiSecret} onChange={e => setApiSecret(e.target.value)}
                placeholder="Your Binance API secret"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" />
              <button onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 px-2 py-1">
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>

          {connectError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-300 mb-4">{connectError}</div>
          )}

          <button onClick={handleConnect} disabled={connecting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition">
            {connecting ? 'Connecting...' : 'Connect'}
          </button>

          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p><strong>How to get API keys:</strong></p>
            <p>1. Go to {environment === 'testnet' ? 'testnet.binance.vision' : 'binance.com'} → API Management</p>
            <p>2. Create a new API key with <strong>Enable Spot Trading</strong> checked</p>
            <p>3. For testnet, keys are generated instantly with no IP restrictions</p>
            <p>4. Copy both the API Key and Secret Key here</p>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Connected to {config?.environment === 'testnet' ? 'Binance Testnet' : 'Binance Production'}</h2>
            <button onClick={handleDisconnect}
              className="px-4 py-1.5 bg-red-600/20 border border-red-600 text-red-400 text-sm rounded-lg hover:bg-red-600/30 transition">
              Disconnect
            </button>
          </div>

          {/* Balances */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">Account Balances</h3>
              <button onClick={refreshBalances} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
            </div>
            {balances.length === 0 ? (
              <p className="text-sm text-gray-500">No balances found. {config?.environment === 'testnet' ? 'Visit testnet.binance.vision to get test funds.' : ''}</p>
            ) : (
              <div className="bg-gray-800/50 rounded-lg divide-y divide-gray-700/50">
                {balances.map(b => (
                  <div key={b.asset} className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-gray-300 font-medium">{b.asset}</span>
                    <span className="font-mono text-white">{b.free.toFixed(b.asset === 'USDT' ? 2 : 6)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Trading Mode</h3>
            <div className="flex gap-2">
              {['dry-run', 'live'].map(mode => (
                <button key={mode}
                  onClick={() => handleModeSwitch(mode)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition border ${
                    (executorStatus?.mode || 'dry-run') === mode
                      ? mode === 'dry-run' ? 'bg-green-600/20 border-green-500 text-green-300' : 'bg-orange-600/20 border-orange-500 text-orange-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  {mode === 'dry-run' ? 'Dry Run (Simulated)' : 'Live Trading'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {executorStatus?.mode === 'dry-run'
                ? 'Orders are simulated against real prices. No real trades are placed.'
                : 'Real orders are placed on Binance. Monitor your positions carefully.'}
            </p>
          </div>

          {/* Kill Switch */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Kill Switch</h3>
              <button onClick={() => killSwitch(!executorStatus?.killSwitch)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition border ${
                  executorStatus?.killSwitch
                    ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300 hover:bg-yellow-600/30'
                    : 'bg-red-600/20 border-red-600 text-red-400 hover:bg-red-600/30'
                }`}>
                {executorStatus?.killSwitch ? 'Resume Trading' : 'Emergency Stop'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Immediately halts all bot trading. Hit this if something looks wrong.</p>
          </div>
        </div>
      )}

      {/* Risk Controls */}
      {connected && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Risk Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {RISK_FIELDS.map(f => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <input type={f.type} min={f.min} max={f.max}
                  value={riskValues[f.key] ?? ''}
                  placeholder={String(f.min)}
                  onChange={e => handleRiskUpdate(f.key, e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" />
              </Field>
            ))}
          </div>
        </div>
      )}

      {/* Live Price Feed */}
      {connected && Object.keys(prices).length > 0 && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Live Prices</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(prices).map(([coin, data]) => (
              <div key={coin} className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-white">{coin}/USDT</span>
                  <span className={`text-xs font-mono ${data.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.priceChange >= 0 ? '+' : ''}{data.priceChange?.toFixed(2)}%
                  </span>
                </div>
                <div className="text-lg font-mono font-bold text-white">${data.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-gray-500 mt-1">
                  H: ${data.high24h?.toLocaleString(undefined, { maximumFractionDigits: 2 })} &middot;
                  L: ${data.low24h?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
