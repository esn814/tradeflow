import { useState } from 'react'

/**
 * Paper Trading banner — always visible at the top of the app.
 * Makes it crystal clear to friends that this is a demo with no real money.
 */
export default function PaperTradingBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div style={{
      background: 'linear-gradient(90deg, var(--color-purple-deep) 0%, var(--color-purple-light) 100%)',
      color: 'var(--color-text-white)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      fontSize: 13,
      fontWeight: 600,
      position: 'relative',
      zIndex: 100,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 16 }}>📊</span>
      <span>
        <strong>PAPER TRADING MODE</strong> — All data is real live market data. All trades use virtual money ($10,000). No real funds at risk.
      </span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'var(--color-text-white)',
          borderRadius: 6,
          padding: '2px 10px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ✕
      </button>
    </div>
  )
}
