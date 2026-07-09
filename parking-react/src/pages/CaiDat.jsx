// src/pages/CaiDat.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Field, Alert } from '../components/UI'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'

function DoiMatKhauCard() {
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
      // Backend đã thu hồi mọi refresh token — đăng xuất phía client rồi chuyển về trang đăng nhập
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

  if (thanhCong) {
    return (
      <div className="card" style={{ padding: '1.25rem', marginTop: 14 }}>
        <Alert type="success">
          Đổi mật khẩu thành công. Đang chuyển về trang đăng nhập...
        </Alert>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1.25rem', marginTop: 14 }}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 4 }}>
        🔒 Đổi mật khẩu
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
        Sau khi đổi, bạn sẽ cần đăng nhập lại trên mọi thiết bị.
      </div>

      <form onSubmit={submit}>
        <Field label="Mật khẩu hiện tại" required>
          <input type="password" value={form.hienTai} onChange={upd('hienTai')} required autoComplete="current-password" />
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
    </div>
  )
}

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

      <DoiMatKhauCard />
    </PageLayout>
  )
}