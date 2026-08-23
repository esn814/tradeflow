import { describe, it, expect, beforeAll } from 'vitest';

process.env.DB_PATH = ':memory:';

let getDb;
let createOrderIntent;
let markIntentSubmitted;
let applyExchangeOrder;
let markIntentQuantityApplied;
let getOrderIntent;
let normalizeStatus;
let ORDER_STATES;

beforeAll(async () => {
  ({ getDb } = await import('../db.js'));
  ({ createOrderIntent, markIntentSubmitted, applyExchangeOrder, markIntentQuantityApplied, getOrderIntent, normalizeStatus, ORDER_STATES } = await import('../services/orderExecution.js'));
  const db = getDb();
  db.prepare('INSERT INTO users (id, address) VALUES (?, ?)').run(1, 'order-execution-test-user');
  db.prepare("INSERT INTO live_bots (id, user_id, name, coin, strategy) VALUES (?, ?, ?, ?, ?)").run('bot-fixture', 1, 'Fixture', 'BTCUSDT', 'test');
});

describe('order execution lifecycle', () => {
  it('creates an intent with a unique client order id', () => {
    const intent = createOrderIntent({ botId: 'bot-fixture', userId: 1, coin: 'BTCUSDT', action: 'buy', amount: 0.01, price: 50000, reason: 'test' });
    expect(intent.status).toBe(ORDER_STATES.REQUESTED);
    expect(intent.client_order_id).toMatch(/^tf-/);
    expect(intent.remaining_qty).toBeCloseTo(0.01);
  });

  it('records a filled exchange acknowledgement using actual quantities', () => {
    const intent = createOrderIntent({ botId: 'bot-fixture', userId: 1, coin: 'ETHUSDT', action: 'buy', amount: 2, price: 3000 });
    const updated = markIntentSubmitted(intent, { orderId: 42, status: 'FILLED', executedQty: '1.75', cummulativeQuoteQty: '5250' });
    expect(updated.status).toBe(ORDER_STATES.FILLED);
    expect(updated.exchange_order_id).toBe('42');
    expect(updated.executed_qty).toBeCloseTo(1.75);
    expect(updated.remaining_qty).toBeCloseTo(0.25);
    expect(updated.avg_fill_price).toBeCloseTo(3000);
  });

  it('keeps partial fills unresolved until reconciliation completes', () => {
    const intent = createOrderIntent({ botId: 'bot-fixture', userId: 1, coin: 'BTCUSDT', action: 'sell', amount: 1, price: 50000 });
    const partial = markIntentSubmitted(intent, { orderId: 43, status: 'NEW', executedQty: '0.4', cummulativeQuoteQty: '20000' });
    expect(partial.status).toBe(ORDER_STATES.PARTIALLY_FILLED);
    const filled = applyExchangeOrder(partial, { orderId: 43, status: 'FILLED', executedQty: '1', cummulativeQuoteQty: '50100' });
    expect(filled.status).toBe(ORDER_STATES.FILLED);
    expect(filled.remaining_qty).toBeCloseTo(0);
    expect(getOrderIntent(intent.id).last_reconciled_at).toBeTruthy();
  });

  it('tracks applied fills without allowing over-application', () => {
    const intent = createOrderIntent({ botId: 'bot-fixture', userId: 1, coin: 'BTCUSDT', action: 'buy', amount: 1, price: 50000 });
    const filled = markIntentSubmitted(intent, { orderId: 44, status: 'FILLED', executedQty: '0.75', cummulativeQuoteQty: '37500' });
    const applied = markIntentQuantityApplied(filled, 0.5);
    expect(applied.applied_qty).toBeCloseTo(0.5);
    expect(markIntentQuantityApplied(applied, 2).applied_qty).toBeCloseTo(0.75);
  });

  it('maps unknown exchange states to a fail-closed state', () => {
    expect(normalizeStatus({ status: 'SOMETHING_NEW' })).toBe(ORDER_STATES.UNKNOWN);
  });

  it('uses the memory database with migrated order intents', () => {
    expect(getDb().prepare('SELECT COUNT(*) AS count FROM order_intents').get().count).toBeGreaterThan(0);
  });
});
