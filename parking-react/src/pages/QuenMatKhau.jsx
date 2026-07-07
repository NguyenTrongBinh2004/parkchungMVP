import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '../components/UI'
import { authApi } from '../services/api'

function LogoParkchung({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 10 105 90" xmlns="http://www.w3.org/2000/svg">
      <path transform="matrix(1,0,0,-1,60.9868,45.0564)" d="M0 0C1.669 1.669 1.669 4.374 0 6.043-1.669 7.712-4.374 7.712-6.043 6.043-7.712 4.374-7.712 1.669-6.043 0-4.374-1.669-1.669-1.669 0 0" fill="#13b47e"/>
      <path transform="matrix(1,0,0,-1,48.9003,32.969903)" d="M0 0C5.006 5.006 13.123 5.006 18.13 0 23.136-5.006 23.136-13.123 18.13-18.13L9.064-27.195 0-18.13C-5.006-13.123-5.006-5.006 0 0M36.259 18.129C21.241 33.149-3.11 33.149-18.129 18.129L-39.281-3.022-45.324-9.064-39.281-15.108 9.064-63.454 15.107-57.411-33.238-9.064-12.086 12.086C-.405 23.768 18.535 23.768 30.216 12.086 41.897 .405 41.897-18.535 30.216-30.216L21.152-39.281 15.107-33.238 24.173-24.173C32.517-15.83 32.517-2.301 24.173 6.043 15.83 14.387 2.301 14.387-6.043 6.043-14.203-2.115-14.382-15.232-6.584-23.61L-6.595-23.621 15.107-45.324 21.152-51.367 27.195-45.324 36.259-36.259C51.278-21.241 51.278 3.11 36.259 18.129" fill="#13b47e"/>
    </svg>
  )
}

function useCountdown() {
  const [conLai, setConLai] = useState(0)
  const ref = useRef(null)
  function batDau(giay) {
    setConLai(giay)
    clearInterval(ref.current)
    ref.current = setInterval(() => {
      setConLai(c => { if (c <= 1) { clearInterval(ref.current); return 0 } return c - 1 })
    }, 1000)
  }
  useEffect(() => () => clearInterval(ref.current), [])
  return { conLai, batDau }
}

function OTPInput({ value, onChange, disabled }) {
  const refs = Array.from({ length: 6 }, () => useRef(null))
  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      onChange(value.slice(0, i) + value.slice(i + 1))
      if (i > 0) refs[i - 1].current?.focus()
    } else if (/^[0-9]$/.test(e.key)) {
      const next = (value.slice(0, i) + e.key + value.slice(i + 1)).slice(0, 6)
      onChange(next)
      if (i < 5) refs[i + 1].current?.focus()
    }
  }
  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    refs[Math.min(pasted.length, 5)].current?.focus()
  }
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '1.5rem 0' }}>
      {refs.map((ref, i) => (
        <input key={i} ref={ref} type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ''} disabled={disabled}
          onKeyDown={e => handleKey(i, e)} onPaste={handlePaste}
          onChange={() => {}} onClick={() => ref.current?.select()}
          style={{
            width: 44, height: 54, textAlign: 'center',
            fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace',
            background: value[i] ? 'rgba(19,180,126,0.08)' : 'var(--bg-secondary)',
            border: `2px solid ${value[i] ? '#13b47e' : 'var(--border)'}`,
            borderRadius: 10, color: 'var(--text)', outline: 'none',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        />
      ))}
    </div>
  )
}

function ErrorBanner({ message, onClose }) {
  if (!message) return null
  return (
    <div style={{
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 12, padding: '12px 14px', color: '#f87171',
      fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
    }}>
      ⚠️ {message}
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
    </div>
  )
}

function PrimaryButton({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? 'var(--bg-secondary)' : '#13b47e',
      color: disabled ? 'var(--text-muted)' : '#fff',
      border: 'none', borderRadius: 14, padding: '16px', width: '100%',
      fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.08em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 20px rgba(19,180,126,0.35)',
      transition: 'background 0.15s',
    }}
      onPointerDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)' }}
      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </button>
  )
}

function OutlineButton({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'none', width: '100%',
      color: disabled ? 'var(--text-muted)' : 'var(--text)',
      border: `1.5px solid ${disabled ? 'var(--border)' : 'var(--border)'}`,
      borderRadius: 14, padding: '14px', fontSize: '0.9rem', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'border-color 0.15s',
    }}>
      {children}
    </button>
  )
}

export default function QuenMatKhau() {
  const navigate = useNavigate()
  const [buoc, setBuoc]               = useState(1) // 1=nhập SĐT, 2=OTP, 3=mật khẩu mới
  const [sdt, setSdt]                 = useState('')
  const [otp, setOtp]                 = useState('')
  const [sandboxOtp, setSandboxOtp]   = useState(null)
  const [matKhau, setMatKhau]         = useState('')
  const [matKhau2, setMatKhau2]       = useState('')
  const [hienMk, setHienMk]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [focusSdt, setFocusSdt]       = useState(false)
  const [focusMk, setFocusMk]         = useState(false)
  const [focusMk2, setFocusMk2]       = useState(false)
  const otpTimer = useCountdown()
  const cooldown = useCountdown()

  function fmtGiay(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}` }

  const inputRow = (focused) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--bg-secondary)', borderRadius: 14,
    padding: '15px 18px',
    border: `1.5px solid ${focused ? '#13b47e' : 'var(--border)'}`,
    transition: 'border-color 0.2s',
  })

  const logoBlock = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: '2rem' }}>
      <div style={{
        width: 62, height: 62, borderRadius: '50%',
        border: '1.5px solid var(--border)', background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(19,180,126,0.15)',
      }}>
        <LogoParkchung size={40} />
      </div>
      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#13b47e', letterSpacing: '0.05em', textShadow: '0 0 8px rgba(19,180,126,0.4)' }}>
        Parkchung
        Parkchung
      </span>
    </div>
  )

  // ── Bước 1: Nhập SĐT ─────────────────────────────────────────
  async function guiOTP() {
    setLoading(true); setError(null)
    try {
      const res = await authApi.quenMatKhau({ sdt })
      setBuoc(2); otpTimer.batDau(300); cooldown.batDau(60)
      if (res.otp_sandbox) setSandboxOtp(res.otp_sandbox)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── Bước 2: Xác nhận OTP ─────────────────────────────────────
  async function xacNhanOTP() {
    if (otp.length < 6) { setError('Vui lòng nhập đủ 6 chữ số'); return }
    setLoading(true); setError(null)
    try {
      await authApi.xacNhanOtpQmk({ sdt, ma_otp: otp })
      setBuoc(3)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function guiLaiOTP() {
    setLoading(true); setError(null)
    try {
      const res = await authApi.quenMatKhau({ sdt })
      setOtp(''); otpTimer.batDau(300); cooldown.batDau(60)
      if (res.otp_sandbox) setSandboxOtp(res.otp_sandbox)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── Bước 3: Đặt mật khẩu mới ─────────────────────────────────
  async function datLaiMatKhau() {
    if (matKhau !== matKhau2) { setError('Mật khẩu xác nhận không khớp'); return }
    setLoading(true); setError(null)
    try {
      await authApi.datLaiMatKhau({ sdt, ma_otp: otp, mat_khau: matKhau })
      navigate('/dang-nhap', { replace: true, state: { thongBao: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' } })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const pageStyle = {
    minHeight: '100dvh', background: 'var(--bg)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '32px 24px',
  }
  const wrapStyle = { width: '100%', maxWidth: 360 }

  // ── Render bước 1 ─────────────────────────────────────────────
  if (buoc === 1) return (
    <div style={pageStyle}><div style={wrapStyle}>
      {logoBlock}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>Quên mật khẩu</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>Nhập số điện thoại đã đăng ký để nhận mã OTP</p>
      </div>
      <ErrorBanner message={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={inputRow(focusSdt)}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📱</span>
          <input type="tel" inputMode="tel" placeholder="Số điện thoại"
            value={sdt} onChange={e => setSdt(e.target.value)}
            onFocus={() => setFocusSdt(true)} onBlur={() => setFocusSdt(false)}
            onKeyDown={e => e.key === 'Enter' && guiOTP()}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '0.97rem', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        </div>
        {loading && <div style={{ textAlign: 'center' }}><Spinner /></div>}
        <PrimaryButton onClick={guiOTP} disabled={loading || !sdt.trim()}>GỬI MÃ OTP</PrimaryButton>
        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          <span style={{ color: '#13b47e', cursor: 'pointer', fontWeight: 700 }} onClick={() => navigate('/dang-nhap')}>← Quay lại đăng nhập</span>
        </p>
      </div>
    </div></div>
  )

  // ── Render bước 2 ─────────────────────────────────────────────
  if (buoc === 2) return (
    <div style={pageStyle}><div style={wrapStyle}>
      {logoBlock}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>Xác nhận OTP</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>Mã gồm 6 chữ số đã được gửi đến</p>
        <p style={{ color: 'var(--text)', fontSize: '0.95rem', fontWeight: 700, margin: '4px 0 0', fontFamily: 'monospace' }}>{sdt}</p>
      </div>
      <ErrorBanner message={error} onClose={() => setError(null)} />
      {sandboxOtp && (
        <div style={{
          background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          color: '#fbbf24', fontSize: '0.88rem', textAlign: 'center',
        }}>
          🧪 Sandbox — Mã OTP:{' '}
          <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: 4 }}>{sandboxOtp}</strong>
        </div>
      )}
      <OTPInput value={otp} onChange={setOtp} disabled={loading} />
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        {otpTimer.conLai > 0 ? (
          <>Mã hết hạn sau{' '}
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: otpTimer.conLai <= 60 ? '#f87171' : '#13b47e' }}>
              {fmtGiay(otpTimer.conLai)}
            </span>
          </>
        ) : <span style={{ color: '#f87171', fontWeight: 600 }}>Mã OTP đã hết hạn</span>}
      </p>
      {loading && <div style={{ textAlign: 'center', marginBottom: 12 }}><Spinner /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton onClick={xacNhanOTP} disabled={loading || otp.length < 6 || otpTimer.conLai === 0}>XÁC NHẬN</PrimaryButton>
        <OutlineButton onClick={guiLaiOTP} disabled={loading || cooldown.conLai > 0}>
          {cooldown.conLai > 0 ? `Gửi lại sau ${cooldown.conLai}s` : '🔄 Gửi lại mã'}
        </OutlineButton>
      </div>
      <button type="button" onClick={() => { setBuoc(1); setOtp(''); setError(null) }}
        style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer' }}>
        ← Quay lại
      </button>
    </div></div>
  )

  // ── Render bước 3 ─────────────────────────────────────────────
  return (
    <div style={pageStyle}><div style={wrapStyle}>
      {logoBlock}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>Mật khẩu mới</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>Nhập mật khẩu mới cho tài khoản của bạn</p>
      </div>
      <ErrorBanner message={error} onClose={() => setError(null)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={inputRow(focusMk)}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔒</span>
          <input type={hienMk ? 'text' : 'password'} placeholder="Mật khẩu mới"
            value={matKhau} onChange={e => setMatKhau(e.target.value)}
            onFocus={() => setFocusMk(true)} onBlur={() => setFocusMk(false)}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '0.97rem', color: 'var(--text)', fontFamily: 'inherit' }}
          />
          <button type="button" onClick={() => setHienMk(h => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: 0 }}>
            {hienMk ? '🙈' : '👁️'}
          </button>
        </div>
        <div style={inputRow(focusMk2)}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔒</span>
          <input type={hienMk ? 'text' : 'password'} placeholder="Xác nhận mật khẩu mới"
            value={matKhau2} onChange={e => setMatKhau2(e.target.value)}
            onFocus={() => setFocusMk2(true)} onBlur={() => setFocusMk2(false)}
            onKeyDown={e => e.key === 'Enter' && datLaiMatKhau()}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '0.97rem', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        </div>
        {loading && <div style={{ textAlign: 'center' }}><Spinner /></div>}
        <PrimaryButton onClick={datLaiMatKhau} disabled={loading || !matKhau || !matKhau2}>ĐẶT LẠI MẬT KHẨU</PrimaryButton>
      </div>
    </div></div>
  )
}