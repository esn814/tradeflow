/**
 * Server-side indicators — pure math, no browser dependencies.
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

/** RSI — Relative Strength Index (Wilder's smoothing) */
export function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  // Seed: simple average of first `period` changes
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining data
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/** Bollinger Bands */
export function computeBollinger(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + (p - middle) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: middle + multiplier * stdDev, middle, lower: middle - multiplier * stdDev };
}

/** ATR from price array (close-to-close proxy) */
export function computeATRFromPrices(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const trueRanges = [];
  for (let i = 1; i < prices.length; i++) {
    trueRanges.push(Math.abs(prices[i] - prices[i - 1]));
  }
  return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** Simple Moving Average */
export function computeSMA(prices, period) {
  if (prices.length < period) return null;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** Market regime detection */
export function detectRegime(prices, atrPeriod = 14, trendPeriod = 20) {
  const minLen = Math.max(atrPeriod, trendPeriod) + 2;
  if (prices.length < minLen) return { regime: 'ranging', atr: 0, atrPct: 0, direction: 0 };

  const trueRanges = [];
  for (let i = 1; i < prices.length; i++) {
    trueRanges.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const atr = trueRanges.slice(-atrPeriod).reduce((a, b) => a + b, 0) / atrPeriod;
  const currentPrice = prices[prices.length - 1];
  const atrPct = currentPrice > 0 ? atr / currentPrice : 0;

  const shortAvg = prices.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, prices.length);
  const longAvg = prices.slice(-trendPeriod).reduce((a, b) => a + b, 0) / Math.min(trendPeriod, prices.length);
  const direction = longAvg > 0 ? (shortAvg - longAvg) / longAvg : 0;

  if (atrPct > 0.025) return { regime: 'volatile', atr, atrPct, direction };
  if (Math.abs(direction) > 0.02 && atrPct > 0.008) {
    return { regime: direction > 0 ? 'trending-up' : 'trending-down', atr, atrPct, direction };
  }
  return { regime: 'ranging', atr, atrPct, direction };
}

/** MACD — returns { macd, signal, histogram } */
export function computeMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod + signalPeriod) return null;

  // Build full MACD line series
  const macdLine = [];
  for (let i = slowPeriod; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const fast = computeEMA(slice, fastPeriod);
    const slow = computeEMA(slice, slowPeriod);
    if (fast != null && slow != null) {
      macdLine.push(fast - slow);
    }
  }

  if (macdLine.length < signalPeriod) return null;

  // Signal line = EMA of MACD line
  const signalLine = computeEMA(macdLine, signalPeriod);
  const lastMACD = macdLine[macdLine.length - 1];

  return {
    macd: lastMACD,
    signal: signalLine,
    histogram: lastMACD - signalLine,
  };
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

/** ATR — Average True Range (time-series, requires OHLC data) */
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

  const kValues = [];
  for (let i = closes.length - dPeriod; i < closes.length; i++) {
    const sliceHighs = highs.slice(i - kPeriod + 1, i + 1);
    const sliceLows = lows.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...sliceHighs);
    const lowest = Math.min(...sliceLows);
    if (highest === lowest) {
      kValues.push(50);
    } else {
      kValues.push(((closes[i] - lowest) / (highest - lowest)) * 100);
    }
  }

  const k = kValues[kValues.length - 1];
  const d = kValues.reduce((a, b) => a + b, 0) / kValues.length;
  return { k, d };
}

/** ADX — Average Directional Index (simplified) */
export function computeADX(highs, lows, closes, period = 14) {
  if (highs.length < period * 2) return null;
  const atr = computeATR(highs, lows, closes, period);
  if (!atr) return null;
  const closeSlice = closes.slice(-period);
  const avg = closeSlice.reduce((a, b) => a + b, 0) / period;
  const priceMove = Math.abs(closes[closes.length - 1] - closes[closes.length - period]);
  return Math.min(100, (priceMove / (atr * period)) * 100);
}
