import { useState, useEffect } from 'react';
import { useLivePrices } from '../data/liveData';
import { Bell, TrendingUp, AlertTriangle, Plus, Trash2, Check, Zap, Shield, Smartphone } from 'lucide-react';
import InfoTip from '../components/InfoTip';
import { Card, CardBody, Btn, Badge, PageHeader, Divider, Toggle, Input, EmptyState, SectionHeader, LinkCard, StatusPill } from '../components/ui';
import { useAppStore } from '../context/AppStore';
import { isPushSupported, enablePushNotifications, isSubscribed as checkPushSubscribed } from '../services/pushNotifications';

const ASSETS = ['BTC', 'ETH', 'SOL', 'PAX', 'BNB', 'XRP', 'ADA', 'DOGE'];
const BOT_EVENTS = ['stopped', 'error', 'profit target hit', 'stop-loss hit'];
const PORTFOLIO_EVENTS = ['loss > 5%', 'loss > 10%', 'gain > 10%', 'gain > 25%'];

export default function Alerts({ onNavigate }) {
  const { alerts, addAlert: storeAddAlert, updateAlert: storeUpdateAlert, removeAlert: storeRemoveAlert } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushDismissed, setPushDismissed] = useState(false);

  // Check push subscription status on mount
  useEffect(() => {
    if (isPushSupported()) {
      checkPushSubscribed().then(setPushActive).catch(() => {});
    }
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      await enablePushNotifications();
      setPushActive(true);
    } catch (err) {
      console.warn('[push] Enable failed:', err.message);
    } finally {
      setPushLoading(false);
    }
  };

  // ── Live price evaluation for price alerts ──
  const activePriceAlerts = alerts.filter(a => a.type === 'price' && a.active && !a.triggered);
  const priceSymbols = [...new Set(activePriceAlerts.map(a => a.asset.toLowerCase()))];
  const { prices } = useLivePrices(priceSymbols.length > 0 ? priceSymbols : ['pax'], 15000);

  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return;
    for (const alert of activePriceAlerts) {
      const sym = alert.asset.toLowerCase();
      const current = prices[sym];
      if (!current?.price) continue;
      let hit = false;
      if (alert.condition === 'above' && current.price >= alert.value) hit = true;
      if (alert.condition === 'below' && current.price <= alert.value) hit = true;
      if (alert.condition === 'change_up' && current.change24h >= alert.value) hit = true;
      if (alert.condition === 'change_down' && current.change24h <= -alert.value) hit = true;
      if (hit) {
        storeUpdateAlert(alert.id, { triggered: true, triggeredPrice: current.price, triggeredAt: Date.now() });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);
  const [formType, setFormType] = useState('price');
  const [formAsset, setFormAsset] = useState('BTC');
  const [formCondition, setFormCondition] = useState('above');
  const [formValue, setFormValue] = useState('');

  const addAlert = () => {
    if (formType === 'price' && !formValue) return;
    const newAlert = {
      id: Date.now(),
      type: formType,
      asset: formType === 'price' ? formAsset : formType === 'bot' ? 'Grid Bot #1' : 'Portfolio',
      condition: formCondition,
      value: formType === 'price' ? Number(formValue) : null,
      active: true,
      triggered: false,
      createdAt: 'Just now',
    };
    storeAddAlert(newAlert);
    setShowForm(false);
    setFormValue('');
  };

  const removeAlert = (id) => storeRemoveAlert(id);
  const toggleAlert = (id) => { const alert = alerts.find(a => a.id === id); if (alert) storeUpdateAlert(id, { active: !alert.active }); };
  const dismissTriggered = (id) => storeUpdateAlert(id, { triggered: false });

  const triggeredCount = alerts.filter(a => a.triggered).length;

  const typeIcon = (type) => {
    if (type === 'price') return <TrendingUp className="w-4 h-4" />;
    if (type === 'bot') return <Zap className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  const typeColor = (type) => {
    if (type === 'price') return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (type === 'bot') return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
  };

  const typeBadgeVariant = (type) => {
    if (type === 'price') return 'info';
    if (type === 'bot') return 'purple';
    return 'warning';
  };

  const selectClass = "w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        icon={Bell}
        title="Price & Event Alerts"
        subtitle="Get notified when prices move or bots trigger events"
      >
        <div className="flex items-center gap-2">
          <InfoTip text="Set up notifications for price targets, bot events, or portfolio thresholds. Get alerted before big moves happen." />
          <Btn onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> New Alert
          </Btn>
        </div>
      </PageHeader>

      {/* Push Notification CTA */}
      {isPushSupported() && !pushActive && !pushDismissed && (
        <Card accent className="border-[var(--color-accent)]/30">
          <CardBody className="flex items-center gap-3 py-4">
            <Smartphone className="w-5 h-5 text-[var(--color-accent)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[var(--color-text-primary)] font-medium text-sm">Enable push notifications</span>
              <p className="text-[var(--color-text-muted)] text-xs mt-0.5">Get alerted on your phone even when the app is closed</p>
            </div>
            <Btn size="sm" onClick={handleEnablePush} disabled={pushLoading}>
              {pushLoading ? 'Enabling…' : 'Enable'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => setPushDismissed(true)} title="Dismiss">
              ✕
            </Btn>
          </CardBody>
        </Card>
      )}

      {/* Triggered Banner */}
      {triggeredCount > 0 && (
        <Card accent className="border-[var(--color-warning)]/30">
          <CardBody className="flex items-center gap-3 py-4">
            <Bell className="w-5 h-5 text-[var(--color-warning)] animate-bounce" />
            <span className="text-[var(--color-warning)] font-medium text-sm">
              {triggeredCount} alert{triggeredCount > 1 ? 's' : ''} triggered — review below
            </span>
          </CardBody>
        </Card>
      )}

      {/* New Alert Form */}
      {showForm && (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="text-[var(--color-text-primary)] font-bold text-lg">Create Alert</h3>

            {/* Type Selector */}
            <div className="flex gap-2">
              {[['price', 'Price Alert'], ['bot', 'Bot Event'], ['portfolio', 'Portfolio Alert']].map(([val, label]) => (
                <Btn
                  key={val}
                  variant={formType === val ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => { setFormType(val); setFormCondition(val === 'price' ? 'above' : val === 'bot' ? 'stopped' : 'loss > 5%'); }}
                >
                  {label}
                </Btn>
              ))}
            </div>

            {/* Price Alert Fields */}
            {formType === 'price' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs font-medium block mb-1.5">Asset</label>
                  <select value={formAsset} onChange={e => setFormAsset(e.target.value)} className={selectClass}>
                    {ASSETS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[var(--color-text-secondary)] text-xs font-medium block mb-1.5">Condition</label>
                  <select value={formCondition} onChange={e => setFormCondition(e.target.value)} className={selectClass}>
                    <option value="above">Goes above</option>
                    <option value="below">Goes below</option>
                    <option value="change_up">% Change up</option>
                    <option value="change_down">% Change down</option>
                  </select>
                </div>
                <Input
                  label="Value ($)"
                  type="number"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder="70000"
                />
              </div>
            )}

            {/* Bot Event Fields */}
            {formType === 'bot' && (
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs font-medium block mb-1.5">Notify when bot</label>
                <select value={formCondition} onChange={e => setFormCondition(e.target.value)} className={selectClass}>
                  {BOT_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            )}

            {/* Portfolio Alert Fields */}
            {formType === 'portfolio' && (
              <div>
                <label className="text-[var(--color-text-secondary)] text-xs font-medium block mb-1.5">Notify when</label>
                <select value={formCondition} onChange={e => setFormCondition(e.target.value)} className={selectClass}>
                  {PORTFOLIO_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            )}

            <Btn onClick={addAlert}>
              Create Alert
            </Btn>
          </CardBody>
        </Card>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.map(alert => (
          <Card key={alert.id} accent={alert.triggered} className={alert.triggered ? 'border-[var(--color-warning)]/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : ''}>
            <CardBody className="flex items-center gap-4 py-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${typeColor(alert.type)}`}>
                {typeIcon(alert.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-primary)] font-medium text-sm">{alert.asset}</span>
                  <Badge variant={typeBadgeVariant(alert.type)}>{alert.type}</Badge>
                  {alert.triggered && <StatusPill status="triggered" />}
                </div>
                <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                  {alert.type === 'price' && `${alert.condition} $${alert.value?.toLocaleString()}`}
                  {alert.type === 'bot' && `Alert when ${alert.condition}`}
                  {alert.type === 'portfolio' && `Alert on ${alert.condition}`}
                  {' · '}{alert.createdAt}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {alert.triggered && (
                  <Btn variant="ghost" size="sm" onClick={() => dismissTriggered(alert.id)} title="Dismiss">
                    <Check className="w-4 h-4" />
                  </Btn>
                )}
                <Toggle
                  checked={alert.active}
                  onChange={() => toggleAlert(alert.id)}
                />
                <Btn variant="danger" size="sm" onClick={() => removeAlert(alert.id)}>
                  <Trash2 className="w-4 h-4" />
                </Btn>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {alerts.length === 0 && (
        <EmptyState
          icon={Bell}
          title="No alerts set"
          desc="Create one above to get started."
        />
      )}

      <Divider />
      <SectionHeader icon={Shield} title="Related" />
      <div className="grid grid-cols-1 gap-4">
        <LinkCard icon={Shield} title="Risk Manager" desc="Monitor portfolio exposure, drawdown, and position sizing" color="var(--color-warning)" onClick={() => onNavigate('/risk')} />
      </div>
    </div>
  );
}
