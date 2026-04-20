import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import WatchlistPage from './pages/WatchlistPage'
import BriefingPage from './pages/BriefingPage'
import ChatPage from './pages/ChatPage'

export default function App() {
  const [activePage, setActivePage] = useState('briefing')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const pages = {
    briefing: <BriefingPage />,
    watchlist: <WatchlistPage />,
    chat: <ChatPage />,
  }

  // close sidebar automatically when switching page on mobile
  const handleNavigate = (id) => {
    setActivePage(id)
    setSidebarOpen(false)
  }

  // close sidebar on resize to desktop to avoid sticky-open state
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="app-shell">
      <button
        className="app-hamburger"
        aria-label="Toggle navigation"
        onClick={() => setSidebarOpen((s) => !s)}
      >
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>
      <div
        className={`app-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        open={sidebarOpen}
      />
      <main className="app-main">
        {pages[activePage]}
      </main>
    </div>
  )
}
