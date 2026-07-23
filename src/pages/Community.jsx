import { useState, useEffect, useCallback } from 'react'
import { Trophy, Heart, GitFork, Search, Plus, X, Award, Target, BarChart3, Users, Layers } from 'lucide-react'
import { fetchLeaderboard, fetchSharedStrategies, publishStrategy, likeStrategy, forkStrategy } from '../services/apiClient'

/* ── Leaderboard Tab ──────────────────────────────────────── */
function Leaderboard() {
  const [period, setPeriod] = useState('week')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchLeaderboard(period, 50).then(data => {
      setRows(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [period])

  const periods = [
    { value: 'day', label: '24h' },
    { value: 'week', label: '7d' },
    { value: 'month', label: '30d' },
    { value: 'all', label: 'All Time' },
  ]

  const medalColor = (rank) => {
    if (rank === 1) return '#FFD700'
    if (rank === 2) return '#C0C0C0'
    if (rank === 3) return '#CD7F32'
    return 'var(--color-text-muted)'
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {periods.map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: period === p.value ? 'var(--color-accent)' : 'var(--color-surface)',
              color: period === p.value ? '#fff' : 'var(--color-text-secondary)',
            }}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading leaderboard…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          <Trophy size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>No traders yet. Be the first!</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Rank</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Trader</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Trades</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Win Rate</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Total P&L</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Best Trade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.rank} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {r.rank <= 3 && <Award size={16} color={medalColor(r.rank)} />}
                      <span style={{ fontWeight: 700, color: medalColor(r.rank) }}>#{r.rank}</span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13 }}>
                    {r.address ? `${r.address.slice(0, 6)}...${r.address.slice(-4)}` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{r.tradeCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: Number(r.winRate) >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {r.winRate}%
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: Number(r.totalPnl) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {Number(r.totalPnl) >= 0 ? '+' : ''}{Number(r.totalPnl).toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: Number(r.bestTrade) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {Number(r.bestTrade) >= 0 ? '+' : ''}{Number(r.bestTrade).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Strategies Tab ──────────────────────────────────────── */
function StrategiesTab() {
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showPublish, setShowPublish] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await fetchSharedStrategies({ type: typeFilter || undefined, risk: riskFilter || undefined, search: search || undefined, page, limit: 12 })
    setStrategies(result?.strategies || [])
    setTotal(result?.total || 0)
    setLoading(false)
  }, [typeFilter, riskFilter, search, page])

  useEffect(() => { load() }, [load])

  const handleLike = async (id) => {
    await likeStrategy(id)
    load()
  }
  const handleFork = async (id) => {
    await forkStrategy(id)
    load()
  }
  const handlePublish = async (data) => {
    await publishStrategy(data)
    setShowPublish(false)
    load()
  }
  const totalPages = Math.ceil(total / 12)

  const selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, cursor: 'pointer', outline: 'none' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search strategies…" style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} style={selectStyle}>
          <option value="">All Types</option>
          <option value="grid">Grid</option>
          <option value="dca">DCA</option>
          <option value="scalping">Scalping</option>
          <option value="swing">Swing</option>
          <option value="arbitrage">Arbitrage</option>
          <option value="custom">Custom</option>
        </select>
        <select value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1) }} style={selectStyle}>
          <option value="">All Risk</option>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
          <option value="extreme">Extreme</option>
        </select>
        <button onClick={() => setShowPublish(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> Publish
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading strategies…</div>
      ) : strategies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>No strategies found. Be the first to publish!</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {strategies.map(s => <StrategyCard key={s.id} strategy={s} onLike={handleLike} onFork={handleFork} />)}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
              <span style={{ padding: '6px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
            </div>
          )}
        </>
      )}

      {showPublish && <PublishModal onClose={() => setShowPublish(false)} onPublish={handlePublish} />}
    </div>
  )
}

/* ── Strategy Card ──────────────────────────────────────── */
function StrategyCard({ strategy, onLike, onFork }) {
  const riskColors = { low: 'var(--color-success)', moderate: 'var(--color-warning)', high: 'var(--color-danger)', extreme: '#ff4488' }
  const tag = (t) => (
    <span key={t} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: 'var(--color-accent-18)', color: 'var(--color-accent)', fontWeight: 500 }}>{t}</span>
  )
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{strategy.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
            by {strategy.authorAddress ? `${strategy.authorAddress.slice(0, 6)}...${strategy.authorAddress.slice(-4)}` : 'anon'}
          </div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: riskColors[strategy.riskLevel] + '22', color: riskColors[strategy.riskLevel] || 'var(--color-text-muted)' }}>
          {strategy.riskLevel}
        </span>
      </div>
      {strategy.description && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{strategy.description}</div>}
      {strategy.tags?.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{strategy.tags.map(tag)}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
        <Target size={14} /> {strategy.strategyType || 'custom'}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--color-border-light)' }}>
        <button onClick={() => onLike(strategy.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: strategy.liked ? '#e74c3c' : 'var(--color-text-muted)', fontSize: 13, fontWeight: 600 }}>
          <Heart size={15} fill={strategy.liked ? '#e74c3c' : 'none'} /> {strategy.likes || 0}
        </button>
        <button onClick={() => onFork(strategy.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600 }}>
          <GitFork size={15} /> {strategy.forks || 0}
        </button>
      </div>
    </div>
  )
}

/* ── Publish Modal ──────────────────────────────────────── */
function PublishModal({ onClose, onPublish }) {
  const [form, setForm] = useState({ name: '', description: '', strategyType: 'grid', riskLevel: 'moderate', tags: '' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setSubmitting(true)
    await onPublish({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
    setSubmitting(false)
  }
  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--color-bg)', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Publish Strategy</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input placeholder="Strategy name" value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} />
          <textarea placeholder="Description" value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Type</label>
              <select value={form.strategyType} onChange={e => set('strategyType', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="grid">Grid</option>
                <option value="dca">DCA</option>
                <option value="scalping">Scalping</option>
                <option value="swing">Swing</option>
                <option value="arbitrage">Arbitrage</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, display: 'block' }}>Risk Level</label>
              <select value={form.riskLevel} onChange={e => set('riskLevel', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
          </div>
          <input placeholder="Tags (comma separated)" value={form.tags} onChange={e => set('tags', e.target.value)} style={inputStyle} />
          <button onClick={handleSubmit} disabled={!form.name.trim() || submitting} style={{ padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: form.name.trim() && !submitting ? 'pointer' : 'not-allowed', opacity: form.name.trim() && !submitting ? 1 : 0.5 }}>
            {submitting ? 'Publishing…' : 'Publish Strategy'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Community Page ─────────────────────────────────── */

export default function Community({ onNavigate: _onNavigate }) {
  const [tab, setTab] = useState('leaderboard')

  const tabs = [
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'strategies', label: 'Shared Strategies', icon: Layers },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          <Users size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />Community
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
          Compete on the leaderboard and discover shared trading strategies.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--color-surface)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
              background: active ? 'var(--color-accent)' : 'transparent',
              color: active ? '#fff' : 'var(--color-text-secondary)',
            }}>
              <Icon size={16} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'leaderboard' ? <Leaderboard /> : <StrategiesTab />}
    </div>
  )
}
