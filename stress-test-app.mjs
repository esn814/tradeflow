#!/usr/bin/env node
/**
 * Tradeflow HARD STRESS TEST
 * Tests the live deployed app with concurrent browser sessions,
 * rapid page navigation, heavy UI interaction, and memory monitoring.
 *
 * Run: node stress-test-app.mjs
 */
import { chromium } from 'playwright';

const APP_URL = 'https://tradeflow.cloud.hyperpaxeer.com';
const PAGES = [
  '/', '/dashboard', '/strategies', '/backtester', '/analytics',
  '/connections', '/copy-trading', '/risk-manager', '/alerts',
  '/scheduler', '/settings', '/automated-trading', '/autopilot',
  '/bridge', '/cross-chain-arbitrage', '/cross-dex-arbitrage',
  '/my-bots', '/invest', '/pricing', '/help', '/security', '/referrals',
];
const RESULTS = { errors: [], warnings: [], timings: [], memorySnapshots: [], navigationErrors: [] };

// ─── HELPERS ───
function now() { return Date.now(); }
function fmt(ms) { return `${ms.toFixed(0)}ms`; }
function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

// ─── TEST 1: RAPID PAGE NAVIGATION (sequential through all pages, 3 rounds) ───
async function testRapidNavigation(browser) {
  log('TEST 1: Rapid page navigation — 3 rounds through all pages');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const timings = [];

  page.on('pageerror', err => RESULTS.errors.push({ test: 'navigation', msg: err.message }));
  page.on('console', msg => {
    if (msg.type() === 'error') RESULTS.errors.push({ test: 'navigation', msg: msg.text() });
    if (msg.type() === 'warning') RESULTS.warnings.push({ test: 'navigation', msg: msg.text() });
  });

  for (let round = 1; round <= 3; round++) {
    for (const path of PAGES) {
      const t0 = now();
      try {
        await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const elapsed = now() - t0;
        timings.push({ round, path, ms: elapsed });
      } catch (e) {
        RESULTS.navigationErrors.push({ round, path, error: e.message });
        timings.push({ round, path, ms: now() - t0, error: true });
      }
    }
  }
  await ctx.close();
  RESULTS.timings.push(...timings);

  const avg = timings.reduce((s, t) => s + t.ms, 0) / timings.length;
  const max = Math.max(...timings.map(t => t.ms));
  const failed = timings.filter(t => t.error).length;
  log(`  → ${timings.length} navigations, avg=${fmt(avg)}, max=${fmt(max)}, failed=${failed}`);
}

// ─── TEST 2: CONCURRENT SESSIONS (5 parallel browser contexts) ───
async function testConcurrentSessions(browser) {
  log('TEST 2: Concurrent sessions — 5 parallel contexts, each hitting 5 pages');
  const ctxCount = 5;
  const pagesPerCtx = 5;
  const allTimings = [];

  const tasks = Array.from({ length: ctxCount }, async (_, i) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const localTimings = [];

    page.on('pageerror', err => RESULTS.errors.push({ test: `concurrent-${i}`, msg: err.message }));

    const subset = PAGES.slice(i * pagesPerCtx, (i + 1) * pagesPerCtx);
    if (subset.length === 0) return [];

    for (let round = 0; round < 3; round++) {
      for (const path of subset) {
        const t0 = now();
        try {
          await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          localTimings.push({ ctx: i, round, path, ms: now() - t0 });
        } catch (e) {
          localTimings.push({ ctx: i, round, path, ms: now() - t0, error: true });
          RESULTS.navigationErrors.push({ test: 'concurrent', ctx: i, path, error: e.message });
        }
      }
    }
    await ctx.close();
    return localTimings;
  });

  const results = await Promise.all(tasks);
  for (const timings of results) allTimings.push(...timings);
  RESULTS.timings.push(...allTimings);

  const avg = allTimings.reduce((s, t) => s + t.ms, 0) / allTimings.length;
  const max = Math.max(...allTimings.map(t => t.ms));
  const failed = allTimings.filter(t => t.error).length;
  log(`  → ${allTimings.length} concurrent navigations, avg=${fmt(avg)}, max=${fmt(max)}, failed=${failed}`);
}

// ─── TEST 3: TRADING UI INTERACTION STRESS ───
async function testTradingInteraction(browser) {
  log('TEST 3: Trading UI interaction stress — rapid clicks, form fills, tab switches');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];

  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Load dashboard
  await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Try clicking various interactive elements rapidly
  const clickTargets = [
    'button', 'a[href]', '[role="tab"]', '[role="button"]',
    'input', 'select', '[data-testid]',
  ];

  let totalClicks = 0;
  for (let round = 0; round < 10; round++) {
    for (const selector of clickTargets) {
      try {
        const elements = await page.$$(selector);
        for (let i = 0; i < Math.min(elements.length, 3); i++) {
          try {
            await elements[i].click({ timeout: 1000 });
            totalClicks++;
          } catch {}
        }
      } catch {}
    }
    // Navigate to a random page between click rounds
    const randomPath = PAGES[Math.floor(Math.random() * PAGES.length)];
    try {
      await page.goto(`${APP_URL}${randomPath}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch {}
  }

  await ctx.close();
  log(`  → ${totalClicks} clicks executed, ${errors.length} JS errors captured`);
  RESULTS.errors.push(...errors.map(msg => ({ test: 'interaction', msg })));
}

// ─── TEST 4: MEMORY SNAPSHOT (check for leaks) ───
async function testMemoryUsage(browser) {
  log('TEST 4: Memory monitoring — 5 page loads with JS heap measurement');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (let i = 0; i < 5; i++) {
    const path = PAGES[i % PAGES.length];
    await page.goto(`${APP_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    const mem = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    }).catch(() => null);

    if (mem) {
      RESULTS.memorySnapshots.push({ page: path, ...mem });
    }
  }

  await ctx.close();
  if (RESULTS.memorySnapshots.length > 0) {
    const heaps = RESULTS.memorySnapshots.map(m => m.usedJSHeapSize / 1024 / 1024);
    log(`  → Heap: min=${heaps[0]?.toFixed(1)}MB, max=${Math.max(...heaps).toFixed(1)}MB across ${RESULTS.memorySnapshots.length} snapshots`);
  } else {
    log('  → performance.memory not available in this browser context');
  }
}

// ─── TEST 5: RAPID RELOAD STRESS ───
async function testRapidReload(browser) {
  log('TEST 5: Rapid reload stress — 20 fast reloads on dashboard');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const timings = [];
  let errors = 0;

  page.on('pageerror', () => errors++);

  await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  for (let i = 0; i < 20; i++) {
    const t0 = now();
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
      timings.push(now() - t0);
    } catch {
      timings.push(now() - t0);
    }
  }

  await ctx.close();
  const avg = timings.reduce((s, t) => s + t, 0) / timings.length;
  log(`  → 20 reloads, avg=${fmt(avg)}, max=${fmt(Math.max(...timings))}, errors=${errors}`);
}

// ─── MAIN ───
async function main() {
  log('╔══════════════════════════════════════════════════════════╗');
  log('║     TRADEFLOW HARD STRESS TEST — LIVE APP              ║');
  log('╚══════════════════════════════════════════════════════════╝');
  log(`Target: ${APP_URL}`);
  log(`Pages: ${PAGES.length} routes`);
  log('');

  const browser = await chromium.launch({ headless: true });
  const startAll = now();

  await testRapidNavigation(browser);
  await testConcurrentSessions(browser);
  await testTradingInteraction(browser);
  await testMemoryUsage(browser);
  await testRapidReload(browser);

  await browser.close();
  const totalElapsed = ((now() - startAll) / 1000).toFixed(1);

  // ─── FINAL REPORT ───
  log('');
  log('═'.repeat(60));
  log('  STRESS TEST RESULTS');
  log('═'.repeat(60));
  log(`  Total time:          ${totalElapsed}s`);
  log(`  Total navigations:   ${RESULTS.timings.length}`);
  log(`  JS errors:           ${RESULTS.errors.length}`);
  log(`  JS warnings:         ${RESULTS.warnings.length}`);
  log(`  Nav failures:        ${RESULTS.navigationErrors.length}`);
  log(`  Memory snapshots:    ${RESULTS.memorySnapshots.length}`);

  if (RESULTS.timings.length > 0) {
    const allMs = RESULTS.timings.map(t => t.ms);
    const avg = allMs.reduce((s, v) => s + v, 0) / allMs.length;
    const p50 = allMs.sort((a, b) => a - b)[Math.floor(allMs.length * 0.5)];
    const p95 = allMs[Math.floor(allMs.length * 0.95)];
    const p99 = allMs[Math.floor(allMs.length * 0.99)];
    log('');
    log('  NAVIGATION TIMING');
    log(`    Avg:  ${fmt(avg)}`);
    log(`    P50:  ${fmt(p50)}`);
    log(`    P95:  ${fmt(p95)}`);
    log(`    P99:  ${fmt(p99)}`);
    log(`    Max:  ${fmt(Math.max(...RESULTS.timings.map(t => t.ms)))}`);
    log(`    Min:  ${fmt(Math.min(...RESULTS.timings.map(t => t.ms)))}`);
  }

  if (RESULTS.errors.length > 0) {
    log('');
    log('  JS ERRORS (unique):');
    const unique = [...new Set(RESULTS.errors.map(e => e.msg))];
    for (const msg of unique.slice(0, 10)) {
      log(`    • ${msg.slice(0, 120)}`);
    }
    if (unique.length > 10) log(`    ... and ${unique.length - 10} more`);
  }

  if (RESULTS.navigationErrors.length > 0) {
    log('');
    log('  NAVIGATION FAILURES:');
    for (const e of RESULTS.navigationErrors.slice(0, 5)) {
      log(`    • ${e.path || e.test}: ${e.error?.slice(0, 100)}`);
    }
  }

  if (RESULTS.memorySnapshots.length > 0) {
    log('');
    log('  MEMORY (JS Heap):');
    for (const m of RESULTS.memorySnapshots) {
      log(`    ${m.page.padEnd(20)} ${(m.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB / ${(m.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
    }
  }

  // Verdict
  log('');
  const errorRate = RESULTS.errors.length / (RESULTS.timings.length || 1);
  const navFailRate = RESULTS.navigationErrors.length / (RESULTS.timings.length || 1);
  if (errorRate === 0 && navFailRate === 0) {
    log('  VERDICT: ✅ PASS — No errors, no navigation failures');
  } else if (errorRate < 0.05 && navFailRate < 0.05) {
    log(`  VERDICT: ⚠️ WARN — Low error rate (${(errorRate*100).toFixed(1)}%)`);
  } else {
    log(`  VERDICT: ❌ FAIL — Error rate ${(errorRate*100).toFixed(1)}%, nav failures ${(navFailRate*100).toFixed(1)}%`);
  }
  log('═'.repeat(60));

  // Write results to file
  const report = JSON.stringify({
    timestamp: new Date().toISOString(),
    totalSeconds: parseFloat(totalElapsed),
    totalNavigations: RESULTS.timings.length,
    jsErrors: RESULTS.errors.length,
    navFailures: RESULTS.navigationErrors.length,
    uniqueJSErrors: [...new Set(RESULTS.errors.map(e => e.msg))],
    timings: RESULTS.timings,
    memory: RESULTS.memorySnapshots,
  }, null, 2);

  const { writeFileSync } = await import('fs');
  writeFileSync('/data/workspace/tradeflow/src/engine/app-stress-results.json', report);
  log('Results written to app-stress-results.json');
}

main().catch(e => {
  console.error('Stress test crashed:', e.message);
  process.exit(1);
});
