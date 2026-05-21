import { useState, useEffect, useRef } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal, fmtDt } from '../components/UI'
import { xeVaoApi, loaiXeApi } from '../services/api'
import imageCompression from 'browser-image-compression'

const API = import.meta.env.VITE_API_URL || ''

// ─── Nén ảnh ─────────────────────────────────────────────────
async function compressImage(file) {
  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
  }
  try {
    return await imageCompression(file, options)
  } catch (error) {
    console.warn('Nén ảnh thất bại, dùng ảnh gốc:', error)
    return file
  }
}

// ─── Hook quản lý Object URL ─────────────────────────────────
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

// ─── Component chọn ảnh: camera + thư viện ────────────────────
function ImagePicker({ label, required, file, onFile, refInput }) {
  const refCam = refInput || useRef(null)
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
      <input ref={refCam} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onChange} />
      <input ref={refLib} type="file" accept="image/*" style={{ display: 'none' }} onChange={onChange} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => refCam.current.click()} style={{ flex: 1 }}>
          📷 Chụp
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => refLib.current.click()} style={{ flex: 1 }}>
          🖼 Thư viện
        </button>
      </div>
      {preview ? (
        <div style={{ position: 'relative', marginTop: 8 }}>
          <img src={preview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
          <button
            type="button"
            onClick={() => onFile(null)}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>
      ) : (
        <div style={{ marginTop: 8, border: '2px dashed #444', borderRadius: 8, padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          Chưa có ảnh
        </div>
      )}
    </div>
  )
}

// ─── Card thông tin vé tháng (tự quản lý ảnh biển số + người lái) ──
function VeThangCard({ result, onXacNhan, loading }) {
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const [localError, setLocalError] = useState(null)

  async function handleXacNhan() {
    if (!fileBienSo) { setLocalError('Vui lòng chụp ảnh biển số xe'); return }
    if (!fileNguoiLai) { setLocalError('Vui lòng chụp ảnh người lái'); return }
    setLocalError(null)

    // Nén ảnh trước khi gửi
    const compressedBS = await compressImage(fileBienSo)
    const compressedNL = await compressImage(fileNguoiLai)
    onXacNhan(compressedBS, compressedNL)
  }

  return (
    <div className="card" style={{ borderColor: 'var(--info)', marginBottom: '0.75rem' }}>
      <h5 style={{ color: 'var(--info)', marginBottom: '0.75rem' }}>🎫 Vé tháng</h5>
      <p><strong>Biển số:</strong> {result.bien_so}</p>
      <p><strong>Chủ xe:</strong> {result.ten_chu_xe}</p>
      <p><strong>Hết hạn:</strong> {result.ngay_het_han}</p>
      {result.so_ngay_con <= 7 && (
        <p style={{ color: 'var(--warning)' }}>⚠️ Vé tháng còn {result.so_ngay_con} ngày</p>
      )}
      {result.ghi_chu && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
          📝 {result.ghi_chu}
        </p>
      )}

      {/* Ảnh đối chiếu từ hồ sơ */}
      {(result.anh_bien_so || result.anh_nguoi_dung) && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>📋 Ảnh hồ sơ đối chiếu:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {result.anh_bien_so && (
              <div style={{ textAlign: 'center' }}>
                <img src={result.anh_bien_so} alt="Biển số hồ sơ"
                  style={{ width: 110, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}
                  onError={e => e.target.style.display = 'none'} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Biển số HS</div>
              </div>
            )}
            {result.anh_nguoi_dung && (
              <div style={{ textAlign: 'center' }}>
                <img src={result.anh_nguoi_dung} alt="Người dùng hồ sơ"
                  style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border)' }}
                  onError={e => e.target.style.display = 'none'} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Người HS</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
        <ImagePicker label="Ảnh biển số xe (chụp lúc vào)" required file={fileBienSo} onFile={setFileBienSo} />
        <ImagePicker label="Ảnh người lái" required file={fileNguoiLai} onFile={setFileNguoiLai} />
      </div>

      {localError && <Alert type="danger" onClose={() => setLocalError(null)}>{localError}</Alert>}

      <button className="btn btn-accent" onClick={handleXacNhan} disabled={loading} style={{ marginTop: 8 }}>
        ✅ Xác nhận xe vào (Vé tháng)
      </button>
    </div>
  )
}

// ─── Tab Chụp ảnh (SmartPanel) ─────────────────────────────────
function SmartPanel() {
  const [loaiXeList, setLoaiXeList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [success, setSuccess] = useState(false)

  // Ảnh scan (để nhận diện QR/biển số)
  const [fileScan, setFileScan] = useState(null)
  const previewScan = useObjectURL(fileScan)
  const refScan = useRef(null)
  const refScanLib = useRef(null)

  // Luồng
  const [bienSoText, setBienSoText] = useState('')
  const [result, setResult] = useState(null)
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [fileBienSoThuong, setFileBienSoThuong] = useState(null)
  const [fileNguoiLaiThuong, setFileNguoiLaiThuong] = useState(null)
  const [formThuong, setFormThuong] = useState({
    loaiXe: '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false,
  })

  useEffect(() => {
    loaiXeApi.list().then(data => {
      setLoaiXeList(data)
      if (data.length) {
        const oto = data.find(lx => lx.ten.toLowerCase().replace(/\s+/g, '').includes('ôtô'))
        const fallback = data.find(lx => lx.ten.toLowerCase().replace(/\s+/g, '').includes('oto'))
        setFormThuong(f => ({ ...f, loaiXe: oto ? oto.id : (fallback ? fallback.id : data[0].id) }))
      }
    }).catch(() => {})
  }, [])

  async function handleScanFile(file) {
    if (!file) return
    setFileScan(file)
    setError(null)
    setResult(null)
    setShowFormThuong(false)
    setSuccess(false)
    setBienSoText('')
    setLoading(true)

    try {
      const compressedFile = await compressImage(file)
      const fd = new FormData()
      fd.append('anh', compressedFile)
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

  async function kiemTraBienSo() {
    const bs = bienSoText.trim()
    if (!bs) { setError('Vui lòng nhập biển số'); return }
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

  // Xác nhận vé tháng (nhận ảnh đã nén từ VeThangCard)
  async function xacNhanVeThang(fileBienSoThucTe, fileNguoiLai) {
    if (!result?.ma_qr) { setError('Thiếu mã QR vé tháng'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('ma_qr', result.ma_qr)
    fd.append('anh_bien_so', fileBienSoThucTe)    // ảnh biển số thực tế
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

  async function xacNhanThuong() {
    if (!fileBienSoThuong) { setError('Vui lòng chụp ảnh biển số'); return }
    if (!fileNguoiLaiThuong) { setError('Vui lòng chụp ảnh người lái'); return }
    if (!formThuong.loaiXe) { setError('Vui lòng chọn loại xe'); return }
    setLoading(true)

    const compressedBS = await compressImage(fileBienSoThuong)
    const compressedNL = await compressImage(fileNguoiLaiThuong)

    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSoText.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    fd.append('anh_bien_so', compressedBS)
    fd.append('anh_nguoi_lai', compressedNL)
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
    setFileScan(null)
    setFileBienSoThuong(null)
    setFileNguoiLaiThuong(null)
    setBienSoText('')
    setResult(null)
    setShowFormThuong(false)
    setError(null)
    setFormThuong({ loaiXe: loaiXeList[0]?.id || '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false })
  }

  return (
    <div>
      {/* Input quét ảnh biển số / QR */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Quét ảnh biển số / QR vé tháng</label>
        <input ref={refScan} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
          onChange={e => handleScanFile(e.target.files[0])} disabled={loading} />
        <input ref={refScanLib} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handleScanFile(e.target.files[0])} disabled={loading} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => refScan.current.click()} disabled={loading} style={{ flex: 1 }}>
            📷 Chụp
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => refScanLib.current.click()} disabled={loading} style={{ flex: 1 }}>
            🖼 Thư viện
          </button>
        </div>
        {previewScan && (
          <img src={previewScan} alt="scan" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
        )}
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Xe vào thành công!</Alert>}

      {/* QR vé tháng nhận diện được */}
      {result?.loai === 've_thang_qr' && (
        <VeThangCard result={result} onXacNhan={xacNhanVeThang} loading={loading} />
      )}

      {/* Ô nhập biển số sau scan */}
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
              <button className="btn btn-accent btn-sm" onClick={kiemTraBienSo}
                disabled={loading || !bienSoText.trim()} style={{ whiteSpace: 'nowrap' }}>
                Kiểm tra
              </button>
            </div>
          </Field>
        </div>
      )}

      {/* Kết quả kiểm tra: có vé tháng (tìm bằng biển số) */}
      {result?.loai === 've_thang' && (
        <VeThangCard result={result} onXacNhan={xacNhanVeThang} loading={loading} />
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
              <input type="checkbox" checked={formThuong.cho_phep_lay_ho}
                onChange={e => setFormThuong(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))}
                style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <span>Có</span>
            </label>
          </Field>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
            <ImagePicker label="Ảnh biển số xe" required file={fileBienSoThuong} onFile={setFileBienSoThuong} />
            <ImagePicker label="Ảnh người lái" required file={fileNguoiLaiThuong} onFile={setFileNguoiLaiThuong} />
          </div>

          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading}>
            ✅ Xác nhận xe vào
          </button>
        </div>
      )}

      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.qr_image_url && (
              <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10, marginTop: 8 }} />
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 8 }}>📸 Chụp màn hình để xuất trình khi lấy xe.</p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Tab Biển số (nhập tay hoàn toàn) ──────────────────────────
function BienSoPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [bienSo, setBienSo] = useState('')
  const [result, setResult] = useState(null)
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const [formThuong, setFormThuong] = useState({
    loaiXe: '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false
  })
  const [loaiXeList, setLoaiXeList] = useState([])

  useEffect(() => {
    loaiXeApi.list().then(data => {
      setLoaiXeList(data)
      if (data.length) {
        const oto = data.find(lx => lx.ten.toLowerCase().replace(/\s+/g, '').includes('ôtô'))
        const fallback = data.find(lx => lx.ten.toLowerCase().replace(/\s+/g, '').includes('oto'))
        const defaultId = oto ? oto.id : (fallback ? fallback.id : data[0].id)
        setFormThuong(f => ({ ...f, loaiXe: defaultId }))
      }
    }).catch(() => {})
  }, [])

  async function kiemTra() {
    if (!bienSo.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setShowFormThuong(false)
    const fd = new FormData()
    fd.append('bien_so', bienSo.trim())
    try {
      const data = await xeVaoApi.kiemTraBienSo(fd)
      if (data.loai === 've_thang') setResult(data)
      else if (data.loai === 'xe_thuong') { setResult(data); setShowFormThuong(true) }
      else setError('Không tìm thấy xe.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function xacNhanVeThang(fileBienSoThucTe, fileNguoiLaiFile) {
    if (!result?.ma_qr) return
    setLoading(true)
    const fd = new FormData()
    fd.append('ma_qr', result.ma_qr)
    fd.append('anh_bien_so', fileBienSoThucTe)
    fd.append('anh_nguoi_lai', fileNguoiLaiFile)
    try {
      const data = await xeVaoApi.xacNhanVeThang(fd)
      setTicket(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function xacNhanThuong() {
    if (!fileBienSo) { setError('Vui lòng chụp ảnh biển số'); return }
    if (!fileNguoiLai) { setError('Vui lòng chụp ảnh người lái'); return }
    setLoading(true)

    const compressedBS = await compressImage(fileBienSo)
    const compressedNL = await compressImage(fileNguoiLai)

    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSo.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    fd.append('anh_bien_so', compressedBS)
    fd.append('anh_nguoi_lai', compressedNL)
    try {
      const data = await xeVaoApi.xacNhanThuong(fd)
      setTicket(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <Field label="Nhập biển số">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={bienSo} onChange={e => setBienSo(e.target.value)}
            placeholder="VD: 51F-12345" style={{ flex: 1, textTransform: 'uppercase' }}
            onKeyDown={e => e.key === 'Enter' && kiemTra()} />
          <button className="btn btn-secondary btn-sm" onClick={kiemTra} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
            Kiểm tra
          </button>
        </div>
      </Field>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {result?.loai === 've_thang' && (
        <VeThangCard result={result} onXacNhan={xacNhanVeThang} loading={loading} />
      )}

      {showFormThuong && (
        <div style={{ marginTop: '0.75rem' }}>
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

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
            <ImagePicker label="Ảnh biển số xe" required file={fileBienSo} onFile={setFileBienSo} />
            <ImagePicker label="Ảnh người lái" required file={fileNguoiLai} onFile={setFileNguoiLai} />
          </div>
          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading}>✅ Xác nhận xe vào</button>
        </div>
      )}

      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10 }} />}
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Trang chính XeVao ─────────────────────────────────────────
export default function XeVao() {
  const [tab, setTab] = useState('smart')

  const tabs = [
    { id: 'smart', label: '📷 Chụp ảnh' },
    { id: 'bien',  label: '🔢 Biển số' },
  ]

  return (
    <PageLayout title="📸 Xe vào" backTo="/">
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'smart' && <SmartPanel />}
      {tab === 'bien'  && <BienSoPanel />}
    </PageLayout>
  )
}