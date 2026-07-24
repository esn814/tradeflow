/**
 * Unified Indicator Library — shared by engine strategies and backtester.
 * All functions take a price array (oldest first) and return computed values.
 */

/** Exponential Moving Average */
export function computeEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/** EMA series — returns array of EMA values aligned with input */
export function computeEMASeries(prices, period) {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) result.push(null);
  result.push(ema);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

/** MACD — returns { macd, signal, histogram } */
export function computeMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod + signalPeriod) return null;
  const fastEMA = computeEMASeries(prices, fastPeriod);
  const slowEMA = computeEMASeries(prices, slowPeriod);
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (fastEMA[i] != null && slowEMA[i] != null) {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  if (macdLine.length < signalPeriod) return null;
  const signalLine = computeEMASeries(macdLine, signalPeriod);
  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    macd: lastMACD,
    signal: lastSignal,
    histogram: lastMACD - lastSignal,
  };
}

/** RSI — Relative Strength Index */
export function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/** Bollinger Bands — returns { upper, middle, lower, bandwidth } */
export function computeBollinger(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + (p - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + multiplier * stdDev,
    middle,
    lower: middle - multiplier * stdDev,
    bandwidth: (2 * multiplier * stdDev) / middle,
  };
}

/** ATR — Average True Range (time-series) */
export function computeATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < highs.length; i++) {
    trueRanges.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  if (trueRanges.length < period) return null;
  return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** Stochastic Oscillator — returns { k, d } */
export function computeStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  if (closes.length < kPeriod) return null;
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const highest = Math.max(...recentHighs);
  const lowest = Math.min(...recentLows);
  const currentClose = closes[closes.length - 1];
  if (highest === lowest) return { k: 50, d: 50 };
  const k = ((currentClose - lowest) / (highest - lowest)) * 100;
  // Simple %D as SMA of recent %K values (simplified)
  return { k, d: k }; // Simplified — full impl would track K history
}

/** VWAP — Volume Weighted Average Price */
export function computeVWAP(prices, volumes) {
  if (!volumes || prices.length !== volumes.length || prices.length === 0) return null;
  let cumPV = 0, cumV = 0;
  for (let i = 0; i < prices.length; i++) {
    cumPV += prices[i] * volumes[i];
    cumV += volumes[i];
  }
  return cumV > 0 ? cumPV / cumV : null;
}

/** ADX — Average Directional Index (simplified) */
export function computeADX(highs, lows, closes, period = 14) {
  if (highs.length < period * 2) return null;
  // Simplified: use ATR-based trend strength
  const atr = computeATR(highs, lows, closes, period);
  if (!atr) return null;
  const closeSlice = closes.slice(-period);
  const avg = closeSlice.reduce((a, b) => a + b, 0) / period;
  const priceMove = Math.abs(closes[closes.length - 1] - closes[closes.length - period]);
  // Normalize to 0-100 scale
  return Math.min(100, (priceMove / (atr * period)) * 100);
}

/** Simple Moving Average */
export function computeSMA(prices, period) {
  if (prices.length < period) return null;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}
