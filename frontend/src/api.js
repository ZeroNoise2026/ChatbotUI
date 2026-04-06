const API_BASE = '/api'

function getUserId() {
  let id = localStorage.getItem('quantagent_user_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('quantagent_user_id', id)
  }
  return id
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
    ...options.headers,
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.message || 'Request failed')
  }
  return res.json()
}

export const api = {
  getTickers: () => request('/tickers'),
  getWatchlist: () => request('/watchlist'),
  addToWatchlist: (ticker) => request('/watchlist', { method: 'POST', body: JSON.stringify({ ticker }) }),
  removeFromWatchlist: (ticker) => request(`/watchlist/${ticker}`, { method: 'DELETE' }),

  getPreferences: () => request('/preferences'),
  updatePreferences: (prefs) => request('/preferences', { method: 'PUT', body: JSON.stringify(prefs) }),

  getBriefings: (limit = 7) => request(`/briefings?limit=${limit}`),
  getLatestBriefing: () => request('/briefings/latest'),

  /**
   * SSE streaming chat — calls onToken(text) for each token, onDone() when finished.
   * Returns an abort controller so the caller can cancel.
   */
  chatStream: async (question, ticker, { onToken, onError, onDone }) => {
    const controller = new AbortController()
    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getUserId(),
        },
        body: JSON.stringify({ question, ticker }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Stream request failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              onDone?.()
              return controller
            }
            if (data.startsWith('[Error:')) {
              onError?.(data.replace(/^\[Error:\s*/, '').replace(/\]$/, ''))
              onDone?.()
              return controller
            }
            try { onToken?.(JSON.parse(data)) } catch { onToken?.(data) }
          }
        }
      }
      onDone?.()
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err.message)
      }
      onDone?.()
    }
    return controller
  },

  summarize: (ticker) => request('/summarize', {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  }),

  getUserId,
}
