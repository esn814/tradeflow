import { useState, useRef, useEffect } from 'react'
import { Bug, X, Send, CheckCircle, Camera, AlertTriangle, Wifi, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import { collectDiagnostics, getErrorSummary, captureScreenshot } from '../utils/diagnostics'

export default function BugReport() {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [screenshot, setScreenshot] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  
  const [summary, setSummary] = useState(null)
  const panelRef = useRef(null)

  // Collect diagnostics when panel opens
  useEffect(() => {
    if (!open) return
    setDiagnosticsReady(false)
    setScreenshot(null)
    setSummary(null)

    const summaryNow = getErrorSummary()
    setSummary(summaryNow)

    // Capture screenshot asynchronously
    setCollecting(true)
    captureScreenshot().then(dataUrl => {
      setScreenshot(dataUrl)
      setCollecting(false)
      setDiagnosticsReady(true)
    }).catch(() => {
      setCollecting(false)
      setDiagnosticsReady(true)
    })
  }, [open])

  const submit = async () => {
    if (!msg.trim()) return
    setCollecting(true)

    const diag = await collectDiagnostics(msg)
    setCollecting(false)

    // Build a rich email body
    const errorLines = diag.summary.recentErrors.length
      ? diag.summary.recentErrors.map(e => `  • ${e}`).join('\n')
      : '  (none)'

    const networkLines = diag.summary.recentNetworkErrors.length
      ? diag.summary.recentNetworkErrors.map(e => `  • ${e.method || '?'} ${e.url} → ${e.status || e.error}`).join('\n')
      : '  (none)'

    const consoleTail = diag.consoleLogs.slice(-15).map(l =>
      `  [${l.level.toUpperCase()}] ${l.time.split('T')[1]?.slice(0, 12)} ${l.message}`
    ).join('\n')

    const networkTail = diag.networkErrors.slice(-10).map(e =>
      `  [${e.type?.toUpperCase()}] ${e.method || '?'} ${e.url} → ${e.status || e.error} (${e.duration}ms)`
    ).join('\n')

    const body = [
      `Bug report from TradeFlow`,
      ``,
      `── Description ──`,
      msg,
      ``,
      `── Auto-Detected Issues ──`,
      `Console errors: ${diag.summary.consoleErrors}`,
      `Console warnings: ${diag.summary.consoleWarnings}`,
      `Network failures (5xx): ${diag.summary.networkFailures}`,
      `Network client errors (4xx): ${diag.summary.networkClientErrors}`,
      `Total logs captured: ${diag.summary.totalLogs}`,
      `Total network events: ${diag.summary.totalNetworkEvents}`,
      ``,
      `── Recent Errors ──`,
      errorLines,
      ``,
      `── Recent Network Errors ──`,
      networkLines,
      ``,
      `── Console Log (last 15) ──`,
      consoleTail,
      ``,
      `── Network Log (last 10) ──`,
      networkTail,
      ``,
      `── Screenshot ──`,
      diag.screenshotDataUrl ? '(screenshot included as attachment — see below)' : '(screenshot capture unavailable)',
      ``,
      `── Environment ──`,
      `URL: ${diag.url}`,
      `Viewport: ${diag.viewport}`,
      `Browser: ${diag.userAgent}`,
      `Time: ${diag.timestamp}`,
    ].join('\n')

    const subject = encodeURIComponent(
      `TradeFlow Bug Report — ${new Date().toLocaleDateString()} — ${diag.summary.consoleErrors} errors`
    )

    // Open mailto with rich body
    window.open(`mailto:support@tradeflow.app?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank')

    setSent(true)
    setTimeout(() => { setOpen(false); setMsg(''); setSent(false); setScreenshot(null); setSummary(null) }, 3000)
  }

  const errorCount = summary ? summary.consoleErrors + summary.networkFailures : 0

  return (
    <>
      {/* Floating trigger button */}
      <button
        data-bugreport="trigger"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[1000] w-11 h-11 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] cursor-pointer flex items-center justify-center hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover-alt)] transition-all group"
        title="Report a bug"
      >
        <Bug size={18} className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors" />
        {errorCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold flex items-center justify-center">
            {errorCount > 9 ? '9+' : errorCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          data-bugreport="panel"
          ref={panelRef}
          className="fixed bottom-20 right-5 z-[1001] w-[380px] bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <Bug size={16} className="text-[var(--color-accent)]" />
              <span className="text-sm font-bold text-[var(--color-text-on-dark)]">Report a Bug</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-border-strong)] transition-colors">
              <X size={16} className="text-[var(--color-text-tertiary)]" />
            </button>
          </div>

          {sent ? (
            <div className="p-8 text-center">
              <CheckCircle size={36} className="text-[var(--color-profit)] mx-auto mb-3" />
              <div className="text-[var(--color-profit)] font-bold text-sm mb-1">Report Submitted!</div>
              <p className="text-xs text-[var(--color-text-tertiary)]">Opening your email client with diagnostics attached…</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Description input */}
              <div>
                <label className="text-xs text-[var(--color-text-tertiary)] font-medium block mb-1.5">What happened?</label>
                <textarea
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  placeholder="Describe the issue — what did you expect, and what actually happened?"
                  rows={3}
                  className="w-full resize-none px-3.5 py-2.5 text-sm bg-[var(--color-surface-input)] border border-[var(--color-border-subtle)] rounded-xl text-[var(--color-text-on-dark)] placeholder:text-[var(--color-text-muted-alt)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors"
                />
              </div>

              {/* Auto-attached diagnostics preview */}
              <div className="bg-[var(--color-surface-input)] rounded-xl border border-[var(--color-border-subtle)] overflow-hidden">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-panel)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal size={13} className="text-[var(--color-info)]" />
                    <span className="text-xs font-semibold text-[var(--color-text-on-dark)]">Auto-Attached Diagnostics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {summary && errorCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-danger-18)] text-[var(--color-danger)]">
                        {errorCount} issues
                      </span>
                    )}
                    {collecting && (
                      <span className="text-[10px] text-[var(--color-warning)]">collecting…</span>
                    )}
                    {showDetails ? <ChevronUp size={13} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={13} className="text-[var(--color-text-tertiary)]" />}
                  </div>
                </button>

                {showDetails && summary && (
                  <div className="px-4 pb-3 space-y-2.5 border-t border-[var(--color-surface-panel)]">
                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2 pt-3">
                      {[
                        { icon: Terminal, label: 'Errors', value: summary.consoleErrors, color: summary.consoleErrors > 0 ? 'var(--color-danger)' : 'var(--color-profit)' },
                        { icon: AlertTriangle, label: 'Warnings', value: summary.consoleWarnings, color: summary.consoleWarnings > 0 ? 'var(--color-warning)' : 'var(--color-profit)' },
                        { icon: Wifi, label: 'Net Fail', value: summary.networkFailures, color: summary.networkFailures > 0 ? 'var(--color-danger)' : 'var(--color-profit)' },
                        { icon: Wifi, label: '4xx', value: summary.networkClientErrors, color: summary.networkClientErrors > 0 ? 'var(--color-warning)' : 'var(--color-profit)' },
                      ].map(stat => (
                        <div key={stat.label} className="text-center">
                          <div className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</div>
                          <div className="text-[9px] text-[var(--color-text-muted-alt)]">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Recent errors */}
                    {summary.recentErrors.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[var(--color-text-tertiary)] font-medium mb-1">Recent Console Errors:</div>
                        {summary.recentErrors.slice(0, 3).map((err, i) => (
                          <div key={i} className="text-[10px] text-[var(--color-danger-light)] font-mono truncate leading-relaxed">• {err}</div>
                        ))}
                      </div>
                    )}

                    {/* Recent network errors */}
                    {summary.recentNetworkErrors.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[var(--color-text-tertiary)] font-medium mb-1">Recent Network Errors:</div>
                        {summary.recentNetworkErrors.slice(0, 3).map((err, i) => (
                          <div key={i} className="text-[10px] text-[var(--color-danger-light)] font-mono truncate leading-relaxed">
                            • {err.method || '?'} {err.url} → {err.status || err.error}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Screenshot preview */}
                    <div>
                      <div className="text-[10px] text-[var(--color-text-tertiary)] font-medium mb-1">Screenshot:</div>
                      {screenshot ? (
                        <div className="relative">
                          <img src={screenshot} alt="Page screenshot" className="w-full rounded-lg border border-[var(--color-border-subtle)] opacity-80" />
                          <div className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-[var(--color-profit)]">
                            <Camera size={9} /> captured
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--color-text-muted-alt)] italic">
                          {collecting ? 'Capturing screenshot…' : 'Screenshot unavailable'}
                        </div>
                      )}
                    </div>

                    {/* Total counts */}
                    <div className="text-[10px] text-[var(--color-text-muted-alt)] pt-1 border-t border-[var(--color-surface-panel)]">
                      {summary.totalLogs} console logs • {summary.totalNetworkEvents} network events will be attached
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                onClick={submit}
                disabled={!msg.trim() || collecting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)] text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[var(--color-accent-25)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                <Send size={14} />
                {collecting ? 'Collecting diagnostics…' : 'Submit Report'}
              </button>

              <p className="text-[10px] text-[var(--color-text-muted-alt)] text-center">
                Console logs, network errors, and a screenshot are automatically attached.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
