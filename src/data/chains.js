// Multi-chain network definitions — Paxeer is primary
export const CHAINS = [
  {
    id: 125,
    hex: '0x7d',
    name: 'Paxeer Network',
    short: 'Paxeer',
    symbol: 'PAX',
    decimals: 18,
    rpcUrl: 'https://api.hyperpax.xyz',
    explorer: 'https://paxscan.io',
    color: '#00d4aa',
    icon: '⚡',
    isPrimary: true,
  },
  {
    id: 1,
    hex: '0x1',
    name: 'Ethereum Mainnet',
    short: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    color: '#627EEA',
    icon: '⟠',
  },
  {
    id: 56,
    hex: '0x38',
    name: 'BNB Smart Chain',
    short: 'BNB Chain',
    symbol: 'BNB',
    decimals: 18,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    color: '#F0B90B',
    icon: '🔶',
  },
  {
    id: 137,
    hex: '0x89',
    name: 'Polygon',
    short: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    color: '#8247E5',
    icon: '🟣',
  },
  {
    id: 42161,
    hex: '0xa4b1',
    name: 'Arbitrum One',
    short: 'Arbitrum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
    color: '#28A0F0',
    icon: '🔵',
  },
  {
    id: 501,
    hex: '0x1f5',
    name: 'Solana',
    short: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorer: 'https://solscan.io',
    color: '#9945FF',
    icon: '◎',
  },
  {
    id: 8453,
    hex: '0x2105',
    name: 'Base',
    short: 'Base',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    color: '#0052FF',
    icon: '🔷',
  },
];

export const WALLETS = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', detect: () => typeof window !== 'undefined' && !!window.ethereum?.isMetaMask },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', detect: () => typeof window !== 'undefined' && !!window.ethereum?.isCoinbaseWallet },
  { id: 'trust', name: 'Trust Wallet', icon: '🛡️', detect: () => typeof window !== 'undefined' && !!window.ethereum?.isTrust },
  { id: 'rainbow', name: 'Rainbow', icon: '🌈', detect: () => typeof window !== 'undefined' && !!window.ethereum?.isRainbow },
  { id: 'phantom', name: 'Phantom', icon: '👻', detect: () => typeof window !== 'undefined' && !!window.ethereum?.isPhantom },
  { id: 'rabby', name: 'Rabby', icon: '🐰', detect: () => typeof window !== 'undefined' && !!window.ethereum?.isRabby },
];

export const EXCHANGES = [
  { id: 'binance', name: 'Binance', color: '#F0B90B', fields: ['API Key', 'API Secret'] },
  { id: 'coinbase', name: 'Coinbase Pro', color: '#0052FF', fields: ['API Key', 'API Secret', 'Passphrase'] },
  { id: 'kraken', name: 'Kraken', color: '#7B61FF', fields: ['API Key', 'API Secret'] },
  { id: 'bybit', name: 'Bybit', color: '#FFA500', fields: ['API Key', 'API Secret'] },
];

export function getChainById(id) {
  return CHAINS.find(c => c.id === id);
}

export function getChainName(id) {
  return getChainById(id)?.name || `Chain ${id}`;
}

export function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}···${addr.slice(-4)}` : '';
}
