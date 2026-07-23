/**
 * PRESSURE TEST — pushes TradeFlow harder across every dimension.
 *
 * Differences from v3 (run-stress.mjs):
 *   • 1000 bots (2×)
 *   • 50ms tick interval (2× tick rate)
 *   • 13 coins (vs 8)
 *   • 3 parallel SimulationEngine instances (CPU contention test)
 *   • Aggressive strategy params (frequent triggers, larger positions)
 *   • Volatile price regime (higher volatility to stress order matching)
 *   • 10-minute snapshots (vs 60s) — less I/O overhead
 *
 * Env overrides:
 *   BOT_COUNT=1000  DURATION_SEC=3600  TICK_MS=50  ENGINES=3
 */
import { SimulationEngine } from './simulationEngine.js';
import { STRATEGIES } from './strategies.js';
import { writeFileSync, appendFileSync } from 'fs';

const BOT_COUNT   = parseInt(process.env.BOT_COUNT    || '1000', 10);
const DURATION    = parseInt(process.env.DURATION_SEC || '3600', 10);
const TICK_MS     = parseInt(process.env.TICK_MS      || '50',   10);
const ENGINE_COUNT = parseInt(process.env.ENGINES     || '3',     10);
const LOG         = '/workspace/tradeflow/src/engine/pressure-results.txt';

const storeActions = { addDemoTrade: () => {}, addTrade: () => {} };
const coins = [
  'BTC','ETH','SOL','AVAX','MATIC','LINK','DOT','PAX',
  'BNB','ATOM','ARB','OP','DOGE',
];
const strategyKeys = Object.keys(STRATEGIES);

// Aggressive params — more frequent triggers, bigger positions
const AGGRESSIVE = {
  dca:            { interval: 4,  buyPct: 0.12, sellPct: 0.08 },
  grid:           { gridSpacing: 0.012, orderPct: 0.15 },
  trend:          { shortWindow: 4, longWindow: 12, tradePct: 0.18 },
  momentum:       { lookback: 6,  threshold: 0.02, tradePct: 0.20 },
  meanReversion:  { window: 10,   deviation: 0.018, tradePct: 0.15 },
};

const lines = [];
function log(msg) { lines.push(msg); console.log(msg); }

log(`╔══════════════════════════════════════════════════════════════╗`);
log(`║  PRESSURE TEST: ${BOT_COUNT} bots × ${ENGINE_COUNT} engines × ${DURATION}s            ║`);
log(`╚══════════════════════════════════════════════════════════════╝`);
log(``);
log(`Tick interval: ${TICK_MS}ms | Strategies: ${strategyKeys.length} | Coins: ${coins.length}`);
log(`Aggressive params enabled | ${ENGINE_COUNT} parallel engines`);
log(``);

// Split bots across engines
const botsPerEngine = Math.ceil(BOT_COUNT / ENGINE_COUNT);
const engines = [];

for (let e = 0; e < ENGINE_COUNT; e++) {
  const engine = new SimulationEngine(storeActions, {
    coins,
    tickIntervalMs: TICK_MS,
    startingBalance: 10000,
  });

  const start = e * botsPerEngine;
  const end = Math.min(start + botsPerEngine, BOT_COUNT);
  for (let i = start; i < end; i++) {
    const strategy = strategyKeys[i % strategyKeys.length];
    const coin = coins[i % coins.length];
    engine.addBot({
      strategy,
      coin,
      name: `E${e}-${STRATEGIES[strategy].name} ${coin} #${Math.floor(i / strategyKeys.length) + 1}`,
      balance: 10000,
      params: { ...AGGRESSIVE[strategy] },
    });
  }
  engines.push(engine);
  log(`  Engine ${e}: ${end - start} bots, ${TICK_MS}ms tick`);
}

log(``);
log(`Total bots spawned across ${ENGINE_COUNT} engines. Running...`);
writeFileSync(LOG, lines.join('\n') + '\n\n(pressure test in progress...)\n');

// Start all engines simultaneously
const startTime = Date.now();
for (const e of engines) e.start();

// Snapshot every 10 minutes
const snapshotInterval = setInterval(() => {
  let totalTrades = 0, totalVolume = 0, totalErrors = 0;
  for (const e of engines) {
    const s = e.getState();
    totalTrades  += s.metrics.totalTrades;
    totalVolume  += s.metrics.totalVolume;
    totalErrors  += s.metrics.totalErrors;
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const tps = (totalTrades / (elapsed || 1)).toFixed(1);
  const line = `[${elapsed}s] Trades: ${totalTrades} | Vol: $${totalVolume.toFixed(0)} | TPS: ${tps} | Errors: ${totalErrors}`;
  console.log(line);
  try { appendFileSync(LOG, line + '\n'); } catch {}
}, 600_000);

// Also log every 60s for closer monitoring
const quickInterval = setInterval(() => {
  let totalTrades = 0, totalVolume = 0, totalErrors = 0;
  for (const e of engines) {
    const s = e.getState();
    totalTrades  += s.metrics.totalTrades;
    totalVolume  += s.metrics.totalVolume;
    totalErrors  += s.metrics.totalErrors;
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const tps = (totalTrades / (elapsed || 1)).toFixed(1);
  console.log(`  [${elapsed}s] trades=${totalTrades} vol=$${(totalVolume/1e6).toFixed(1)}M tps=${tps} err=${totalErrors}`);
}, 60_000);

// Run
await new Promise(r => setTimeout(r, DURATION * 1000));

clearInterval(snapshotInterval);
clearInterval(quickInterval);
for (const e of engines) e.stop();

// Aggregate final stats
let totalTrades = 0, totalVolume = 0, totalErrors = 0;
let allBots = [];
for (const e of engines) {
  const s = e.getState();
  totalTrades  += s.metrics.totalTrades;
  totalVolume  += s.metrics.totalVolume;
  totalErrors  += s.metrics.totalErrors;
  allBots.push(...s.bots);
}
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const finalTps = (totalTrades / (elapsed || 1)).toFixed(1);

log(`\n${'═'.repeat(72)}`);
log(`  PRESSURE TEST RESULTS — ${elapsed}s, ${BOT_COUNT} bots, ${ENGINE_COUNT} engines`);
log(`${'═'.repeat(72)}`);
log(`  Total Trades:   ${totalTrades}`);
log(`  Total Volume:   $${totalVolume.toFixed(2)}`);
log(`  Total Errors:   ${totalErrors}`);
log(`  Avg TPS:        ${finalTps}`);
log(`  Tick interval:  ${TICK_MS}ms`);
log(`  Engines:        ${ENGINE_COUNT}`);

// Per-strategy breakdown
log(`\n${'─'.repeat(72)}`);
log(`  STRATEGY BREAKDOWN`);
log(`${'─'.repeat(72)}`);
for (const key of strategyKeys) {
  const bots = allBots.filter(b => b.strategy === key);
  const trades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const avgPnl = bots.reduce((s, b) => s + b.pnl, 0) / (bots.length || 1);
  log(`  ${STRATEGIES[key].name.padEnd(16)} ${bots.length} bots | ${trades} trades | avg PnL: $${avgPnl.toFixed(2)}`);
}

// Aggregate
const totalPnl = allBots.reduce((s, b) => s + b.pnl, 0);
const profitable = allBots.filter(b => b.pnl > 0).length;

log(`\n${'─'.repeat(72)}`);
log(`  AGGREGATE`);
log(`${'─'.repeat(72)}`);
log(`  Profitable:     ${profitable}/${BOT_COUNT} (${((profitable / BOT_COUNT) * 100).toFixed(1)}%)`);
log(`  Aggregate PnL:  $${totalPnl.toFixed(2)}`);
log(`  Aggregate ROI:   ${((totalPnl / (BOT_COUNT * 10000)) * 100).toFixed(2)}%`);
log(`\n${'═'.repeat(72)}`);
log(`  Completed: ${new Date().toISOString()}`);
log(`${'═'.repeat(72)}`);

writeFileSync(LOG, lines.join('\n') + '\n');
console.log(`\nResults written to: ${LOG}`);
