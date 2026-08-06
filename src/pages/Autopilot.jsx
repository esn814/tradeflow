import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Play, Pause, Settings2, Clock, AlertTriangle, LayoutDashboard, BarChart3 } from 'lucide-react';
import { useMode, useAppStore } from '../context/AppStore';
import { Divider, SectionHeader, LinkCard } from '../components/ui';
import { useSimulation } from '../hooks/useSimulation';
import { STRATEGY_META, RISK_PROFILES } from '../strategies';
import {
  MarketScanner, AmountSelector, StrategyCard,
  RiskSelector, ConfigPanel, PerformanceStats, TradeLog,
} from '../components/autopilot';

export default function Autopilot({ onNavigate }) {
  const { settings, updateSettings } = useAppStore();
  const { simple: _simple } = useMode();

  // Use real simulation engine instead of random generation
  const sim = useSimulation({
    coins: ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'],
    startingBalance: 10000,
    tickIntervalMs: 1500,
  });

  const [strategyId, setStrategyId] = useState(() => settings.autopilotStrategy || '');
  const [riskProfileId, setRiskProfileId] = useState(() => settings.autopilotRisk || 'moderate');
  const [tradeAmount, setTradeAmount] = useState(() => settings.autopilotAmount || 1000);
  const [showConfig, setShowConfig] = useState(false);
  const [running, setRunning] = useState(false);
  const [tradesExpanded, setTradesExpanded] = useState(false);
  const [stopLoss, setStopLoss] = useState(3);
  const [takeProfit, setTakeProfit] = useState(6);
  const [activeBotId, setActiveBotId] = useState(null);

  const strategy = STRATEGY_META.find(s => s.id === strategyId);
  const riskProfile = RISK_PROFILES.find(p => p.id === riskProfileId) || RISK_PROFILES[1];

  /* Adjust SL/TP when strategy or risk profile changes */
  useEffect(() => {
    if (strategy) {
      setStopLoss(+(strategy.riskDefaults.stopLoss * riskProfile.slMultiplier).toFixed(1));
      setTakeProfit(+(strategy.riskDefaults.takeProfit * riskProfile.tpMultiplier).toFixed(1));
    }
  }, [strategyId, riskProfileId]);

  const handleStart = () => {
    if (!strategyId) return;

    // Create a real bot using the simulation engine
    const botConfig = sim.startBot({
      strategyId,
      riskProfile: riskProfileId,
      tradeAmount,
      paramOverrides: {},
    });

    if (botConfig) {
      setActiveBotId(botConfig.id);
      setRunning(true);
      updateSettings({
        autopilotStrategy: strategyId,
        autopilotRisk: riskProfileId,
        autopilotAmount: tradeAmount,
      });
    }
  };

  const handleStop = () => {
    if (activeBotId) {
      sim.stopBot(activeBotId);
      setActiveBotId(null);
    }
    setRunning(false);
    updateSettings({ autopilotStrategy: strategyId, autopilotRisk: riskProfileId });
  };

  // Get live prices from the engine for the MarketScanner
  const enginePrices = {};
  for (const [sym, data] of Object.entries(sim.prices)) {
    enginePrices[sym.toLowerCase()] = data;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={20} className="text-[var(--color-accent)] flex-shrink-0" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">Autopilot</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-accent-22)] text-[var(--color-accent)] flex-shrink-0">BETA</span>
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

      <MarketScanner prices={enginePrices} loading={!sim.running && sim.tickCount === 0} />
      <AmountSelector value={tradeAmount} onChange={setTradeAmount} />

      {/* Strategy selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Choose a Strategy</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
          {STRATEGY_META.map(s => (
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
          <div className="bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-border-default)] p-5">
            <div className="flex items-center justify-between mb-3 gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{strategy.name}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                  Trading {strategy.pairs.join(', ')} · {strategy.timeframe} timeframe
                  {' | '}
                  <span className="text-red-400">SL {stopLoss}%</span>
                  {' / '}
                  <span className="text-green-400">TP {takeProfit}%</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
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
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Active with SL {stopLoss}% / TP {takeProfit}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono tabular-nums">{sim.metrics.totalTrades} trades</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{sim.metrics.tradesPerSecond} tps</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {sim.trades.length > 0 && <PerformanceStats trades={sim.trades} />}
      <TradeLog trades={sim.trades} expanded={tradesExpanded} onToggle={() => setTradesExpanded(!tradesExpanded)} />

      <div className="flex items-start gap-3 bg-[var(--color-warning-8)] border border-[var(--color-warning-22)] rounded-xl p-4">
        <AlertTriangle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-orange-300/80 leading-relaxed min-w-0">
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
