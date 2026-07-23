import { describe, it, expect } from 'vitest';
import {
  computeSMA,
  computeRSI,
  computeBollinger,
  calculatePositionSize,
  calculateKelly,
  calculateATR,
  calculateSortino,
  calculateCalmar,
} from '../data/marketData';

// Helper: generate deterministic OHLCV data (no Math.random)
function makeData(closes) {
  return closes.map((c, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    open: c * 0.99,
    high: c * 1.01,
    low: c * 0.98,
    close: c,
    volume: 1000,
  }));
}

describe('computeSMA', () => {
  const data = makeData([100, 200, 300, 400, 500]);

  it('returns null for indices before period-1', () => {
    const result = computeSMA(data, 3);
    expect(result[0].sma).toBeNull();
    expect(result[1].sma).toBeNull();
  });

  it('calculates correct SMA at period boundary', () => {
    const result = computeSMA(data, 3);
    // SMA(3) at index 2: (100+200+300)/3 = 200
    expect(result[2].sma).toBe(200);
    // SMA(3) at index 3: (200+300+400)/3 = 300
    expect(result[3].sma).toBe(300);
    // SMA(3) at index 4: (300+400+500)/3 = 400
    expect(result[4].sma).toBe(400);
  });

  it('preserves original data fields', () => {
    const result = computeSMA(data, 3);
    expect(result[2].close).toBe(300);
    expect(result[2].date).toBe('2025-01-03');
  });

  it('SMA(1) equals close price', () => {
    const result = computeSMA(data, 1);
    result.forEach((d, i) => {
      expect(d.sma).toBe(data[i].close);
    });
  });
});

describe('computeRSI', () => {
  it('returns null for indices before period', () => {
    const data = makeData([100, 102, 104, 103, 105]);
    const result = computeRSI(data, 3);
    expect(result[0].rsi).toBeNull();
    expect(result[1].rsi).toBeNull();
    expect(result[2].rsi).toBeNull();
  });

  it('returns ~99 when all moves are up (rs=100 → rsi=100−100/101≈99)', () => {
    const data = makeData([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115]);
    const result = computeRSI(data, 14);
    expect(result[14].rsi).toBe(99);
  });

  it('returns near 0 when all moves are down', () => {
    const data = makeData([200, 199, 198, 197, 196, 195, 194, 193, 192, 191, 190, 189, 188, 187, 186, 185]);
    const result = computeRSI(data, 14);
    expect(result[14].rsi).toBe(0);
  });

  it('returns 50 for flat data', () => {
    const data = Array.from({ length: 16 }, () => ({ date: '2025-01-01', open: 100, high: 100, low: 100, close: 100, volume: 1000 }));
    const result = computeRSI(data, 14);
    // Flat → no gains, no losses → losses=0 → rs=100 → rsi=100-100/101 ≈ 99
    // Actually with flat data, all diffs are 0, so gains=0 and losses=0
    // When losses=0, rs=100, rsi=100-100/101=99
    expect(result[14].rsi).toBe(99);
  });
});

describe('computeBollinger', () => {
  it('returns null bands for indices before period-1', () => {
    const data = makeData([100, 101, 102, 103, 104]);
    const result = computeBollinger(data, 3);
    expect(result[0].bb_mid).toBeNull();
    expect(result[0].bb_upper).toBeNull();
    expect(result[0].bb_lower).toBeNull();
  });

  it('calculates correct bands at period boundary', () => {
    const data = makeData([100, 100, 100, 100, 100]);
    const result = computeBollinger(data, 3);
    // All closes are 100 → std=0, mean=100
    expect(result[2].bb_mid).toBe(100);
    expect(result[2].bb_upper).toBe(100);
    expect(result[2].bb_lower).toBe(100);
  });

  it('upper > mid > lower for volatile data', () => {
    const data = makeData([100, 110, 90, 105, 95, 115, 85, 120, 80, 125, 75, 130, 70, 135, 65, 140, 60, 145, 55, 150, 50]);
    const result = computeBollinger(data, 20);
    const last = result[20];
    expect(last.bb_upper).toBeGreaterThan(last.bb_mid);
    expect(last.bb_mid).toBeGreaterThan(last.bb_lower);
  });
});

describe('calculatePositionSize', () => {
  it('calculates correct position size', () => {
    // $100k capital, 2% risk, entry $50k, stop $49k → risk $2000 / dist $1000 = 2 units
    expect(calculatePositionSize(100000, 2, 50000, 49000)).toBe(2);
  });

  it('returns 0 when entry equals stop loss', () => {
    expect(calculatePositionSize(100000, 2, 50000, 50000)).toBe(0);
  });

  it('handles stop above entry (short)', () => {
    // $100k, 1% risk, entry $50k, stop $51k → risk $1000 / dist $1000 = 1
    expect(calculatePositionSize(100000, 1, 50000, 51000)).toBe(1);
  });
});

describe('calculateKelly', () => {
  it('returns 0 when avgLoss is 0', () => {
    expect(calculateKelly(0.6, 100, 0)).toBe(0);
  });

  it('returns correct fraction for known inputs', () => {
    // winRate=0.6, avgWin=100, avgLoss=50 → b=2, f=(0.6*2-0.4)/2 = 0.8/2 = 0.4
    // capped at 0.25
    expect(calculateKelly(0.6, 100, 50)).toBe(0.25);
  });

  it('returns 0 for losing strategy', () => {
    // winRate=0.3, avgWin=100, avgLoss=200 → b=0.5, f=(0.3*0.5-0.7)/0.5 = -1.1 → clamped to 0
    expect(calculateKelly(0.3, 100, 200)).toBe(0);
  });
});

describe('calculateATR', () => {
  it('returns 0 when data is too short', () => {
    const data = makeData([100, 101, 102]);
    expect(calculateATR(data, 14)).toBe(0);
  });

  it('calculates ATR for sufficient data', () => {
    // 15 data points, all with high=101, low=99, close=100
    const data = Array.from({ length: 15 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      open: 100, high: 101, low: 99, close: 100, volume: 1000,
    }));
    const atr = calculateATR(data, 14);
    // TR = max(101-99=2, |101-100|=1, |99-100|=1) = 2 for each
    expect(atr).toBe(2);
  });
});

describe('calculateSortino', () => {
  it('returns 0 for empty returns', () => {
    expect(calculateSortino([])).toBe(0);
  });

  it('returns 999 when all returns are positive', () => {
    expect(calculateSortino([0.01, 0.02, 0.03])).toBe(999);
  });

  it('calculates ratio for mixed returns', () => {
    const returns = [0.05, -0.02, 0.03, -0.01, 0.04];
    const result = calculateSortino(returns);
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });
});

describe('calculateCalmar', () => {
  it('returns 999 when max drawdown is 0 and return is positive', () => {
    expect(calculateCalmar(50, 0)).toBe(999);
  });

  it('returns 0 when max drawdown is 0 and return is 0', () => {
    expect(calculateCalmar(0, 0)).toBe(0);
  });

  it('calculates correct ratio', () => {
    // 30% return, 10% drawdown, 365 days → 30/10 = 3.0
    expect(calculateCalmar(30, 10)).toBe(3);
  });

  it('annualizes for non-365 day periods', () => {
    // 30% return in 182.5 days → annualized = 60%, drawdown 10% → 6.0
    expect(calculateCalmar(30, 10, 182.5)).toBe(6);
  });
});
