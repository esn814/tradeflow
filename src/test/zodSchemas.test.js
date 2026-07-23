import { describe, it, expect } from 'vitest';
import {
  createBotSchema,
  updateBotSchema,
  createTradeSchema,
  createAlertSchema,
  updateAlertSchema,
  createStrategySchema,
  updateStrategySchema,
  updateSettingsSchema,
} from '../../server/schemas.js';

// Vitest runs in the frontend root; server schemas use ESM — we import directly.
// These tests validate the Zod schemas catch bad input before it hits the DB.

describe('createBotSchema', () => {
  it('accepts valid bot input', () => {
    const result = createBotSchema.safeParse({
      name: 'BTC DCA Bot',
      type: 'DCA',
      coin: 'BTC',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createBotSchema.safeParse({ type: 'DCA', coin: 'BTC' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('name');
  });

  it('rejects empty name', () => {
    const result = createBotSchema.safeParse({ name: '', type: 'DCA', coin: 'BTC' });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding 200 chars', () => {
    const result = createBotSchema.safeParse({ name: 'x'.repeat(201), type: 'DCA', coin: 'BTC' });
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const result = createBotSchema.safeParse({ name: 'Test', type: 'DCA', coin: 'BTC' });
    expect(result.success).toBe(true);
    expect(result.data.strategy).toBeUndefined();
  });
});

describe('updateBotSchema', () => {
  it('accepts partial update', () => {
    const result = updateBotSchema.safeParse({ name: 'Updated Bot' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no-op update)', () => {
    const result = updateBotSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateBotSchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    for (const status of ['active', 'paused', 'stopped']) {
      expect(updateBotSchema.safeParse({ status }).success).toBe(true);
    }
  });
});

describe('createTradeSchema', () => {
  it('accepts valid trade', () => {
    const result = createTradeSchema.safeParse({
      pair: 'BTC/USDT',
      side: 'buy',
      price: 65000,
      qty: 0.1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing pair', () => {
    const result = createTradeSchema.safeParse({ side: 'buy', price: 65000, qty: 0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid side', () => {
    const result = createTradeSchema.safeParse({ pair: 'BTC/USDT', side: 'hold', price: 65000, qty: 0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = createTradeSchema.safeParse({ pair: 'BTC/USDT', side: 'buy', price: -1, qty: 0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects zero qty', () => {
    const result = createTradeSchema.safeParse({ pair: 'BTC/USDT', side: 'buy', price: 65000, qty: 0 });
    expect(result.success).toBe(false);
  });
});

describe('createAlertSchema', () => {
  it('accepts valid alert', () => {
    const result = createAlertSchema.safeParse({
      type: 'price',
      asset: 'BTC',
      condition: 'above',
      value: 70000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = createAlertSchema.safeParse({ type: 'invalid', asset: 'BTC', condition: 'above' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid types', () => {
    for (const type of ['price', 'bot', 'portfolio', 'custom']) {
      expect(createAlertSchema.safeParse({ type, asset: 'BTC', condition: 'above' }).success).toBe(true);
    }
  });
});

describe('createStrategySchema', () => {
  it('accepts valid strategy', () => {
    const result = createStrategySchema.safeParse({
      name: 'My DCA Strategy',
      description: 'Dollar cost averaging into BTC',
      strategyType: 'dca',
      riskLevel: 'moderate',
      tags: ['dca', 'btc'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createStrategySchema.safeParse({ description: 'test' });
    expect(result.success).toBe(false);
  });

  it('accepts string tags (not just array)', () => {
    const result = createStrategySchema.safeParse({ name: 'Test', tags: 'dca, btc' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid riskLevel', () => {
    const result = createStrategySchema.safeParse({ name: 'Test', riskLevel: 'extreme' });
    expect(result.success).toBe(false);
  });
});

describe('updateSettingsSchema', () => {
  it('accepts valid settings update', () => {
    const result = updateSettingsSchema.safeParse({
      riskTolerance: 'aggressive',
      notifications: false,
      darkMode: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid riskTolerance', () => {
    const result = updateSettingsSchema.safeParse({ riskTolerance: 'yolo' });
    expect(result.success).toBe(false);
  });

  it('accepts empty object (no-op)', () => {
    const result = updateSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
