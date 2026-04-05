import { useState } from 'react'
import Sidebar from './components/Sidebar'
import WatchlistPage from './pages/WatchlistPage'
import BriefingPage from './pages/BriefingPage'
import ChatPage from './pages/ChatPage'

export default function App() {
  const [activePage, setActivePage] = useState('briefing')

  const pages = {
    briefing: <BriefingPage />,
    watchlist: <WatchlistPage />,
    chat: <ChatPage />,
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        {pages[activePage]}
      </main>
    </div>
  )
}
