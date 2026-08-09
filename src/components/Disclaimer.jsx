import { useState, useEffect } from 'react'

const DISCLAIMER_KEY = 'tradeflow_disclaimer_ack'

/**
 * Financial disclaimer banner shown at the bottom of every page.
 * First visit: prominent warning with "I Understand" button.
 * After acknowledgment: collapsed footer text.
 */
export default function Disclaimer() {
  const [acknowledged, setAcknowledged] = useState(true)

  useEffect(() => {
    try {
      setAcknowledged(localStorage.getItem(DISCLAIMER_KEY) === 'true')
    } catch { /* localStorage unavailable */ }
  }, [])

  const handleAcknowledge = () => {
    try { localStorage.setItem(DISCLAIMER_KEY, 'true') } catch { /* */ }
    setAcknowledged(true)
  }

  if (!acknowledged) {
    return (
      <div className="disclaimer disclaimer--warning">
        <div className="disclaimer__content">
          <div className="disclaimer__title">
            ⚠️ Trading Involves Risk
          </div>
          <div className="disclaimer__text">
            TradeFlow connects to real exchanges (Binance testnet) and executes automated trades.
            <strong> You can lose money.</strong> Nothing on this platform constitutes financial advice.
            Past performance does not guarantee future results. You are solely responsible for
            any investment decisions you make.
          </div>
        </div>
        <button
          onClick={handleAcknowledge}
          className="disclaimer__btn"
        >
          I Understand
        </button>
      </div>
    )
  }

  return (
    <div className="disclaimer disclaimer--footer">
      TradeFlow — Automated crypto trading with real exchange integration.
      Not financial advice. Trading involves risk. Past performance does not guarantee future results.
    </div>
  )
}
