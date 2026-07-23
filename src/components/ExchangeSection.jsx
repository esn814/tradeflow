import { Link, Loader2, Shield } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge, Divider, Input } from '../components/ui';
import { EXCHANGES } from '../data/chains';

export default function ExchangeSection({
  exchangeKeys, showAddExchange, setShowAddExchange,
  exchangeForm, setExchangeForm,
  testingExchange, exchangeStatus,
  addExchangeKey, removeExchangeKey, testConnection,
  connectedExchangeCount,
}) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <SectionHeader icon={Link} title="Exchange Accounts" badge={`${connectedExchangeCount} Connected`} />
        <p className="text-[var(--color-text-muted)] text-xs -mt-2">Connect exchange API keys for live order execution.</p>
        <div className="flex items-center gap-2 bg-[var(--color-surface-2)] rounded-xl p-3 text-xs text-[var(--color-text-secondary)]">
          <Shield className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />
          API keys are encrypted and stored locally. We only request trade permissions — never withdrawal access.
        </div>

        <div className="space-y-3">
          {EXCHANGES.map(exchange => {
            const keys = exchangeKeys[exchange.id];
            const status = exchangeStatus[exchange.id];
            const isAdding = showAddExchange === exchange.id;
            return (
              <Card key={exchange.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: `${exchange.color}20`, color: exchange.color }}>{exchange.name[0]}</div>
                    <div>
                      <span className="text-sm font-medium">{exchange.name}</span>
                      {keys && <div className="flex items-center gap-2 mt-0.5"><span className="text-[var(--color-text-muted)] text-xs font-mono">{keys.keyPreview}</span><Badge variant={status === 'connected' ? 'success' : 'warning'}>{status === 'connected' ? 'Verified' : 'Saved'}</Badge></div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {keys && <><Btn variant="ghost" size="sm" onClick={() => testConnection(exchange.id)} disabled={testingExchange === exchange.id}>{testingExchange === exchange.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}</Btn><Btn variant="danger" size="sm" onClick={() => removeExchangeKey(exchange.id)}>Remove</Btn></>}
                    {!keys && !isAdding && <Btn variant="secondary" size="sm" onClick={() => { setShowAddExchange(exchange.id); setExchangeForm({}); }}>+ Connect</Btn>}
                  </div>
                </div>
                {isAdding && (<><Divider /><div className="space-y-3">{exchange.fields.map(f => (<Input key={f} label={f} type={f.includes('Secret') || f === 'Passphrase' ? 'password' : 'text'} value={exchangeForm[f] || ''} onChange={e => setExchangeForm(prev => ({ ...prev, [f]: e.target.value }))} placeholder={`Enter your ${f.toLowerCase()}`} />))}<div className="flex gap-2 pt-1"><Btn onClick={() => addExchangeKey(exchange.id)}>Save Keys</Btn><Btn variant="ghost" onClick={() => { setShowAddExchange(null); setExchangeForm({}); }}>Cancel</Btn></div></div></>)}
              </Card>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
