import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Spinner } from '../components/UI'
import { authApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

function LogoParkchung({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 10 105 90" xmlns="http://www.w3.org/2000/svg">
      <path transform="matrix(1,0,0,-1,60.9868,45.0564)" d="M0 0C1.669 1.669 1.669 4.374 0 6.043-1.669 7.712-4.374 7.712-6.043 6.043-7.712 4.374-7.712 1.669-6.043 0-4.374-1.669-1.669-1.669 0 0" fill="#13b47e"/>
      <path transform="matrix(1,0,0,-1,48.9003,32.969903)" d="M0 0C5.006 5.006 13.123 5.006 18.13 0 23.136-5.006 23.136-13.123 18.13-18.13L9.064-27.195 0-18.13C-5.006-13.123-5.006-5.006 0 0M36.259 18.129C21.241 33.149-3.11 33.149-18.129 18.129L-39.281-3.022-45.324-9.064-39.281-15.108 9.064-63.454 15.107-57.411-33.238-9.064-12.086 12.086C-.405 23.768 18.535 23.768 30.216 12.086 41.897 .405 41.897-18.535 30.216-30.216L21.152-39.281 15.107-33.238 24.173-24.173C32.517-15.83 32.517-2.301 24.173 6.043 15.83 14.387 2.301 14.387-6.043 6.043-14.203-2.115-14.382-15.232-6.584-23.61L-6.595-23.621 15.107-45.324 21.152-51.367 27.195-45.324 36.259-36.259C51.278-21.241 51.278 3.11 36.259 18.129" fill="#13b47e"/>
    </svg>
  )
}

function InputField({ icon, type = 'text', placeholder, value, onChange, onKeyDown, rightSlot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--bg-secondary)',
      borderRadius: 12,
      padding: '14px 16px', border: '1.5px solid var(--border)',
      transition: 'border-color 0.15s',
    }}>
      <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          fontSize: '0.95rem', color: 'var(--text)',
          fontFamily: 'inherit',
        }}
      />
      {rightSlot}
    </div>
  )
}

export default function DangNhap() {
  const navigate = useNavigate()
  const location = useLocation()
  const { dangNhapThanhCong } = useAuth()
  const [form, setForm]               = useState({ sdt: '', mat_khau: '' })
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [hienMatKhau, setHienMatKhau] = useState(false)

  const thongBao = location.state?.thongBao

  function setField(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function dangNhap() {
    if (!form.sdt || !form.mat_khau) { setError('Vui lòng nhập đầy đủ thông tin'); return }
    setLoading(true); setError(null)
    try {
      const data = await authApi.dangNhap(form)
      dangNhapThanhCong(data)
      navigate('/', { replace: true })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* ── Logo & Tên thương hiệu ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 14, marginBottom: '2.5rem',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-secondary)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}>
            <LogoParkchung size={42} />
          </div>
          <span style={{
            fontSize: '1.45rem', fontWeight: 800,
            color: '#13b47e', letterSpacing: '0.04em',
            textShadow: '0 0 8px rgba(19,180,126,0.4)',
          }}>
            Parkchung
          </span>
        </div>

        {/* ── Banner thông báo thành công (từ redirect) ── */}
        {thongBao && (
          <div style={{
            background: 'rgba(19,180,126,0.1)', border: '1px solid rgba(19,180,126,0.3)',
            borderRadius: 12, padding: '12px 14px', color: '#13b47e',
            fontSize: '0.88rem', marginBottom: 16, textAlign: 'center',
          }}>
            ✅ {thongBao}
          </div>
        )}

        {/* ── Tiêu đề ── */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.6rem', fontWeight: 800,
            color: 'var(--text)', margin: 0, marginBottom: 6,
          }}>
            Đăng nhập hệ thống
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            Hệ thống kiểm soát bãi xe di động
          </p>
        </div>

        {/* ── Form ── */}
        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 10, padding: '12px 14px',
            color: 'var(--danger)', fontSize: '0.88rem', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem',
            }}>✕</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InputField
            icon="👤"
            type="tel"
            placeholder="Số điện thoại"
            value={form.sdt}
            onChange={setField('sdt')}
            onKeyDown={e => e.key === 'Enter' && dangNhap()}
          />

          <InputField
            icon="🔒"
            type={hienMatKhau ? 'text' : 'password'}
            placeholder="Mật khẩu"
            value={form.mat_khau}
            onChange={setField('mat_khau')}
            onKeyDown={e => e.key === 'Enter' && dangNhap()}
            rightSlot={
              <button type="button" onClick={() => setHienMatKhau(h => !h)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '1rem', padding: 0, lineHeight: 1,
                display: 'flex', alignItems: 'center',
              }}>
                {hienMatKhau ? '🙈' : '👁️'}
              </button>
            }
          />

          {/* Link quên mật khẩu */}
          <p style={{ textAlign: 'right', fontSize: '0.82rem', margin: '-4px 0 4px' }}>
            <span style={{ color: '#13b47e', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => navigate('/quen-mat-khau')}>
              Quên mật khẩu?
            </span>
          </p>

          {loading && (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <Spinner />
            </div>
          )}

          <button
            onClick={dangNhap}
            disabled={loading}
            style={{
              background: loading ? 'var(--text-muted)' : 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '16px', fontSize: '0.95rem', fontWeight: 800,
              letterSpacing: '0.08em', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, transform 0.1s',
              marginTop: 4,
            }}
            onPointerDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)' }}
            onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            ĐĂNG NHẬP
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, marginTop: 4 }}>
            Chưa có tài khoản?{' '}
            <span
              style={{ color: '#13b47e', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => navigate('/dang-ky')}
            >
              Đăng ký ngay
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}