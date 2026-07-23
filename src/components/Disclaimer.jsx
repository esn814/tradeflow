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
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
        background: 'linear-gradient(135deg, rgba(220,38,38,0.95), rgba(185,28,28,0.95))',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
            ⚠️ Not Financial Advice
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            TradeFlow is a <strong>demo/educational tool only</strong>. Trading strategies, P&L calculations,
            and portfolio data are simulated or for demonstration purposes. Nothing on this platform constitutes
            financial advice. Past performance does not guarantee future results. You are solely responsible for
            any investment decisions you make.
          </div>
        </div>
        <button
          onClick={handleAcknowledge}
          style={{
            background: '#fff', color: '#b91c1c', border: 'none',
            padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          I Understand
        </button>
      </div>
    )
  }

  return (
    <div style={{
      textAlign: 'center', padding: '8px 16px',
      fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.5,
      borderTop: '1px solid var(--color-border)',
    }}>
      TradeFlow is a demo trading platform for educational purposes only.
      Not financial advice. Past performance does not guarantee future results.
    </div>
  )
}
