// src/pages/CaiDat.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Field, Alert, Modal } from '../components/UI'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'

// ─── Hàng cài đặt dùng chung (giống style hàng "Giao diện") ───────
function SettingRow({ icon, title, subtitle, right, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'var(--row-icon-bg, rgba(0,0,0,0.06))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
            {title}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>
      {right}
    </div>
  )
}

// ─── Modal đổi mật khẩu ────────────────────────────────────────
function DoiMatKhauModal({ onClose }) {
  const { dangXuat } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ hienTai: '', moi: '', xacNhan: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [thanhCong, setThanhCong] = useState(false)

  const upd = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(null)

    if (form.moi.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (!/[a-zA-Z]/.test(form.moi) || !/[0-9]/.test(form.moi)) {
      setError('Mật khẩu mới phải có ít nhất 1 chữ cái và 1 chữ số.')
      return
    }
    if (form.moi !== form.xacNhan) {
      setError('Xác nhận mật khẩu mới không khớp.')
      return
    }

    setLoading(true)
    try {
      await authApi.doiMatKhau({
        mat_khau_hien_tai: form.hienTai,
        mat_khau_moi: form.moi,
      })
      setThanhCong(true)
      setTimeout(async () => {
        await dangXuat()
        navigate('/dang-nhap')
      }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="🔒 Đổi mật khẩu">
      {thanhCong ? (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 8,
          background: 'rgba(19, 180, 126, 0.12)',
          border: '1px solid rgba(19, 180, 126, 0.35)',
          color: '#13b47e',
          fontSize: '0.88rem',
        }}>
          ✓ Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập...
        </div>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.9rem' }}>
            Sau khi đổi, bạn sẽ cần đăng nhập lại trên mọi thiết bị.
          </p>
          <Field label="Mật khẩu hiện tại" required>
            <input type="password" value={form.hienTai} onChange={upd('hienTai')} required autoComplete="current-password" autoFocus />
          </Field>
          <Field label="Mật khẩu mới" required>
            <input type="password" value={form.moi} onChange={upd('moi')} required autoComplete="new-password" minLength={8} />
          </Field>
          <Field label="Xác nhận mật khẩu mới" required>
            <input type="password" value={form.xacNhan} onChange={upd('xacNhan')} required autoComplete="new-password" minLength={8} />
          </Field>

          {error && <Alert type="danger">{error}</Alert>}

          <button type="submit" className="btn btn-accent" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Đang lưu...' : '✓ Đổi mật khẩu'}
          </button>
        </form>
      )}
    </Modal>
  )
}

// ─── Trang Cài đặt ─────────────────────────────────────────────
export default function CaiDat() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [showDoiMatKhau, setShowDoiMatKhau] = useState(false)

  return (
    <PageLayout title="⚙️ Cài đặt" backTo="/">
      <div className="card" style={{ padding: '1.25rem' }}>
        <SettingRow
          icon={isDark ? '🌙' : '☀️'}
          title="Giao diện"
          subtitle={isDark ? 'Đang dùng chế độ tối' : 'Đang dùng chế độ sáng'}
          right={
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
          }
        />
      </div>

      <div className="card" style={{ padding: '1.25rem', marginTop: 14 }}>
        <SettingRow
          icon="🔒"
          title="Đổi mật khẩu"
          subtitle="Cập nhật mật khẩu đăng nhập"
          onClick={() => setShowDoiMatKhau(true)}
          right={<span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>}
        />
      </div>

      {showDoiMatKhau && (
        <DoiMatKhauModal onClose={() => setShowDoiMatKhau(false)} />
      )}
    </PageLayout>
  )
}