import { describe, it, expect, beforeAll } from 'vitest';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-for-auto-trader-execution';

let getDb;
let BotRuntime;

beforeAll(async () => {
  ({ getDb } = await import('../db.js'));
  ({ BotRuntime } = await import('../services/autoTrader.js'));
  const db = getDb();
  db.prepare('INSERT INTO users (id, address) VALUES (?, ?)').run(1, 'autotrader-execution-test-user');
  db.prepare("INSERT INTO live_bots (id, user_id, name, coin, strategy, config, risk_config) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run('runtime-fixture', 1, 'Runtime fixture', 'BTCUSDT', 'test', '{}', '{}');
});

describe('AutoTrader execution safety', () => {
  it('does not overlap manually-triggered ticks', async () => {
    const runtime = new BotRuntime({
      id: 'runtime-fixture', user_id: 1, coin: 'BTCUSDT', strategy: 'test',
      config: '{}', risk_config: '{}', interval_ms: 60000,
    }, {}, 1);
    runtime._running = true;

    let calls = 0;
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    runtime._runTick = async () => {
      calls++;
      await blocked;
    };

    const first = runtime._tick();
    const second = runtime._tick();
    await Promise.resolve();
    expect(calls).toBe(1);
    release();
    await first;
    await second;
    expect(runtime._tickInFlight).toBe(false);
  });

  it('reconciles a timeout-after-submit and applies the fill once', async () => {
    const runtime = new BotRuntime({
      id: 'runtime-fixture', user_id: 1, coin: 'BTCUSDT', strategy: 'test',
      config: '{}', risk_config: '{}', interval_ms: 60000,
    }, {
      marketOrderQuote: async () => { throw new Error('request timed out'); },
      marketOrder: async () => { throw new Error('request timed out'); },
      getOrder: async () => ({ orderId: 9001, status: 'FILLED', executedQty: '0.2', cummulativeQuoteQty: '10000' }),
    }, 1);

    const result = await runtime._executeTrade({ action: 'buy', coin: 'BTCUSDT', amount: 0.2, reason: 'timeout test' }, 50000);
    expect(result).toBeNull();
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM order_intents WHERE bot_id = 'runtime-fixture' AND status = 'unknown'").get().count).toBe(1);

    expect((await runtime._reconcileOrders()).ok).toBe(true);
    expect(runtime.state.holdings).toBeCloseTo(0.2);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM live_trades WHERE bot_id = 'runtime-fixture'").get().count).toBe(1);

    // A repeated reconciliation response must not duplicate the fill.
    expect((await runtime._reconcileOrders()).ok).toBe(true);
    expect(runtime.state.holdings).toBeCloseTo(0.2);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM live_trades WHERE bot_id = 'runtime-fixture'").get().count).toBe(1);
  });

  it('applies a partial fill before a terminal filled response without double-counting', async () => {
    let status = { orderId: 9002, status: 'NEW', executedQty: '0.1', cummulativeQuoteQty: '5000' };
    const runtime = new BotRuntime({
      id: 'runtime-fixture', user_id: 1, coin: 'ETHUSDT', strategy: 'test',
      config: '{}', risk_config: '{}', interval_ms: 60000,
    }, { getOrder: async () => status }, 1);

    const intent = (await import('../services/orderExecution.js')).createOrderIntent({
      botId: 'runtime-fixture', userId: 1, coin: 'ETHUSDT', action: 'buy', amount: 0.2, price: 50000, reason: 'partial test',
    });
    (await import('../services/orderExecution.js')).markIntentSubmitted(intent, status);

    runtime._running = true;
    expect((await runtime._reconcileOrders()).ok).toBe(false);
    expect(runtime.state.holdings).toBeCloseTo(0.1);

    status = { orderId: 9002, status: 'FILLED', executedQty: '0.2', cummulativeQuoteQty: '10200' };
    expect((await runtime._reconcileOrders()).ok).toBe(true);
    expect(runtime.state.holdings).toBeCloseTo(0.2);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM live_trades WHERE bot_id = 'runtime-fixture' AND coin = 'ETHUSDT'").get().count).toBe(2);
  });
});
