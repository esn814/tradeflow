import { useState, useEffect, useMemo } from 'react';
import {
  ArrowRightLeft, RefreshCw, Zap,
  Loader2, ChevronDown, ChevronUp,
  BarChart3, Target
} from 'lucide-react';
import { useLivePrices } from '../data/liveData';
import { useAppStore } from '../context/AppStore';
import { useAuth } from '../context/AuthContext';
import InfoTip from '../components/InfoTip';
import {
  Card, CardBody, SectionHeader, Btn, Badge, Stat, PageHeader,
  Divider, EmptyState, Toggle
} from '../components/ui';

/* ─── DEX definitions ─── */
const DEXES = [
  { id: 'uniswap', name: 'Uniswap V3', chain: 'Ethereum', tvl: '$5.2B', icon: '🦄' },
  { id: 'sushiswap', name: 'SushiSwap', chain: 'Ethereum', tvl: '$1.8B', icon: '🍣' },
  { id: 'pancakeswap', name: 'PancakeSwap', chain: 'BSC', tvl: '$3.1B', icon: '🥞' },
  { id: 'raydium', name: 'Raydium', chain: 'Solana', tvl: '$890M', icon: '☀️' },
  { id: 'traderjoe', name: 'Trader Joe', chain: 'Avalanche', tvl: '$420M', icon: '🏔️' },
  { id: 'paxswap', name: 'PaxSwap', chain: 'Paxeer', tvl: '$156M', icon: '⚡' },
];

const TOKENS = ['ETH', 'BTC', 'SOL', 'PAX', 'BNB', 'AVAX', 'USDC', 'USDT'];

function generateOpportunities() {
  const opps = [];
  for (const token of TOKENS) {
    for (let i = 0; i < DEXES.length; i++) {
      for (let j = i + 1; j < DEXES.length; j++) {
        const spread = (Math.random() * 2.5 + 0.1).toFixed(2);
        if (parseFloat(spread) > 0.3) {
          const basePrice = token === 'BTC' ? 67420 : token === 'ETH' ? 3450 : token === 'SOL' ? 148 : 100;
          const buyPrice = (basePrice * (1 - parseFloat(spread) / 200)).toFixed(2);
          const sellPrice = (basePrice * (1 + parseFloat(spread) / 200)).toFixed(2);
          opps.push({
            id: `${token}-${DEXES[i].id}-${DEXES[j].id}`,
            token,
            buyDex: DEXES[i],
            sellDex: DEXES[j],
            buyPrice: parseFloat(buyPrice),
            sellPrice: parseFloat(sellPrice),
            spread: parseFloat(spread),
            estimatedProfit: (parseFloat(spread) * basePrice / 100).toFixed(2),
            volume24h: `$${(Math.random() * 50 + 10).toFixed(1)}M`,
            gasEstimate: `$${(Math.random() * 15 + 2).toFixed(2)}`,
            timeWindow: `${Math.floor(Math.random() * 30 + 5)}s`,
            confidence: Math.random() > 0.3 ? 'high' : 'medium',
          });
        }
      }
    }
  }
  return opps.sort((a, b) => b.spread - a.spread).slice(0, 12);
}

export default function CrossDexArbitrage({ onNavigate: _onNavigate }) {
  const _store = useAppStore();
  const { isAuthenticated } = useAuth();
  const { prices: _prices } = useLivePrices(['pax', 'btc', 'eth', 'sol']);
  const [opps, setOpps] = useState(() => generateOpportunities());
  const [scanning, setScanning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedChain, setSelectedChain] = useState('all');
  const [minSpread, setMinSpread] = useState(0.5);
  const [expandedOpp, setExpandedOpp] = useState(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setOpps(generateOpportunities()), 8000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filteredOpps = useMemo(() =>
    opps.filter(o =>
      o.spread >= minSpread &&
      (selectedChain === 'all' || o.buyDex.chain === selectedChain || o.sellDex.chain === selectedChain)
    ), [opps, minSpread, selectedChain]);

  const totalSpread = filteredOpps.reduce((s, o) => s + o.spread, 0);
  const avgSpread = filteredOpps.length > 0 ? (totalSpread / filteredOpps.length).toFixed(2) : '0';
  const bestOpp = filteredOpps[0];
  const chains = [...new Set(DEXES.map(d => d.chain))];

  const handleScan = async () => {
    setScanning(true);
    await new Promise(r => setTimeout(r, 1500));
    setOpps(generateOpportunities());
    setScanning(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader icon={ArrowRightLeft} title="Cross-DEX Arbitrage" badge="LIVE SCAN"
        subtitle="Find price differences across decentralized exchanges and execute arbitrage trades">
        <InfoTip text="Cross-DEX arbitrage buys an asset on one exchange where it's cheaper and sells it on another where it's more expensive. Profits come from the price spread minus gas and slippage. Always verify spreads on-chain before executing." />
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Opportunities" value={filteredOpps.length} sub={`of ${opps.length} scanned`} color="text-[var(--color-accent)]" />
        <Stat label="Avg Spread" value={`${avgSpread}%`} color="text-[var(--color-success)]" />
        <Stat label="Best Spread" value={bestOpp ? `${bestOpp.spread}%` : '—'} color="text-[var(--color-warning-alt)]" />
        <Stat label="DEX Pairs" value={DEXES.length * (DEXES.length - 1) / 2} color="text-[var(--color-info)]" />
      </div>

      <Divider />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={handleScan} disabled={scanning}>
          {scanning ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><RefreshCw size={14} /> Scan Now</>}
        </Btn>
        <Toggle label="Auto-refresh" checked={autoRefresh} onChange={setAutoRefresh} />
        <select className="input text-sm" value={selectedChain} onChange={e => setSelectedChain(e.target.value)}>
          <option value="all">All Chains</option>
          {chains.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          Min Spread:
          <input type="range" min="0.1" max="3" step="0.1" value={minSpread}
            onChange={e => setMinSpread(parseFloat(e.target.value))} className="w-24" />
          <span className="font-mono text-[var(--color-text)]">{minSpread}%</span>
        </div>
      </div>

      {/* Opportunities List */}
      <SectionHeader icon={Zap} title="Arbitrage Opportunities" count={filteredOpps.length} />
      {filteredOpps.length === 0 ? (
        <EmptyState icon={Target} title="No opportunities found" subtitle="Try lowering the minimum spread or scanning different chains." />
      ) : (
        <div className="space-y-3">
          {filteredOpps.map(opp => {
            const expanded = expandedOpp === opp.id;
            const netProfit = (parseFloat(opp.estimatedProfit) - parseFloat(opp.gasEstimate.replace('$', ''))).toFixed(2);
            return (
              <Card key={opp.id}>
                <CardBody>
                  <button onClick={() => setExpandedOpp(expanded ? null : opp.id)}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'var(--color-success-20)' }}>
                        {opp.buyDex.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-[var(--color-text)]">
                          {opp.token} · {opp.buyDex.name} → {opp.sellDex.name}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Buy ${opp.buyPrice.toLocaleString()} · Sell ${opp.sellPrice.toLocaleString()} · {opp.volume24h} vol
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-[var(--color-success)]">+{opp.spread}%</div>
                        <div className={`text-xs ${parseFloat(netProfit) > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                          Net: ${netProfit}
                        </div>
                      </div>
                      <Badge color={opp.confidence === 'high' ? 'var(--color-success)' : 'var(--color-warning-alt)'}>{opp.confidence}</Badge>
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">Buy DEX:</span> {opp.buyDex.name} ({opp.buyDex.chain})</div>
                      <div><span className="text-[var(--color-text-muted)]">Sell DEX:</span> {opp.sellDex.name} ({opp.sellDex.chain})</div>
                      <div><span className="text-[var(--color-text-muted)]">Gas Est:</span> {opp.gasEstimate}</div>
                      <div><span className="text-[var(--color-text-muted)]">Window:</span> {opp.timeWindow}</div>
                      <div><span className="text-[var(--color-text-muted)]">24h Volume:</span> {opp.volume24h}</div>
                      <div><span className="text-[var(--color-text-muted)]">Est. Profit:</span> ${opp.estimatedProfit}</div>
                      <div className="col-span-2">
                        <Btn disabled={!isAuthenticated} className="text-xs">
                          <Zap size={12} /> Execute Arb
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

      {/* DEX Reference */}
      <SectionHeader icon={BarChart3} title="Monitored DEXes" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DEXES.map(dex => (
          <Card key={dex.id}>
            <CardBody className="text-center">
              <div className="text-2xl mb-1">{dex.icon}</div>
              <div className="font-semibold text-xs text-[var(--color-text)]">{dex.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{dex.chain}</div>
              <div className="text-xs text-[var(--color-success)] mt-1">{dex.tvl}</div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}