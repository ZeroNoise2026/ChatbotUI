import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api'

export default function BriefingPage() {
  const [briefing, setBriefing] = useState(null)
  const [history, setHistory] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(true)

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

  if (!briefing || !briefing.content) {
    return (
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Daily Briefing</h1>
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
            Add tickers to your watchlist and your first briefing will be generated at 8:00 AM your local time.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Daily Briefing</h1>

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
