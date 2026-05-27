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

      {/* ─── Footer ─── */}
      <div style={{
        marginTop: '2.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" xmlnsInkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="40" height="40" viewBox="0 0 100 100">
          <defs>
            <clipPath id="clip_0">
              <path transform="matrix(1,0,0,-1,0,100)" d="M0 100H100V0H0Z"/>
            </clipPath>
          </defs>
          <g inkscape:groupmode="layer" inkscape:label="Layer 1">
            <g clipPath="url(#clip_0)">
              <path transform="matrix(1,0,0,-1,60.9868,45.0564)" d="M0 0C1.669 1.669 1.669 4.374 0 6.043-1.669 7.712-4.374 7.712-6.043 6.043-7.712 4.374-7.712 1.669-6.043 0-4.374-1.669-1.669-1.669 0 0" fill="#13b47e"/>
              <path transform="matrix(1,0,0,-1,48.9003,32.969903)" d="M0 0C5.006 5.006 13.123 5.006 18.13 0 23.136-5.006 23.136-13.123 18.13-18.13L9.064-27.195 0-18.13C-5.006-13.123-5.006-5.006 0 0M36.259 18.129C21.241 33.149-3.11 33.149-18.129 18.129L-39.281-3.022-45.324-9.064-39.281-15.108 9.064-63.454 15.107-57.411-33.238-9.064-12.086 12.086C-.405 23.768 18.535 23.768 30.216 12.086 41.897 .405 41.897-18.535 30.216-30.216L21.152-39.281 15.107-33.238 24.173-24.173C32.517-15.83 32.517-2.301 24.173 6.043 15.83 14.387 2.301 14.387-6.043 6.043-14.203-2.115-14.382-15.232-6.584-23.61L-6.595-23.621 15.107-45.324 21.152-51.367 27.195-45.324 36.259-36.259C51.278-21.241 51.278 3.11 36.259 18.129" fill="#13b47e"/>
            </g>
          </g>
        </svg>
        <div>
          <strong style={{ color: '#13b47e' }}>PARKCHUNG</strong>
          <span style={{ marginLeft: '0.75rem' }}>version: 1.0.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>📞</span>
          <a href="tel:0903229906" style={{ color: 'inherit', textDecoration: 'none' }}>0903.229.906</a>
          <span style={{ fontSize: '0.75rem' }}>(8:00 AM - 9:00 PM)</span>
        </div>
      </div>
    </div>
  )
}