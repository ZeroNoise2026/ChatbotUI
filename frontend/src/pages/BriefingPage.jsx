import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api'

export default function BriefingPage() {
  const [briefing, setBriefing] = useState(null)
  const [history, setHistory] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const loadBriefings = () => {
    return api.getBriefings(7).then(data => {
      setHistory(data)
      if (data.length > 0) {
        setBriefing(data[0])
        setSelectedIdx(0)
      }
    })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      await api.refreshBriefing()
      await loadBriefings()
    } catch (e) {
      setError(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    api.getBriefings(7)
      .then(data => {
        setHistory(data)
        if (data.length > 0) setBriefing(data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  const selectBriefing = (idx) => {
    setSelectedIdx(idx)
    setBriefing(history[idx])
  }

  if (loading) return <div style={{ padding: 40, color: '#71717a' }}>Loading...</div>

  const refreshButton = (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      style={{
        padding: '8px 16px',
        fontSize: '0.85rem',
        fontWeight: 600,
        background: refreshing ? '#27272a' : '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: refreshing ? 'not-allowed' : 'pointer',
        opacity: refreshing ? 0.6 : 1,
      }}
    >
      {refreshing ? 'Generating...' : '↻ Refresh'}
    </button>
  )

  if (!briefing || !briefing.content) {
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Daily Briefing</h1>
          {refreshButton}
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
        <div style={{
          marginTop: 32,
          padding: 32,
          background: '#18181b',
          borderRadius: 12,
          border: '1px solid #27272a',
          textAlign: 'center',
          color: '#71717a',
        }}>
          <p style={{ fontSize: '1.125rem', marginBottom: 8 }}>No briefings yet</p>
          <p style={{ fontSize: '0.875rem' }}>
            Add tickers to your watchlist and click Refresh, or your first briefing will be generated at 8:00 AM your local time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Daily Briefing</h1>
        {refreshButton}
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}

      {history.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {history.map((b, i) => (
            <button
              key={b.briefing_date}
              onClick={() => selectBriefing(i)}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                background: i === selectedIdx ? '#3b82f6' : '#27272a',
                color: i === selectedIdx ? '#fff' : '#a1a1aa',
                borderRadius: 6,
              }}
            >
              {b.briefing_date}
            </button>
          ))}
        </div>
      )}

      <div style={{
        background: '#18181b',
        borderRadius: 12,
        border: '1px solid #27272a',
        padding: 24,
      }}>
        <div style={{ fontSize: '0.75rem', color: '#71717a', marginBottom: 12 }}>
          {briefing.briefing_date} &middot; {briefing.tickers?.join(', ')}
        </div>
        <div className="markdown-body" style={{ lineHeight: 1.7, fontSize: '0.9rem' }}>
          <ReactMarkdown>{briefing.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
