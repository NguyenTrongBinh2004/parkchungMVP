import { useState, useEffect, useRef } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal, fmtDt } from '../components/UI'
import { xeVaoApi, loaiXeApi } from '../services/api'

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

// ─── Helper hiển thị thời gian gửi ───
function fmtThoiGianGui(phut) {
  if (phut == null) return null;
  const h = Math.floor(phut / 60);
  const m = phut % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}p`);
  return `${phut} phút${parts.length ? ` (${parts.join(' ')})` : ''}`;
}

// ─── Tab Chụp ảnh (luồng chính) ───
function SmartPanel() {
  const [loaiXeList, setLoaiXeList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [success, setSuccess] = useState(false)

  // Ảnh
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const previewBS = useObjectURL(fileBienSo)
  const previewNL = useObjectURL(fileNguoiLai)
  const refInputBienSo = useRef(null)
  const refInputNguoiLai = useRef(null)

  // Trạng thái luồng
  const [bienSoText, setBienSoText] = useState('')
  const [result, setResult] = useState(null)   // { loai: 've_thang_qr' | 'bien_so' | 've_thang' }
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [formThuong, setFormThuong] = useState({
    loaiXe: '',
    tenChuXe: '',
    sdt: '',
    email: '',
    ghiChu: '',
    cho_phep_lay_ho: false,
  })

  // Lấy danh sách loại xe
  useEffect(() => {
    loaiXeApi.list().then(data => {
      setLoaiXeList(data)
      if (data.length) setFormThuong(f => ({ ...f, loaiXe: data[0].id }))
    }).catch(() => {})
  }, [])

  // Chụp ảnh biển số / QR
  async function handleFileBienSo(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileBienSo(file)
    setError(null)
    setResult(null)
    setShowFormThuong(false)
    setSuccess(false)
    setBienSoText('')
    setLoading(true)

    const fd = new FormData()
    fd.append('anh', file)
    try {
      const data = await xeVaoApi.nhanDien(fd)
      if (data.loai === 've_thang_qr') {
        // QR vé tháng: hiển thị luôn
        setResult(data)
      } else {
        // Nhận diện biển số (có hoặc không có ký tự)
        setBienSoText(data.bien_so_nhan_dien || '')
        setResult({ loai: 'bien_so' })
      }
    } catch (err) {
      setError(err.message)
      // Nếu lỗi vẫn cho phép nhập tay
      setBienSoText('')
      setResult({ loai: 'bien_so' })
    } finally {
      setLoading(false)
    }
  }

  // Chụp ảnh người lái (riêng)
  function handleFileNguoiLai(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileNguoiLai(file)
  }

  // Kiểm tra biển số sau khi người dùng đã sửa
  async function kiemTraBienSo() {
    const bs = bienSoText.trim()
    if (!bs) {
      setError('Vui lòng nhập biển số')
      return
    }
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.append('bien_so', bs)
    try {
      const data = await xeVaoApi.kiemTraBienSo(fd)
      if (data.loai === 've_thang') {
        // Có vé tháng
        setResult(data)
        setShowFormThuong(false)
      } else if (data.loai === 'xe_thuong') {
        // Xe thường -> hiển thị form
        setResult(data)
        setShowFormThuong(true)
      } else {
        setError('Không xác định được loại xe.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Xác nhận vào cho vé tháng
  async function xacNhanVeThang() {
    if (!result?.ma_qr || !fileBienSo) {
      setError('Vui lòng chụp ảnh biển số')
      return
    }
    if (!fileNguoiLai) {
      setError('Vui lòng chụp ảnh người lái')
      return
    }
    setLoading(true)
    const fd = new FormData()
    fd.append('ma_qr', result.ma_qr)
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_lai', fileNguoiLai)
    try {
      const data = await xeVaoApi.xacNhanVeThang(fd)
      setTicket(data)
      setSuccess(true)
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Xác nhận vào cho xe thường
  async function xacNhanThuong() {
    if (!fileBienSo || !fileNguoiLai) {
      setError('Vui lòng chụp đầy đủ ảnh biển số và người lái')
      return
    }
    if (!formThuong.loaiXe) {
      setError('Vui lòng chọn loại xe')
      return
    }
    setLoading(true)
    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSoText.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_lai', fileNguoiLai)
    try {
      const data = await xeVaoApi.xacNhanThuong(fd)
      setTicket(data)
      setSuccess(true)
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFileBienSo(null)
    setFileNguoiLai(null)
    setBienSoText('')
    setResult(null)
    setShowFormThuong(false)
    setError(null)
    setFormThuong({
      loaiXe: loaiXeList[0]?.id || '',
      tenChuXe: '',
      sdt: '',
      email: '',
      ghiChu: '',
      cho_phep_lay_ho: false,
    })
    if (refInputBienSo.current) refInputBienSo.current.value = ''
    if (refInputNguoiLai.current) refInputNguoiLai.current.value = ''
  }

  return (
    <div>
      {/* Ảnh biển số / QR */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Chụp ảnh biển số / QR</label>
        <input ref={refInputBienSo} type="file" accept="image/*" capture="environment"
          onChange={handleFileBienSo} disabled={loading} />
        {previewBS && <img src={previewBS} alt="preview"
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
      </div>

      {/* Ảnh người lái */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Ảnh người lái <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input ref={refInputNguoiLai} type="file" accept="image/*" capture="user"
          onChange={handleFileNguoiLai} disabled={loading} />
        {previewNL && <img src={previewNL} alt="người lái"
          style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', marginTop: 8 }} />}
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Xe vào thành công!</Alert>}

      {/* QR vé tháng nhận diện ngay */}
      {result?.loai === 've_thang_qr' && (
        <div className="card" style={{ borderColor: 'var(--info)', marginBottom: '0.75rem' }}>
          <h5 style={{ color: 'var(--info)' }}>🎫 Vé tháng</h5>
          <p><strong>Biển số:</strong> {result.bien_so}</p>
          <p><strong>Chủ xe:</strong> {result.ten_chu_xe}</p>
          <p><strong>Hết hạn:</strong> {result.ngay_het_han}</p>
          {result.canh_bao && <p style={{ color: 'var(--warning)' }}>⚠️ {result.canh_bao}</p>}
          <button className="btn btn-accent" onClick={xacNhanVeThang} disabled={loading}>
            Xác nhận xe vào (Vé tháng)
          </button>
        </div>
      )}

      {/* Ô nhập biển số + nút Kiểm tra */}
      {result?.loai === 'bien_so' && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <Field label="Biển số (sửa nếu cần)">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={bienSoText}
                onChange={e => setBienSoText(e.target.value)}
                placeholder="Nhập biển số"
                style={{ textTransform: 'uppercase', flex: 1 }}
              />
              <button
                className="btn btn-accent btn-sm"
                onClick={kiemTraBienSo}
                disabled={loading || !bienSoText.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                Kiểm tra
              </button>
            </div>
          </Field>
        </div>
      )}

      {/* Kết quả kiểm tra là vé tháng */}
      {result?.loai === 've_thang' && (
        <div className="card" style={{ borderColor: 'var(--info)', marginBottom: '0.75rem' }}>
          <h5 style={{ color: 'var(--info)' }}>🎫 Vé tháng</h5>
          <p><strong>Biển số:</strong> {result.bien_so}</p>
          <p><strong>Chủ xe:</strong> {result.ten_chu_xe}</p>
          <p><strong>Hết hạn:</strong> {result.ngay_het_han}</p>
          {result.canh_bao && <p style={{ color: 'var(--warning)' }}>⚠️ {result.canh_bao}</p>}
          <button className="btn btn-accent" onClick={xacNhanVeThang} disabled={loading}>
            Xác nhận xe vào (Vé tháng)
          </button>
        </div>
      )}

      {/* Form xe thường */}
      {showFormThuong && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '0.75rem' }}>🚗 Xe thường</h5>
          <Field label="Biển số">
            <input value={bienSoText} disabled style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label="Loại xe" required>
            <select value={formThuong.loaiXe} onChange={e => setFormThuong(f => ({ ...f, loaiXe: e.target.value }))}>
              {loaiXeList.map(lx => <option key={lx.id} value={lx.id}>{lx.ten}</option>)}
            </select>
          </Field>
          <Field label="Tên chủ xe">
            <input value={formThuong.tenChuXe} onChange={e => setFormThuong(f => ({ ...f, tenChuXe: e.target.value }))} />
          </Field>
          <Field label="Số điện thoại">
            <input value={formThuong.sdt} onChange={e => setFormThuong(f => ({ ...f, sdt: e.target.value }))} inputMode="tel" />
          </Field>
          <Field label="Email">
            <input type="email" value={formThuong.email} onChange={e => setFormThuong(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Ghi chú">
            <input value={formThuong.ghiChu} onChange={e => setFormThuong(f => ({ ...f, ghiChu: e.target.value }))} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '0.85rem' }}>
            <input type="checkbox" checked={formThuong.cho_phep_lay_ho}
              onChange={e => setFormThuong(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))} />
            Cho phép lấy hộ
          </label>
          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading}>
            Xác nhận xe vào
          </button>
        </div>
      )}

      {/* Hiển thị vé sau khi vào thành công */}
      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10 }} />}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>📸 Chụp màn hình để xuất trình khi lấy xe.</p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab quét QR (giữ nguyên) ───
function QRPanel() {
  // code cũ giữ nguyên
}

// ─── Tab Biển số (có thể giữ lại để nhập tay không cần ảnh) ───
function BienSoPanel({ bienSoMacDinh }) {
  // code cũ giữ nguyên
}

// ─── Trang chính XeVao ───
export default function XeVao() {
  const [tab, setTab] = useState('smart')
  const [bienSoTuSmart, setBienSoTuSmart] = useState('')

  const chuyenTabBienSo = (bienSo) => {
    setBienSoTuSmart(bienSo)
    setTab('bien')
  }

  const tabs = [
    { id: 'smart', label: '📷 Chụp ảnh' },
    { id: 'qr',    label: '🔳 Quét QR' },
    { id: 'bien',  label: '🔢 Biển số' },
  ]

  return (
    <PageLayout title="📸 Xe vào" backTo="/">
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'smart' && <SmartPanel />}
      {tab === 'qr'    && <QRPanel />}
      {tab === 'bien'  && <BienSoPanel bienSoMacDinh={bienSoTuSmart} />}
    </PageLayout>
  )
}