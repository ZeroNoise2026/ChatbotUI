import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../api'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [tickers, setTickers] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    api.getTickers().then(setTickers)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const q = input.trim()
    if (!q || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const result = await api.chat(q, ticker || null)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async () => {
    if (!ticker || loading) return
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: `Generate summary for ${ticker}` }])
    try {
      const result = await api.summarize(ticker)
      setMessages(prev => [...prev, { role: 'assistant', content: result.report }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 800 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Chat</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          style={{ width: 140 }}
        >
          <option value="">All tickers</option>
          {tickers.map(t => <option key={t.ticker} value={t.ticker}>{t.ticker}</option>)}
        </select>
        <button
          onClick={handleSummarize}
          disabled={!ticker || loading}
          style={{
            background: '#059669',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '0.8rem',
          }}
        >
          Summarize {ticker || '...'}
        </button>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#18181b',
        borderRadius: 12,
        border: '1px solid #27272a',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginBottom: 16,
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#52525b', textAlign: 'center', marginTop: 80, fontSize: '0.9rem' }}>
            Ask a question about any tracked stock, or select a ticker and click Summarize.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: msg.role === 'user' ? '#1d4ed8' : '#27272a',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: '0.875rem',
            lineHeight: 1.6,
          }}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
            {msg.sources && msg.sources.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #3f3f46', fontSize: '0.7rem', color: '#71717a' }}>
                Sources: {msg.sources.map((s, j) => (
                  <span key={j}>{s.ticker} {s.doc_type} ({s.date}){j < msg.sources.length - 1 ? ', ' : ''}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ color: '#71717a', fontSize: '0.8rem', padding: 8 }}>Thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about a stock..."
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{ background: '#3b82f6', color: '#fff', padding: '8px 20px' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
