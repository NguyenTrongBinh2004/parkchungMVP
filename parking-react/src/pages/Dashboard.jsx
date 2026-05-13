import { useNavigate } from 'react-router-dom'

const MENUS = [
  { icon: '📸', label: 'Xe vào',       path: '/xe-vao' },
  { icon: '📤', label: 'Xe ra',        path: '/xe-ra' },
  { icon: '📋', label: 'DS trong bãi', path: '/danh-sach' },
  { icon: '🎫', label: 'Vé tháng',     path: '/ve-thang' },
  { icon: '⚙️', label: 'Cài đặt',      path: '/cai-dat' },
  { icon: '🏷️', label: 'Loại xe',      path: '/loai-xe' },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <h3 style={{ marginBottom: '1.25rem', fontFamily: 'var(--font-mono)' }}>
        🏍️ Parking MVP
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {MENUS.map(m => (
          <button
            key={m.path}
            className="menu-card"
            onClick={() => navigate(m.path)}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{m.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{m.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}