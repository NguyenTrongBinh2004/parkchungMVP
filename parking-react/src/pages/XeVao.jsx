import { useState, useEffect, useRef } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal, fmtDt } from '../components/UI'
import { xeVaoApi, loaiXeApi } from '../services/api'

// ─── Hook tạo ObjectURL cho file ───
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

// ─── Tab Chụp ảnh (luồng chính) ───
function SmartPanel({ onChuyenTabBienSo }) {
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
  const [result, setResult] = useState(null)
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [formThuong, setFormThuong] = useState({
    loaiXe: '',
    tenChuXe: '',
    sdt: '',
    email: '',
    ghiChu: '',
    cho_phep_lay_ho: false,
  })

  // Lấy danh sách loại xe, tự động chọn "ô tô" nếu có
  useEffect(() => {
    loaiXeApi.list().then(data => {
      setLoaiXeList(data)
      if (data.length) {
        const oto = data.find(lx =>
          lx.ten.toLowerCase().replace(/\s+/g, '').includes('ôtô')
        )
        const fallback = data.find(lx =>
          lx.ten.toLowerCase().replace(/\s+/g, '').includes('oto')
        )
        setFormThuong(f => ({
          ...f,
          loaiXe: oto ? oto.id : (fallback ? fallback.id : data[0].id)
        }))
      }
    }).catch(() => {})
  }, [])

  // Xử lý khi chọn ảnh biển số
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
        setResult(data)
      } else {
        setBienSoText(data.bien_so_nhan_dien || '')
        setResult({ loai: 'bien_so' })
      }
    } catch (err) {
      setError(err.message)
      setBienSoText('')
      setResult({ loai: 'bien_so' })
    } finally {
      setLoading(false)
    }
  }

  function handleFileNguoiLai(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileNguoiLai(file)
  }

  // Kiểm tra biển số
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
        setResult(data)
        setShowFormThuong(false)
      } else if (data.loai === 'xe_thuong') {
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

  // Dùng chung cho cả ve_thang_qr và ve_thang
  async function xacNhanVeThang() {
    if (!result?.ma_qr) {
      setError('Không tìm thấy mã QR vé tháng. Vui lòng thử lại hoặc chuyển sang tab Biển số.')
      return
    }
    if (!fileBienSo) {
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
      setResult(null)
      setShowFormThuong(false)
      setTicket(data)
      setSuccess(true)
      // Reset file inputs
      setFileBienSo(null)
      setFileNguoiLai(null)
      setBienSoText('')
      setError(null)
      if (refInputBienSo.current) refInputBienSo.current.value = ''
      if (refInputNguoiLai.current) refInputNguoiLai.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
      setResult(null)
      setShowFormThuong(false)
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

  function dongModal() {
    setTicket(null)
    setSuccess(false)
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
      {success && !ticket && <Alert type="success">✅ Xe vào thành công!</Alert>}

      {/* QR vé tháng nhận diện ngay từ ảnh */}
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={bienSoText}
                onChange={e => setBienSoText(e.target.value)}
                placeholder="Nhập biển số"
                style={{ textTransform: 'uppercase', flex: 1, minWidth: '120px' }}
                onKeyDown={e => e.key === 'Enter' && kiemTraBienSo()}
              />
              <button
                className="btn btn-accent btn-sm"
                onClick={kiemTraBienSo}
                disabled={loading || !bienSoText.trim()}
                style={{ whiteSpace: 'nowrap' }}
              >
                Kiểm tra
              </button>
              {bienSoText.trim() && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onChuyenTabBienSo(bienSoText.trim())}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  🔢 Nhập tay
                </button>
              )}
            </div>
          </Field>
        </div>
      )}

      {/* Kết quả kiểm tra biển số → vé tháng (có onClick đầy đủ) */}
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
          <Field label="Cho phép lấy hộ">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={formThuong.cho_phep_lay_ho}
                onChange={e => setFormThuong(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))}
                style={{ width: 'auto', accentColor: 'var(--accent)' }}
              />
              <span>Có</span>
            </label>
          </Field>
          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading}>
            Xác nhận xe vào
          </button>
        </div>
      )}

      {/* Hiển thị vé sau khi vào thành công */}
      {ticket && (
        <Modal onClose={dongModal} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10 }} />}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>📸 Chụp màn hình để xuất trình khi lấy xe.</p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={dongModal}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab quét QR ───
function QRPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [success, setSuccess] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const previewBS = useObjectURL(fileBienSo)
  const previewNL = useObjectURL(fileNguoiLai)

  async function handleFileQR(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileBienSo(file)
    setLoading(true)
    setError(null)
    setResult(null)
    setSuccess(false)
    const fd = new FormData()
    fd.append('anh_qr', file)
    try {
      const data = await xeVaoApi.quetQR(fd)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
      await xeVaoApi.xacNhanVeThang(fd)
      setResult(null)
      setSuccess(true)
      setFileBienSo(null)
      setFileNguoiLai(null)
      setResetKey(k => k + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleFileNguoiLai(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileNguoiLai(file)
  }

  return (
    <div className="card">
      <label className="form-label">Chụp ảnh QR</label>
      <input key={resetKey} type="file" accept="image/*" capture="environment" onChange={handleFileQR} />
      {previewBS && <img src={previewBS} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Xe vào thành công!</Alert>}

      {result?.loai === 've_thang_qr' && (
        <div className="card" style={{ borderColor: 'var(--info)', marginBottom: '0.75rem', marginTop: '0.75rem' }}>
          <h5 style={{ color: 'var(--info)' }}>🎫 Vé tháng</h5>
          <p><strong>Biển số:</strong> {result.bien_so}</p>
          <p><strong>Chủ xe:</strong> {result.ten_chu_xe}</p>
          <p><strong>Hết hạn:</strong> {result.ngay_het_han}</p>
          {result.canh_bao && <p style={{ color: 'var(--warning)' }}>⚠️ {result.canh_bao}</p>}

          <div className="card" style={{ marginBottom: '0.75rem', marginTop: '0.75rem' }}>
            <label className="form-label">Ảnh người lái <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="file" accept="image/*" capture="user" onChange={handleFileNguoiLai} />
            {previewNL && <img src={previewNL} alt="người lái" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', marginTop: 8 }} />}
          </div>

          <button className="btn btn-accent" onClick={xacNhanVeThang} disabled={loading}>
            Xác nhận xe vào (Vé tháng)
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab Biển số ───
function BienSoPanel({ bienSoMacDinh }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)

  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const previewBS = useObjectURL(fileBienSo)
  const previewNL = useObjectURL(fileNguoiLai)

  const [bienSo, setBienSo] = useState('')
  const [result, setResult] = useState(null)
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [formThuong, setFormThuong] = useState({
    loaiXe: '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false
  })
  const [loaiXeList, setLoaiXeList] = useState([])

  // Lấy danh sách loại xe
  useEffect(() => {
    loaiXeApi.list().then(data => {
      setLoaiXeList(data)
      if (data.length) setFormThuong(f => ({ ...f, loaiXe: data[0].id }))
    }).catch(() => {})
  }, [])

  // Khi nhận biển số từ tab Chụp ảnh, tự động điền và kiểm tra
  useEffect(() => {
    if (bienSoMacDinh && bienSoMacDinh.trim()) {
      setBienSo(bienSoMacDinh.trim())
      kiemTra(bienSoMacDinh.trim())
    }
  }, [bienSoMacDinh]) // eslint-disable-line

  async function kiemTra(bs) {
    const searchBien = bs || bienSo.trim()
    if (!searchBien) return
    setLoading(true)
    setError(null)
    setResult(null)
    setShowFormThuong(false)
    const fd = new FormData()
    fd.append('bien_so', searchBien)
    try {
      const data = await xeVaoApi.kiemTraBienSo(fd)
      if (data.loai === 've_thang') {
        // Nếu API không trả về ma_qr, có thể hiển thị thông báo thân thiện
        if (!data.ma_qr) {
          setError('Vé tháng này chưa có mã QR. Vui lòng liên hệ quản lý.')
        }
        setResult(data)
      } else if (data.loai === 'xe_thuong') {
        setResult(data)
        setShowFormThuong(true)
      } else {
        setError('Không tìm thấy xe.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function xacNhanVeThang() {
    if (!result?.ma_qr) {
      setError('Không có mã QR vé tháng.')
      return
    }
    if (!fileBienSo || !fileNguoiLai) {
      setError('Vui lòng chụp đầy đủ ảnh biển số và người lái')
      return
    }
    setLoading(true)
    const fd = new FormData()
    fd.append('ma_qr', result.ma_qr)
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_lai', fileNguoiLai)
    try {
      const data = await xeVaoApi.xacNhanVeThang(fd)
      setResult(null)
      setShowFormThuong(false)
      setTicket(data)
      setFileBienSo(null)
      setFileNguoiLai(null)
      // Reset input file người lái (nếu cần)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
    fd.append('bien_so_xac_nhan', bienSo.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    fd.append('anh_bien_so', fileBienSo)
    fd.append('anh_nguoi_lai', fileNguoiLai)
    try {
      const data = await xeVaoApi.xacNhanThuong(fd)
      setResult(null)
      setShowFormThuong(false)
      setTicket(data)
      setFileBienSo(null)
      setFileNguoiLai(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function dongModal() {
    setTicket(null)
    setBienSo('')
    setError(null)
  }

  return (
    <div className="card">
      <Field label="Nhập biển số">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={bienSo} onChange={e => setBienSo(e.target.value)}
            placeholder="VD: 51F-12345" style={{ flex: 1, textTransform: 'uppercase' }}
            onKeyDown={e => e.key === 'Enter' && kiemTra()} />
          <button className="btn btn-secondary btn-sm" onClick={() => kiemTra()} disabled={loading}>
            Kiểm tra
          </button>
        </div>
      </Field>

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Ảnh biển số <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input type="file" accept="image/*" capture="environment" onChange={e => setFileBienSo(e.target.files[0])} />
        {previewBS && <img src={previewBS} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
      </div>
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Ảnh người lái <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input type="file" accept="image/*" capture="user" onChange={e => setFileNguoiLai(e.target.files[0])} />
        {previewNL && <img src={previewNL} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: '50%', marginTop: 8 }} />}
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {/* Vé tháng tìm được — có onClick đầy đủ */}
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

      {showFormThuong && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '0.75rem' }}>🚗 Xe thường</h5>
          <Field label="Biển số">
            <input value={bienSo} disabled style={{ textTransform: 'uppercase' }} />
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
          <Field label="Cho phép lấy hộ">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={formThuong.cho_phep_lay_ho}
                onChange={e => setFormThuong(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))}
                style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <span>Có</span>
            </label>
          </Field>
          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading}>
            Xác nhận xe vào
          </button>
        </div>
      )}

      {ticket && (
        <Modal onClose={dongModal} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10 }} />}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>📸 Chụp màn hình để xuất trình khi lấy xe.</p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={dongModal}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Trang chính XeVao ───
export default function XeVao() {
  const [tab, setTab] = useState('smart')
  const [bienSoTuSmart, setBienSoTuSmart] = useState('')

  // Callback để chuyển sang tab Biển số kèm biển số
  const chuyenTabBienSo = (bienSo) => {
    setBienSoTuSmart(bienSo)
    setTab('bien')
  }

  // Xóa biển số cũ khi chuyển tab để tránh tự động kiểm tra lại
  useEffect(() => {
    if (tab !== 'bien') {
      setBienSoTuSmart('')
    }
  }, [tab])

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
      {tab === 'smart' && <SmartPanel onChuyenTabBienSo={chuyenTabBienSo} />}
      {tab === 'qr'    && <QRPanel />}
      {tab === 'bien'  && <BienSoPanel bienSoMacDinh={bienSoTuSmart} />}
    </PageLayout>
  )
}