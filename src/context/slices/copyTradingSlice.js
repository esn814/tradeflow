import { useCallback, useMemo } from 'react';

/**
 * Copy Trading slice — manages followed traders and copy-trade state.
 * Traders are discovered from the platform; users follow them to auto-copy trades.
 */

// Sample traders for demo/empty state
const SAMPLE_TRADERS = [
  {
    id: 'trader_1',
    name: 'CryptoViper',
    avatar: '🐍',
    strategy: 'Trend Following',
    pnl30d: 18420,
    pnlPct30d: 34.2,
    winRate: 71.3,
    followers: 1247,
    trades30d: 89,
    avgHoldTime: '4.2h',
    risk: 'medium',
    assets: ['BTC', 'ETH', 'SOL'],
    verified: true,
    topTrader: true,
  },
  {
    id: 'trader_2',
    name: 'GridMaster',
    avatar: '📊',
    strategy: 'Grid Trading',
    pnl30d: 12650,
    pnlPct30d: 22.8,
    winRate: 68.5,
    followers: 834,
    trades30d: 215,
    avgHoldTime: '1.8h',
    risk: 'low',
    assets: ['ETH', 'PAX', 'USDC'],
    verified: true,
    topTrader: true,
  },
  {
    id: 'trader_3',
    name: 'DeFiScout',
    avatar: '🔍',
    strategy: 'Smart DCA',
    pnl30d: 9870,
    pnlPct30d: 18.5,
    winRate: 64.2,
    followers: 562,
    trades30d: 42,
    avgHoldTime: '12.6h',
    risk: 'low',
    assets: ['BTC', 'ETH'],
    verified: true,
    topTrader: false,
  },
  {
    id: 'trader_4',
    name: 'AlphaSniper',
    avatar: '🎯',
    strategy: 'Momentum',
    pnl30d: 28340,
    pnlPct30d: 52.1,
    winRate: 58.9,
    followers: 2103,
    trades30d: 156,
    avgHoldTime: '2.1h',
    risk: 'high',
    assets: ['SOL', 'ETH', 'PAX'],
    verified: true,
    topTrader: true,
  },
  {
    id: 'trader_5',
    name: 'SafeHarbor',
    avatar: '⚓',
    strategy: 'Mean Reversion',
    pnl30d: 6240,
    pnlPct30d: 12.8,
    winRate: 73.1,
    followers: 389,
    trades30d: 67,
    avgHoldTime: '6.4h',
    risk: 'low',
    assets: ['BTC', 'PAX'],
    verified: false,
    topTrader: false,
  },
  {
    id: 'trader_6',
    name: 'VolTrader',
    avatar: '🌊',
    strategy: 'Volatility Breakout',
    pnl30d: 15890,
    pnlPct30d: 31.7,
    winRate: 55.2,
    followers: 712,
    trades30d: 198,
    avgHoldTime: '0.8h',
    risk: 'high',
    assets: ['BTC', 'ETH', 'SOL'],
    verified: true,
    topTrader: false,
  },
];

export const COPY_TRADING_DEFAULTS = {
  followedTraders: {},    // { [traderId]: { followedAt, copyAmount, autoCopy } }
  copyTradeHistory: [],   // trades copied from followed traders
};

export function useCopyTradingActions(store, setStore) {
  const { followedTraders = {} } = store;

  const followTrader = useCallback((traderId, opts = {}) => {
    setStore(prev => ({
      ...prev,
      followedTraders: {
        ...prev.followedTraders,
        [traderId]: {
          followedAt: new Date().toISOString(),
          copyAmount: opts.copyAmount || 100,
          autoCopy: opts.autoCopy ?? true,
        },
      },
    }));
  }, [setStore]);

  const unfollowTrader = useCallback((traderId) => {
    setStore(prev => {
      const next = { ...prev.followedTraders };
      delete next[traderId];
      return { ...prev, followedTraders: next };
    });
  }, [setStore]);

  const updateCopySettings = useCallback((traderId, settings) => {
    setStore(prev => ({
      ...prev,
      followedTraders: {
        ...prev.followedTraders,
        [traderId]: { ...prev.followedTraders[traderId], ...settings },
      },
    }));
  }, [setStore]);

  const followedCount = useMemo(() => Object.keys(followedTraders).length, [followedTraders]);

  const isFollowing = useCallback((traderId) => !!followedTraders[traderId], [followedTraders]);

  return {
    followTrader,
    unfollowTrader,
    updateCopySettings,
    followedCount,
    isFollowing,
    followedTraders,
    traders: SAMPLE_TRADERS,
  };
}

export { SAMPLE_TRADERS };
