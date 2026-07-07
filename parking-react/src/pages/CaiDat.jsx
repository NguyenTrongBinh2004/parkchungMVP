// src/pages/CaiDat.jsx
import { PageLayout } from '../components/UI'
import { useTheme } from '../context/ThemeContext'

export default function CaiDat() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <PageLayout title="⚙️ Cài đặt" backTo="/">
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem',
            }}>
              {isDark ? '🌙' : '☀️'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
                Giao diện
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {isDark ? 'Đang dùng chế độ tối' : 'Đang dùng chế độ sáng'}
              </div>
            </div>
          </div>

          {/* Toggle switch */}
          <div
            onClick={toggleTheme}
            style={{
              width: 52, height: 28, borderRadius: 14,
              background: isDark ? '#13b47e' : '#d1d5db',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.25s',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute',
              top: 3, left: isDark ? 27 : 3,
              width: 22, height: 22, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              transition: 'left 0.25s',
            }} />
          </div>
        </div>
      </div>
    </PageLayout>
  )
}