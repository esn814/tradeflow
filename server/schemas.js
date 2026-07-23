// server/schemas.js — Zod validation schemas for all write endpoints
import { z } from 'zod';

// ── Bots ───────────────────────────────────────────────────────
export const createBotSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  coin: z.string().min(1).max(20),
  invested: z.number().nonnegative().optional(),
  currentValue: z.number().nonnegative().optional(),
  status: z.enum(['active', 'paused', 'stopped']).optional(),
  strategy: z.string().max(100).optional(),
  config: z.any().optional(),
});

export const updateBotSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(50).optional(),
  coin: z.string().min(1).max(20).optional(),
  invested: z.number().nonnegative().optional(),
  currentValue: z.number().nonnegative().optional(),
  status: z.enum(['active', 'paused', 'stopped']).optional(),
  strategy: z.string().max(100).optional(),
  config: z.any().optional(),
});

// ── Trades ─────────────────────────────────────────────────────
export const createTradeSchema = z.object({
  botId: z.string().max(100).optional(),
  pair: z.string().min(1).max(20),
  side: z.enum(['buy', 'sell']),
  price: z.number().positive(),
  qty: z.number().positive(),
  pnl: z.number().optional(),
  status: z.enum(['filled', 'partial', 'cancelled']).optional(),
  sl: z.number().positive().optional(),
  tp: z.number().positive().optional(),
  strategy: z.string().max(100).optional(),
  meta: z.any().optional(),
});

// ── Alerts ─────────────────────────────────────────────────────
export const createAlertSchema = z.object({
  type: z.enum(['price', 'bot', 'portfolio', 'custom']),
  asset: z.string().min(1).max(50),
  condition: z.string().min(1).max(100),
  value: z.number().nullable().optional(),
  active: z.boolean().optional(),
  meta: z.any().optional(),
});

export const updateAlertSchema = z.object({
  type: z.enum(['price', 'bot', 'portfolio', 'custom']).optional(),
  asset: z.string().min(1).max(50).optional(),
  condition: z.string().min(1).max(100).optional(),
  value: z.number().nullable().optional(),
  active: z.boolean().optional(),
  meta: z.any().optional(),
});

// ── Schedules ──────────────────────────────────────────────────
export const createScheduleSchema = z.object({
  id: z.string().max(100).optional(),
  action: z.string().min(1).max(200),
  cron: z.string().min(1).max(100),
  params: z.any().optional(),
  active: z.boolean().optional(),
});

export const updateScheduleSchema = z.object({
  action: z.string().min(1).max(200).optional(),
  cron: z.string().min(1).max(100).optional(),
  params: z.any().optional(),
  active: z.boolean().optional(),
});

// ── Settings ───────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  notifications: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  demoMode: z.boolean().optional(),
  virtualBalance: z.number().nonnegative().optional(),
  selectedPlan: z.string().max(50).optional(),
  hasCompletedOnboarding: z.boolean().optional(),
  antiPhishingCode: z.string().max(100).nullable().optional(),
});

// ── Copy Trading ───────────────────────────────────────────────
export const followTraderSchema = z.object({
  traderId: z.string().min(1).max(100),
  copySettings: z.any().optional(),
});

export const updateCopySettingsSchema = z.object({
  copySettings: z.any(),
});

// ── Social ─────────────────────────────────────────────────────
export const createStrategySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  strategyType: z.string().max(50).optional(),
  params: z.any().optional(),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});

export const updateStrategySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  strategyType: z.string().max(50).optional(),
  params: z.any().optional(),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
});
