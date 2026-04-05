const NAV_ITEMS = [
  { id: 'briefing', label: 'Daily Briefing', icon: '\u{1f4cb}' },
  { id: 'watchlist', label: 'Watchlist', icon: '\u{2b50}' },
  { id: 'chat', label: 'Chat', icon: '\u{1f4ac}' },
]

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <nav style={{
      width: 220,
      background: '#18181b',
      borderRight: '1px solid #27272a',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
    }}>
      <div style={{
        padding: '0 20px 24px',
        fontSize: '1.125rem',
        fontWeight: 700,
        color: '#3b82f6',
        letterSpacing: '-0.025em',
      }}>
        QuantAgent
      </div>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            background: activePage === item.id ? '#27272a' : 'transparent',
            color: activePage === item.id ? '#fff' : '#a1a1aa',
            borderRadius: 0,
            fontSize: '0.875rem',
            textAlign: 'left',
          }}
        >
          <span>{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 20px', fontSize: '0.75rem', color: '#52525b' }}>
        v1.0
      </div>
    </nav>
  )
}
