// src/pages/NhanVien.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Field, Alert, Modal } from '../components/UI'
import { nhanVienApi } from '../services/api'

function formatNgay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN')
}

// ─── Modal thêm nhân viên ────────────────────────────────────
function ThemNhanVienModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ sdt: '', mat_khau: '', xacNhan: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const upd = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError(null)

    if (!/^(0[3-9][0-9]{8}|\+84[3-9][0-9]{8})$/.test(form.sdt)) {
      setError('Số điện thoại không đúng định dạng Việt Nam.')
      return
    }
    if (form.mat_khau.length < 8 || form.mat_khau.length > 20) {
      setError('Mật khẩu phải từ 8 đến 20 ký tự.')
      return
    }
    if (!/[a-zA-Z]/.test(form.mat_khau) || !/[0-9]/.test(form.mat_khau)) {
      setError('Mật khẩu phải có ít nhất 1 chữ cái và 1 chữ số.')
      return
    }
    if (!/[A-Z]/.test(form.mat_khau)) {
      setError('Mật khẩu phải có ít nhất 1 chữ hoa.')
      return
    }
    if (form.mat_khau !== form.xacNhan) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    setLoading(true)
    try {
      await nhanVienApi.create({ sdt: form.sdt, mat_khau: form.mat_khau })
      onCreated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="➕ Thêm nhân viên">
      <form onSubmit={submit}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.9rem' }}>
          Nhân viên sẽ dùng số điện thoại và mật khẩu này để đăng nhập. Họ không thể sửa loại xe & giá hoặc thông tin bãi xe.
        </p>
        <Field label="Số điện thoại" required>
          <input value={form.sdt} onChange={upd('sdt')} required placeholder="09xxxxxxxx" autoFocus />
        </Field>
        <Field label="Mật khẩu" required>
          <input
            type="password"
            value={form.mat_khau}
            onChange={upd('mat_khau')}
            required
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
            minLength={8}
            maxLength={20}
          />
        </Field>
        <Field label="Xác nhận mật khẩu" required>
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
          {loading ? 'Đang tạo...' : '✓ Tạo tài khoản nhân viên'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Hàng nhân viên trong danh sách ──────────────────────────
function NhanVienRow({ nv, onXoa }) {
  const [dangXoa, setDangXoa] = useState(false)

  async function handleXoa() {
    if (!window.confirm(`Xóa tài khoản nhân viên ${nv.sdt}? Hành động này không thể hoàn tác.`)) return
    setDangXoa(true)
    try {
      await onXoa(nv.id)
    } finally {
      setDangXoa(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.75rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)' }}>{nv.sdt}</div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
          Tạo lúc {formatNgay(nv.created_at)}
        </div>
      </div>
      <button
        onClick={handleXoa}
        disabled={dangXoa}
        style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 8,
          padding: '0.4rem 0.7rem', fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer',
        }}
      >
        {dangXoa ? '...' : '🗑️ Xóa'}
      </button>
    </div>
  )
}

// ─── Trang Quản lý nhân viên ─────────────────────────────────
export default function NhanVien() {
  const [dsNhanVien, setDsNhanVien] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showThem, setShowThem] = useState(false)

  async function taiDanhSach() {
    setLoading(true)
    setError(null)
    try {
      const data = await nhanVienApi.list()
      setDsNhanVien(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { taiDanhSach() }, [])

  async function handleXoa(id) {
    try {
      await nhanVienApi.xoa(id)
      setDsNhanVien(ds => ds.filter(nv => nv.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <PageLayout title="👥 Quản lý nhân viên" backTo="/#quan-ly">
      <div className="card" style={{ padding: '1.25rem' }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Nhân viên trông bãi có thể đăng nhập và xử lý xe vào/ra, nhưng không thể sửa loại xe & giá hoặc thông tin bãi xe.
        </p>

        <button
          className="btn btn-accent"
          style={{ marginBottom: '1rem' }}
          onClick={() => setShowThem(true)}
        >
          ➕ Thêm nhân viên
        </button>

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Đang tải...</div>}
        {error && <Alert type="danger">{error}</Alert>}

        {!loading && !error && dsNhanVien.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
            Chưa có nhân viên nào.
          </div>
        )}

        {dsNhanVien.map(nv => (
          <NhanVienRow key={nv.id} nv={nv} onXoa={handleXoa} />
        ))}
      </div>

      {showThem && (
        <ThemNhanVienModal
          onClose={() => setShowThem(false)}
          onCreated={taiDanhSach}
        />
      )}
    </PageLayout>
  )
}