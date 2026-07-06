// src/pages/Dashboard.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LogoParkchung({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 10 105 90" xmlns="http://www.w3.org/2000/svg">
      <path transform="matrix(1,0,0,-1,60.9868,45.0564)" d="M0 0C1.669 1.669 1.669 4.374 0 6.043-1.669 7.712-4.374 7.712-6.043 6.043-7.712 4.374-7.712 1.669-6.043 0-4.374-1.669-1.669-1.669 0 0" fill="#13b47e"/>
      <path transform="matrix(1,0,0,-1,48.9003,32.969903)" d="M0 0C5.006 5.006 13.123 5.006 18.13 0 23.136-5.006 23.136-13.123 18.13-18.13L9.064-27.195 0-18.13C-5.006-13.123-5.006-5.006 0 0M36.259 18.129C21.241 33.149-3.11 33.149-18.129 18.129L-39.281-3.022-45.324-9.064-39.281-15.108 9.064-63.454 15.107-57.411-33.238-9.064-12.086 12.086C-.405 23.768 18.535 23.768 30.216 12.086 41.897 .405 41.897-18.535 30.216-30.216L21.152-39.281 15.107-33.238 24.173-24.173C32.517-15.83 32.517-2.301 24.173 6.043 15.83 14.387 2.301 14.387-6.043 6.043-14.203-2.115-14.382-15.232-6.584-23.61L-6.595-23.621 15.107-45.324 21.152-51.367 27.195-45.324 36.259-36.259C51.278-21.241 51.278 3.11 36.259 18.129" fill="#13b47e"/>
    </svg>
  )
}

const TABS = [
  {
    id: 'ban-gui-xe',
    label: 'Bảng giữ xe',
    icon: <LogoParkchung size={24} />,
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
  const { dangXuat, tenBaiXe } = useAuth()

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
          <LogoParkchung size={40} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em', color: '#13b47e', textShadow: '0 0 8px rgba(19,180,126,0.4)' }}>
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

        {/* Header tên bãi xe — chỉ hiện ở tab Người dùng */}
        {activeTab.id === 'nguoi-dung' && tenBaiXe && (
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 14,
            padding: '14px 16px', marginBottom: 12,
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.4rem' }}>🏢</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bãi xe</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{tenBaiXe}</div>
            </div>
          </div>
        )}

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
                background: item.color,
                border: 'none',
                borderRadius: 18,
                padding: '28px 16px 22px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transition: 'transform 0.12s, filter 0.12s',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: `0 4px 20px ${item.color}55`,
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'scale(0.94)'
                e.currentTarget.style.filter = 'brightness(0.85)'
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.filter = 'brightness(1)'
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.filter = 'brightness(1)'
              }}
            >
              <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{item.icon}</span>
              <span style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#fff',
                textAlign: 'center',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Nút đăng xuất — chỉ hiện ở tab Người dùng */}
        {activeTab.id === 'nguoi-dung' && (
          <button
            onClick={async () => {
              if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
                await dangXuat()
              }
            }}
            style={{
              marginTop: 16,
              width: '100%',
              background: 'rgba(239,68,68,0.1)',
              border: '1.5px solid rgba(239,68,68,0.3)',
              borderRadius: 14,
              padding: '15px',
              color: '#f87171',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.15s',
            }}
            onPointerDown={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)' }}
            onPointerUp={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onPointerLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          >
            🚪 Đăng xuất
          </button>
        )}
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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