import { describe, it, vi, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Page imports
import Home from '../pages/Home';
import Dashboard from '../pages/Dashboard';
import Autopilot from '../pages/Autopilot';
import Invest from '../pages/Invest';
import MyBots from '../pages/MyBots';
import Strategies from '../pages/Strategies';
import Backtester from '../pages/Backtester';
import Alerts from '../pages/Alerts';
import RiskManager from '../pages/RiskManager';
import Connections from '../pages/Connections';
import Pricing from '../pages/Pricing';
import Security from '../pages/Security';
import Settings from '../pages/Settings';
import Help from '../pages/Help';
import Scheduler from '../pages/Scheduler';
import Referrals from '../pages/Referrals';
import Analytics from '../pages/Analytics';
import CopyTrading from '../pages/CopyTrading';

// Context providers
import { AppStoreProvider } from '../context/AppStore';
import { AuthProvider } from '../context/AuthContext';
// ModeContext removed — demo/simple mode now lives in AppStore

// Mock all liveData hooks used across pages
vi.mock('../data/liveData', () => ({
  useLiveStream: () => ({ prices: {}, connected: false, error: null }),
  useLivePrices: () => ({ prices: {}, loading: false, refresh: () => {} }),
  useLivePrice: () => ({ price: null, loading: false, error: null, refresh: () => {} }),
  useLiveCandles: () => ({ candles: null, loading: false, refresh: () => {} }),
  useExchangeData: () => ({
    exchangeStatus: { binance: true, coingecko: true, coincap: true, bybit: true, paxeer: true },
    volumes: { BTC: 28500000000, ETH: 15200000000 },
  }),
  fetchPrice: async () => null,
  fetchCandles: async () => null,
}));

function Wrapper({ children }) {
  return (
    <BrowserRouter>
      <AppStoreProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </AppStoreProvider>
    </BrowserRouter>
  );
}

describe('Smoke Tests', () => {
  it('renders Home without crashing', () => {
    const { container } = render(<Home />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Dashboard without crashing', () => {
    const { container } = render(<Dashboard />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Autopilot without crashing', () => {
    const { container } = render(<Autopilot />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Invest without crashing', () => {
    const { container } = render(<Invest />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders MyBots without crashing', () => {
    const { container } = render(<MyBots />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Strategies without crashing', () => {
    const { container } = render(<Strategies />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Backtester without crashing', () => {
    const { container } = render(<Backtester />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Alerts without crashing', () => {
    const { container } = render(<Alerts />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders RiskManager without crashing', () => {
    const { container } = render(<RiskManager />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Connections without crashing', () => {
    const { container } = render(<Connections />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Pricing without crashing', () => {
    const { container } = render(<Pricing />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Security without crashing', () => {
    const { container } = render(<Security />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Settings without crashing', () => {
    const { container } = render(<Settings />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Help without crashing', () => {
    const { container } = render(<Help />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Scheduler without crashing', () => {
    const { container } = render(<Scheduler />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Referrals without crashing', () => {
    const { container } = render(<Referrals />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders Analytics without crashing', () => {
    const { container } = render(<Analytics />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });

  it('renders CopyTrading without crashing', () => {
    const { container } = render(<CopyTrading />, { wrapper: Wrapper });
    expect(container).toBeTruthy();
  });
});
