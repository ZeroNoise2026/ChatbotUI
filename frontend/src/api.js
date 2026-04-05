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

  chat: (question, ticker = null) => request('/chat', {
    method: 'POST',
    body: JSON.stringify({ question, ticker }),
  }),

  summarize: (ticker) => request('/summarize', {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  }),

  getUserId,
}
