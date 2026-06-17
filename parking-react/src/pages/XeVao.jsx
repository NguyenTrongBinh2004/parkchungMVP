// parking-react/src/XeVao.jsx
import { useState, useEffect, useRef } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal, fmtDt } from '../components/UI'
import { xeVaoApi, loaiXeApi } from '../services/api'
import imageCompression from 'browser-image-compression'
import { chuanHoaBienSo, isValidBienSo } from '../utils'

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

// ── VeThangCard ────────────────────────────────────────────────────
function VeThangCard({ result, onXacNhan, loading }) {
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
      <button className="btn btn-accent" onClick={handleXacNhan} disabled={loading} style={{ marginTop: 8 }}>
        ✅ Xác nhận xe vào (Vé tháng)
      </button>
    </div>
  )
}

// ── groupByNhomWithGia ─────────────────────────────────────────────
function groupByNhomWithGia(configuredData, nhomGiaList, allLoaiXe) {
  const nhomGiaMap = {}
  nhomGiaList.forEach(ng => { nhomGiaMap[ng.nhom_xe_id] = ng })

  const coGiaRieng = (lx) => {
    if (lx.kieu_tinh_gia === 'theo_luot') return Number(lx.gia_luot || 0) > 0
    if (lx.kieu_tinh_gia === 'theo_gio') {
      let cfg = lx.cau_hinh_theo_gio
      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { return false } }
      if (Array.isArray(cfg) && cfg.length) return cfg.some(b => (b.gia && b.gia > 0) || (b.moi_gio_tiep && b.moi_gio_tiep > 0))
      return false
    }
    if (lx.kieu_tinh_gia === 'theo_ngay_dem') return (Number(lx.gia_ngay || 0) > 0) || (Number(lx.gia_dem || 0) > 0) || (Number(lx.gia_ngay_dem || 0) > 0)
    return false
  }

  const map = {}
  configuredData.forEach(lx => {
    if (!map[lx.nhom_xe_id]) {
      map[lx.nhom_xe_id] = { nhom_id: lx.nhom_xe_id, ten_nhom: lx.ten_nhom, thu_tu: lx.thu_tu_nhom, items: [] }
    }
    map[lx.nhom_xe_id].items.push(lx)
  })

  nhomGiaList.forEach(ng => {
    if (!map[ng.nhom_xe_id]) {
      map[ng.nhom_xe_id] = { nhom_id: ng.nhom_xe_id, ten_nhom: ng.ten_nhom || '', thu_tu: 0, items: [] }
    }
  })

  return Object.values(map)
    .sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0))
    .map(group => {
      let riengLe = [...group.items]   // các xe riêng lẻ (có giá)
      const nhomGia = nhomGiaMap[group.nhom_id]

      if (nhomGia) {
        // Tìm xe đại diện: ưu tiên xe mặc định, không có giá riêng
        let xeDaiDien = allLoaiXe.find(lx => lx.nhom_xe_id === group.nhom_id && lx.is_default && !coGiaRieng(lx))
                     || allLoaiXe.find(lx => lx.nhom_xe_id === group.nhom_id && !coGiaRieng(lx))

        // Nếu không tìm thấy xe không có giá riêng, fallback về xe mặc định đầu tiên
        if (!xeDaiDien) {
          xeDaiDien = allLoaiXe.find(lx => lx.nhom_xe_id === group.nhom_id && lx.is_default)
                   || allLoaiXe.find(lx => lx.nhom_xe_id === group.nhom_id)
        }

        if (xeDaiDien) {
          // Loại bỏ xe đại diện khỏi danh sách riêng lẻ (tránh trùng value)
          riengLe = riengLe.filter(lx => lx.id !== xeDaiDien.id)

          // Thêm dòng đồng giá vào đầu danh sách
          riengLe.unshift({
            ...xeDaiDien,
            ...nhomGia,
            id: xeDaiDien.id,
            ten: group.ten_nhom,
            _la_dai_dien_dong_gia: true,
          })
        }
      }

      return { ...group, items: riengLe }
    })
    .filter(g => g.items.length > 0)
}

// ── useLoaiXeData — hook dùng chung, chỉ gọi API 1 lần ───────────
function useLoaiXeData() {
  const [allLoaiXe, setAllLoaiXe] = useState([])
  const [configuredLoaiXe, setConfiguredLoaiXe] = useState([])
  const [groupedLoaiXe, setGroupedLoaiXe] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      loaiXeApi.list(),
      loaiXeApi.list({ da_cau_hinh: true }),
      loaiXeApi.listNhomGia().catch(() => [])
    ]).then(([allData, configuredData, nhomGia]) => {
      setAllLoaiXe(allData)
      setConfiguredLoaiXe(configuredData)
      setGroupedLoaiXe(groupByNhomWithGia(configuredData, nhomGia, allData))
    }).catch(() => {}).finally(() => setDataLoading(false))
  }, [])

  return { allLoaiXe, configuredLoaiXe, groupedLoaiXe, dataLoading }
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
function SmartPanel({ loaiXeData }) {
  const { allLoaiXe, configuredLoaiXe, groupedLoaiXe, dataLoading } = loaiXeData

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

  // Set default loại xe khi data load xong
  useEffect(() => {
    if (groupedLoaiXe.length === 0) return
    const defaultId = pickDefaultLoaiXe(groupedLoaiXe)
    defaultLoaiXeRef.current = defaultId
    setFormThuong(f => f.loaiXe ? f : { ...f, loaiXe: defaultId })
  }, [groupedLoaiXe])

  useEffect(() => { setAutoModeFailed(false) }, [result])

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
    const loaiXeObj = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)
    const isBicycle = loaiXeObj?.ten.toLowerCase().includes('đạp')
    if (!isBicycle && !isValidBienSo(cleaned)) { setError('Biển số không đúng định dạng (VD: 51F-123.45)'); return }
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
    setLoading(true)
    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSoText.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    fd.append('anh_bien_so', await compressImage(fileBienSo))
    fd.append('anh_nguoi_lai', await compressImage(fileNguoiLai))
    try { const data = await xeVaoApi.xacNhanThuong(fd); setTicket(data); setSuccess(true); resetForm() }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function resetForm() {
    setFileBienSo(null); setFileNguoiLai(null); setBienSoText('')
    setResult(null); setShowFormThuong(false); setError(null); setAutoModeFailed(false)
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
      <button className="btn btn-accent" onClick={xacNhanVeThangAuto} disabled={loading} style={{ marginTop: 8 }}>✅ Xác nhận xe vào (Vé tháng)</button>
    </div>
  )

  return (
    <div>
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
          : <VeThangCard key={result.ma_qr || 'manual'} result={result} onXacNhan={xacNhanVeThangManual} loading={loading} />
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
            <select value={formThuong.loaiXe} onChange={e => setFormThuong(f => ({ ...f, loaiXe: e.target.value }))}>
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
          <button className="btn btn-accent" onClick={xacNhanThuong} disabled={loading}>✅ Xác nhận xe vào</button>
        </div>
      )}

      {ticket && (
        <Modal onClose={() => setTicket(null)} title="🎫 Vé gửi xe">
          <div style={{ textAlign: 'center' }}>
            <p><strong>Biển số:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{ticket.bien_so}</span></p>
            <p style={{ color: 'var(--text-muted)' }}>Giờ vào: {fmtDt(ticket.gio_vao)}</p>
            {ticket.qr_image_url && <img src={ticket.qr_image_url} alt="QR" style={{ width: 220, borderRadius: 10, marginTop: 8 }} />}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 8 }}>📸 Chụp màn hình để xuất trình khi lấy xe.</p>
            <button className="btn btn-accent" style={{ marginTop: '1rem' }} onClick={() => setTicket(null)}>Đóng</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── BienSoPanel ────────────────────────────────────────────────────
function BienSoPanel({ loaiXeData }) {
  const { allLoaiXe, configuredLoaiXe, groupedLoaiXe, dataLoading } = loaiXeData

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [bienSo, setBienSo] = useState('')
  const [result, setResult] = useState(null)
  const [showFormThuong, setShowFormThuong] = useState(false)
  const [fileBienSo, setFileBienSo] = useState(null)
  const [fileNguoiLai, setFileNguoiLai] = useState(null)
  const [formThuong, setFormThuong] = useState({ loaiXe: '', tenChuXe: '', sdt: '', email: '', ghiChu: '', cho_phep_lay_ho: false })
  const [autoModeFailed, setAutoModeFailed] = useState(false)
  const defaultLoaiXeRef = useRef('')

  useEffect(() => {
    if (groupedLoaiXe.length === 0) return
    const defaultId = pickDefaultLoaiXe(groupedLoaiXe)
    defaultLoaiXeRef.current = defaultId
    setFormThuong(f => f.loaiXe ? f : { ...f, loaiXe: defaultId })
  }, [groupedLoaiXe])

  useEffect(() => { setAutoModeFailed(false) }, [result])

  async function kiemTra() {
    const raw = bienSo.trim()
    if (!raw) {
      const xeDap = configuredLoaiXe.find(lx => lx.ten.toLowerCase().includes('đạp'))
      if (xeDap) {
        const tempPlate = 'XD' + Date.now().toString().slice(-6)
        setBienSo(tempPlate); setResult({ loai: 'xe_thuong' })
        setShowFormThuong(true); setFormThuong(f => ({ ...f, loaiXe: xeDap.id })); return
      }
      setError('Loại "Xe đạp" chưa được cấu hình giá.'); return
    }
    const cleaned = chuanHoaBienSo(raw)
    const loaiXeObj = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)
    const isBicycle = loaiXeObj?.ten.toLowerCase().includes('đạp')
    if (!isBicycle && !isValidBienSo(cleaned)) { setError('Biển số không đúng định dạng (VD: 51F-123.45)'); return }
    setBienSo(cleaned); setLoading(true); setError(null); setResult(null); setShowFormThuong(false)
    const fd = new FormData(); fd.append('bien_so', cleaned)
    try {
      const data = await xeVaoApi.kiemTraBienSo(fd)
      if (data.loai === 've_thang') { setResult(data) }
      else if (data.loai === 'xe_thuong') { setResult(data); setShowFormThuong(true) }
      else { setError('Không tìm thấy xe.') }
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
      setTicket(data); setResult(null); setShowFormThuong(false)
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
    try { const data = await xeVaoApi.xacNhanVeThang(fd); setTicket(data); setResult(null); setShowFormThuong(false) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function xacNhanThuong() {
    if (!fileBienSo) { setError('Vui lòng chụp ảnh biển số'); return }
    if (!fileNguoiLai) { setError('Vui lòng chụp ảnh người lái'); return }
    const loaiXeObj = configuredLoaiXe.find(lx => lx.id == formThuong.loaiXe)
    const isBicycle = loaiXeObj?.ten.toLowerCase().includes('đạp')
    if (!isBicycle && !bienSo.trim()) { setError('Vui lòng nhập biển số'); return }
    setLoading(true)
    const fd = new FormData()
    fd.append('id_loai_xe', formThuong.loaiXe)
    fd.append('bien_so_xac_nhan', bienSo.trim().toUpperCase())
    fd.append('ten_chu_xe', formThuong.tenChuXe || '')
    fd.append('sdt', formThuong.sdt || '')
    fd.append('email', formThuong.email || '')
    fd.append('ghi_chu', formThuong.ghiChu || '')
    fd.append('cho_phep_lay_ho', formThuong.cho_phep_lay_ho)
    fd.append('anh_bien_so', await compressImage(fileBienSo))
    fd.append('anh_nguoi_lai', await compressImage(fileNguoiLai))
    try { const data = await xeVaoApi.xacNhanThuong(fd); setTicket(data); setResult(null); setShowFormThuong(false) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const hasProfileImages = result && (result.anh_bien_so || result.anh_nguoi_dung) && !autoModeFailed

  return (
    <div className="card">
      <Field label="Nhập biển số">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={bienSo} onChange={e => setBienSo(e.target.value)} placeholder="VD: 51F-12345"
            style={{ flex: 1, textTransform: 'uppercase' }} onKeyDown={e => e.key === 'Enter' && kiemTra()} />
          <button className="btn btn-secondary btn-sm" onClick={kiemTra} disabled={loading} style={{ whiteSpace: 'nowrap' }}>Xác nhận</button>
        </div>
      </Field>

      <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        <ImagePicker label="Ảnh biển số xe" required file={fileBienSo} onFile={setFileBienSo} />
        <ImagePicker label="Ảnh người lái" required file={fileNguoiLai} onFile={setFileNguoiLai} />
      </div>

      {(loading || dataLoading) && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {result?.loai === 've_thang' && (
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
            <button className="btn btn-accent" onClick={xacNhanVeThangAuto} disabled={loading} style={{ marginTop: 8 }}>✅ Xác nhận xe vào (Vé tháng)</button>
          </div>
        ) : (
          <VeThangCard key={result.ma_qr || 'manual'} result={result} onXacNhan={xacNhanVeThangManual} loading={loading} />
        )
      )}

      {showFormThuong && (
        <div style={{ marginTop: '0.75rem' }}>
          <Field label="Loại xe" required>
            <select value={formThuong.loaiXe} onChange={e => setFormThuong(f => ({ ...f, loaiXe: e.target.value }))}>
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

// ── Trang chính ────────────────────────────────────────────────────
export default function XeVao() {
  const [tab, setTab] = useState('smart')
  const loaiXeData = useLoaiXeData()

  const tabs = [
    { id: 'smart', label: '📷 Chụp ảnh' },
    { id: 'bien',  label: '🔢 Biển số' },
  ]

  return (
    <PageLayout title="📸 Xe vào" backTo="/">
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'smart' && <SmartPanel loaiXeData={loaiXeData} />}
      {tab === 'bien'  && <BienSoPanel loaiXeData={loaiXeData} />}
    </PageLayout>
  )
}