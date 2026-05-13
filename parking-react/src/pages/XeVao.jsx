import { useState, useEffect, useRef } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal, fmtDt } from '../components/UI'
import { xeVaoApi, loaiXeApi } from '../services/api'

// Hook quản lý URL tạm cho preview ảnh (tránh rò rỉ bộ nhớ)
function useObjectURL(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const objUrl = URL.createObjectURL(file)
    setUrl(objUrl)
    return () => URL.revokeObjectURL(objUrl)
  }, [file])
  return url
}

export default function XeVao() {
  const [loaiXeList, setLoaiXeList] = useState([])
  const [loadingNhanDien, setLoadingNhanDien] = useState(false)
  const [loadingXacNhan, setLoadingXacNhan] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)

  // Ảnh chụp
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const previewBS = useObjectURL(fileBienSo)
  const previewNL = useObjectURL(fileNguoiLai)

  const refInputBienSo = useRef(null)
  const refInputNguoiLai = useRef(null)

  // Luồng nghiệp vụ
  const [step, setStep] = useState('idle')
  // 'idle'          – chưa có kết quả nhận diện
  // 'ocr_confirm'   – hiển thị ô biển số để sửa + nút Tìm xe
  // 'qr_detected'   – quét được QR vé tháng từ ảnh
  // 've_thang_view' – đã xác định là vé tháng, hiển thị thông tin
  // 'thuong_form'   – xe thường, hiển thị form đầy đủ

  const [qrData, setQrData] = useState(null)

  // Form xe thường
  const [form, setForm] = useState({
    bienSo: '',
    loaiXe: '',
    tenChuXe: '',
    sdt: '',
    email: '',
    ghi_chu: '',
    cho_phep_lay_ho: false,
  })

  // Lấy danh sách loại xe
  useEffect(() => {
    loaiXeApi.list().then(data => {
      setLoaiXeList(data)
      if (data.length) setForm(f => ({ ...f, loaiXe: data[0].id }))
    }).catch(() => {})
  }, [])

  // ─── Xử lý chụp ảnh ───
  function handleFileBienSo(e) {
    const f = e.target.files[0]
    if (!f) return
    setFileBienSo(f)
    setQrData(null)
    setError(null)
    setStep('idle')
    guiNhanDien(f)
  }

  function handleFileNguoiLai(e) {
    const f = e.target.files[0]
    if (!f) return
    setFileNguoiLai(f)
  }

  async function guiNhanDien(file) {
    setLoadingNhanDien(true)
    const fd = new FormData()
    fd.append('anh', file)
    try {
      const data = await xeVaoApi.nhanDien(fd)
      if (data.loai === 've_thang_qr') {
        setQrData(data);            
        setStep('ve_thang_view');
      } else if (data.loai === 'bien_so' && data.bien_so_nhan_dien) {
        setForm(f => ({ ...f, bienSo: data.bien_so_nhan_dien }))
        setStep('ocr_confirm')
      } else {
        setStep('thuong_form')
        setError(data.ghi_chu || 'Không nhận diện được biển số. Vui lòng nhập tay.')
      }
    } catch (err) {
      setError(err.message)
      setStep('thuong_form')
    } finally {
      setLoadingNhanDien(false)
    }
  }

  // ─── Kiểm tra biển số (sau khi user sửa) ───
  async function kiemTraBienSo() {
    const bs = form.bienSo.trim()
    if (!bs) {
      setError('Vui lòng nhập biển số')
      return
    }
    setLoadingNhanDien(true)
    const fd = new FormData()
    fd.append('bien_so', bs)
    try {
      const data = await xeVaoApi.kiemTraBienSo(fd)
      if (data.loai === 've_thang') {
        setQrData(data)
        setStep('ve_thang_view')
      } else {
        // Xe thường
        setForm(f => ({ ...f, bienSo: data.bien_so || bs }))
        setStep('thuong_form')
      }
    } catch (err) {
      setError(err.message)
      // Giữ nguyên step ocr_confirm để user sửa lại biển số
    } finally {
      setLoadingNhanDien(false)
    }
  }

  // ─── Xác nhận xe vào ───
  async function xacNhanVeThang() {
    if (!fileNguoiLai) {
      setError('Vui lòng chụp ảnh người lái.')
      return
    }
    if (!qrData?.ma_qr) {
      setError('Thiếu mã QR.')
      return
    }
    const fd = new FormData()
    fd.append('ma_qr', qrData.ma_qr)
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_lai', fileNguoiLai)
    setLoadingXacNhan(true)
    try {
      const data = await xeVaoApi.xacNhanVeThang(fd)
      setTicket(data)
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingXacNhan(false)
    }
  }

  async function xacNhanThuong() {
    if (!fileBienSo || !fileNguoiLai) {
      setError('Vui lòng chụp đầy đủ ảnh biển số và người lái.')
      return
    }
    if (!form.bienSo.trim()) {
      setError('Vui lòng nhập biển số xe.')
      return
    }
    const fd = new FormData()
    fd.append('id_loai_xe', form.loaiXe)
    fd.append('bien_so_xac_nhan', form.bienSo.trim().toUpperCase())
    fd.append('ten_chu_xe', form.tenChuXe)
    fd.append('sdt', form.sdt)
    fd.append('email', form.email)
    fd.append('ghi_chu', form.ghi_chu)
    fd.append('cho_phep_lay_ho', form.cho_phep_lay_ho)
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_lai', fileNguoiLai)
    setLoadingXacNhan(true)
    try {
      const data = await xeVaoApi.xacNhanThuong(fd)
      setTicket(data)
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingXacNhan(false)
    }
  }

  function resetForm() {
    setFileBienSo(null)
    setFileNguoiLai(null)
    setQrData(null)
    setError(null)
    setStep('idle')
    setForm({
      bienSo: '',
      loaiXe: loaiXeList[0]?.id || '',
      tenChuXe: '',
      sdt: '',
      email: '',
      ghi_chu: '',
      cho_phep_lay_ho: false,
    })
    if (refInputBienSo.current) refInputBienSo.current.value = ''
    if (refInputNguoiLai.current) refInputNguoiLai.current.value = ''
  }

  const loading = loadingNhanDien || loadingXacNhan

  // ─── Giao diện ───
  return (
    <PageLayout title="📸 Xe vào" backTo="/">
      {/* Chụp ảnh biển số / QR */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Chụp ảnh biển số / QR</label>
        <input
          ref={refInputBienSo}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileBienSo}
          disabled={loading}
        />
        {previewBS && (
          <img
            src={previewBS}
            alt="preview biển số"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
          />
        )}
        {loadingNhanDien && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Spinner />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang nhận diện...</p>
          </div>
        )}
      </div>

      {/* Chụp ảnh người lái */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">
          Ảnh người lái <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <input
          ref={refInputNguoiLai}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileNguoiLai}
          disabled={loading}
        />
        {previewNL && (
          <img
            src={previewNL}
            alt="người lái"
            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', marginTop: 8 }}
          />
        )}
      </div>

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Bước: Xác nhận biển số (sau OCR) */}
      {step === 'ocr_confirm' && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <Field label="Biển số nhận diện (sửa nếu cần)">
            <input
              value={form.bienSo}
              onChange={e => setForm(f => ({ ...f, bienSo: e.target.value }))}
              placeholder="VD: 51F-12345"
              style={{ textTransform: 'uppercase' }}
            />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-accent"
              onClick={kiemTraBienSo}
              disabled={loadingNhanDien}
              style={{ flex: 1 }}
            >
              {loadingNhanDien ? 'Đang tìm...' : '🔍 Tìm xe'}
            </button>
            <button
              className="btn btn-outline"
              onClick={resetForm}
              disabled={loading}
              style={{ width: 'auto', padding: '0.55rem 1rem' }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Bước: Quét QR vé tháng (chưa có chi tiết) */}
      {step === 'qr_detected' && (
        <div className="card" style={{ marginBottom: '0.75rem', borderColor: 'var(--info)' }}>
          <h5 style={{ marginBottom: '0.75rem', color: 'var(--info)' }}>🎫 Vé tháng (QR)</h5>
          <p>Đã nhận diện QR vé tháng hợp lệ.</p>
          <button
            className="btn btn-accent"
            style={{ marginTop: '0.75rem' }}
            onClick={xacNhanVeThang}
            disabled={loadingXacNhan}
          >
            {loadingXacNhan ? 'Đang xử lý...' : 'Xác nhận xe vào (Vé tháng)'}
          </button>
        </div>
      )}

      {/* Bước: Vé tháng có đầy đủ thông tin (từ kiểm tra biển số) */}
      {step === 've_thang_view' && qrData && (
        <div className="card" style={{ marginBottom: '0.75rem', borderColor: 'var(--info)' }}>
          <h5 style={{ marginBottom: '0.75rem', color: 'var(--info)' }}>🎫 Vé tháng</h5>
          <p><strong>Biển số:</strong> {qrData.bien_so}</p>
          <p><strong>Chủ xe:</strong> {qrData.ten_chu_xe}</p>
          <p><strong>Hết hạn:</strong> {qrData.ngay_het_han}</p>
          {qrData.canh_bao && <p style={{ color: 'var(--warning)', marginTop: 4 }}>⚠️ {qrData.canh_bao}</p>}
          {qrData.ghi_chu && <p><strong>Ghi chú:</strong> {qrData.ghi_chu}</p>}
          <p>
            <strong>Cho phép lấy hộ:</strong>{' '}
            <span style={{ color: qrData.cho_phep_lay_ho ? 'var(--success)' : 'var(--text-muted)' }}>
              {qrData.cho_phep_lay_ho ? '✅ Có' : '❌ Không'}
            </span>
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {qrData.anh_bien_so && (
              <img src={qrData.anh_bien_so} className="thumb" alt="biển số" />
            )}
            {qrData.anh_nguoi_dung && (
              <img src={qrData.anh_nguoi_dung} className="thumb-round" alt="người dùng" />
            )}
          </div>
          <button
            className="btn btn-accent"
            style={{ marginTop: '0.75rem' }}
            onClick={xacNhanVeThang}
            disabled={loadingXacNhan}
          >
            {loadingXacNhan ? 'Đang xử lý...' : 'Xác nhận xe vào (Vé tháng)'}
          </button>
        </div>
      )}

      {/* Bước: Form xe thường */}
      {step === 'thuong_form' && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '0.75rem' }}>🚗 Xe thường</h5>
          <Field label="Biển số" required>
            <input
              value={form.bienSo}
              onChange={e => setForm(f => ({ ...f, bienSo: e.target.value }))}
              placeholder="VD: 51F-12345"
              style={{ textTransform: 'uppercase' }}
            />
          </Field>
          <Field label="Loại xe" required>
            <select
              value={form.loaiXe}
              onChange={e => setForm(f => ({ ...f, loaiXe: e.target.value }))}
            >
              {loaiXeList.map(lx => (
                <option key={lx.id} value={lx.id}>{lx.ten}</option>
              ))}
            </select>
          </Field>
          <Field label="Tên chủ xe">
            <input
              value={form.tenChuXe}
              onChange={e => setForm(f => ({ ...f, tenChuXe: e.target.value }))}
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              value={form.sdt}
              onChange={e => setForm(f => ({ ...f, sdt: e.target.value }))}
              placeholder="0912345678"
              inputMode="tel"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="example@email.com"
              inputMode="email"
            />
          </Field>
          <Field label="Ghi chú">
            <input
              value={form.ghi_chu}
              onChange={e => setForm(f => ({ ...f, ghi_chu: e.target.value }))}
              placeholder="Ghi chú thêm..."
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem', marginBottom: '0.85rem' }}>
            <input
              type="checkbox"
              checked={form.cho_phep_lay_ho}
              onChange={e => setForm(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            Cho phép lấy hộ
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-accent"
              onClick={xacNhanThuong}
              disabled={loadingXacNhan}
              style={{ flex: 1 }}
            >
              {loadingXacNhan ? 'Đang xử lý...' : 'Xác nhận xe vào'}
            </button>
            <button
              className="btn btn-outline"
              onClick={resetForm}
              disabled={loading}
              style={{ flex: '0 0 auto', width: 'auto', padding: '0.55rem 1rem' }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Modal vé gửi xe */}
      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 6 }}>
              <strong>Biển số:</strong>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem' }}>{ticket.bien_so}</span>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 12 }}>
              <strong>Giờ vào:</strong> {fmtDt(ticket.gio_vao)}
            </p>
            {ticket.qr_image_url && (
              <img
                src={ticket.qr_image_url}
                alt="QR"
                style={{ width: 220, borderRadius: 10, margin: '0 auto 1rem' }}
              />
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              📸 Chụp ảnh màn hình này để xuất trình khi lấy xe.
            </p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>
              Đóng
            </button>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}