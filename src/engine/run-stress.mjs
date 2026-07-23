/**
 * Headless stress test runner — configurable via env vars.
 * Env: BOT_COUNT (default 200), DURATION_SEC (default 10800 = 3h), TICK_MS (default 100)
 * Results written to stdout AND /workspace/tradeflow/src/engine/stress-results.txt
 */
import { SimulationEngine } from './simulationEngine.js';
import { STRATEGIES } from './strategies.js';
import { writeFileSync, appendFileSync } from 'fs';

const BOT_COUNT = parseInt(process.env.BOT_COUNT || '200', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '10800', 10);
const TICK_MS = parseInt(process.env.TICK_MS || '100', 10);
const LOG_FILE = '/workspace/tradeflow/src/engine/stress-results.txt';

const storeActions = { addDemoTrade: () => {}, addTrade: () => {} };
const coins = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT', 'PAX'];
const strategyKeys = Object.keys(STRATEGIES);

const lines = [];
function log(msg) {
  lines.push(msg);
  console.log(msg);
}

log(`╔══════════════════════════════════════════════════════════╗`);
log(`║    STRESS TEST: ${BOT_COUNT} BOTS × ${DURATION_SEC}s (${(DURATION_SEC/3600).toFixed(1)}h)           ║`);
log(`╚══════════════════════════════════════════════════════════╝`);
log(``);
log(`Tick interval: ${TICK_MS}ms | Strategies: ${strategyKeys.length} | Coins: ${coins.length}`);
log(`Starting balance per bot: $10,000`);
log(``);

const engine = new SimulationEngine(storeActions, {
  coins,
  tickIntervalMs: TICK_MS,
  startingBalance: 10000,
});

// Spread bots across strategies and coins evenly
for (let i = 0; i < BOT_COUNT; i++) {
  const strategy = strategyKeys[i % strategyKeys.length];
  const coin = coins[i % coins.length];
  engine.addBot({
    strategy,
    coin,
    name: `${STRATEGIES[strategy].name} ${coin} #${Math.floor(i / strategyKeys.length) + 1}`,
    balance: 10000,
  });
}

log(`Spawned ${BOT_COUNT} bots. Running...`);

// Write initial file so the user can see it's running
writeFileSync(LOG_FILE, lines.join('\n') + '\n\n(simulation in progress...)\n');

engine.start();
const startTime = Date.now();

// Periodic log flush every 60s
const snapshotInterval = setInterval(() => {
  const state = engine.getState();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const line = `[${elapsed}s] Ticks: ${state.tickCount} | Trades: ${state.metrics.totalTrades} | Vol: $${state.metrics.totalVolume.toFixed(0)} | TPS: ${state.metrics.tradesPerSecond} | Errors: ${state.metrics.totalErrors}`;
  console.log(line);
  // Append snapshot to log file
  try {
    appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}, 60000);

// Run for DURATION_SEC
await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

clearInterval(snapshotInterval);
engine.stop();

const finalState = engine.getState();
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// ─── FINAL RESULTS ───
log(`\n${'═'.repeat(72)}`);
log(`  STRESS TEST RESULTS — ${elapsed}s runtime, ${BOT_COUNT} bots`);
log(`${'═'.repeat(72)}`);
log(``);
log(`  Total Ticks:    ${finalState.tickCount}`);
log(`  Total Trades:   ${finalState.metrics.totalTrades}`);
log(`  Total Volume:   $${finalState.metrics.totalVolume.toFixed(2)}`);
log(`  Total Errors:   ${finalState.metrics.totalErrors}`);
log(`  Final TPS:      ${finalState.metrics.tradesPerSecond}`);

// Per-strategy summary
log(`\n${'─'.repeat(72)}`);
log(`  STRATEGY BREAKDOWN`);
log(`${'─'.repeat(72)}`);
log(`  ${'Strategy'.padEnd(16)} ${'Bots'.padStart(5)} ${'Trades'.padStart(8)} ${'Volume'.padStart(14)} ${'Avg PnL'.padStart(12)} ${'Best PnL'.padStart(12)} ${'Worst'.padStart(12)}`);
log(`  ${'─'.repeat(72)}`);

for (const key of strategyKeys) {
  const stratBots = finalState.bots.filter(b => b.strategy === key);
  const trades = stratBots.reduce((s, b) => s + b.tradeCount, 0);
  const vol = stratBots.reduce((s, b) => s + (b.totalValue - b.balance + b.holdingsValue), 0);
  const avgPnl = stratBots.reduce((s, b) => s + b.pnl, 0) / (stratBots.length || 1);
  const bestPnl = Math.max(...stratBots.map(b => b.pnl));
  const worstPnl = Math.min(...stratBots.map(b => b.pnl));

  log(`  ${STRATEGIES[key].name.padEnd(16)} ${String(stratBots.length).padStart(5)} ${String(trades).padStart(8)} $${(vol).toFixed(0).padStart(12)} $${avgPnl.toFixed(2).padStart(10)} $${bestPnl.toFixed(2).padStart(10)} $${worstPnl.toFixed(2).padStart(10)}`);
}

// Top 10 and bottom 10
const sorted = [...finalState.bots].sort((a, b) => b.pnl - a.pnl);

log(`\n${'─'.repeat(72)}`);
log(`  TOP 10 BOTS (by PnL)`);
log(`${'─'.repeat(72)}`);
for (const b of sorted.slice(0, 10)) {
  const roi = ((b.pnl / b.invested) * 100).toFixed(1);
  log(`  ${b.name.padEnd(35)} PnL: $${b.pnl.toFixed(2).padStart(12)} (${roi}%) | ${b.tradeCount} trades | WR: ${b.winRate}%`);
}

log(`\n${'─'.repeat(72)}`);
log(`  BOTTOM 10 BOTS (by PnL)`);
log(`${'─'.repeat(72)}`);
for (const b of sorted.slice(-10).reverse()) {
  const roi = ((b.pnl / b.invested) * 100).toFixed(1);
  log(`  ${b.name.padEnd(35)} PnL: $${b.pnl.toFixed(2).padStart(12)} (${roi}%) | ${b.tradeCount} trades | WR: ${b.winRate}%`);
}

// Aggregate stats
const totalPnl = sorted.reduce((s, b) => s + b.pnl, 0);
const profitable = sorted.filter(b => b.pnl > 0).length;
const totalTrades = sorted.reduce((s, b) => s + b.tradeCount, 0);
const totalBalance = sorted.reduce((s, b) => s + b.balance, 0);
const totalHoldingsValue = sorted.reduce((s, b) => s + b.holdingsValue, 0);

log(`\n${'─'.repeat(72)}`);
log(`  AGGREGATE`);
log(`${'─'.repeat(72)}`);
log(`  Profitable bots:    ${profitable}/${BOT_COUNT} (${((profitable/BOT_COUNT)*100).toFixed(1)}%)`);
log(`  Aggregate PnL:      $${totalPnl.toFixed(2)}`);
log(`  Aggregate ROI:      ${((totalPnl / (BOT_COUNT * 10000)) * 100).toFixed(2)}%`);
log(`  Total trades:       ${totalTrades}`);
log(`  Avg trades/bot:     ${(totalTrades / BOT_COUNT).toFixed(1)}`);
log(`  Total cash:         $${totalBalance.toFixed(2)}`);
log(`  Total holdings:     $${totalHoldingsValue.toFixed(2)}`);

// Price snapshot
log(`\n${'─'.repeat(72)}`);
log(`  FINAL PRICES`);
log(`${'─'.repeat(72)}`);
for (const [sym, data] of Object.entries(finalState.prices)) {
  const arrow = data.changePct >= 0 ? '▲' : '▼';
  log(`  ${sym.padEnd(6)} $${data.price.toFixed(2).padStart(12)}  ${arrow} ${Math.abs(data.changePct).toFixed(3)}%`);
}

log(`\n${'═'.repeat(72)}`);
log(`  Completed: ${new Date().toISOString()}`);
log(`${'═'.repeat(72)}`);

// Write final results to file
writeFileSync(LOG_FILE, lines.join('\n') + '\n');
console.log(`\nResults written to: ${LOG_FILE}`);
