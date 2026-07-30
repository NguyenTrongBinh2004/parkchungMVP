// parking-react/src/XeVao.jsx
import { useState, useEffect, useRef } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal, fmtDt } from '../components/UI'
import { xeVaoApi } from '../services/api'
import imageCompression from 'browser-image-compression'
import { chuanHoaBienSo, isValidBienSo, isMaTuSinhXeDap } from '../utils'
import { useLoaiXe } from '../context/LoaiXeContext'
import { useBaiXe } from '../context/BaiXeContext'

// ── Tiện ích ──────────────────────────────────────────────────────
async function compressImage(file) {
  const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true }
  try { return await imageCompression(file, options) }
  catch (e) { console.warn('Nén ảnh lỗi, dùng gốc:', e); return file }
}

async function urlToFile(url, filename) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type')
    if (!contentType || !contentType.startsWith('image/')) return null
    const blob = await res.blob()
    return new File([blob], filename, { type: blob.type })
  } catch (e) { console.warn('urlToFile failed:', e); return null }
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

// ── ImagePicker ────────────────────────────────────────────────────
function ImagePicker({ label, required, file, onFile, refInput }) {
  const internalRef = useRef(null)
  const refCam = refInput || internalRef
  const refLib = useRef(null)
  const preview = useObjectURL(file)

  function onChange(e) {
    if (e.target.files[0]) onFile(e.target.files[0])
  }

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label className="form-label">{label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
      <input ref={refCam} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onChange} />
      <input ref={refLib} type="file" accept="image/*" style={{ display: 'none' }} onChange={onChange} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => refCam.current.click()} style={{ flex: 1 }}>📷 Chụp</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => refLib.current.click()} style={{ flex: 1 }}>🖼 Thư viện</button>
      </div>
      {preview ? (
        <div style={{ position: 'relative', marginTop: 8 }}>
          <img src={preview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />
          <button type="button" onClick={() => onFile(null)}
            style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <div style={{ marginTop: 8, border: '2px dashed #444', borderRadius: 8, padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Chưa có ảnh</div>
      )}
    </div>
  )
}

// ─── Chọn kiểu giá khi loại xe có nhiều lựa chọn (giao diện mới) ──
function KieuGiaPicker({ loaiXe, value, onChange }) {
  if (!loaiXe) return null
  const options = [
    loaiXe.co_gia_luot && { key: 'theo_luot', icon: '🎫', label: 'Theo lượt' },
    loaiXe.co_gia_gio && { key: 'theo_gio', icon: '⏱️', label: 'Theo giờ' },
    loaiXe.co_gia_ngay_dem && { key: 'theo_ngay_dem', icon: '🌗', label: 'Ngày/đêm' },
  ].filter(Boolean)

  if (options.length <= 1) return null

  return (
    <div style={{
      marginBottom: '0.85rem', padding: '10px 12px',
      background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.3)',
      borderRadius: 10,
    }}>
      <div style={{
        fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        ⚖️ Chọn kiểu tính giá <span style={{ color: 'var(--danger)' }}>*</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '10px 4px', minHeight: 56,
              borderRadius: 10,
              border: `1.5px solid ${value === opt.key ? 'var(--accent)' : 'var(--border)'}`,
              background: value === opt.key ? 'var(--accent)' : 'transparent',
              color: value === opt.key ? '#1e293b' : 'var(--text)',
              fontWeight: value === opt.key ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{opt.icon}</span>
            <span style={{ fontSize: '0.74rem' }}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── VeThangCard (đã thêm prop hoanThien) ────────────────────────
function VeThangCard({ result, onXacNhan, loading, hoanThien }) {
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const [localError, setLocalError] = useState(null)

  async function handleXacNhan() {
    if (!fileBienSo) { setLocalError('Vui lòng chụp ảnh biển số xe'); return }
    if (!fileNguoiLai) { setLocalError('Vui lòng chụp ảnh người lái'); return }
    setLocalError(null)
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
      {result.so_ngay_con <= 7 && <p style={{ color: 'var(--warning)' }}>⚠️ Vé tháng còn {result.so_ngay_con} ngày</p>}
      {result.ghi_chu && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📝 {result.ghi_chu}</p>}
      {(result.anh_bien_so || result.anh_nguoi_dung) && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>📋 Ảnh hồ sơ đối chiếu:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {result.anh_bien_so && <img src={result.anh_bien_so} alt="Biển số hồ sơ" style={{ width: 110, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />}
            {result.anh_nguoi_dung && <img src={result.anh_nguoi_dung} alt="Người dùng hồ sơ" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border)' }} />}
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
        <ImagePicker label="Ảnh biển số xe (chụp thực tế)" required file={fileBienSo} onFile={setFileBienSo} />
        <ImagePicker label="Ảnh người lái" required file={fileNguoiLai} onFile={setFileNguoiLai} />
      </div>
      {localError && <Alert type="danger" onClose={() => setLocalError(null)}>{localError}</Alert>}
      <button className="btn btn-accent" onClick={handleXacNhan} disabled={loading || !hoanThien} style={{ marginTop: 8 }}>
        ✅ Xác nhận xe vào (Vé tháng)
      </button>
    </div>
  )
}

// ── Helper: chọn loại xe mặc định từ groupedLoaiXe ────────────────
function pickDefaultLoaiXe(groupedLoaiXe) {
  const flatItems = groupedLoaiXe.flatMap(g => g.items)
  if (flatItems.length === 0) return ''
  const oto = flatItems.find(lx => lx.ten?.toLowerCase().replace(/\s+/g, '').includes('ôtô'))
  const fallback = flatItems.find(lx => lx.ten?.toLowerCase().replace(/\s+/g, '').includes('oto'))
  return oto ? oto.id : (fallback ? fallback.id : flatItems[0].id)
}

// ── SmartPanel ─────────────────────────────────────────────────────
function SmartPanel() {
  const { allLoaiXe, configuredLoaiXe, groupedLoaiXe, dataLoading } = useLoaiXe()
  const { hoanThien, thieuThongTin, dataLoading: baiXeLoading } = useBaiXe()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [success, setSuccess] = useState(false)

  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)

  const [bienSoText, setBienSoText] = useState('')
  const [result, setResult] = useState(null)
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [formThuong, setFormThuong] = useState({
    loaiXe: '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false,
  })
  const defaultLoaiXeRef = useRef('')
  const [autoModeFailed, setAutoModeFailed] = useState(false)

  // State chọn kiểu giá
  const [kieuTinhGia, setKieuTinhGia] = useState('')

  useEffect(() => {
    if (groupedLoaiXe.length === 0) return
    const defaultId = pickDefaultLoaiXe(groupedLoaiXe)
    defaultLoaiXeRef.current = defaultId
    setFormThuong(f => f.loaiXe ? f : { ...f, loaiXe: defaultId })
  }, [groupedLoaiXe])

  useEffect(() => { setAutoModeFailed(false) }, [result])

  const loaiXeObjThuong = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)

  async function handleBienSoFile(file) {
    if (!file) { setFileBienSo(null); setResult(null); setBienSoText(''); return }
    setFileBienSo(file); setError(null); setResult(null)
    setShowFormThuong(false); setSuccess(false); setBienSoText('')
    setLoading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('anh', compressed)
      const data = await xeVaoApi.nhanDien(fd)
      if (data.loai === 've_thang_qr') { setFileBienSo(null); setResult(data) }
      else { setBienSoText(data.bien_so_nhan_dien || ''); setResult({ loai: 'bien_so' }) }
    } catch (err) { setError(err.message); setBienSoText(''); setResult({ loai: 'bien_so' }) }
    finally { setLoading(false) }
  }

  async function kiemTraBienSo() {
    const raw = bienSoText.trim()
    if (!raw) {
      const xeDap = configuredLoaiXe.find(lx => lx.ten.toLowerCase().includes('đạp'))
      if (xeDap) {
        const tempPlate = 'XD' + Date.now().toString().slice(-6)
        setBienSoText(tempPlate); setResult({ loai: 'xe_thuong' })
        setShowFormThuong(true); setFormThuong(f => ({ ...f, loaiXe: xeDap.id })); return
      }
      setError('Loại "Xe đạp" chưa được cấu hình giá.'); return
    }
    const cleaned = chuanHoaBienSo(raw)
    if (!isMaTuSinhXeDap(cleaned) && !isValidBienSo(cleaned)) {
      setError('Biển số không đúng định dạng (VD: 51F-123.45)')
      return
    }
    setBienSoText(cleaned); setLoading(true); setError(null)
    const fd = new FormData(); fd.append('bien_so', cleaned)
    try {
      const data = await xeVaoApi.kiemTraBienSo(fd)
      if (data.loai === 've_thang') { setResult(data); setShowFormThuong(false) }
      else if (data.loai === 'xe_thuong') { setResult(data); setShowFormThuong(true) }
      else { setError('Không xác định được loại xe.') }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function xacNhanVeThangAuto() {
    if (!result?.ma_qr) { setError('Thiếu mã QR vé tháng'); return }
    setLoading(true)
    try {
      const fileBS = result.anh_bien_so ? await urlToFile(result.anh_bien_so, 'bien_so.jpg') : null
      const fileNL = result.anh_nguoi_dung ? await urlToFile(result.anh_nguoi_dung, 'nguoi_dung.jpg') : null
      if (!fileBS || !fileNL) { setAutoModeFailed(true); setError('Ảnh hồ sơ không khả dụng, vui lòng chụp ảnh thực tế.'); setLoading(false); return }
      const fd = new FormData()
      fd.append('ma_qr', result.ma_qr)
      fd.append('anh_bien_so', await compressImage(fileBS))
      fd.append('anh_nguoi_lai', await compressImage(fileNL))
      const data = await xeVaoApi.xacNhanVeThang(fd)
      setTicket(data); setSuccess(true); resetForm()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function xacNhanVeThangManual(fileBienSoThucTe, fileNguoiLaiThucTe) {
    if (!result?.ma_qr) { setError('Thiếu mã QR vé tháng'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('ma_qr', result.ma_qr)
    fd.append('anh_bien_so', fileBienSoThucTe)
    fd.append('anh_nguoi_lai', fileNguoiLaiThucTe)
    try { const data = await xeVaoApi.xacNhanVeThang(fd); setTicket(data); setSuccess(true); resetForm() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function xacNhanThuong() {
    if (!fileBienSo) { setError('Vui lòng chụp ảnh biển số'); return }
    if (!fileNguoiLai) { setError('Vui lòng chụp ảnh người lái'); return }
    if (!formThuong.loaiXe) { setError('Vui lòng chọn loại xe'); return }
    const loaiXeObj = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)
    const isBicycle = loaiXeObj?.ten.toLowerCase().includes('đạp')
    if (!isBicycle && !bienSoText.trim()) { setError('Vui lòng nhập biển số'); return }

    const coNhieuKieu = [loaiXeObj?.co_gia_luot, loaiXeObj?.co_gia_gio, loaiXeObj?.co_gia_ngay_dem].filter(Boolean).length > 1
    if (coNhieuKieu && !kieuTinhGia) { setError('Vui lòng chọn kiểu tính giá áp dụng.'); return }

    setLoading(true)
    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSoText.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    if (kieuTinhGia) fd.append('kieu_tinh_gia', kieuTinhGia)
    fd.append('anh_bien_so', await compressImage(fileBienSo))
    fd.append('anh_nguoi_lai', await compressImage(fileNguoiLai))
    try { const data = await xeVaoApi.xacNhanThuong(fd); setTicket(data); setSuccess(true); resetForm() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function resetForm() {
    setFileBienSo(null); setFileNguoiLai(null); setBienSoText('')
    setResult(null); setShowFormThuong(false); setError(null); setAutoModeFailed(false)
    setKieuTinhGia('')
    setFormThuong({ loaiXe: defaultLoaiXeRef.current, tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false })
  }

  const hasProfileImages = result && (result.anh_bien_so || result.anh_nguoi_dung) && !autoModeFailed
  const isVeThangQR = result?.loai === 've_thang_qr'
  const isVeThang = result?.loai === 've_thang'

  const VeThangInfo = ({ r }) => (
    <div className="card" style={{ borderColor: 'var(--info)', marginBottom: '0.75rem' }} key={r.ma_qr || 'auto'}>
      <h5 style={{ color: 'var(--info)', marginBottom: '0.75rem' }}>🎫 Vé tháng</h5>
      <p><strong>Biển số:</strong> {r.bien_so}</p>
      <p><strong>Chủ xe:</strong> {r.ten_chu_xe}</p>
      <p><strong>Hết hạn:</strong> {r.ngay_het_han}</p>
      {r.so_ngay_con <= 7 && <p style={{ color: 'var(--warning)' }}>⚠️ Vé tháng còn {r.so_ngay_con} ngày</p>}
      {r.ghi_chu && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📝 {r.ghi_chu}</p>}
      <div style={{ margin: '10px 0', padding: '10px', background: 'rgba(13,202,240,0.07)', borderRadius: 8, border: '1px solid rgba(13,202,240,0.2)' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>📋 Ảnh hồ sơ đối chiếu</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          {r.anh_bien_so && <img src={r.anh_bien_so} alt="Biển số hồ sơ" style={{ width: 130, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid var(--border)' }} />}
          {r.anh_nguoi_dung && <img src={r.anh_nguoi_dung} alt="Người dùng hồ sơ" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--border)' }} />}
        </div>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Hệ thống sẽ tự động dùng ảnh hồ sơ đã lưu.</p>
      <button className="btn btn-accent" onClick={xacNhanVeThangAuto} disabled={loading || !hoanThien} style={{ marginTop: 8 }}>✅ Xác nhận xe vào (Vé tháng)</button>
    </div>
  )

  return (
    <div>
      {!baiXeLoading && !hoanThien && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '0.75rem',
          background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)',
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Chưa thể cho xe vào</div>
            <div style={{ color: 'var(--text-muted)' }}>
              Vui lòng hoàn thiện thông tin bãi xe: {thieuThongTin.join(', ')}.
            </div>
            <a href="/#nguoi-dung" style={{ color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600 }}>
              → Đi tới Cài đặt
            </a>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <ImagePicker label="Ảnh biển số xe" required file={fileBienSo} onFile={handleBienSoFile} />
      </div>
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <ImagePicker label="Ảnh người lái" required file={fileNguoiLai} onFile={setFileNguoiLai} />
      </div>

      {(loading || dataLoading) && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Xe vào thành công!</Alert>}

      {(isVeThangQR || isVeThang) && (
        hasProfileImages
          ? <VeThangInfo r={result} />
          : <VeThangCard key={result.ma_qr || 'manual'} result={result} onXacNhan={xacNhanVeThangManual} loading={loading} hoanThien={hoanThien} />
      )}

      {result?.loai === 'bien_so' && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <Field label="Biển số (sửa nếu cần)">
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={bienSoText} onChange={e => setBienSoText(e.target.value)} placeholder="Nhập biển số" style={{ textTransform: 'uppercase', flex: 1 }} />
              <button className="btn btn-accent btn-sm" onClick={kiemTraBienSo} disabled={loading} style={{ whiteSpace: 'nowrap' }}>Xác nhận</button>
            </div>
          </Field>
        </div>
      )}

      {showFormThuong && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <h5 style={{ marginBottom: '0.75rem' }}>🚗 Xe thường</h5>
          <Field label="Biển số"><input value={bienSoText} disabled style={{ textTransform: 'uppercase' }} /></Field>
          <Field label="Loại xe" required>
            <select value={formThuong.loaiXe} onChange={e => { setFormThuong(f => ({ ...f, loaiXe: e.target.value })); setKieuTinhGia('') }}>
              {groupedLoaiXe.map(group => (
                <optgroup key={group.nhom_id} label={group.ten_nhom}>
                  {group.items.map(lx => (
                    <option key={lx.id} value={lx.id}>
                      {lx._la_dai_dien_dong_gia ? `⚖️ ${lx.ten} (đồng giá)` : lx.ten}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <KieuGiaPicker loaiXe={loaiXeObjThuong} value={kieuTinhGia} onChange={setKieuTinhGia} />
          <Field label="Tên chủ xe"><input value={formThuong.tenChuXe} onChange={e => setFormThuong(f => ({ ...f, tenChuXe: e.target.value }))} /></Field>
          <Field label="Số điện thoại"><input value={formThuong.sdt} onChange={e => setFormThuong(f => ({ ...f, sdt: e.target.value }))} inputMode="tel" /></Field>
          <Field label="Email"><input type="email" value={formThuong.email} onChange={e => setFormThuong(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Ghi chú"><input value={formThuong.ghiChu} onChange={e => setFormThuong(f => ({ ...f, ghiChu: e.target.value }))} /></Field>
          <Field label="Cho phép lấy hộ">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={formThuong.cho_phep_lay_ho} onChange={e => setFormThuong(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <span>Có</span>
            </label>
          </Field>
          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading || !hoanThien}>✅ Xác nhận xe vào</button>
        </div>
      )}

      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.canh_bao_het_cho && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                textAlign: 'left', fontSize: '0.82rem',
                color: '#f5c451',
                background: 'rgba(245, 196, 81, 0.08)',
                borderLeft: '3px solid #f5c451',
                borderRadius: 6,
                padding: '0.6rem 0.8rem',
                margin: '0.75rem 0',
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                <span>{ticket.canh_bao_het_cho.replace('⚠️ ', '')}</span>
              </div>
            )}
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10, marginTop: 8 }} />}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 8 }}>📸 Chụp màn hình để xuất trình khi lấy xe.</p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── BienSoPanel (nhận coChupAnh từ props) ──────────────────────
function BienSoPanel({ coChupAnh, setCoChupAnh }) {
  const { configuredLoaiXe, groupedLoaiXe, dataLoading } = useLoaiXe()
  const { hoanThien, thieuThongTin, dataLoading: baiXeLoading } = useBaiXe()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [bienSo, setBienSo] = useState('')
  const [result, setResult] = useState(null)
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const [formThuong, setFormThuong] = useState({ loaiXe: '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false })
  const [autoModeFailed, setAutoModeFailed] = useState(false)

  // State chọn kiểu giá
  const [kieuTinhGia, setKieuTinhGia] = useState('')

  const defaultLoaiXeRef = useRef('')

  useEffect(() => {
    if (groupedLoaiXe.length === 0) return
    const defaultId = pickDefaultLoaiXe(groupedLoaiXe)
    defaultLoaiXeRef.current = defaultId
    setFormThuong(f => f.loaiXe ? f : { ...f, loaiXe: defaultId })
  }, [groupedLoaiXe])

  useEffect(() => { setAutoModeFailed(false) }, [result])

  const isVeThang = result?.loai === 've_thang'
  const loaiXeObj = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)

  async function xacNhanVeThangAuto() {
    if (!result?.ma_qr) { setError('Thiếu mã QR vé tháng'); return }
    setLoading(true)
    try {
      const fileBS = result.anh_bien_so ? await urlToFile(result.anh_bien_so, 'bien_so.jpg') : null
      const fileNL = result.anh_nguoi_dung ? await urlToFile(result.anh_nguoi_dung, 'nguoi_dung.jpg') : null
      if (!fileBS || !fileNL) { setAutoModeFailed(true); setError('Ảnh hồ sơ không khả dụng, vui lòng chụp ảnh thực tế.'); setLoading(false); return }
      const fd = new FormData()
      fd.append('ma_qr', result.ma_qr)
      fd.append('anh_bien_so', await compressImage(fileBS))
      fd.append('anh_nguoi_lai', await compressImage(fileNL))
      const data = await xeVaoApi.xacNhanVeThang(fd)
      setTicket(data); setResult(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function xacNhanVeThangManual(fileBienSoThucTe, fileNguoiLaiThucTe) {
    if (!result?.ma_qr) return
    setLoading(true)
    const fd = new FormData()
    fd.append('ma_qr', result.ma_qr)
    fd.append('anh_bien_so', fileBienSoThucTe)
    fd.append('anh_nguoi_lai', fileNguoiLaiThucTe)
    try { const data = await xeVaoApi.xacNhanVeThang(fd); setTicket(data); setResult(null) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function guiXacNhanThuong(bienSoFinal) {
    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSoFinal.toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    if (coChupAnh && fileBienSo)   fd.append('anh_bien_so', await compressImage(fileBienSo))
    if (coChupAnh && fileNguoiLai) fd.append('anh_nguoi_lai', await compressImage(fileNguoiLai))
    if (kieuTinhGia) fd.append('kieu_tinh_gia', kieuTinhGia)

    try {
      const data = await xeVaoApi.xacNhanThuong(fd)
      setTicket(data)
      resetForm()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleXacNhan() {
    setError(null)
    if (!formThuong.loaiXe) { setError('Vui lòng chọn loại xe'); return }
    const loaiXeObj = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)
    const isBicycle = loaiXeObj?.ten.toLowerCase().includes('đạp')

    let bienSoFinal = bienSo.trim()
    if (!isBicycle) {
      if (!bienSoFinal) { setError('Vui lòng nhập biển số'); return }
      const cleaned = chuanHoaBienSo(bienSoFinal)
      if (!isValidBienSo(cleaned)) { setError('Biển số không đúng định dạng (VD: 51F-123.45)'); return }
      bienSoFinal = cleaned
    } else if (bienSoFinal) {
      bienSoFinal = chuanHoaBienSo(bienSoFinal)
    }

    if (coChupAnh) {
      if (!fileBienSo) { setError('Vui lòng chụp ảnh biển số'); return }
      if (!fileNguoiLai) { setError('Vui lòng chụp ảnh người lái'); return }
    }

    const coNhieuKieu = [loaiXeObj?.co_gia_luot, loaiXeObj?.co_gia_gio, loaiXeObj?.co_gia_ngay_dem].filter(Boolean).length > 1
    if (coNhieuKieu && !kieuTinhGia) { setError('Vui lòng chọn kiểu tính giá áp dụng.'); return }

    setBienSo(bienSoFinal)
    setLoading(true)

    if (bienSoFinal && !isMaTuSinhXeDap(bienSoFinal)) {
      try {
        const fd = new FormData(); fd.append('bien_so', bienSoFinal)
        const data = await xeVaoApi.kiemTraBienSo(fd)
        if (data.loai === 've_thang') {
          setResult(data)
          setLoading(false)
          return
        }
      } catch (err) {
        setError(err.message)
        setLoading(false)
        return
      }
    }

    await guiXacNhanThuong(bienSoFinal)
  }

  function resetForm() {
    setBienSo(''); setResult(null); setError(null); setAutoModeFailed(false)
    setFileBienSo(null); setFileNguoiLai(null); setCoChupAnh(false)
    setKieuTinhGia('')
    setFormThuong({ loaiXe: defaultLoaiXeRef.current, tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false })
  }

  const hasProfileImages = result && (result.anh_bien_so || result.anh_nguoi_dung) && !autoModeFailed

  return (
    <div className="card">
      {!baiXeLoading && !hoanThien && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '0.75rem',
          background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)',
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Chưa thể cho xe vào</div>
            <div style={{ color: 'var(--text-muted)' }}>
              Vui lòng hoàn thiện thông tin bãi xe: {thieuThongTin.join(', ')}.
            </div>
            <a href="/#nguoi-dung" style={{ color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600 }}>
              → Đi tới Cài đặt
            </a>
          </div>
        </div>
      )}

      <Field label="Nhập biển số">
        <input value={bienSo} onChange={e => setBienSo(e.target.value)} placeholder="VD: 51F-12345"
          style={{ textTransform: 'uppercase' }} onKeyDown={e => e.key === 'Enter' && handleXacNhan()} />
      </Field>

      <div
        onClick={() => setCoChupAnh(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '0.7rem 0.85rem', margin: '0.6rem 0',
          background: 'var(--bg-input, rgba(255,255,255,0.03))',
          border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,193,7,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
          }}>📷</div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>Chụp ảnh biển số & người lái</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lưu bằng chứng đối chiếu khi xe ra</div>
          </div>
        </div>
        <div style={{
          width: 40, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative',
          background: coChupAnh ? 'var(--accent)' : 'var(--border)', transition: 'background 0.15s',
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%', background: '#000',
            position: 'absolute', top: 3, left: coChupAnh ? 19 : 3, transition: 'left 0.15s',
          }} />
        </div>
      </div>

      {coChupAnh && (
        <div style={{ marginBottom: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <ImagePicker label="Ảnh biển số xe" required file={fileBienSo} onFile={setFileBienSo} />
          <ImagePicker label="Ảnh người lái" required file={fileNguoiLai} onFile={setFileNguoiLai} />
        </div>
      )}

      {(loading || dataLoading) && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {isVeThang && (
        hasProfileImages ? (
          <div className="card" style={{ borderColor: 'var(--info)', marginTop: '0.75rem' }} key={result.ma_qr || 'auto'}>
            <h5 style={{ color: 'var(--info)', marginBottom: '0.75rem' }}>🎫 Vé tháng</h5>
            <p><strong>Biển số:</strong> {result.bien_so}</p>
            <p><strong>Chủ xe:</strong> {result.ten_chu_xe}</p>
            <p><strong>Hết hạn:</strong> {result.ngay_het_han}</p>
            {result.so_ngay_con <= 7 && <p style={{ color: 'var(--warning)' }}>⚠️ Vé tháng còn {result.so_ngay_con} ngày</p>}
            {result.ghi_chu && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📝 {result.ghi_chu}</p>}
            <div style={{ margin: '10px 0', padding: '10px', background: 'rgba(13,202,240,0.07)', borderRadius: 8, border: '1px solid rgba(13,202,240,0.2)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>📋 Ảnh hồ sơ đối chiếu</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                {result.anh_bien_so && <img src={result.anh_bien_so} alt="Biển số hồ sơ" style={{ width: 130, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid var(--border)' }} />}
                {result.anh_nguoi_dung && <img src={result.anh_nguoi_dung} alt="Người dùng hồ sơ" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--border)' }} />}
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Hệ thống sẽ tự động dùng ảnh hồ sơ đã lưu.</p>
            <button className="btn btn-accent" onClick={xacNhanVeThangAuto} disabled={loading || !hoanThien} style={{ marginTop: 8 }}>✅ Xác nhận xe vào (Vé tháng)</button>
          </div>
        ) : (
          <VeThangCard key={result.ma_qr || 'manual'} result={result} onXacNhan={xacNhanVeThangManual} loading={loading} hoanThien={hoanThien} />
        )
      )}

      {!isVeThang && (
        <div style={{ marginTop: '0.75rem' }}>
          <h5 style={{ marginBottom: '0.75rem' }}>🚗 Thông tin xe</h5>
          <Field label="Loại xe" required>
            <select value={formThuong.loaiXe} onChange={e => { setFormThuong(f => ({ ...f, loaiXe: e.target.value })); setKieuTinhGia('') }}>
              {groupedLoaiXe.map(group => (
                <optgroup key={group.nhom_id} label={group.ten_nhom}>
                  {group.items.map(lx => (
                    <option key={lx.id} value={lx.id}>
                      {lx._la_dai_dien_dong_gia ? `⚖️ ${lx.ten} (đồng giá)` : lx.ten}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <KieuGiaPicker loaiXe={loaiXeObj} value={kieuTinhGia} onChange={setKieuTinhGia} />
          <Field label="Tên chủ xe"><input value={formThuong.tenChuXe} onChange={e => setFormThuong(f => ({ ...f, tenChuXe: e.target.value }))} /></Field>
          <Field label="Số điện thoại"><input value={formThuong.sdt} onChange={e => setFormThuong(f => ({ ...f, sdt: e.target.value }))} inputMode="tel" /></Field>
          <Field label="Email"><input type="email" value={formThuong.email} onChange={e => setFormThuong(f => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Ghi chú"><input value={formThuong.ghiChu} onChange={e => setFormThuong(f => ({ ...f, ghiChu: e.target.value }))} /></Field>
          <Field label="Cho phép lấy hộ">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={formThuong.cho_phep_lay_ho} onChange={e => setFormThuong(f => ({ ...f, cho_phep_lay_ho: e.target.checked }))} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              <span>Có</span>
            </label>
          </Field>
          <button className="btn btn-accent" onClick={handleXacNhan} disabled={loading || !hoanThien}>✅ Xác nhận xe vào</button>
        </div>
      )}

      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.canh_bao_het_cho && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                textAlign: 'left', fontSize: '0.82rem',
                color: '#f5c451',
                background: 'rgba(245, 196, 81, 0.08)',
                borderLeft: '3px solid #f5c451',
                borderRadius: 6,
                padding: '0.6rem 0.8rem',
                margin: '0.75rem 0',
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                <span>{ticket.canh_bao_het_cho.replace('⚠️ ', '')}</span>
              </div>
            )}
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10 }} />}
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Trang chính ────────────────────────────────────────────────────
export default function XeVao() {
  const [tab, setTab] = useState('smart')
  const [coChupAnhBienSo, setCoChupAnhBienSo] = useState(false)

  const tabs = [
    { id: 'smart', label: '📷 Chụp ảnh' },
    { id: 'bien',  label: '🔢 Nhập Biển Số' },
  ]

  return (
    <PageLayout title="📸 Xe vào" backTo="/#ban-gui-xe">
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'smart' && <SmartPanel />}
      {tab === 'bien'  && <BienSoPanel coChupAnh={coChupAnhBienSo} setCoChupAnh={setCoChupAnhBienSo} />}
    </PageLayout>
  )
}