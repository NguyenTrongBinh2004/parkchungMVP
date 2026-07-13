// src/pages/CaiDat.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Field, Alert, Modal } from '../components/UI'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { authApi, baiXeApi } from '../services/api'

// ─── Hàng cài đặt dùng chung ─────────────────────────────────
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

// ─── Hiển thị điều kiện mật khẩu ────────────────────────────
function DieuKienMatKhau({ matKhau }) {
  const dieuKien = [
    { dat: matKhau.length >= 8 && matKhau.length <= 20, label: 'Từ 8 đến 20 ký tự' },
    { dat: /[a-zA-Z]/.test(matKhau), label: 'Có ít nhất 1 chữ cái' },
    { dat: /[A-Z]/.test(matKhau), label: 'Có ít nhất 1 chữ hoa' },
    { dat: /[0-9]/.test(matKhau), label: 'Có ít nhất 1 chữ số' },
  ]
  return (
    <div style={{ margin: '-0.4rem 0 0.9rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {dieuKien.map((dk, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: dk.dat ? '#13b47e' : 'var(--text-muted)' }}>
          <span>{dk.dat ? '✓' : '○'}</span>
          <span>{dk.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Modal đổi mật khẩu ──────────────────────────────────────
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

    if (form.moi.length < 8 || form.moi.length > 20) {
      setError('Mật khẩu mới phải từ 8 đến 20 ký tự.')
      return
    }
    if (!/[a-zA-Z]/.test(form.moi) || !/[0-9]/.test(form.moi)) {
      setError('Mật khẩu mới phải có ít nhất 1 chữ cái và 1 chữ số.')
      return
    }
    if (!/[A-Z]/.test(form.moi)) {
      setError('Mật khẩu mới phải có ít nhất 1 chữ hoa.')
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
            <input
              type="password"
              value={form.moi}
              onChange={upd('moi')}
              required
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore
              minLength={8}
              maxLength={20}
            />
          </Field>
          <DieuKienMatKhau matKhau={form.moi} />
          <Field label="Xác nhận mật khẩu mới" required>
            <input
              type="password"
              value={form.xacNhan}
              onChange={upd('xacNhan')}
              required
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore
              minLength={8}
              maxLength={20}
            />
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

// ─── Modal thông tin bãi xe (đã bỏ trường so_cho) ─────────────
function ThongTinBaiXeModal({ onClose }) {
  const [form, setForm] = useState({
    ten: '', dia_chi: '', mo_ta: '',
    gio_mo_cua: '', gio_dong_cua: '',
    cac_ngay_hoat_dong: [],
    tien_ich: [],
  })
  const [tienIchList, setTienIchList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [data, tienIchData] = await Promise.all([
          baiXeApi.layThongTin(),
          baiXeApi.layTienIchKhaDung(),
        ])
        setForm({
          ten: data.ten || '',
          // so_cho đã bị xóa khỏi API, không cần set
          dia_chi: data.dia_chi || '',
          mo_ta: data.mo_ta || '',
          gio_mo_cua: data.gio_mo_cua || '',
          gio_dong_cua: data.gio_dong_cua || '',
          cac_ngay_hoat_dong: data.cac_ngay_hoat_dong || [],
          tien_ich: data.tien_ich || [],
        })
        setTienIchList(tienIchData.tien_ich || [])
      } catch (err) {
        setError('Không thể tải thông tin bãi xe.')
      }
    })()
  }, [])

  const upd = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const toggleNgay = (ngay) => {
    setForm(f => {
      const daChon = f.cac_ngay_hoat_dong.includes(ngay)
      return {
        ...f,
        cac_ngay_hoat_dong: daChon
          ? f.cac_ngay_hoat_dong.filter(n => n !== ngay)
          : [...f.cac_ngay_hoat_dong, ngay].sort(),
      }
    })
  }

  const toggleTienIch = (key) => {
    setForm(f => {
      const co = f.tien_ich.includes(key)
      return {
        ...f,
        tien_ich: co ? f.tien_ich.filter(t => t !== key) : [...f.tien_ich, key],
      }
    })
  }

  const labelNgay = (n) => ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'][n-1]

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.ten.trim()) { setError('Tên bãi xe không được để trống.'); return }
    // Bỏ kiểm tra so_cho
    setLoading(true)
    try {
      await baiXeApi.capNhat({
        ten: form.ten.trim(),
        // so_cho không gửi nữa
        dia_chi: form.dia_chi.trim(),
        mo_ta: form.mo_ta.trim(),
        gio_mo_cua: form.gio_mo_cua || null,
        gio_dong_cua: form.gio_dong_cua || null,
        cac_ngay_hoat_dong: form.cac_ngay_hoat_dong.length > 0 ? form.cac_ngay_hoat_dong : null,
        tien_ich: form.tien_ich.length > 0 ? form.tien_ich : null,
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="🏢 Thông tin bãi xe">
      {success ? (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 8,
          background: 'rgba(19, 180, 126, 0.12)',
          border: '1px solid rgba(19, 180, 126, 0.35)',
          color: '#13b47e',
          fontSize: '0.88rem',
        }}>
          ✓ Cập nhật thành công.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Tên bãi xe" required>
            <input value={form.ten} onChange={upd('ten')} required maxLength={100} />
          </Field>
          {/* Đã xóa ô Số chỗ để xe */}
          <Field label="Địa chỉ">
            <input value={form.dia_chi} onChange={upd('dia_chi')} maxLength={255} />
          </Field>
          <Field label="Mô tả">
            <textarea rows={3} value={form.mo_ta} onChange={upd('mo_ta')} style={{ resize: 'vertical' }} />
          </Field>

          <Field label="Giờ mở cửa">
            <input type="time" value={form.gio_mo_cua} onChange={upd('gio_mo_cua')} />
          </Field>
          <Field label="Giờ đóng cửa">
            <input type="time" value={form.gio_dong_cua} onChange={upd('gio_dong_cua')} />
          </Field>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Ngày hoạt động</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[1,2,3,4,5,6,7].map(ngay => (
                <label key={ngay} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={form.cac_ngay_hoat_dong.includes(ngay)}
                    onChange={() => toggleNgay(ngay)}
                    style={{ width: 'auto', accentColor: 'var(--accent)' }}
                  />
                  {labelNgay(ngay)}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label className="form-label">Tiện ích</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tienIchList.map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={form.tien_ich.includes(key)}
                    onChange={() => toggleTienIch(key)}
                    style={{ width: 'auto', accentColor: 'var(--accent)' }}
                  />
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          {error && <Alert type="danger">{error}</Alert>}

          <button type="submit" className="btn btn-accent" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Đang lưu...' : '✓ Lưu thay đổi'}
          </button>
        </form>
      )}
    </Modal>
  )
}

// ─── Trang Cài đặt ───────────────────────────────────────────
export default function CaiDat() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [showDoiMatKhau, setShowDoiMatKhau] = useState(false)
  const [showThongTin, setShowThongTin] = useState(false)

  return (
    <PageLayout title="⚙️ Cài đặt" backTo="/#nguoi-dung">
      {/* Giao diện */}
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

      {/* Thông tin bãi xe */}
      <div className="card" style={{ padding: '1.25rem', marginTop: 14 }}>
        <SettingRow
          icon="🏢"
          title="Thông tin bãi xe"
          subtitle="Tên bãi, địa chỉ, giờ mở cửa, tiện ích..."
          onClick={() => setShowThongTin(true)}
          right={<span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>}
        />
      </div>

      {/* Đổi mật khẩu */}
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
      {showThongTin && (
        <ThongTinBaiXeModal onClose={() => setShowThongTin(false)} />
      )}
    </PageLayout>
  )
}