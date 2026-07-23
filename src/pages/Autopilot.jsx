import { useState, useEffect, useRef } from 'react';
import { Zap, Play, Pause, Settings2, Clock, AlertTriangle, LayoutDashboard, BarChart3 } from 'lucide-react';
import { useLivePrices } from '../data/liveData';
import { useMode, useAppStore } from '../context/AppStore';
import { Divider, SectionHeader, LinkCard } from '../components/ui';
import {
  STRATEGIES, RISK_PROFILES, generateTrade,
  MarketScanner, AmountSelector, StrategyCard,
  RiskSelector, ConfigPanel, PerformanceStats, TradeLog,
} from '../components/autopilot';

export default function Autopilot({ onNavigate }) {
  const { settings, updateSettings } = useAppStore();
  const { simple: _simple } = useMode();
  const { prices, loading } = useLivePrices(['btc', 'eth', 'sol', 'pax'], 30000);

  const [strategyId, setStrategyId] = useState(() => settings.autopilotStrategy || '');
  const [riskProfileId, setRiskProfileId] = useState(() => settings.autopilotRisk || 'moderate');
  const [tradeAmount, setTradeAmount] = useState(() => settings.autopilotAmount || 100);
  const [showConfig, setShowConfig] = useState(false);
  const [running, setRunning] = useState(false);
  const [trades, setTrades] = useState([]);
  const [tradesExpanded, setTradesExpanded] = useState(false);
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(6);

  const actionRef = useRef(null);
  const intervalRef = useRef(null);

  const strategy = STRATEGIES.find(s => s.id === strategyId);
  const riskProfile = RISK_PROFILES.find(p => p.id === riskProfileId) || RISK_PROFILES[1];

  /* Adjust SL/TP when strategy or risk profile changes */
  useEffect(() => {
    const strat = STRATEGIES.find(s => s.id === strategyId);
    if (strat) {
      const rp = RISK_PROFILES.find(p => p.id === riskProfileId) || RISK_PROFILES[1];
      setStopLoss(+(strat.params.stopLoss * rp.slMultiplier).toFixed(1));
      setTakeProfit(+(strat.params.takeProfit * rp.tpMultiplier).toFixed(1));
    }
  }, [strategyId, riskProfileId]);

  /* Trade generation loop */
  useEffect(() => {
    if (running && strategy) {
      const tick = () => {
        const trade = generateTrade(strategy, prices, stopLoss, takeProfit, riskProfile.sizeMultiplier, tradeAmount);
        setTrades(prev => [trade, ...prev].slice(0, 200));
      };
      tick();
      intervalRef.current = setInterval(tick, 3000 + Math.random() * 4000);
      return () => clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, strategy, prices, stopLoss, takeProfit, riskProfile.sizeMultiplier, tradeAmount]);

  const handleStart = () => {
    if (!strategyId) return;
    setTrades([]);
    setRunning(true);
    updateSettings({ autopilotStrategy: strategyId, autopilotRisk: riskProfileId, autopilotAmount: tradeAmount });
  };

  const handleStop = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    updateSettings({ autopilotStrategy: strategyId, autopilotRisk: riskProfileId });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-[var(--color-accent)]" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Autopilot</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-accent-22)] text-[var(--color-accent)]">BETA</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Pick a strategy. Adjust risk. The bot trades 24/7. Stop anytime.</p>
        </div>
        {running && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">LIVE</span>
          </div>
        )}
      </div>

      <MarketScanner prices={prices} loading={loading} />
      <AmountSelector value={tradeAmount} onChange={setTradeAmount} />

      {/* Strategy selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Choose a Strategy</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
          {STRATEGIES.map(s => (
            <StrategyCard key={s.id} strat={s} selected={strategyId} onSelect={setStrategyId} />
          ))}
        </div>
      </div>

      {strategy && <RiskSelector selected={riskProfileId} onSelect={setRiskProfileId} strategy={strategy} />}

      {strategy && (
        <>
          {showConfig && (
            <ConfigPanel
              strat={strategy}
              onClose={() => setShowConfig(false)}
              stopLoss={stopLoss}
              takeProfit={takeProfit}
              onStopLossChange={setStopLoss}
              onTakeProfitChange={setTakeProfit}
            />
          )}

          {/* Start/Stop controls */}
          <div ref={actionRef} className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border-default)] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{strategy.name}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Trading {strategy.pairs.join(', ')} on {strategy.timeframe} candles
                  {' | '}
                  <span className="text-red-400">SL {stopLoss}%</span>
                  {' / '}
                  <span className="text-green-400">TP {takeProfit}%</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-2 rounded-lg bg-[var(--color-surface-3)] hover:bg-[var(--color-border-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
                  title="Strategy settings"
                >
                  <Settings2 size={16} />
                </button>
                {!running ? (
                  <button
                    onClick={handleStart}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-surface-deep)] font-bold text-sm hover:bg-[var(--color-accent-hover)] transition shadow-lg shadow-[var(--color-accent-22)]"
                  >
                    <Play size={16} /> Start Trading
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/30 transition"
                  >
                    <Pause size={16} /> Stop
                  </button>
                )}
              </div>
            </div>
            {running && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <Clock size={12} />
                <span>Active with SL {stopLoss}% / TP {takeProfit}%</span>
              </div>
            )}
          </div>
        </>
      )}

      {trades.length > 0 && <PerformanceStats trades={trades} />}
      <TradeLog trades={trades} expanded={tradesExpanded} onToggle={() => setTradesExpanded(!tradesExpanded)} />

      <div className="flex items-start gap-3 bg-[var(--color-warning-8)] border border-[var(--color-warning-22)] rounded-xl p-4">
        <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
        <p className="text-xs text-orange-300/80 leading-relaxed">
          Automated trading involves risk. This is a paper trading simulation — no real money is at risk. All trades use virtual funds with real market data for learning and testing purposes.
        </p>
      </div>

      <Divider />
      <SectionHeader icon={LayoutDashboard} title="Related" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        <div className="animate-fade-in">
          <LinkCard icon={LayoutDashboard} title="Dashboard" desc="View your portfolio, positions, and P&L at a glance" color="var(--color-info)" onClick={() => onNavigate('/dashboard')} />
        </div>
        <div className="animate-fade-in">
          <LinkCard icon={BarChart3} title="My Bots" desc="Monitor, pause, or stop your running bots" color="var(--color-purple)" onClick={() => onNavigate('/my-bots')} />
        </div>
      </div>
    </div>
  );
}
