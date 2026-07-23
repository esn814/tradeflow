import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Brain, Flame, Droplets, Zap, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { Card, CardBody, SectionHeader, Badge } from './ui';
import { useLiveStream, useExchangeData } from '../data/liveData';

/* ── Real API fetchers with simulated fallback ── */
function getSimulatedFearGreed() {
  const base = 50;
  const drift = Math.sin(Date.now() / 86400000) * 15;
  const noise = (Math.random() - 0.5) * 20;
  return Math.max(0, Math.min(100, Math.round(base + drift + noise)));
}

function getSimulatedBTCDominance() {
  const base = 54.2;
  const noise = (Math.random() - 0.5) * 0.8;
  return +(base + noise).toFixed(1);
}

function getSimulatedAltSeasonIndex() {
  return Math.floor(30 + Math.random() * 40);
}

async function fetchFearGreed() {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const val = parseInt(data?.data?.[0]?.value);
    if (!isNaN(val)) return val;
  } catch { /* fall through to simulated */ }
  return getSimulatedFearGreed();
}

async function fetchGlobalMetrics() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const dom = data?.data?.market_cap_percentage?.btc;
    const alt = data?.data?.altcoin_market_cap_percentage_30d;
    return {
      btcDominance: dom ? +dom.toFixed(1) : getSimulatedBTCDominance(),
      altSeason: alt ? Math.round(alt / 2) : getSimulatedAltSeasonIndex(),
    };
  } catch { /* fall through */ }
  return { btcDominance: getSimulatedBTCDominance(), altSeason: getSimulatedAltSeasonIndex() };
}

function fearGreedLabel(value) {
  if (value <= 20) return { label: 'Extreme Fear', color: 'var(--color-loss)', icon: AlertTriangle };
  if (value <= 40) return { label: 'Fear', color: 'var(--color-danger-light)', icon: TrendingDown };
  if (value <= 60) return { label: 'Neutral', color: 'var(--color-warning)', icon: Minus };
  if (value <= 80) return { label: 'Greed', color: 'var(--color-profit)', icon: TrendingUp };
  return { label: 'Extreme Greed', color: 'var(--color-profit-light)', icon: Flame };
}

function getMarketRegime(fearGreed, btcDom) {
  if (fearGreed <= 30 && btcDom > 55) return { regime: 'Capitulation', desc: 'Extreme fear + BTC dominance rising. Historically a good time to accumulate quality assets.', advice: 'Consider DCA into BTC/ETH. Avoid altcoins.', color: 'var(--color-loss)' };
  if (fearGreed <= 40 && btcDom > 52) return { regime: 'Accumulation', desc: 'Fear in the market with BTC leading. Smart money tends to buy here.', advice: 'DCA strategies perform well. Grid bots on BTC/ETH.', color: 'var(--color-danger-light)' };
  if (fearGreed >= 70 && btcDom < 48) return { regime: 'Alt Season', desc: 'Greed is high and money is flowing into altcoins. High volatility expected.', advice: 'Take profits on alts. Tighten stop-losses.', color: 'var(--color-purple)' };
  if (fearGreed >= 80) return { regime: 'Euphoria', desc: 'Extreme greed — the market may be overheated. Historical top signals.', advice: 'Consider reducing exposure. Set trailing stops.', color: 'var(--color-warning)' };
  return { regime: 'Transitional', desc: 'Market is in a balanced state. No strong directional bias.', advice: 'Grid trading and mean reversion work well here.', color: 'var(--color-info)' };
}

/* ── Gauge Dial ── */
function FearGreedGauge({ value }) {
  const { label, color } = fearGreedLabel(value);
  const angle = (value / 100) * 180 - 90; // -90 to +90 degrees
  const circumference = Math.PI * 80; // semicircle
  const filled = (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="140" height="85" viewBox="0 0 160 90">
        {/* Background arc */}
        <path d="M 10 85 A 70 70 0 0 1 150 85" fill="none" stroke="var(--color-border-strong)" strokeWidth="10" strokeLinecap="round" />
        {/* Colored arc */}
        <path d="M 10 85 A 70 70 0 0 1 150 85" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Needle */}
        <line x1="80" y1="85" x2={80 + 50 * Math.cos((angle * Math.PI) / 180)} y2={85 - 50 * Math.sin((-angle * Math.PI) / 180)}
          stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ transition: 'all 0.5s ease' }} />
        {/* Center dot */}
        <circle cx="80" cy="85" r="4" fill={color} />
        {/* Value */}
        <text x="80" y="75" textAnchor="middle" fill={color} fontSize="20" fontWeight="800">{value}</text>
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

/* ── Exchange Status Indicator ── */
function ExchangeStatusDot({ name, online }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${online ? 'bg-[var(--color-success)] shadow-[0_0_4px_var(--color-success)]' : 'bg-[var(--color-loss)]'}`} />
      <span className="text-[10px] text-[var(--color-text-muted)] capitalize">{name}</span>
    </div>
  );
}

/* ── Exchange Status Bar ── */
function ExchangeStatusBar({ exchangeStatus }) {
  const anyOnline = Object.values(exchangeStatus).some(Boolean);
  return (
    <div className="flex items-center gap-3 p-2 bg-[var(--color-surface-2)] rounded-lg">
      <div className="flex items-center gap-1.5">
        {anyOnline ? <Wifi size={12} className="text-[var(--color-success)]" /> : <WifiOff size={12} className="text-[var(--color-loss)]" />}
        <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">Exchanges:</span>
      </div>
      <div className="flex items-center gap-3">
        <ExchangeStatusDot name="Binance" online={exchangeStatus.binance} />
        <ExchangeStatusDot name="CoinGecko" online={exchangeStatus.coingecko} />
        <ExchangeStatusDot name="CoinCap" online={exchangeStatus.coincap} />
        <ExchangeStatusDot name="Bybit" online={exchangeStatus.bybit} />
        <ExchangeStatusDot name="Paxeer" online={exchangeStatus.paxeer} />
      </div>
      {anyOnline && (
        <Badge variant="success" className="ml-auto text-[9px] px-1.5 py-0.5">
          LIVE DATA
        </Badge>
      )}
    </div>
  );
}

/* ── Volume Display ── */
function VolumeDisplay({ volume }) {
  if (!volume) return null;
  const formatted = volume >= 1e9 ? `${(volume / 1e9).toFixed(1)}B` : volume >= 1e6 ? `${(volume / 1e6).toFixed(1)}M` : `${volume.toLocaleString()}`;
  return (
    <span className="text-[10px] text-[var(--color-text-muted)] ml-2">
      Vol: {formatted}
    </span>
  );
}

export default function MarketPulse() {
  const { prices, connected } = useLiveStream(['btc', 'eth', 'sol', 'pax'], 30000);
  const { exchangeStatus, volumes } = useExchangeData(['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT'], 30000);
  const [fearGreed, setFearGreed] = useState(getSimulatedFearGreed);
  const [btcDominance, setBtcDominance] = useState(getSimulatedBTCDominance);
  const [, setAltSeason] = useState(getSimulatedAltSeasonIndex);

  // Fetch real data on mount, refresh every 5 min
  useEffect(() => {
    const load = async () => {
      const [fg, global] = await Promise.allSettled([
        fetchFearGreed(),
        fetchGlobalMetrics(),
      ]);
      if (fg.status === 'fulfilled') setFearGreed(fg.value);
      if (global.status === 'fulfilled') {
        setBtcDominance(global.value.btcDominance);
        setAltSeason(global.value.altSeason);
      }
    };
    load();
    const id = setInterval(load, 300000);
    return () => clearInterval(id);
  }, []);

  const regime = useMemo(() => getMarketRegime(fearGreed, btcDominance), [fearGreed, btcDominance]);

  const btcChange = prices.btc?.change24h ?? '--';
  const ethChange = prices.eth?.change24h ?? '--';
  const btcVolume = volumes?.BTC ?? 0;
  const ethVolume = volumes?.ETH ?? 0;

  return (
    <Card>
      <CardBody>
        <SectionHeader icon={Brain} title="Market Pulse" action={
          <div className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${connected ? 'bg-[var(--color-success-15)] text-[var(--color-success)]' : 'bg-[var(--color-warning-15)] text-[var(--color-warning)]'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-warning)]'}`} />
            {connected ? 'Live' : 'Polling'}
          </div>
        } />

        {/* Exchange Status Bar */}
        <ExchangeStatusBar exchangeStatus={exchangeStatus} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Fear & Greed Gauge */}
          <div className="flex flex-col items-center justify-center">
            <FearGreedGauge value={fearGreed} />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2">Crypto Fear & Greed Index</p>
          </div>

          {/* Market Regime Card */}
          <div className="flex flex-col gap-3">
            <div className="p-3 rounded-xl border" style={{ borderColor: regime.color + '40', background: regime.color + '08' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: regime.color }} />
                <span className="text-sm font-bold" style={{ color: regime.color }}>{regime.regime}</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">{regime.desc}</p>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-surface-2)]">
                <Zap size={12} className="text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-[var(--color-text-primary)]">{regime.advice}</p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface-2)] rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[var(--color-btc-22)] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[var(--color-btc)]">₿</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">BTC 24h</span>
              </div>
              <div className="flex items-center">
                <span className={`text-sm font-bold ${parseFloat(btcChange) >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                  {parseFloat(btcChange) >= 0 ? '+' : ''}{btcChange}%
                </span>
                <VolumeDisplay volume={btcVolume} />
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-[var(--color-surface-2)] rounded-lg">
              <div className="flex items-center gap-2">
                <Droplets size={14} className="text-[var(--color-eth)]" />
                <span className="text-xs text-[var(--color-text-secondary)]">ETH 24h</span>
              </div>
              <div className="flex items-center">
                <span className={`text-sm font-bold ${parseFloat(ethChange) >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                  {parseFloat(ethChange) >= 0 ? '+' : ''}{ethChange}%
                </span>
                <VolumeDisplay volume={ethVolume} />
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
