import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Spinner, Alert, Field, Modal } from '../components/UI'
import { veThangApi, loaiXeApi } from '../services/api'

// ─── Hook tiện ích quản lý Object URL cho file ảnh ───
function useObjectURL(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) { setUrl(null); return }
    const objUrl = URL.createObjectURL(file)
    setUrl(objUrl)
    return () => URL.revokeObjectURL(objUrl)
  }, [file])
  return url
}

// ─── Component chính ───
export default function DangKyVeThang() {
  const navigate = useNavigate()
  const [loaiXeList, setLoaiXeList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)

  // File ảnh
  const [fileBienSo,   setFileBienSo]   = useState(null)
  const [fileNguoiDung, setFileNguoiDung] = useState(null)
  const previewBS = useObjectURL(fileBienSo)
  const previewND = useObjectURL(fileNguoiDung)

  // Form data
  const [form, setForm] = useState({
    bien_so: '',
    id_loai_xe: '',
    ten_chu_xe: '',
    sdt: '',
    email: '',
    dia_chi: '',
    ghi_chu: '',
    cho_phep_lay_ho: false,
  })

  // Lấy danh sách loại xe
  useEffect(() => {
    loaiXeApi.list()
      .then(data => {
        setLoaiXeList(data)
        if (data.length) setForm(f => ({ ...f, id_loai_xe: data[0].id }))
      })
      .catch(() => {})
  }, [])

  // Helper cập nhật state form
  function upd(field) {
    return e => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  // Xử lý chọn file
  function handleFile(setter) {
    return e => {
      const f = e.target.files[0]
      if (!f) return
      setter(f)
    }
  }

  // Submit form
  async function submit(e) {
    e.preventDefault()

    // Validation
    if (!form.bien_so.trim()) {
      setError('Vui lòng nhập biển số.')
      return
    }
    if (!form.id_loai_xe) {
      setError('Vui lòng chọn loại xe.')
      return
    }
    if (!form.ten_chu_xe.trim()) {
      setError('Vui lòng nhập tên chủ xe.')
      return
    }
    if (!fileBienSo) {
      setError('Vui lòng chọn ảnh biển số.')
      return
    }
    if (!fileNguoiDung) {
      setError('Vui lòng chọn ảnh người dùng.')
      return
    }

    setLoading(true)
    setError(null)

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_dung', fileNguoiDung)

    try {
      const data = await veThangApi.dangKy(fd)
      setTicket(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageLayout title="📝 Đăng ký vé tháng" backTo="/ve-thang">
      <form onSubmit={submit}>
        {/* Thông tin xe */}
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Thông tin xe
          </h5>
          <Field label="Biển số" required>
            <input
              value={form.bien_so}
              onChange={upd('bien_so')}
              placeholder="VD: 51F-12345"
              style={{ textTransform: 'uppercase' }}
              required
            />
          </Field>
          <Field label="Loại xe" required>
            <select value={form.id_loai_xe} onChange={upd('id_loai_xe')} required>
              {loaiXeList.map(lx => (
                <option key={lx.id} value={lx.id}>{lx.ten}</option>
              ))}
            </select>
          </Field>
          <Field label="Ghi chú">
            <input
              value={form.ghi_chu}
              onChange={upd('ghi_chu')}
              placeholder="Ghi chú thêm..."
            />
          </Field>
        </div>

        {/* Thông tin chủ xe */}
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Thông tin chủ xe
          </h5>
          <Field label="Tên chủ xe" required>
            <input
              value={form.ten_chu_xe}
              onChange={upd('ten_chu_xe')}
              required
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              value={form.sdt}
              onChange={upd('sdt')}
              placeholder="0912345678"
              inputMode="tel"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={upd('email')}
              placeholder="example@email.com"
              inputMode="email"
            />
          </Field>
          <Field label="Địa chỉ">
            <input
              value={form.dia_chi}
              onChange={upd('dia_chi')}
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={form.cho_phep_lay_ho}
              onChange={upd('cho_phep_lay_ho')}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            Cho phép lấy hộ
          </label>
        </div>

        {/* Ảnh đính kèm */}
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ảnh đính kèm
          </h5>
          <Field label="Ảnh biển số" required>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile(setFileBienSo)}
              required
            />
            {previewBS && (
              <img
                src={previewBS}
                style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
                alt=""
              />
            )}
          </Field>
          <Field label="Ảnh người dùng" required>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile(setFileNguoiDung)}
              required
            />
            {previewND && (
              <img
                src={previewND}
                style={{ width: '100%', maxHeight: 150, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
                alt=""
              />
            )}
          </Field>
        </div>

        {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

        <button
          type="submit"
          className="btn btn-accent"
          disabled={loading}
          style={{ marginTop: '0.5rem' }}
        >
          {loading ? 'Đang xử lý...' : '✓ Đăng ký vé tháng'}
        </button>
      </form>

      {/* Modal hiển thị kết quả */}
      {ticket && (
        <Modal onClose={() => navigate('/ve-thang')} title="✅ Đăng ký thành công">
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 8 }}>
              Biển số:{' '}
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</strong>
            </p>
            <p style={{ marginBottom: 8 }}>
              Hết hạn: <strong>{ticket.ngay_het_han}</strong>
            </p>
            <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '1rem' }}>
              {Number(ticket.so_tien).toLocaleString('vi-VN')} đ
            </p>
            {ticket.ma_qr && (
              <img
                src={`/uploads/qr/${ticket.ma_qr}.png`}
                alt="QR"
                style={{ width: 200, borderRadius: 10, margin: '0 auto' }}
              />
            )}
            <button
              className="btn btn-accent"
              style={{ marginTop: '1rem' }}
              onClick={() => navigate('/ve-thang')}
            >
              Quay về danh sách
            </button>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}