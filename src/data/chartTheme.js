/**
 * Shared chart theme constants for consistent styling across all Recharts charts.
 * Import these into Dashboard, Analytics, Backtester, RiskManager, MyBots, etc.
 */

export const CHART_GRID = {
  stroke: '#1e2740',
  strokeDasharray: '3 3',
};

export const CHART_AXIS_TICK = {
  fill: '#8892b0',
  fontSize: 11,
};

export const CHART_AXIS = {
  axisLine: false,
  tickLine: false,
};

export const CHART_TOOLTIP_STYLE = {
  background: '#0a0f1e',
  border: '1px solid #1e2740',
  borderRadius: 12,
  color: '#ccd6f6',
  fontSize: 12,
};

export const CHART_COLORS = {
  accent: '#00d4aa',
  accentFaded: '#00d4aa',
  positive: '#22d68a',
  negative: '#ff4d6a',
  warning: '#ffa502',
  btc: '#f7931a',
  eth: '#627eea',
  sol: '#9945ff',
  pax: '#00d4aa',
  neutral: '#8892b0',
};

export const CHART_GRADIENT = {
  accent: { id: 'chartAccentGrad', start: '#00d4aa', startOpacity: 0.3, end: '#00d4aa', endOpacity: 0 },
  positive: { id: 'chartPositiveGrad', start: '#22d68a', startOpacity: 0.3, end: '#22d68a', endOpacity: 0 },
  negative: { id: 'chartNegativeGrad', start: '#ff4d6a', startOpacity: 0.3, end: '#ff4d6a', endOpacity: 0 },
};
