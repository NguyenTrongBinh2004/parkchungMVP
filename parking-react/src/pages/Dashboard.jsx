// src/pages/Dashboard.jsx
import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  {
    id: 'ban-gui-xe',
    label: 'Bảng giữ xe',
    icon: '🅿️',
    items: [
      { label: 'Xe vào',  icon: '📸', path: '/xe-vao',  color: '#22c55e' },
      { label: 'Xe ra',   icon: '📤', path: '/xe-ra',   color: '#ef4444' },
    ],
  },
  {
    id: 'quan-ly',
    label: 'Quản lý',
    icon: '🏷️',
    items: [
      { label: 'Loại xe & giá', icon: '🏷️', path: '/loai-xe', color: '#f59e0b' },
    ],
  },
  {
    id: 'bai-xe',
    label: 'QL Bãi xe',
    icon: '🚗',
    items: [
      { label: 'Trong bãi',  icon: '🅿️', path: '/danh-sach',  color: '#3b82f6' },
      { label: 'Đã ra',      icon: '✅', path: '/xe-da-ra',    color: '#6366f1' },
      { label: 'Tìm xe',     icon: '🔍', path: '/tim-xe',      color: '#06b6d4' },
      { label: 'Vé tháng',   icon: '🎫', path: '/ve-thang',    color: '#f97316' },
      { label: 'Thống kê',   icon: '📊', path: '/thong-ke',    color: '#8b5cf6' },
    ],
  },
  {
    id: 'nguoi-dung',
    label: 'Người dùng',
    icon: '👤',
    items: [
      { label: 'Cài đặt', icon: '⚙️', path: '/cai-dat', color: '#64748b' },
    ],
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()

  // Tab active: giữ lại lựa chọn theo hash, mặc định tab đầu tiên
  const hash = location.hash.replace('#', '') || TABS[0].id
  const activeTab = TABS.find(t => t.id === hash) || TABS[0]

  function setTab(id) {
    navigate({ hash: id }, { replace: true })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      maxWidth: 520,
      margin: '0 auto',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '20px 20px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.6rem' }}>🅿️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em', color: 'var(--text)' }}>
              PARKCHUNG
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
              version: 1.0.0 &nbsp;·&nbsp; 📞 0903.229.906
            </div>
          </div>
        </div>
      </div>

      {/* ── Nội dung tab ── */}
      <div style={{ flex: 1, padding: '24px 16px 20px', overflowY: 'auto' }}>
        <p style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          marginBottom: 16,
        }}>
          {activeTab.label}
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: activeTab.items.length === 1 ? '1fr' : 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {activeTab.items.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: 'var(--bg-secondary)',
                border: `1.5px solid var(--border)`,
                borderRadius: 18,
                padding: '22px 16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                transition: 'transform 0.15s, background 0.15s, border-color 0.15s',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'scale(0.96)'
                e.currentTarget.style.background = `${item.color}18`
                e.currentTarget.style.borderColor = `${item.color}60`
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: `${item.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.6rem',
                border: `1.5px solid ${item.color}40`,
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--text)',
                textAlign: 'center',
              }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        padding: '6px 0 max(6px, env(safe-area-inset-bottom))',
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
      }}>
        {TABS.map(tab => {
          const isActive = tab.id === activeTab.id
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontSize: '1.35rem',
                lineHeight: 1,
                filter: isActive ? 'none' : 'grayscale(0.8) opacity(0.5)',
                transition: 'filter 0.15s',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                letterSpacing: '0.02em',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  width: 20,
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--accent)',
                  marginTop: -2,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}