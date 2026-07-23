import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Fetch real token balances for a connected wallet from PaxScan API.
 * Falls back to empty balances when not connected or on error.
 */

const PAXSCAN_API = 'https://api.paxscan.io/api/v2';
const _CHAIN_ID = 125;

// Well-known Paxeer tokens to track
const TRACKED_TOKENS = [
  { symbol: 'PAX', name: 'Paxeer', isNative: true, decimals: 18 },
  { symbol: 'USDL', name: 'USDL Stablecoin', address: null, decimals: 6 },
  { symbol: 'USDC', name: 'USD Coin', address: null, decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: null, decimals: 6 },
];

/**
 * Fetch native PAX balance + ERC-20 token list for an address.
 */
async function fetchWalletBalances(address) {
  const result = { native: null, tokens: [], error: null };

  try {
    // 1. Fetch address overview (includes native balance + token balances)
    const res = await fetch(`${PAXSCAN_API}/addresses/${address}`);
    if (!res.ok) throw new Error(`PaxScan returned ${res.status}`);
    const data = await res.json();

    // Native PAX balance
    if (data.coin_balance) {
      result.native = {
        symbol: 'PAX',
        name: 'Paxeer',
        balance: data.coin_balance,
        balanceFormatted: formatBalance(data.coin_balance, 18),
        decimals: 18,
        isNative: true,
      };
    }

    // 2. Fetch token balances
    const tokenRes = await fetch(`${PAXSCAN_API}/addresses/${address}/tokens?type=ERC-20`);
    if (tokenRes.ok) {
      const tokenData = await tokenRes.json();
      const items = tokenData.items || tokenData || [];
      result.tokens = items.map(t => ({
        symbol: t.token?.symbol || 'UNKNOWN',
        name: t.token?.name || 'Unknown Token',
        balance: t.value || '0',
        balanceFormatted: formatBalance(t.value || '0', t.token?.decimals || 18),
        decimals: t.token?.decimals || 18,
        address: t.token?.address,
        iconUrl: t.token?.icon_url,
        type: t.token?.type || 'ERC-20',
      })).filter(t => parseFloat(t.balanceFormatted) > 0);
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Fetch USD prices for tracked tokens via PaxScan or fallback.
 */
async function fetchTokenPrices(symbols) {
  const prices = {};
  // Try PaxScan token prices endpoint
  try {
    const res = await fetch(`${PAXSCAN_API}/stats`);
    if (res.ok) {
      const stats = await res.json();
      if (stats.gas_prices?.market_price) {
        // PaxScan stats may include market data
      }
    }
  } catch { /* ignore */ }

  // Fallback: use our own price API
  for (const sym of symbols) {
    try {
      const res = await fetch(`https://data-api.crossverse.app/api/${sym.toLowerCase()}/price`);
      if (res.ok) {
        const data = await res.json();
        prices[sym] = parseFloat(data.price || data.usd || 0);
      }
    } catch { /* ignore */ }
  }

  return prices;
}

function formatBalance(raw, decimals) {
  try {
    const num = BigInt(raw);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    const frac = num % divisor;
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole.toString()}.${fracStr}`;
  } catch {
    return '0';
  }
}

/**
 * Hook: real wallet portfolio data.
 * Returns { balances, totalValue, loading, error, refresh, connected }
 *
 * When no wallet is connected or API fails, returns empty state —
 * Dashboard falls back to demo positions.
 */
export function useWalletPortfolio(pollInterval = 60000) {
  const { isAuthenticated, address } = useAuth();
  const [state, setState] = useState({
    balances: [],
    totalValue: 0,
    loading: false,
    error: null,
    connected: false,
  });
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !address) {
      setState({ balances: [], totalValue: 0, loading: false, error: null, connected: false });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));

    try {
      const walletData = await fetchWalletBalances(address);

      if (!mountedRef.current) return;

      // Combine native + token balances
      const allBalances = [];
      if (walletData.native) {
        allBalances.push(walletData.native);
      }
      allBalances.push(...walletData.tokens);

      // Fetch prices for valuation
      const symbols = allBalances.map(b => b.symbol);
      const prices = await fetchTokenPrices(symbols);

      if (!mountedRef.current) return;

      // Calculate USD values
      const enriched = allBalances.map(b => ({
        ...b,
        price: prices[b.symbol] || 0,
        value: parseFloat(b.balanceFormatted) * (prices[b.symbol] || 0),
      }));

      const totalValue = enriched.reduce((sum, b) => sum + b.value, 0);

      setState({
        balances: enriched,
        totalValue: +totalValue.toFixed(2),
        loading: false,
        error: walletData.error,
        connected: true,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, loading: false, error: err.message, connected: true }));
    }
  }, [isAuthenticated, address]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh, pollInterval]);

  return { ...state, refresh };
}

export { TRACKED_TOKENS, fetchWalletBalances, fetchTokenPrices };
