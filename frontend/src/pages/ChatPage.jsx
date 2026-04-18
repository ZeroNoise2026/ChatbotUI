import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../api'
import { relativeTime } from '../utils/date'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [watchlist, setWatchlist] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const bottomRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    api.getWatchlist()
      .then(items => setWatchlist((items || []).map(w => w.ticker)))
      .catch(() => setWatchlist([]))
    refreshSessions()
  }, [])

  const refreshSessions = useCallback(async () => {
    try {
      const list = await api.listChatSessions()
      setSessions(list || [])
    } catch {
      setSessions([])
    }
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

  const loadSession = async (sid) => {
    if (loading) return
    setCurrentSessionId(sid)
    setLoadingMessages(true)
    try {
      const resp = await api.getChatSessionMessages(sid)
      const msgs = Array.isArray(resp) ? resp : (resp?.messages || [])
      setMessages(msgs.map(m => ({
        role: m.role,
        content: m.content,
        streaming: false,
      })))
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }

  const newChat = () => {
    if (loading) return
    setCurrentSessionId(null)
    setMessages([])
    setInput('')
  }

  const deleteSession = async (sid, e) => {
    e?.stopPropagation()
    if (!confirm('Delete this chat session?')) return
    try {
      await api.deleteChatSession(sid)
      if (sid === currentSessionId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      refreshSessions()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const clearAll = async () => {
    if (!confirm('Delete ALL chat sessions? This cannot be undone.')) return
    try {
      await api.deleteAllChatSessions()
      setCurrentSessionId(null)
      setMessages([])
      setSessions([])
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const sendMessage = async (textArg, forceTicker = null) => {
    const q = (textArg ?? input).trim()
    if (!q || loading) return

    if (textArg == null) setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    const msgIndex = (prev => prev.length + 1)(messages)
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '', status: '', streaming: true }])

    let accumulated = ''
    let thinkingText = ''
    let thinkingStart = null
    let thinkingDuration = null

    await api.chatStream(q, {
      forceTicker,
      contextTickers: watchlist,
      sessionId: currentSessionId,
      onSession: ({ id, is_new }) => {
        if (id && id !== currentSessionId) setCurrentSessionId(id)
        if (is_new) refreshSessions()
      },
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
      onClarification: ({ question, options }) => {
        setMessages(prev => {
          const updated = [...prev]
          updated[msgIndex] = {
            role: 'assistant',
            type: 'clarification',
            originalQuery: question,
            options: options || [],
            streaming: false,
          }
          return updated
        })
        setLoading(false)
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
          if (updated[msgIndex]?.type === 'clarification') return updated
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
        refreshSessions()
      },
    })
  }

  const handleClarificationClick = (originalQuery, ticker) => {
    sendMessage(`${originalQuery} (focus: $${ticker})`, ticker)
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 12 }}>
      {/* Left panel: session list */}
      <div style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ padding: 12, borderBottom: '1px solid #27272a' }}>
          <button
            onClick={newChat}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#3b82f6',
              color: '#fff',
              fontSize: '0.85rem',
              borderRadius: 8,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            + New chat
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
          {sessions.length === 0 ? (
            <div style={{ padding: 12, color: '#52525b', fontSize: '0.75rem', textAlign: 'center' }}>
              No chats yet
            </div>
          ) : sessions.map(s => (
            <div
              key={s.id}
              onClick={() => loadSession(s.id)}
              className="session-item"
              style={{
                padding: '8px 10px',
                marginBottom: 2,
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
                background: s.id === currentSessionId ? '#27272a' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: s.id === currentSessionId ? '#fff' : '#d4d4d8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s.title || 'Untitled'}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#71717a', marginTop: 2 }}>
                  {relativeTime(s.last_message_at)} · {s.message_count || 0}
                </div>
              </div>
              <button
                onClick={(e) => deleteSession(s.id, e)}
                title="Delete"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  fontSize: '0.9rem',
                  opacity: 0.6,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {sessions.length > 0 && (
          <div style={{ padding: 8, borderTop: '1px solid #27272a' }}>
            <button
              onClick={clearAll}
              style={{
                width: '100%',
                padding: '6px',
                background: 'transparent',
                color: '#71717a',
                fontSize: '0.7rem',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Right panel: chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 800, minWidth: 0 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Chat</h1>

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
          {loadingMessages && (
            <div style={{ color: '#52525b', textAlign: 'center', marginTop: 40, fontSize: '0.85rem' }}>
              Loading messages…
            </div>
          )}
          {!loadingMessages && messages.length === 0 && (
            <div style={{ color: '#52525b', textAlign: 'center', marginTop: 80, fontSize: '0.9rem' }}>
              {watchlist.length > 0
                ? `Ask anything about ${watchlist.slice(0, 3).join(', ')}${watchlist.length > 3 ? '…' : ''} or the market.`
                : 'Ask a question. Tip: add tickers to your Watchlist so we can auto-scope follow-ups.'}
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
                {msg.role === 'assistant' && msg.type === 'clarification' ? (
                  <div>
                    <div style={{ marginBottom: 10, color: '#d4d4d8' }}>
                      Which ticker should I focus on?
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {msg.options.map(t => (
                        <button
                          key={t}
                          onClick={() => handleClarificationClick(msg.originalQuery, t)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            background: '#3f3f46',
                            color: '#fff',
                            border: '1px solid #52525b',
                            borderRadius: 999,
                            cursor: 'pointer',
                          }}
                        >
                          ${t}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
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
                    {msg.role === 'assistant' && msg.elapsed != null && (
                      <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#52525b' }}>
                        ⏱ Took {msg.elapsed}s
                      </div>
                    )}
                  </>
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
            placeholder="Ask about a stock or the market..."
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{ background: '#3b82f6', color: '#fff', padding: '8px 20px' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
