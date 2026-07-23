import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, Zap, Loader2,
  ChevronDown, ChevronUp, Target, Globe, Link2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import InfoTip from '../components/InfoTip';
import {
  Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader,
  Divider, EmptyState, Toggle
} from '../components/ui';

/* ─── Cross-chain definitions ─── */
const CHAINS = [
  { id: 'ethereum', name: 'Ethereum', icon: '⟠', native: 'ETH', bridgeTime: '~15 min', fee: '$8–25' },
  { id: 'bsc', name: 'BNB Chain', icon: '🔶', native: 'BNB', bridgeTime: '~3 min', fee: '$0.5–2' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔵', native: 'ETH', bridgeTime: '~10 min', fee: '$1–5' },
  { id: 'solana', name: 'Solana', icon: '◎', native: 'SOL', bridgeTime: '~1 min', fee: '$0.01–0.10' },
  { id: 'avalanche', name: 'Avalanche', icon: '🔺', native: 'AVAX', bridgeTime: '~2 min', fee: '$0.5–3' },
  { id: 'paxeer', name: 'Paxeer', icon: '⚡', native: 'PAX', bridgeTime: '~5 sec', fee: '$0.001' },
];

const BRIDGE_PROTOCOLS = [
  { id: 'across', name: 'Across Protocol', chains: 6, tvl: '$2.1B', speed: 'Fast' },
  { id: 'stargate', name: 'Stargate V2', chains: 8, tvl: '$3.4B', speed: 'Medium' },
  { id: 'wormhole', name: 'Wormhole', chains: 12, tvl: '$1.8B', speed: 'Medium' },
  { id: 'axelar', name: 'Axelar', chains: 15, tvl: '$920M', speed: 'Slow' },
];

const TOKENS = ['ETH', 'USDC', 'USDT', 'WBTC', 'PAX'];

function generateCrossChainOpps() {
  const opps = [];
  for (const token of TOKENS) {
    for (let i = 0; i < CHAINS.length; i++) {
      for (let j = 0; j < CHAINS.length; j++) {
        if (i === j) continue;
        const spread = (Math.random() * 3 + 0.2).toFixed(2);
        if (parseFloat(spread) > 0.5) {
          const base = token === 'ETH' ? 3450 : token === 'WBTC' ? 67420 : token === 'PAX' ? 0.52 : 1;
          const profit = (parseFloat(spread) * base / 100).toFixed(2);
          const bridgeFee = (Math.random() * 10 + 1).toFixed(2);
          const netProfit = (parseFloat(profit) - parseFloat(bridgeFee)).toFixed(2);
          const bestBridge = BRIDGE_PROTOCOLS[Math.floor(Math.random() * BRIDGE_PROTOCOLS.length)];
          opps.push({
            id: `${token}-${CHAINS[i].id}-${CHAINS[j].id}-${Date.now()}`,
            token,
            sourceChain: CHAINS[i],
            destChain: CHAINS[j],
            spread: parseFloat(spread),
            profit: parseFloat(profit),
            bridgeFee: parseFloat(bridgeFee),
            netProfit: parseFloat(netProfit),
            bridge: bestBridge,
            timeEstimate: `${Math.floor(Math.random() * 20 + 2)} min`,
            confidence: parseFloat(spread) > 1.5 ? 'high' : parseFloat(spread) > 0.8 ? 'medium' : 'low',
          });
        }
      }
    }
  }
  return opps.sort((a, b) => b.netProfit - a.netProfit).slice(0, 15);
}

export default function CrossChainArbitrage() {
  
  const { isAuthenticated } = useAuth();
  const [opps, setOpps] = useState(() => generateCrossChainOpps());
  const [scanning, setScanning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [minSpread, setMinSpread] = useState(0.8);
  const [selectedToken, setSelectedToken] = useState('all');
  const [expandedOpp, setExpandedOpp] = useState(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setOpps(generateCrossChainOpps()), 12000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filtered = useMemo(() =>
    opps.filter(o =>
      o.spread >= minSpread &&
      (selectedToken === 'all' || o.token === selectedToken)
    ), [opps, minSpread, selectedToken]);

  const avgSpread = filtered.length > 0
    ? (filtered.reduce((s, o) => s + o.spread, 0) / filtered.length).toFixed(2)
    : '0';
  const profitable = filtered.filter(o => o.netProfit > 0).length;

  const handleScan = async () => {
    setScanning(true);
    await new Promise(r => setTimeout(r, 2000));
    setOpps(generateCrossChainOpps());
    setScanning(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader icon={Globe} title="Cross-Chain Arbitrage" badge="BETA"
        subtitle="Exploit price differences for the same asset across different blockchains">
        <InfoTip text="Cross-chain arbitrage buys an asset cheaper on one blockchain and sells it for more on another. Requires bridging assets between chains, which adds time and fees. Only profitable when the spread exceeds bridge costs + slippage." />
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Opportunities" value={filtered.length} sub={`of ${opps.length} found`} color="text-[var(--color-accent)]" />
        <Stat label="Avg Spread" value={`${avgSpread}%`} color="text-[var(--color-success)]" />
        <Stat label="Profitable" value={`${profitable}/${filtered.length}`} color="text-[var(--color-info)]" />
        <Stat label="Chains" value={CHAINS.length} color="text-[var(--color-warning-alt)]" />
      </div>

      <Divider />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={handleScan} disabled={scanning}>
          {scanning ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><RefreshCw size={14} /> Scan Now</>}
        </Btn>
        <Toggle label="Auto-refresh" checked={autoRefresh} onChange={setAutoRefresh} />
        <select className="input text-sm" value={selectedToken} onChange={e => setSelectedToken(e.target.value)}>
          <option value="all">All Tokens</option>
          {TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Min Spread:
          <input type="range" min="0.2" max="5" step="0.1" value={minSpread}
            onChange={e => setMinSpread(parseFloat(e.target.value))} className="w-24" />
          <span className="font-mono text-[var(--color-text)]">{minSpread}%</span>
        </div>
      </div>

      {/* Opportunities */}
      <SectionHeader icon={Zap} title="Cross-Chain Opportunities" count={filtered.length} />
      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="No opportunities" subtitle="Lower the minimum spread or wait for new market conditions." />
      ) : (
        <div className="space-y-3">
          {filtered.map(opp => {
            const expanded = expandedOpp === opp.id;
            return (
              <Card key={opp.id}>
                <CardBody>
                  <button onClick={() => setExpandedOpp(expanded ? null : opp.id)}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--color-info-20)' }}>
                        {opp.sourceChain.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[var(--color-text)]">
                          {opp.token} · {opp.sourceChain.name} → {opp.destChain.name}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          via {opp.bridge.name} · ~{opp.timeEstimate} · Fee: ${opp.bridgeFee}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-[var(--color-success)]">+{opp.spread}%</div>
                        <div className={`text-xs ${opp.netProfit > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          Net: ${opp.netProfit > 0 ? '+' : ''}{opp.netProfit}
                        </div>
                      </div>
                      <Badge variant={opp.confidence === 'high' ? 'success' : opp.confidence === 'medium' ? 'warning' : 'danger'}>
                        {opp.confidence}
                      </Badge>
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">Source:</span> {opp.sourceChain.name}</div>
                      <div><span className="text-[var(--color-text-muted)]">Dest:</span> {opp.destChain.name}</div>
                      <div><span className="text-[var(--color-text-muted)]">Bridge:</span> {opp.bridge.name}</div>
                      <div><span className="text-[var(--color-text-muted)]">Time:</span> {opp.timeEstimate}</div>
                      <div><span className="text-[var(--color-text-muted)]">Gross Profit:</span> ${opp.profit}</div>
                      <div><span className="text-[var(--color-text-muted)]">Bridge Fee:</span> ${opp.bridgeFee}</div>
                      <div><span className="text-[var(--color-text-muted)]">Net Profit:</span> ${opp.netProfit}</div>
                      <div><span className="text-[var(--color-text-muted)]">Confidence:</span> {opp.confidence}</div>
                      <div className="col-span-2">
                        <Btn disabled={!isAuthenticated} className="text-xs">
                          <Zap size={12} /> Execute Cross-Chain Arb
                        </Btn>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Divider />

      {/* Chain & Bridge Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader icon={Globe} title="Supported Chains" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CHAINS.map(ch => (
              <Card key={ch.id}>
                <CardBody className="text-center">
                  <div className="text-2xl mb-1">{ch.icon}</div>
                  <div className="font-semibold text-xs text-[var(--color-text)]">{ch.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">Bridge: {ch.bridgeTime}</div>
                  <div className="text-xs text-[var(--color-success)] mt-1">Fee: {ch.fee}</div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <SectionHeader icon={Link2} title="Bridge Protocols" />
          <div className="space-y-2">
            {BRIDGE_PROTOCOLS.map(bp => (
              <Card key={bp.id}>
                <CardBody className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-[var(--color-text)]">{bp.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{bp.chains} chains · TVL {bp.tvl}</div>
                  </div>
                  <Badge variant={bp.speed === 'Fast' ? 'success' : bp.speed === 'Medium' ? 'warning' : 'info'}>{bp.speed}</Badge>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}