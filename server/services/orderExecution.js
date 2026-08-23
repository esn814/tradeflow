import { randomBytes } from 'crypto';
import { getDb } from '../db.js';

export const ORDER_STATES = Object.freeze({
  REQUESTED: 'requested',
  SUBMITTED: 'submitted',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',
  CANCELED: 'canceled',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  UNKNOWN: 'unknown',
});

const TERMINAL_STATES = new Set([
  ORDER_STATES.FILLED,
  ORDER_STATES.CANCELED,
  ORDER_STATES.REJECTED,
  ORDER_STATES.EXPIRED,
]);

function json(value) {
  try { return JSON.stringify(value ?? null); } catch { return null; }
}

function normalizeStatus(order) {
  const status = String(order?.status || '').toUpperCase();
  const executed = Number(order?.executedQty || 0);
  if (status === 'FILLED') return ORDER_STATES.FILLED;
  if (status === 'CANCELED') return ORDER_STATES.CANCELED;
  if (status === 'REJECTED') return ORDER_STATES.REJECTED;
  if (status === 'EXPIRED') return ORDER_STATES.EXPIRED;
  if (executed > 0) return ORDER_STATES.PARTIALLY_FILLED;
  if (status === 'NEW' || status === 'PENDING_NEW') return ORDER_STATES.SUBMITTED;
  return ORDER_STATES.UNKNOWN;
}

function updateIntent(id, patch) {
  const db = getDb();
  const fields = Object.keys(patch);
  if (!fields.length) return db.prepare('SELECT * FROM order_intents WHERE id = ?').get(id);
  const values = fields.map(key => patch[key]);
  db.prepare(`UPDATE order_intents SET ${fields.map(key => `${key} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values, id);
  return db.prepare('SELECT * FROM order_intents WHERE id = ?').get(id);
}

export function createOrderIntent({ botId, userId, coin, action, amount, price, reason }) {
  if (!botId || !userId || !coin || !['buy', 'sell'].includes(action) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Invalid order intent');
  }
  const id = `oi-${Date.now()}-${randomBytes(8).toString('hex')}`;
  const clientOrderId = `tf-${String(botId).replace(/[^a-zA-Z0-9]/g, '').slice(-12)}-${Date.now()}-${randomBytes(4).toString('hex')}`.slice(0, 36);
  getDb().prepare(`
    INSERT INTO order_intents (id, bot_id, user_id, coin, action, requested_qty, requested_quote, signal_price, reason, client_order_id, remaining_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, botId, userId, coin, action, Number(amount), action === 'buy' ? Number(amount) * Number(price || 0) : null, Number(price || 0), reason || null, clientOrderId, Number(amount));
  return getDb().prepare('SELECT * FROM order_intents WHERE id = ?').get(id);
}

export function getOrderIntent(id) {
  return getDb().prepare('SELECT * FROM order_intents WHERE id = ?').get(id);
}

export function markIntentSubmitted(intent, exchangeOrder) {
  return updateIntent(intent.id, {
    status: normalizeStatus(exchangeOrder),
    exchange_order_id: exchangeOrder?.orderId?.toString() || null,
    executed_qty: Number(exchangeOrder?.executedQty || 0),
    applied_qty: 0,
    remaining_qty: Math.max(0, Number(intent.requested_qty) - Number(exchangeOrder?.executedQty || 0)),
    avg_fill_price: Number(exchangeOrder?.cummulativeQuoteQty || 0) > 0 && Number(exchangeOrder?.executedQty || 0) > 0
      ? Number(exchangeOrder.cummulativeQuoteQty) / Number(exchangeOrder.executedQty)
      : null,
    cumulative_quote: Number(exchangeOrder?.cummulativeQuoteQty || 0),
    exchange_payload: json(exchangeOrder),
    submitted_at: new Date().toISOString(),
    completed_at: TERMINAL_STATES.has(normalizeStatus(exchangeOrder)) ? new Date().toISOString() : null,
  });
}

export function markIntentError(intent, error, status = ORDER_STATES.UNKNOWN) {
  return updateIntent(intent.id, { status, last_error: error?.message || String(error), exchange_payload: json({ error: error?.message || String(error) }) });
}

export function markIntentQuantityApplied(intent, appliedQty) {
  const qty = Math.max(0, Number(appliedQty) || 0);
  return updateIntent(intent.id, { applied_qty: Math.min(Number(intent.executed_qty || 0), qty) });
}

export function applyExchangeOrder(intent, exchangeOrder) {
  const status = normalizeStatus(exchangeOrder);
  const executedQty = Number(exchangeOrder?.executedQty || 0);
  return updateIntent(intent.id, {
    status,
    exchange_order_id: exchangeOrder?.orderId?.toString() || intent.exchange_order_id || null,
    executed_qty: executedQty,
    remaining_qty: Math.max(0, Number(intent.requested_qty) - executedQty),
    avg_fill_price: Number(exchangeOrder?.cummulativeQuoteQty || 0) > 0 && executedQty > 0
      ? Number(exchangeOrder.cummulativeQuoteQty) / executedQty
      : intent.avg_fill_price,
    cumulative_quote: Number(exchangeOrder?.cummulativeQuoteQty || 0),
    exchange_payload: json(exchangeOrder),
    last_reconciled_at: new Date().toISOString(),
    completed_at: TERMINAL_STATES.has(status) ? new Date().toISOString() : intent.completed_at,
  });
}

export function listReconciliationCandidates(botId) {
  return getDb().prepare(`
    SELECT * FROM order_intents
    WHERE bot_id = ? AND status IN ('requested', 'submitted', 'partially_filled', 'unknown')
    ORDER BY created_at ASC
  `).all(botId);
}

export function isTerminalStatus(status) { return TERMINAL_STATES.has(status); }
export { normalizeStatus };
