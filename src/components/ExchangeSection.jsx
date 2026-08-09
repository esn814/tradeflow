import { Link, Loader2, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardBody, SectionHeader, Btn, Badge, Divider, Input } from '../components/ui';
import { EXCHANGES } from '../data/chains';

export default function ExchangeSection({
  exchangeKeys, showAddExchange, setShowAddExchange,
  exchangeForm, setExchangeForm,
  testingExchange, exchangeStatus,
  addExchangeKey, removeExchangeKey, testConnection,
  connectedExchangeCount,
  exchangeError, savingExchange, clearExchangeError,
}) {
  return (
    <Card className="overflow-hidden">
      <CardBody className="space-y-6">
        <SectionHeader icon={Link} title="Exchange Accounts" badge={`${connectedExchangeCount} Connected`} />
        <p className="text-[var(--color-text-muted)] text-xs -mt-2">Connect exchange API keys for live order execution.</p>
        <div className="flex items-start gap-2 bg-[var(--color-surface-2)] rounded-xl p-3 text-xs text-[var(--color-text-secondary)]">
          <Shield className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
          <span>API keys are encrypted with AES-256-GCM and stored securely on the server. We only request trade permissions — never withdrawal access.</span>
        </div>

        {/* Error banner */}
        {exchangeError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--color-danger-18)] text-[var(--color-danger)] text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{exchangeError}</span>
            <button onClick={clearExchangeError} className="underline flex-shrink-0">Dismiss</button>
          </div>
        )}

        <div className="space-y-3">
          {EXCHANGES.map(exchange => {
            const keys = exchangeKeys[exchange.id];
            const status = exchangeStatus[exchange.id];
            const isAdding = showAddExchange === exchange.id;
            const isSaving = savingExchange === exchange.id;
            return (
              <Card key={exchange.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: `${exchange.color}20`, color: exchange.color }}>{exchange.name[0]}</div>
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{exchange.name}</span>
                      {keys && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[var(--color-text-muted)] text-xs font-mono truncate">{keys.keyPreview}</span>
                          {status === 'connected' ? (
                            <Badge variant="success" className="flex-shrink-0 whitespace-nowrap flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </Badge>
                          ) : status === 'error' ? (
                            <Badge variant="danger" className="flex-shrink-0 whitespace-nowrap">Error</Badge>
                          ) : (
                            <Badge variant="warning" className="flex-shrink-0 whitespace-nowrap">Saved</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {keys && (
                      <>
                        <Btn variant="ghost" size="sm" onClick={() => testConnection(exchange.id)} disabled={testingExchange === exchange.id}>
                          {testingExchange === exchange.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}
                        </Btn>
                        <Btn variant="danger" size="sm" onClick={() => removeExchangeKey(exchange.id)}>Remove</Btn>
                      </>
                    )}
                    {!keys && !isAdding && (
                      <Btn variant="secondary" size="sm" onClick={() => { setShowAddExchange(exchange.id); setExchangeForm({}); }}>
                        + Connect
                      </Btn>
                    )}
                  </div>
                </div>
                {isAdding && (
                  <>
                    <Divider />
                    <div className="space-y-3 mt-3">
                      {exchange.fields.map(f => (
                        <Input
                          key={f}
                          label={f}
                          type={f.includes('Secret') || f === 'Passphrase' ? 'password' : 'text'}
                          value={exchangeForm[f] || ''}
                          onChange={e => setExchangeForm(prev => ({ ...prev, [f]: e.target.value }))}
                          placeholder={f === 'API Key' ? 'Enter your API key' : 'Enter your API secret'}
                        />
                      ))}
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        For Binance: use <strong>testnet.binancefuture.com</strong> testnet keys. Enable Futures trading permission only.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <Btn onClick={() => addExchangeKey(exchange.id)} disabled={isSaving}>
                          {isSaving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...</> : 'Save Keys'}
                        </Btn>
                        <Btn variant="ghost" onClick={() => { setShowAddExchange(null); setExchangeForm({}); clearExchangeError?.(); }}>Cancel</Btn>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
