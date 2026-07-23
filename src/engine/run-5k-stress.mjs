#!/usr/bin/env node
/**
 * 5,000 BOT × 30-MINUTE STRESS TEST — SIMULATED PRICES
 *
 * Uses geometric Brownian motion price simulation (realistic market behavior,
 * zero external network load). All trades are simulated (fake money).
 *
 * Env overrides: BOT_COUNT, DURATION_SEC, TICK_MS
 */

import { SimulationEngine } from './simulationEngine.js';
import { STRATEGIES } from './strategies.js';
import { writeFileSync, appendFileSync } from 'fs';

const BOT_COUNT = parseInt(process.env.BOT_COUNT || '5000', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '1800', 10);
const TICK_MS = parseInt(process.env.TICK_MS || '100', 10);
const LOG_FILE = '/workspace/tradeflow/src/engine/5k-stress-results.txt';
const JSON_FILE = '/workspace/tradeflow/src/engine/5k-stress-results.json';

const storeActions = { addDemoTrade: () => {}, addTrade: () => {} };
const coins = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'DOT', 'PAX'];
const strategyKeys = Object.keys(STRATEGIES);

const lines = [];
function log(msg) { lines.push(msg); console.log(msg); }

log(`╔══════════════════════════════════════════════════════════════════╗`);
log(`║  HARD STRESS TEST: ${BOT_COUNT} BOTS × ${DURATION_SEC}s (${(DURATION_SEC/60).toFixed(0)} min)              ║`);
log(`║  Simulated prices (Brownian motion) — zero network load        ║`);
log(`╚══════════════════════════════════════════════════════════════════╝`);
log(``);
log(`Tick interval: ${TICK_MS}ms | Strategies: ${strategyKeys.length} | Coins: ${coins.length}`);
log(`Starting balance per bot: $10,000 | Total capital: $${(BOT_COUNT * 10000).toLocaleString()}`);
log(`Mode: useSimulator=TRUE → PriceSimulator (Brownian motion)`);
log(``);

const engine = new SimulationEngine(storeActions, {
  coins,
  tickIntervalMs: TICK_MS,
  startingBalance: 10000,
  useSimulator: true,
});

for (let i = 0; i < BOT_COUNT; i++) {
  const strategy = strategyKeys[i % strategyKeys.length];
  const coin = coins[i % coins.length];
  engine.addBot({
    strategy, coin,
    name: `${STRATEGIES[strategy].name} ${coin} #${Math.floor(i / strategyKeys.length) + 1}`,
    balance: 10000,
  });
}

log(`✓ Spawned ${BOT_COUNT} bots. Running...`);
log(``);
writeFileSync(LOG_FILE, lines.join('\n') + '\n\n(simulation in progress...)\n');

engine.start();
const startTime = Date.now();

// Snapshots every 60s
const snapshotInterval = setInterval(() => {
  const state = engine.getState();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const line = `[${elapsed}s] Ticks: ${state.tickCount} | Trades: ${state.metrics.totalTrades} | Vol: $${(state.metrics.totalVolume/1e6).toFixed(1)}M | TPS: ${state.metrics.tradesPerSecond} | Errors: ${state.metrics.totalErrors}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
}, 60000);

await new Promise(r => setTimeout(r, DURATION_SEC * 1000));

clearInterval(snapshotInterval);
engine.stop();

const finalState = engine.getState();
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

log(`\n${'═'.repeat(72)}`);
log(`  STRESS TEST RESULTS — ${elapsed}s runtime, ${BOT_COUNT} bots`);
log(`${'═'.repeat(72)}`);
log(``);
log(`  Total Ticks:    ${finalState.tickCount}`);
log(`  Total Trades:   ${finalState.metrics.totalTrades.toLocaleString()}`);
log(`  Total Volume:   $${finalState.metrics.totalVolume.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
log(`  Total Errors:   ${finalState.metrics.totalErrors}`);
log(`  Final TPS:      ${finalState.metrics.tradesPerSecond}`);

log(`\n${'─'.repeat(72)}`);
log(`  STRATEGY BREAKDOWN`);
log(`${'─'.repeat(72)}`);
log(`  ${'Strategy'.padEnd(16)} ${'Bots'.padStart(6)} ${'Trades'.padStart(10)} ${'Volume'.padStart(16)} ${'Avg PnL'.padStart(14)} ${'Best PnL'.padStart(14)} ${'Worst'.padStart(14)}`);
log(`  ${'─'.repeat(72)}`);

for (const key of strategyKeys) {
  const sb = finalState.bots.filter(b => b.strategy === key);
  const trades = sb.reduce((s, b) => s + b.tradeCount, 0);
  const vol = sb.reduce((s, b) => s + (b.totalValue - b.balance + b.holdingsValue), 0);
  const avgPnl = sb.reduce((s, b) => s + b.pnl, 0) / (sb.length || 1);
  const bestPnl = Math.max(...sb.map(b => b.pnl));
  const worstPnl = Math.min(...sb.map(b => b.pnl));
  log(`  ${STRATEGIES[key].name.padEnd(16)} ${String(sb.length).padStart(6)} ${String(trades).padStart(10)} $${vol.toFixed(0).padStart(14)} $${avgPnl.toFixed(2).padStart(12)} $${bestPnl.toFixed(2).padStart(12)} $${worstPnl.toFixed(2).padStart(12)}`);
}

const sorted = [...finalState.bots].sort((a, b) => b.pnl - a.pnl);

log(`\n  TOP 10 BOTS (by PnL)`);
log(`${'─'.repeat(72)}`);
for (const b of sorted.slice(0, 10)) {
  const roi = b.invested > 0 ? ((b.pnl / b.invested) * 100).toFixed(1) : '0.0';
  log(`  ${b.name.padEnd(35)} PnL: $${b.pnl.toFixed(2).padStart(12)} (${roi}%) | ${b.tradeCount} trades | WR: ${b.winRate}%`);
}

log(`\n  BOTTOM 10 BOTS (by PnL)`);
log(`${'─'.repeat(72)}`);
for (const b of sorted.slice(-10).reverse()) {
  const roi = b.invested > 0 ? ((b.pnl / b.invested) * 100).toFixed(1) : '0.0';
  log(`  ${b.name.padEnd(35)} PnL: $${b.pnl.toFixed(2).padStart(12)} (${roi}%) | ${b.tradeCount} trades | WR: ${b.winRate}%`);
}

const totalPnl = sorted.reduce((s, b) => s + b.pnl, 0);
const profitable = sorted.filter(b => b.pnl > 0).length;
const totalTrades = sorted.reduce((s, b) => s + b.tradeCount, 0);
const totalBalance = sorted.reduce((s, b) => s + b.balance, 0);
const totalHoldingsValue = sorted.reduce((s, b) => s + b.holdingsValue, 0);

log(`\n${'─'.repeat(72)}`);
log(`  AGGREGATE`);
log(`${'─'.repeat(72)}`);
log(`  Profitable bots:    ${profitable}/${BOT_COUNT} (${((profitable/BOT_COUNT)*100).toFixed(1)}%)`);
log(`  Aggregate PnL:      $${totalPnl.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
log(`  Aggregate ROI:      ${((totalPnl / (BOT_COUNT * 10000)) * 100).toFixed(2)}%`);
log(`  Total trades:       ${totalTrades.toLocaleString()}`);
log(`  Avg trades/bot:     ${(totalTrades / BOT_COUNT).toFixed(1)}`);
log(`  Total cash:         $${totalBalance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
log(`  Total holdings:     $${totalHoldingsValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);

log(`\n  FINAL PRICES`);
log(`${'─'.repeat(72)}`);
for (const [sym, data] of Object.entries(finalState.prices)) {
  const arrow = data.changePct >= 0 ? '▲' : '▼';
  log(`  ${sym.padEnd(6)} $${data.price.toFixed(2).padStart(12)}  ${arrow} ${Math.abs(data.changePct).toFixed(3)}%`);
}

log(`\n${'═'.repeat(72)}`);
log(`  Completed: ${new Date().toISOString()}`);
log(`${'═'.repeat(72)}`);

writeFileSync(LOG_FILE, lines.join('\n') + '\n');
writeFileSync(JSON_FILE, JSON.stringify({
  timestamp: new Date().toISOString(),
  config: { botCount: BOT_COUNT, durationSec: DURATION_SEC, tickMs: TICK_MS, mode: 'SIMULATED' },
  results: {
    totalTicks: finalState.tickCount,
    totalTrades: finalState.metrics.totalTrades,
    totalVolume: finalState.metrics.totalVolume,
    totalErrors: finalState.metrics.totalErrors,
    tps: parseFloat(finalState.metrics.tradesPerSecond),
    profitableBots: profitable,
    aggregatePnl: totalPnl,
    aggregateRoi: (totalPnl / (BOT_COUNT * 10000)) * 100,
    avgTradesPerBot: totalTrades / BOT_COUNT,
  },
}, null, 2));

console.log(`\nResults → ${LOG_FILE}`);
console.log(`JSON    → ${JSON_FILE}`);
