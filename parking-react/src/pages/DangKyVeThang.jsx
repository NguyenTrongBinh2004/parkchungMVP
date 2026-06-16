import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Spinner, Alert, Field, Modal } from '../components/UI'
import { veThangApi, loaiXeApi } from '../services/api'
import { chuanHoaBienSo, isValidBienSo } from '../utils'

const API = import.meta.env.VITE_API_URL || ''

// ─── Nhóm loại xe theo nhóm (chỉ dùng cho danh sách đã lọc) ───
function groupByNhom(loaiXeList) {
  const map = {}
  loaiXeList.forEach(lx => {
    if (!map[lx.nhom_xe_id]) {
      map[lx.nhom_xe_id] = {
        nhom_id: lx.nhom_xe_id,
        ten_nhom: lx.ten_nhom,
        thu_tu: lx.thu_tu_nhom,
        items: []
      }
    }
    map[lx.nhom_xe_id].items.push(lx)
  })
  return Object.values(map).sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0))
}

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

function getQrUrl(ticket) {
  if (!ticket) return null
  if (ticket.qr_image_url) return ticket.qr_image_url
  if (ticket.ma_qr) return `${API}/uploads/qr/${ticket.ma_qr}.png`
  return null
}

// ─── Component input ảnh ───
function ImagePicker({ label, required, file, onFile }) {
  const internalRef = useRef(null)
  const refCam = internalRef
  const refLib = useRef(null)
  const preview = useObjectURL(file)

  function onChange(e) {
    if (e.target.files[0]) onFile(e.target.files[0])
  }

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>

      <input
        ref={refCam}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <input
        ref={refLib}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onChange}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => refCam.current.click()}
          style={{ flex: 1 }}
        >
          📷 Chụp ảnh
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => refLib.current.click()}
          style={{ flex: 1 }}
        >
          🖼 Thư viện
        </button>
      </div>

      {preview ? (
        <div style={{ position: 'relative', marginTop: 8 }}>
          <img
            src={preview}
            alt=""
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, display: 'block' }}
          />
          <button
            type="button"
            onClick={() => onFile(null)}
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(0,0,0,0.6)', border: 'none',
              color: '#fff', borderRadius: '50%',
              width: 28, height: 28, cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >✕</button>
        </div>
      ) : (
        <div style={{
          marginTop: 8, border: '2px dashed #444', borderRadius: 8,
          padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem'
        }}>
          Chưa có ảnh
        </div>
      )}
    </div>
  )
}

export default function DangKyVeThang() {
  const navigate = useNavigate()
  const [allLoaiXe, setAllLoaiXe] = useState([])            // toàn bộ loại xe (để tìm xe đạp)
  const [groupedLoaiXe, setGroupedLoaiXe] = useState([])   // nhóm loại xe có thể đăng ký vé tháng
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)

  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiDung, setFileNguoiDung] = useState(null)

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

  const defaultLoaiXeRef = useRef('')

  useEffect(() => {
    // Reset form
    setForm({
      bien_so: '',
      id_loai_xe: '',
      ten_chu_xe: '',
      sdt: '',
      email: '',
      dia_chi: '',
      ghi_chu: '',
      cho_phep_lay_ho: false,
    })

    // Load dữ liệu: toàn bộ loại xe, loại đã cấu hình (không filter has_ve_thang), đồng giá nhóm
    Promise.all([
      loaiXeApi.list(),
      loaiXeApi.list({ da_cau_hinh: true }),          // lấy tất cả xe đã có giá (lượt/giờ/ngày)
      loaiXeApi.listNhomGia().catch(() => [])         // thêm danh sách đồng giá nhóm
    ]).then(([allData, configuredData, nhomGia]) => {
      setAllLoaiXe(allData)

      // Tạo map nhom_xe_id → thông tin đồng giá
      const nhomGiaMap = {}
      nhomGia.forEach(ng => { nhomGiaMap[ng.nhom_xe_id] = ng })

      // Lọc xe có vé tháng: riêng (gia_ve_thang > 0) hoặc nhóm có đồng giá vé tháng
      const coVeThang = configuredData.filter(lx => {
        if (Number(lx.gia_ve_thang || 0) > 0) return true
        const ng = nhomGiaMap[lx.nhom_xe_id]
        return ng && Number(ng.gia_ve_thang || 0) > 0
      })

      const grouped = groupByNhom(coVeThang)
      setGroupedLoaiXe(grouped)

      if (coVeThang.length > 0) {
        // Ưu tiên chọn ô tô, nếu không có thì lấy xe đầu tiên
        const oto = coVeThang.find(lx => lx.ten.toLowerCase().replace(/\s+/g, '').includes('ôtô'))
        const fallback = coVeThang.find(lx => lx.ten.toLowerCase().replace(/\s+/g, '').includes('oto'))
        const defaultId = oto ? oto.id : (fallback ? fallback.id : coVeThang[0].id)
        setForm(f => ({ ...f, id_loai_xe: defaultId }))
        defaultLoaiXeRef.current = defaultId
      } else {
        defaultLoaiXeRef.current = ''
      }
    }).catch(() => {})
  }, [])

  function upd(field) {
    return e => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  async function submit(e) {
    e.preventDefault()

    const loaiXeObj = allLoaiXe.find(lx => lx.id == form.id_loai_xe)
    const isBicycle = loaiXeObj?.ten.toLowerCase().includes('đạp')

    // Xử lý biển số
    let bienSoGui
    if (isBicycle) {
      if (!form.bien_so.trim()) {
        bienSoGui = 'XD' + Date.now().toString().slice(-6)
      } else {
        bienSoGui = form.bien_so.trim().toUpperCase()
      }
    } else {
      if (!form.bien_so.trim()) {
        setError('Vui lòng nhập biển số.')
        return
      }
      const cleaned = chuanHoaBienSo(form.bien_so)
      if (!isValidBienSo(cleaned)) {
        setError('Biển số không đúng định dạng (VD: 51F-123.45)')
        return
      }
      bienSoGui = form.bien_so.trim().toUpperCase()
    }

    if (!form.id_loai_xe) { setError('Vui lòng chọn loại xe.'); return }
    if (!form.ten_chu_xe.trim()) { setError('Vui lòng nhập tên chủ xe.'); return }
    if (!fileBienSo) { setError('Vui lòng chọn ảnh biển số.'); return }
    if (!fileNguoiDung) { setError('Vui lòng chọn ảnh người dùng.'); return }

    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('bien_so', bienSoGui)
    fd.append('id_loai_xe', form.id_loai_xe)
    fd.append('ten_chu_xe', form.ten_chu_xe.trim())
    fd.append('sdt', form.sdt)
    fd.append('email', form.email)
    fd.append('dia_chi', form.dia_chi)
    fd.append('ghi_chu', form.ghi_chu)
    fd.append('cho_phep_lay_ho', form.cho_phep_lay_ho)
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

  const qrUrl = getQrUrl(ticket)
  const sectionTitle = {
    marginBottom: '1rem', color: 'var(--text-muted)',
    fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em'
  }

  return (
    <PageLayout title="📝 Đăng ký vé tháng" backTo="/ve-thang">
      <form onSubmit={submit} noValidate>
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={sectionTitle}>Thông tin xe</h5>
          <Field label="Biển số" required>
            <input
              value={form.bien_so}
              onChange={upd('bien_so')}
              placeholder="VD: 51F-12345"
              style={{ textTransform: 'uppercase' }}
            />
          </Field>
          <Field label="Loại xe" required>
            <select value={form.id_loai_xe} onChange={upd('id_loai_xe')}>
              {groupedLoaiXe.map(group => (
                <optgroup key={group.nhom_id} label={group.ten_nhom}>
                  {group.items.map(lx => (
                    <option key={lx.id} value={lx.id}>{lx.ten}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Ghi chú">
            <input value={form.ghi_chu} onChange={upd('ghi_chu')} placeholder="Ghi chú thêm..." />
          </Field>
        </div>

        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={sectionTitle}>Thông tin chủ xe</h5>
          <Field label="Tên chủ xe" required>
            <input value={form.ten_chu_xe} onChange={upd('ten_chu_xe')} />
          </Field>
          <Field label="Số điện thoại">
            <input value={form.sdt} onChange={upd('sdt')} placeholder="0912345678" inputMode="tel" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={upd('email')} placeholder="example@email.com" />
          </Field>
          <Field label="Địa chỉ">
            <input value={form.dia_chi} onChange={upd('dia_chi')} />
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

        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={sectionTitle}>Ảnh đính kèm</h5>
          <ImagePicker label="Ảnh biển số" required file={fileBienSo} onFile={setFileBienSo} />
          <ImagePicker label="Ảnh người dùng" required file={fileNguoiDung} onFile={setFileNguoiDung} />
        </div>

        {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
        {loading && <Spinner />}

        <button type="submit" className="btn btn-accent" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? 'Đang xử lý...' : '✓ Đăng ký vé tháng'}
        </button>
      </form>

      {ticket && (
        <Modal onClose={() => navigate('/ve-thang')} title="✅ Đăng ký thành công">
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 8 }}>
              Biển số: <strong style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</strong>
            </p>
            <p style={{ marginBottom: 8 }}>
              Hết hạn: <strong>{ticket.ngay_het_han}</strong>
            </p>
            <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '1rem' }}>
              {Number(ticket.so_tien).toLocaleString('vi-VN')} đ
            </p>
            {qrUrl ? (
              <div style={{ marginBottom: '1rem' }}>
                <img
                  src={qrUrl}
                  alt="Mã QR vé tháng"
                  style={{ width: 220, height: 220, borderRadius: 12, background: '#fff', padding: 8, margin: '0 auto', display: 'block' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>
                  📸 Chụp màn hình mã QR để dùng khi vào bãi
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                Mã QR sẽ được gửi qua email / Zalo.
              </p>
            )}
            <button className="btn btn-accent" onClick={() => navigate('/ve-thang')}>
              Quay về danh sách
            </button>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}