import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [tickers, setTickers] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const bottomRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    api.getTickers().then(setTickers).catch(() => { })
  }, [])

  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.elapsed = 0
      timerRef.current = setInterval(() => {
        setElapsed(t => { timerRef.elapsed = t + 1; return t + 1 })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const q = input.trim()
    if (!q || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    // Add an empty assistant message that we'll fill incrementally
    const msgIndex = messages.length + 1 // +1 because we just pushed user msg
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '', status: '', streaming: true }])

    let accumulated = ''
    let thinkingText = ''
    let thinkingStart = null
    let thinkingDuration = null

    await api.chatStream(q, ticker || null, {
      onStatus: (text) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[msgIndex] = { ...updated[msgIndex], status: text }
          return updated
        })
      },
      onThinking: (text) => {
        if (!thinkingStart) thinkingStart = Date.now()
        thinkingText += text
        setMessages(prev => {
          const updated = [...prev]
          updated[msgIndex] = { ...updated[msgIndex], thinking: thinkingText }
          return updated
        })
      },
      onToken: (token) => {
        if (thinkingStart && thinkingDuration === null) {
          thinkingDuration = Math.round((Date.now() - thinkingStart) / 1000)
          setMessages(prev => {
            const updated = [...prev]
            updated[msgIndex] = { ...updated[msgIndex], thinkingTime: thinkingDuration }
            return updated
          })
        }
        accumulated += token
        setMessages(prev => {
          const updated = [...prev]
          updated[msgIndex] = { ...updated[msgIndex], content: accumulated }
          return updated
        })
      },
      onError: (errMsg) => {
        accumulated = accumulated || `Error: ${errMsg}`
        setMessages(prev => {
          const updated = [...prev]
          updated[msgIndex] = { ...updated[msgIndex], content: accumulated }
          return updated
        })
      },
      onDone: () => {
        setMessages(prev => {
          const updated = [...prev]
          updated[msgIndex] = {
            ...updated[msgIndex],
            content: accumulated || 'The AI model is busy. Please wait a moment and try again.',
            streaming: false,
            elapsed: timerRef.elapsed,
            thinkingTime: thinkingDuration,
          }
          return updated
        })
        setLoading(false)
      },
    })
  }

  const handleSummarize = async () => {
    if (!ticker || loading) return
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: `Generate summary for ${ticker}` }])
    try {
      const result = await api.summarize(ticker)
      setMessages(prev => [...prev, { role: 'assistant', content: result.report, elapsed: timerRef.elapsed }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, elapsed: timerRef.elapsed }])
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
          style={{ width: 160, minHeight: 36 }}
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
          msg.streaming && !msg.content && !msg.thinking ? null :
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: msg.role === 'user' ? '#1d4ed8' : '#27272a',
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}>
              {msg.role === 'assistant' && msg.thinking && (
                <details open={msg.streaming && !msg.content} style={{ marginBottom: msg.content ? 8 : 0 }}>
                  <summary style={{ cursor: 'pointer', userSelect: 'none', fontSize: '0.8rem', color: '#a1a1aa', listStyle: 'none' }}>
                    🧠 {msg.streaming && !msg.content
                      ? <><span className="thinking-dot" style={{ marginLeft: 4, marginRight: 6 }} />Thinking... ({elapsed}s)</>
                      : `Thought for ${msg.thinkingTime || '?'}s`
                    }
                  </summary>
                  <div
                    ref={el => { if (el && msg.streaming) el.scrollTop = el.scrollHeight }}
                    style={{
                      marginTop: 4,
                      padding: '8px 12px',
                      background: '#1a1a1e',
                      borderRadius: 8,
                      maxHeight: 200,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.78rem',
                      color: '#71717a',
                      fontStyle: 'italic',
                    }}>
                    {msg.thinking}
                  </div>
                </details>
              )}
              <div className={msg.role === 'assistant' ? 'markdown-body' : ''}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #3f3f46', fontSize: '0.7rem', color: '#71717a' }}>
                  Sources: {msg.sources.map((s, j) => (
                    <span key={j}>{s.ticker} {s.doc_type} ({s.date}){j < msg.sources.length - 1 ? ', ' : ''}</span>
                  ))}
                </div>
              )}
              {msg.role === 'assistant' && msg.elapsed != null && (
                <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#52525b' }}>
                  ⏱ Took {msg.elapsed}s
                </div>
              )}
            </div>
        ))}
        {loading && messages.some(m => m.streaming && !m.content && !m.thinking) && (
          <div style={{ color: '#71717a', fontSize: '0.8rem', padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="thinking-dot" />
            {messages.find(m => m.streaming)?.status || 'Processing...'} ({elapsed}s)
          </div>
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
