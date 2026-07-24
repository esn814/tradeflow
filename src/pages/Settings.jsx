import { useState, useEffect } from 'react';
import { useMode, useAppStore } from '../context/AppStore';
import { Bell, Shield, Key, Globe, Save, AlertTriangle, CheckCircle, Wallet, Send, MessageSquare } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge, PageHeader, Divider, Toggle, Input, LinkCard, ConfirmDialog } from '../components/ui';
import { isPushSupported, enablePushNotifications, disablePushNotifications, isSubscribed } from '../services/pushNotifications';

const EXCHANGES = [
  { id: 'binance', name: 'Binance', connected: true },
  { id: 'coinbase', name: 'Coinbase Pro', connected: false },
  { id: 'kraken', name: 'Kraken', connected: false },
  { id: 'bybit', name: 'Bybit', connected: true },
];

const TG_STORAGE_KEY = 'tradeflow-telegram';

function loadTelegram() {
  try {
    const raw = localStorage.getItem(TG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn(e); }
  return { botToken: '', chatId: '', tradeAlerts: true, dailyPnl: true, botStatus: true, riskWarnings: false, connected: false };
}

export default function Settings({ onNavigate }) {
  const { settings, updateSettings } = useAppStore();
  const [saved, setSaved] = useState(false);
  const [showKey, _setShowKey] = useState(false);
  const [tg, setTg] = useState(loadTelegram);
  const [tgStatus, setTgStatus] = useState(null); // 'success' | 'error' | null
  const [tgStatusMsg, setTgStatusMsg] = useState('');
  const [config, setConfig] = useState({
    maxPositionSize: 10,
    maxDrawdown: 15,
    dailyLossLimit: 5,
    maxOpenPositions: 6,
    defaultSlippage: 0.5,
    notifications: settings.notifications ?? true,
    emailAlerts: false,
    darkMode: settings.darkMode ?? true,
    autoCompound: true,
    paperTrading: false,
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const confirm = (message, onOk) => setConfirmState({ message, onOk });
  const handleConfirm = () => { confirmState?.onOk(); setConfirmState(null); };
  const handleCancel = () => setConfirmState(null);

  useEffect(() => {
    isSubscribed().then(setPushEnabled).catch(() => {});
  }, []);

  const handlePushToggle = async (val) => {
    setPushLoading(true);
    setPushError(null);
    try {
      if (val) {
        await enablePushNotifications();
        setPushEnabled(true);
      } else {
        await disablePushNotifications();
        setPushEnabled(false);
      }
    } catch (err) {
      setPushError(err.message);
      setTimeout(() => setPushError(null), 5000);
    } finally {
      setPushLoading(false);
    }
  };

  const { demoMode, setDemoMode, virtualBalance, setVirtualBalance, resetDemo } = useMode();

  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));
  const updateTg = (key, val) => setTg(prev => ({ ...prev, [key]: val }));

  const handleTgSave = () => {
    localStorage.setItem(TG_STORAGE_KEY, JSON.stringify({ ...tg, connected: true }));
    setTgStatus('success');
    setTgStatusMsg('Telegram settings saved!');
    setTimeout(() => { setTgStatus(null); setTgStatusMsg(''); }, 3000);
  };

  const handleTgTest = async () => {
    if (!tg.botToken || !tg.chatId) {
      setTgStatus('error');
      setTgStatusMsg('Enter both Bot Token and Chat ID first.');
      setTimeout(() => { setTgStatus(null); setTgStatusMsg(''); }, 3000);
      return;
    }
    setTgStatus(null);
    setTgStatusMsg('Sending...');
    try {
      const res = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tg.chatId,
          text: '🔔 TradeFlow Test Message\n\nYour Telegram alerts are connected! You\'ll receive trade notifications here.',
          parse_mode: 'Markdown',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTgStatus('success');
        setTgStatusMsg('Test message sent! Check Telegram.');
      } else {
        setTgStatus('error');
        setTgStatusMsg(`Error: ${data.description || 'Unknown error'}`);
      }
    } catch (err) {
      setTgStatus('error');
      setTgStatusMsg(`Network error: ${err.message}`);
    }
    setTimeout(() => { setTgStatus(null); setTgStatusMsg(''); }, 5000);
  };

  const handleSave = () => {
    updateSettings({
      notifications: config.notifications,
      darkMode: config.darkMode,
      demoMode,
      virtualBalance,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader icon={Shield} title="Settings" subtitle="Configure trading parameters, API keys, and risk limits">
        <Btn variant={saved ? 'success' : 'primary'} onClick={handleSave}>
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </Btn>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Risk Limits */}
        <Card>
          <CardBody>
            <SectionHeader icon={Shield} title="Risk Limits" />
            <div className="space-y-4">
              {[
                { key: 'maxPositionSize', label: 'Max Position Size (% of portfolio)', min: 1, max: 50, step: 1 },
                { key: 'maxDrawdown', label: 'Max Drawdown Before Halt (%)', min: 5, max: 50, step: 1 },
                { key: 'dailyLossLimit', label: 'Daily Loss Limit (%)', min: 1, max: 20, step: 0.5 },
                { key: 'maxOpenPositions', label: 'Max Open Positions', min: 1, max: 20, step: 1 },
                { key: 'defaultSlippage', label: 'Default Slippage Tolerance (%)', min: 0.1, max: 5, step: 0.1 },
              ].map(p => (
                <div key={p.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--color-text-secondary)]">{p.label}</span>
                    <span className="text-[var(--color-text-primary)] font-mono">{config[p.key]}{p.key === 'maxOpenPositions' ? '' : '%'}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step}
                    value={config[p.key]}
                    onChange={e => update(p.key, +e.target.value)}
                    className="w-full h-1.5 bg-[var(--color-surface-3)] rounded-full appearance-none cursor-pointer accent-[var(--color-accent)]"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    <span>{p.min}{p.key === 'maxOpenPositions' ? '' : '%'}</span>
                    <span>{p.max}{p.key === 'maxOpenPositions' ? '' : '%'}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* API Keys */}
        <Card>
          <CardBody>
            <SectionHeader icon={Key} title="API Connections" />
            <div className="space-y-3 mb-6">
              {EXCHANGES.map(ex => (
                <div key={ex.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-2)] rounded-lg">
                <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${ex.connected ? 'bg-[var(--color-profit)]' : 'bg-gray-600'}`} />
                <span className="text-sm text-[var(--color-text-primary)]">{ex.name}</span>
                </div>
                <Btn variant={ex.connected ? 'danger' : 'success'} size="sm" onClick={() => {
                if (ex.connected) {
                confirm(`Disconnect from ${ex.name}?`, () => {
                setSaved(true); setTimeout(() => setSaved(false), 2000);
                });
                } else {
                  setSaved(true); setTimeout(() => setSaved(false), 2000);
                }
              }}>
                {ex.connected ? 'Disconnect' : 'Connect'}
              </Btn>
            </div>
              ))}
            </div>
            <Divider />
            <div className="mt-4">
              <Input
                label="API Key"
                type={showKey ? 'text' : 'password'}
                placeholder="Enter your API key"
                hint="API keys are encrypted at rest. Use read-only keys where possible. Never share keys with third parties."
              />
            </div>
          </CardBody>
        </Card>

        {/* Notifications */}
        <Card>
          <CardBody>
            <SectionHeader icon={Bell} title="Notifications" />
            <div className="space-y-3">
              <Toggle
                label="Push Notifications"
                desc={isPushSupported()
                  ? (pushEnabled ? 'Active — you will receive real-time alerts' : 'Enable to receive real-time trade alerts and risk warnings')
                  : 'Not supported in this browser'}
                checked={pushEnabled}
                onChange={handlePushToggle}
                disabled={!isPushSupported() || pushLoading}
              />
              {pushError && (
                <div className="flex items-center gap-2 p-2 rounded-lg text-xs bg-[var(--color-loss-15)] text-[var(--color-loss)]">
                  <AlertTriangle size={13} />
                  {pushError}
                </div>
              )}
              <Toggle
                label="Email Alerts"
                desc="Daily portfolio summary and trade confirmations"
                checked={config.emailAlerts}
                onChange={(val) => update('emailAlerts', val)}
              />
              <Toggle
                label="Auto-Compound Profits"
                desc="Automatically reinvest gains into active strategies"
                checked={config.autoCompound}
                onChange={(val) => update('autoCompound', val)}
              />
            </div>
          </CardBody>
        </Card>

        {/* Trading Mode */}
        <Card>
          <CardBody>
            <SectionHeader icon={Globe} title="Trading Mode" />
            <div className="space-y-4">
              <Toggle
                label="Paper Trading"
                desc="Test strategies with simulated funds before going live"
                checked={config.paperTrading}
                onChange={(val) => update('paperTrading', val)}
                color="var(--color-warning)"
              />
              {config.paperTrading && (
                <div className="flex items-start gap-2 p-3 bg-[var(--color-warning-10)] border border-[var(--color-warning-30)] rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-[var(--color-warning)]">Paper trading is active. All orders use simulated execution — no real funds are at risk.</p>
                </div>
              )}

              <Toggle
                label="Demo Mode"
                desc="Practice with virtual funds — no real money at risk"
                checked={demoMode}
                onChange={(val) => {
                  setDemoMode(val);
                  updateSettings({ demoMode: val, virtualBalance: val ? virtualBalance : undefined });
                }}
                color="var(--color-accent)"
              />
              {demoMode && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-[var(--color-accent-10)] border border-[var(--color-accent-30)] rounded-lg">
                    <CheckCircle className="w-4 h-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-[var(--color-accent)]">Demo mode active. You're trading with virtual funds — no real money is at risk.</p>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Virtual Starting Balance</label>
                    <div className="flex gap-2">
                      {[1000, 5000, 10000, 50000, 100000].map(v => (
                        <button
                          key={v}
                          onClick={() => {
                            setVirtualBalance(v);
                            resetDemo(v);
                            updateSettings({ virtualBalance: v });
                          }}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                            virtualBalance === v
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                              : 'border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)]'
                          }`}
                        >
                          ${(v/1000).toFixed(0)}K
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-[var(--color-surface-2)] rounded-lg">
                <span className="text-xs text-[var(--color-text-muted)] block mb-2">Environment</span>
                <div className="flex gap-2">
                  {['Testnet', 'Mainnet'].map(env => (
                    <Btn key={env}
                      variant={(env === 'Mainnet' && !config.paperTrading) || (env === 'Testnet' && config.paperTrading) ? 'primary' : 'ghost'}
                      size="sm"
                      className="flex-1 justify-center"
                    >
                      {env}
                    </Btn>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Divider />

      {/* Telegram Bot Integration */}
      <Card>
        <CardBody>
          <SectionHeader icon={Send} title="Telegram Alerts" action={<Badge variant="info">Beta</Badge>} />
          <p className="text-xs text-[var(--color-text-muted)] mb-4">Get real-time trade alerts, daily P&L summaries, and bot status notifications directly in Telegram. Quick-action buttons let you pause/resume bots without opening the app.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Bot Token</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  value={tg.botToken}
                  onChange={e => updateTg('botToken', e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Create a bot via <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-[var(--color-accent)] hover:underline">@BotFather</a> on Telegram and paste the token here.</p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Chat ID</label>
              <input
                type="text"
                placeholder="e.g. 123456789 or @yourchannel"
                value={tg.chatId}
                onChange={e => updateTg('chatId', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Send a message to <a href="https://t.me/userinfobot" target="_blank" rel="noopener" className="text-[var(--color-accent)] hover:underline">@userinfobot</a> to find your Chat ID.</p>
            </div>
            <Divider />
            <div className="space-y-3">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">Notification Types</span>
              <Toggle
                label="Trade Execution Alerts"
                desc="Get notified when a bot buys or sells"
                checked={tg.tradeAlerts}
                onChange={val => updateTg('tradeAlerts', val)}
              />
              <Toggle
                label="Daily P&L Summary"
                desc="End-of-day portfolio performance digest"
                checked={tg.dailyPnl}
                onChange={val => updateTg('dailyPnl', val)}
              />
              <Toggle
                label="Bot Status Changes"
                desc="Alerts when bots start, pause, stop, or error"
                checked={tg.botStatus}
                onChange={val => updateTg('botStatus', val)}
              />
              <Toggle
                label="Risk Warnings"
                desc="Drawdown alerts and position limit notifications"
                checked={tg.riskWarnings}
                onChange={val => updateTg('riskWarnings', val)}
              />
            </div>
            {tgStatusMsg && (
              <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${tgStatus === 'success' ? 'bg-[var(--color-success-15)] text-[var(--color-success)]' : tgStatus === 'error' ? 'bg-[var(--color-loss-15)] text-[var(--color-loss)]' : 'bg-[var(--color-warning-15)] text-[var(--color-warning)]'}`}>
                {tgStatus === 'success' ? <CheckCircle size={13} /> : tgStatus === 'error' ? <AlertTriangle size={13} /> : null}
                {tgStatusMsg}
              </div>
            )}
            <div className="flex gap-2">
              <Btn variant="primary" size="sm" onClick={handleTgSave}>
                <Send size={13} /> Save & Connect
              </Btn>
              <Btn variant="ghost" size="sm" onClick={handleTgTest}>
                <MessageSquare size={13} /> Send Test Message
              </Btn>
            </div>
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* Danger Zone */}
      <Card className="border-[var(--color-loss-30)]">
        <CardBody>
          <SectionHeader icon={AlertTriangle} title="Danger Zone" />
          <div className="flex flex-wrap gap-3">
            <Btn variant="danger" size="sm" onClick={() => confirm('Close all open positions? This cannot be undone.', () => { updateSettings({ bots: [] }); setSaved(true); setTimeout(() => setSaved(false), 2000); })}>Close All Positions</Btn>
            <Btn variant="danger" size="sm" onClick={() => confirm('Reset all strategy parameters to defaults?', () => { localStorage.clear(); window.location.reload(); })}>Reset All Strategies</Btn>
            <Btn variant="danger" size="sm" onClick={() => confirm('Delete ALL account data? This cannot be undone.', () => { localStorage.clear(); window.location.reload(); })}>Delete Account Data</Btn>
          </div>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={Shield} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={Shield} title="Security" desc="2FA, API keys, session management, and anti-phishing" color="var(--color-accent)" onClick={() => onNavigate('/security')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Wallet} title="Connections" desc="Connect wallets and exchange API keys" color="var(--color-info)" onClick={() => onNavigate('/connections')} />
        </div>
      </div>
      <Divider />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={Shield} title="Privacy Policy" desc="How we collect, use, and protect your data" color="var(--color-purple)" onClick={() => onNavigate('/privacy')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Shield} title="Terms of Service" desc="Usage terms, risk disclosures, and liability" color="var(--color-warning)" onClick={() => onNavigate('/terms')} />
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmState}
        title="Confirm Action"
        message={confirmState?.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
