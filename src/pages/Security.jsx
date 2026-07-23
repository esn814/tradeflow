import { useState } from 'react';
import { useAppStore } from '../context/AppStore';
import { Shield, Lock, Key, Eye, EyeOff, Smartphone, Globe, Clock, AlertTriangle, CheckCircle, Plus, Trash2, Copy, Settings, Wallet } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge, PageHeader, Divider, Toggle, LinkCard } from '../components/ui';

export default function Security({ onNavigate }) {
  const { settings, updateSettings } = useAppStore();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(settings.twoFactor ?? false);
  const [showApiKey, setShowApiKey] = useState({});
  const [whitelistEnabled, setWhitelistEnabled] = useState(settings.whitelistEnabled ?? true);
  const [sessionTimeout, setSessionTimeout] = useState(settings.sessionTimeout ?? '30min');
  const [antiPhishingCode, _setAntiPhishingCode] = useState(() => {
    const saved = settings.antiPhishingCode;
    if (saved) return saved;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    updateSettings({ antiPhishingCode: code });
    return code;
  });
  const [showPhishingCode, setShowPhishingCode] = useState(false);

  const [apiKeys] = useState(settings.apiKeys || []);
  const [whitelistAddresses] = useState(settings.whitelistAddresses || []);
  const [loginActivity] = useState(settings.loginActivity || []);

  const toggleApiKeyVisibility = (id) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader icon={Shield} title="Security Settings" subtitle="Protect your account with 2FA, API key management, login monitoring, and withdrawal whitelists." />

      {/* Two-Factor Authentication */}
      <Card>
        <CardBody>
          <SectionHeader
            icon={Smartphone}
            title="Two-Factor Authentication"
            badge={twoFactorEnabled ? 'Enabled' : 'Disabled'}
            action={
              <Toggle
                label=""
                checked={twoFactorEnabled}
                onChange={(val) => {
                  setTwoFactorEnabled(val);
                  updateSettings({ twoFactor: val });
                }}
              />
            }
          />
          <p className="text-[var(--color-text-secondary)] mb-4 text-sm">Add an extra layer of security to your account with 2FA.</p>
          <Btn variant="primary" size="sm">Setup 2FA</Btn>
        </CardBody>
      </Card>

      <Divider />

      {/* API Key Management */}
      <Card>
        <CardBody>
          <SectionHeader
            icon={Key}
            title="API Key Management"
            action={
              <Btn variant="primary" size="sm">
                <Plus className="w-4 h-4" />
                Add New Key
              </Btn>
            }
          />
          <div className="space-y-3">
            {apiKeys.length === 0 && (
              <div className="text-center py-6">
                <Key className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No API keys stored yet.</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Add exchange API keys from the Connections page.</p>
              </div>
            )}
            {apiKeys.map(key => (
              <div key={key.id} className="flex flex-wrap items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-xl gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-text-primary)] font-medium">{key.exchange}</span>
                  <span className="text-[var(--color-text-secondary)] font-mono text-xs">{key.key}</span>
                  <button onClick={() => toggleApiKeyVisibility(key.id)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    {showApiKey[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => copyToClipboard(key.key)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-text-muted)] text-xs">Last used: {key.lastUsed}</span>
                  <button className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* Login Activity */}
      <Card>
        <CardBody>
          <SectionHeader icon={Globe} title="Login Activity" />
          <div className="overflow-x-auto">
            {loginActivity.length === 0 ? (
              <div className="text-center py-6">
                <Globe className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No login activity recorded yet.</p>
              </div>
            ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="text-[var(--color-text-secondary)] text-left text-xs">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">IP Address</th>
                  <th className="pb-3 pr-4">Location</th>
                  <th className="pb-3 pr-4">Device</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loginActivity.map(login => (
                  <tr key={login.id} className="border-t border-[var(--color-border-default)]">
                    <td className="py-3 pr-4 text-[var(--color-text-primary)] text-sm">{login.date}</td>
                    <td className="py-3 pr-4 text-gray-300 font-mono text-xs">{login.ip}</td>
                    <td className="py-3 pr-4 text-gray-300 text-sm">{login.location}</td>
                    <td className="py-3 pr-4 text-gray-300 text-sm">{login.device}</td>
                    <td className="py-3">
                      <Badge variant={login.status === 'Success' ? 'success' : 'danger'}>
                        {login.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        </CardBody>
      </Card>

      <Divider />

      {/* Withdrawal Whitelist */}
      <Card>
        <CardBody>
          <SectionHeader
            icon={Lock}
            title="Withdrawal Whitelist"
            badge={whitelistEnabled ? 'Active' : 'Inactive'}
            action={
              <Toggle
                label=""
                checked={whitelistEnabled}
                onChange={setWhitelistEnabled}
              />
            }
          />
          {whitelistAddresses.length === 0 && (
            <div className="text-center py-6">
              <Lock className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">No addresses whitelisted yet.</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Add addresses from the Connections page.</p>
            </div>
          )}
          <div className="space-y-3">
            {whitelistAddresses.map(addr => (
              <div key={addr.id} className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-xl">
                <div className="flex items-center gap-4">
                  <span className="text-[var(--color-text-primary)] font-medium">{addr.label}</span>
                  <span className="text-[var(--color-text-secondary)] font-mono">{addr.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={addr.enabled ? 'success' : 'info'}>
                    {addr.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <button className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Btn variant="ghost" size="sm" className="mt-4">
            <Plus className="w-4 h-4" />
            Add Address
          </Btn>
        </CardBody>
      </Card>

      <Divider />

      {/* Session Timeout */}
      <Card>
        <CardBody>
          <SectionHeader icon={Clock} title="Session Timeout" />
          <p className="text-[var(--color-text-secondary)] mb-4 text-sm">Automatically log out after period of inactivity.</p>
          <select
            value={sessionTimeout}
            onChange={(e) => {
              setSessionTimeout(e.target.value);
              updateSettings({ sessionTimeout: e.target.value });
            }}
            className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          >
            <option value="15min">15 minutes</option>
            <option value="30min">30 minutes</option>
            <option value="1hr">1 hour</option>
            <option value="4hr">4 hours</option>
            <option value="24hr">24 hours</option>
          </select>
        </CardBody>
      </Card>

      <Divider />

      {/* Anti-Phishing Code */}
      <Card>
        <CardBody>
          <SectionHeader icon={AlertTriangle} title="Anti-Phishing Code" />
          <p className="text-[var(--color-text-secondary)] mb-4 text-sm">This code will appear in all emails from our platform to verify authenticity.</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-[var(--color-surface-2)] rounded-xl p-4 font-mono text-lg text-[var(--color-text-primary)]">
              {showPhishingCode ? antiPhishingCode : '••••••••'}
            </div>
            <button
              onClick={() => setShowPhishingCode(!showPhishingCode)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {showPhishingCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button
              onClick={() => copyToClipboard(antiPhishingCode)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          <Btn variant="ghost" size="sm" className="mt-4">
            <CheckCircle className="w-4 h-4" />
            Update Code
          </Btn>
        </CardBody>
      </Card>

      <Divider />
      <SectionHeader icon={Settings} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={Settings} title="Settings" desc="Trading preferences, notifications, and display options" color="var(--color-purple)" onClick={() => onNavigate('/settings')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={Wallet} title="Connections" desc="Connect wallets and exchange API keys" color="var(--color-info)" onClick={() => onNavigate('/connections')} />
        </div>
      </div>
    </div>
  );
}
