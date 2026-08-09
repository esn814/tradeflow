/**
 * Signal Engine — Server-side confluence scoring for the AutoTrader.
 *
 * Ported from src/engine/signalEngine.js. Pure computation, no browser deps.
 * Provides:
 *   - computeSignals(coin, priceData) → full signal breakdown + confluence score
 *   - getTopPick(pricesMap) → best coin+strategy combo
 *
 * Used by AutoTrader as an alternative strategy: instead of running a single
 * strategy function, the bot can use the confluence engine to make decisions.
 */

import {
  computeEMA, computeMACD, computeRSI, computeBollinger,
  computeATRFromPrices, computeStochastic, computeADX,
  detectRegime,
} from './indicators.js';

// ─── Signal Weights ────────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  rsi: 1.0,
  macd: 1.2,
  bollinger: 0.9,
  emaCross: 1.1,
  stochastic: 0.7,
  adx: 0.6,
  volume: 0.5,
  regime: 0.8,
};

// ─── Individual Signal Computations ────────────────────────────

function rsiSignal(prices) {
  const rsi = computeRSI(prices, 14);
  if (rsi == null) return { signal: 0, value: null, label: 'RSI', detail: 'Insufficient data' };

  if (rsi < 25) return { signal: 1, value: rsi, label: 'RSI', detail: `${rsi.toFixed(0)} — deeply oversold`, strength: 'strong' };
  if (rsi < 35) return { signal: 0.5, value: rsi, label: 'RSI', detail: `${rsi.toFixed(0)} — oversold zone`, strength: 'moderate' };
  if (rsi > 75) return { signal: -1, value: rsi, label: 'RSI', detail: `${rsi.toFixed(0)} — deeply overbought`, strength: 'strong' };
  if (rsi > 65) return { signal: -0.5, value: rsi, label: 'RSI', detail: `${rsi.toFixed(0)} — overbought zone`, strength: 'moderate' };
  return { signal: 0, value: rsi, label: 'RSI', detail: `${rsi.toFixed(0)} — neutral`, strength: 'neutral' };
}

function macdSignal(prices) {
  const macd = computeMACD(prices);
  if (!macd) return { signal: 0, value: null, label: 'MACD', detail: 'Insufficient data' };

  const { histogram, macd: macdLine, signal: signalLine } = macd;
  const normalized = histogram / (Math.abs(macdLine) + 1) * 100;

  if (histogram > 0 && macdLine > signalLine) {
    return {
      signal: Math.min(1, normalized / 50),
      value: histogram,
      label: 'MACD',
      detail: `Bullish crossover, histogram +${histogram.toFixed(2)}`,
      strength: histogram > 0.5 ? 'strong' : 'moderate',
    };
  }
  if (histogram < 0 && macdLine < signalLine) {
    return {
      signal: Math.max(-1, normalized / 50),
      value: histogram,
      label: 'MACD',
      detail: `Bearish crossover, histogram ${histogram.toFixed(2)}`,
      strength: histogram < -0.5 ? 'strong' : 'moderate',
    };
  }
  return { signal: 0, value: histogram, label: 'MACD', detail: `Neutral, histogram ${histogram.toFixed(2)}`, strength: 'neutral' };
}

function bollingerSignal(prices) {
  const bb = computeBollinger(prices, 20, 2);
  if (!bb) return { signal: 0, value: null, label: 'Bollinger', detail: 'Insufficient data' };

  const price = prices[prices.length - 1];
  const bandwidth = bb.upper - bb.lower;
  if (bandwidth <= 0) return { signal: 0, value: price, label: 'Bollinger', detail: 'Zero bandwidth', strength: 'neutral' };

  const position = (price - bb.lower) / bandwidth;

  if (position < 0.1) return { signal: 1, value: position, label: 'Bollinger', detail: `Below lower band — strong buy`, strength: 'strong' };
  if (position < 0.25) return { signal: 0.5, value: position, label: 'Bollinger', detail: `Near lower band — buy zone`, strength: 'moderate' };
  if (position > 0.9) return { signal: -1, value: position, label: 'Bollinger', detail: `Above upper band — strong sell`, strength: 'strong' };
  if (position > 0.75) return { signal: -0.5, value: position, label: 'Bollinger', detail: `Near upper band — sell zone`, strength: 'moderate' };
  return { signal: 0, value: position, label: 'Bollinger', detail: `Mid-band (${(position * 100).toFixed(0)}%)`, strength: 'neutral' };
}

function emaCrossSignal(prices) {
  if (prices.length < 26) return { signal: 0, value: null, label: 'EMA Cross', detail: 'Insufficient data' };

  const fast = computeEMA(prices, 9);
  const slow = computeEMA(prices, 21);
  if (fast == null || slow == null) return { signal: 0, value: null, label: 'EMA Cross', detail: 'Insufficient data' };

  const diff = (fast - slow) / slow;

  if (diff > 0.02) return { signal: 1, value: diff, label: 'EMA Cross', detail: `Fast EMA above slow by ${(diff * 100).toFixed(1)}%`, strength: 'strong' };
  if (diff > 0.005) return { signal: 0.5, value: diff, label: 'EMA Cross', detail: `Fast EMA slightly above slow`, strength: 'moderate' };
  if (diff < -0.02) return { signal: -1, value: diff, label: 'EMA Cross', detail: `Fast EMA below slow by ${(Math.abs(diff) * 100).toFixed(1)}%`, strength: 'strong' };
  if (diff < -0.005) return { signal: -0.5, value: diff, label: 'EMA Cross', detail: `Fast EMA slightly below slow`, strength: 'moderate' };
  return { signal: 0, value: diff, label: 'EMA Cross', detail: `EMAs converging`, strength: 'neutral' };
}

function stochasticSignal(prices, highs, lows) {
  if (!highs || !lows || prices.length < 14) return { signal: 0, value: null, label: 'Stochastic', detail: 'Insufficient data' };

  const stoch = computeStochastic(highs, lows, prices, 14, 3);
  if (!stoch) return { signal: 0, value: null, label: 'Stochastic', detail: 'Insufficient data' };

  const { k } = stoch;
  if (k < 20) return { signal: 0.8, value: k, label: 'Stochastic', detail: `%K ${k.toFixed(0)} — oversold`, strength: 'moderate' };
  if (k > 80) return { signal: -0.8, value: k, label: 'Stochastic', detail: `%K ${k.toFixed(0)} — overbought`, strength: 'moderate' };
  return { signal: 0, value: k, label: 'Stochastic', detail: `%K ${k.toFixed(0)} — neutral`, strength: 'neutral' };
}

function adxSignal(prices, highs, lows) {
  if (!highs || !lows || prices.length < 30) return { signal: 0, value: null, label: 'ADX', detail: 'Insufficient data' };

  const adx = computeADX(highs, lows, prices, 14);
  if (adx == null) return { signal: 0, value: null, label: 'ADX', detail: 'Insufficient data' };

  const direction = prices[prices.length - 1] > prices[prices.length - 10] ? 1 : -1;
  const magnitude = Math.min(1, adx / 50);

  if (adx > 25) return { signal: direction * magnitude, value: adx, label: 'ADX', detail: `ADX ${adx.toFixed(0)} — strong ${direction > 0 ? 'uptrend' : 'downtrend'}`, strength: 'strong' };
  if (adx > 15) return { signal: direction * magnitude * 0.5, value: adx, label: 'ADX', detail: `ADX ${adx.toFixed(0)} — moderate trend`, strength: 'moderate' };
  return { signal: 0, value: adx, label: 'ADX', detail: `ADX ${adx.toFixed(0)} — no clear trend`, strength: 'neutral' };
}

function volumeSignal(prices, volumes) {
  if (!volumes || volumes.length < 10) return { signal: 0, value: null, label: 'Volume', detail: 'No volume data' };

  const recent = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  if (avg <= 0) return { signal: 0, value: recent, label: 'Volume', detail: 'Zero average volume', strength: 'neutral' };

  const ratio = recent / avg;
  const priceDirection = prices[prices.length - 1] > prices[prices.length - 6] ? 1 : -1;

  if (ratio > 1.5) return { signal: priceDirection * 0.5, value: ratio, label: 'Volume', detail: `${ratio.toFixed(1)}x average — ${priceDirection > 0 ? 'bullish' : 'bearish'} volume spike`, strength: 'moderate' };
  if (ratio < 0.5) return { signal: 0, value: ratio, label: 'Volume', detail: `${ratio.toFixed(1)}x average — low volume`, strength: 'neutral' };
  return { signal: 0, value: ratio, label: 'Volume', detail: `${ratio.toFixed(1)}x average — normal`, strength: 'neutral' };
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Compute all signals for a single coin.
 *
 * @param {string} coin - e.g. 'BTC'
 * @param {Object} priceData - { price, history, highs, lows, volumes }
 * @returns {{ coin, price, signals, confluence, regime, recommendation }}
 */
export function computeSignals(coin, priceData) {
  const { price, history = [], highs, lows, volumes } = priceData;

  if (!price || !history || history.length < 15) {
    return {
      coin,
      price: price || 0,
      signals: [],
      confluence: 0,
      regime: { regime: 'unknown', atr: 0, atrPct: 0, direction: 0 },
      recommendation: { action: 'hold', confidence: 0, reason: 'Insufficient data' },
    };
  }

  const signals = [
    rsiSignal(history),
    macdSignal(history),
    bollingerSignal(history),
    emaCrossSignal(history),
    stochasticSignal(history, highs, lows),
    adxSignal(history, highs, lows),
    volumeSignal(history, volumes),
  ];

  const regime = detectRegime(history, 14, 20);

  let regimeSignal = 0;
  if (regime.regime === 'trending-up') regimeSignal = 0.3;
  else if (regime.regime === 'trending-down') regimeSignal = -0.3;

  signals.push({
    signal: regimeSignal,
    value: regime.atrPct,
    label: 'Regime',
    detail: `${regime.regime} (ATR ${(regime.atrPct * 100).toFixed(2)}%)`,
    strength: regime.regime.includes('trending') ? 'moderate' : 'neutral',
  });

  const weightKeys = ['rsi', 'macd', 'bollinger', 'emaCross', 'stochastic', 'adx', 'volume', 'regime'];
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < signals.length; i++) {
    const key = weightKeys[i];
    const weight = SIGNAL_WEIGHTS[key] || 1;
    weightedSum += signals[i].signal * weight;
    totalWeight += weight;
  }
  const confluence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let action = 'hold';
  let confidence = 0;
  let reason = '';

  if (confluence > 0.3) {
    action = 'buy';
    confidence = Math.min(100, Math.round(confluence * 100));
    reason = `${signals.filter(s => s.signal > 0).length}/${signals.length} indicators bullish`;
  } else if (confluence < -0.3) {
    action = 'sell';
    confidence = Math.min(100, Math.round(Math.abs(confluence) * 100));
    reason = `${signals.filter(s => s.signal < 0).length}/${signals.length} indicators bearish`;
  } else {
    action = 'hold';
    confidence = Math.round((1 - Math.abs(confluence)) * 50);
    reason = 'Mixed signals — no clear direction';
  }

  return { coin, price, signals, confluence, regime, recommendation: { action, confidence, reason } };
}

/**
 * Compute signals for all coins and return the top pick.
 *
 * @param {Object} pricesMap - { BTC: priceData, ETH: priceData, ... }
 * @returns {{ topPick, allPicks }}
 */
export function getTopPick(pricesMap) {
  const picks = [];
  for (const [coin, priceData] of Object.entries(pricesMap)) {
    const result = computeSignals(coin, priceData);
    picks.push(result);
  }

  picks.sort((a, b) => Math.abs(b.confluence) - Math.abs(a.confluence));

  const topPick = picks[0] || null;
  return { topPick, allPicks: picks };
}
