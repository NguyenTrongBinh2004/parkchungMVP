// src/pages/LoaiXe.jsx
import { useState, useEffect, useMemo } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal } from '../components/UI'
import { loaiXeApi } from '../services/api'

const NHOM_ICON = { 1: '🛵', 2: '🚗', 3: '🚛', 4: '🚲' }

function fmtGia(lx) {
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
  if (lx.kieu_tinh_gia === 'theo_luot') return `${fmt(lx.gia_luot)} đ / lượt`
  if (lx.kieu_tinh_gia === 'theo_gio') {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { cfg = [] } }
    if (Array.isArray(cfg) && cfg.length) {
      return cfg.map(b => b.den_gio ? `${b.den_gio}h: ${b.gia.toLocaleString()}đ` : `+${b.moi_gio_tiep.toLocaleString()}đ/h`).join(' · ')
    }
    return 'Chưa cấu hình'
  }
  if (lx.kieu_tinh_gia === 'theo_ngay_dem') return `Ngày ${fmt(lx.gia_ngay)} · Đêm ${fmt(lx.gia_dem)} · Qua đêm ${fmt(lx.gia_ngay_dem)} đ`
  return ''
}

const KIEU_LABEL = { theo_luot: 'Lượt', theo_gio: 'Giờ', theo_ngay_dem: 'Ngày/đêm' }

function coGiaThucTe(lx) {
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

// ─── Modal đồng giá cho cả nhóm ─────────────────────────────────────────
function DongGiaModal({ nhom, allLoaiXe, onClose, onSuccess }) {
  // Lấy tất cả loại xe không bị xóa trong nhóm (API đã lọc deleted_at IS NULL)
  const loaiXeTrongNhom = allLoaiXe.filter(lx => lx.nhom_xe_id === nhom.id)
  const [kieu, setKieu] = useState('theo_luot')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ gia_luot: '', gia_ngay: '', gia_dem: '', gia_ngay_dem: '', gia_ve_thang: '' })
  const [bangGio, setBangGio] = useState([{ tuGio: 1, denGio: 2, gia: '' }])
  const [giaMoiGioTiep, setGiaMoiGioTiep] = useState('')

  const upd = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }))

  const buildJsonGio = () => {
    const arr = bangGio.map(d => ({ tu_gio: Number(d.tuGio), den_gio: Number(d.denGio), gia: Number(d.gia) }))
    if (giaMoiGioTiep) arr.push({ moi_gio_tiep: Number(giaMoiGioTiep) })
    return JSON.stringify(arr)
  }

  async function submit(e) {
    e.preventDefault()
    if (loaiXeTrongNhom.length === 0) {
      setError('Nhóm này chưa có loại xe nào.')
      return
    }
    setLoading(true); setError(null)
    const ids = loaiXeTrongNhom.map(lx => lx.id)
    const fd = new FormData()
    fd.append('loai_xe_ids', JSON.stringify(ids))
    fd.append('kieu_tinh_gia', kieu)
    if (kieu === 'theo_luot') fd.append('gia_luot', form.gia_luot || 0)
    else if (kieu === 'theo_gio') fd.append('cau_hinh_theo_gio', buildJsonGio())
    else if (kieu === 'theo_ngay_dem') {
      fd.append('gia_ngay', form.gia_ngay || 0)
      fd.append('gia_dem', form.gia_dem || 0)
      fd.append('gia_ngay_dem', form.gia_ngay_dem || 0)
    }
    if (form.gia_ve_thang) fd.append('gia_ve_thang', form.gia_ve_thang)
    try {
      await loaiXeApi.dongGia(fd)
      onSuccess()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <Modal onClose={onClose} title={`⚖️ Đồng giá nhóm "${nhom.ten}"`}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Áp cùng một mức giá cho tất cả <strong>{loaiXeTrongNhom.length} loại xe</strong> trong nhóm này.
      </p>
      <form onSubmit={submit}>
        <Field label="Kiểu tính giá">
          <select value={kieu} onChange={e => setKieu(e.target.value)}>
            <option value="theo_luot">Theo lượt</option>
            <option value="theo_gio">Theo giờ</option>
            <option value="theo_ngay_dem">Theo ngày / đêm</option>
          </select>
        </Field>
        {kieu === 'theo_luot' && <Field label="Giá mỗi lượt (VNĐ)" required><input type="number" value={form.gia_luot} onChange={upd('gia_luot')} min="0" step="1000" required /></Field>}
        {kieu === 'theo_ngay_dem' && (
          <>
            <Field label="Giá ban ngày (đ)" required><input type="number" value={form.gia_ngay} onChange={upd('gia_ngay')} min="0" step="1000" required /></Field>
            <Field label="Giá ban đêm (đ)" required><input type="number" value={form.gia_dem} onChange={upd('gia_dem')} min="0" step="1000" required /></Field>
            <Field label="Giá qua đêm (đ)" required><input type="number" value={form.gia_ngay_dem} onChange={upd('gia_ngay_dem')} min="0" step="1000" required /></Field>
          </>
        )}
        {kieu === 'theo_gio' && (
          <Field label="Cấu hình giá theo giờ">
            {bangGio.map((dong, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem' }}>Từ giờ</span>
                <input type="number" value={dong.tuGio} style={{ width: 50 }} min="1" onChange={e => { const a = [...bangGio]; a[idx].tuGio = Number(e.target.value); setBangGio(a) }} />
                <span style={{ fontSize: '0.8rem' }}>đến giờ</span>
                <input type="number" value={dong.denGio} style={{ width: 50 }} min={dong.tuGio + 1} onChange={e => { const a = [...bangGio]; a[idx].denGio = Number(e.target.value); setBangGio(a) }} />
                <input type="number" value={dong.gia} style={{ width: 90 }} min="0" step="1000" placeholder="VNĐ" onChange={e => { const a = [...bangGio]; a[idx].gia = e.target.value; setBangGio(a) }} />
                {bangGio.length > 1 && <button type="button" onClick={() => setBangGio(bangGio.filter((_, i) => i !== idx))} style={{ background: 'none', border: '1px solid #f44', color: '#f44', borderRadius: 4, cursor: 'pointer' }}>Xóa</button>}
              </div>
            ))}
            <button type="button" onClick={() => { const l = bangGio[bangGio.length - 1]; setBangGio([...bangGio, { tuGio: l.denGio + 1, denGio: l.denGio + 2, gia: '' }]) }} className="btn btn-sm btn-outline">+ Thêm mốc</button>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: '0.82rem' }}>Mỗi giờ tiếp theo</label>
              <input type="number" value={giaMoiGioTiep} onChange={e => setGiaMoiGioTiep(e.target.value)} min="0" step="1000" style={{ width: '100%', marginTop: 4 }} />
            </div>
          </Field>
        )}
        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={form.gia_ve_thang} onChange={upd('gia_ve_thang')} min="0" step="10000" placeholder="Không bắt buộc" />
        </Field>
        {error && <Alert type="danger">{error}</Alert>}
        <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }} disabled={loading}>
          {loading ? 'Đang lưu...' : '⚖️ Áp đồng giá'}
        </button>
      </form>
    </Modal>
  )
}


// hàm handleXoaDongGia:
async function handleXoaDongGia(nhomId, tenNhom) {
  if (!window.confirm(`Bỏ đồng giá nhóm "${tenNhom}"?\nCác loại xe sẽ hiển thị riêng lẻ trở lại.`)) return
  try {
    const fd = new FormData()
    fd.append('nhom_xe_id', nhomId)
    await loaiXeApi.xoaDongGia(fd)
    load()
  } catch (err) {
    setError(err.message)
  }
}



// ─── Modal thêm loại xe ─────────────────────────────────────────────────
function ThemLoaiXeModal({ nhomList, onClose, onSuccess, onDongGia }) {
  const [kieu, setKieu] = useState('theo_luot')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dsMau, setDsMau] = useState([])
  const [form, setForm] = useState({
    ten: '', nhom_xe_id: String(nhomList[0]?.id || ''), mau_sac: '#FFD700',
    gia_luot: '', cau_hinh_theo_gio: '', gia_ngay: '', gia_dem: '', gia_ngay_dem: '', gia_ve_thang: '',
  })
  const [bangGio, setBangGio] = useState([{ tuGio: 1, denGio: 2, gia: '' }])
  const [giaMoiGioTiep, setGiaMoiGioTiep] = useState('')

  const upd = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }))

  useEffect(() => {
    if (!form.nhom_xe_id) return
    loaiXeApi.list({ include_deleted: true })
      .then(data => setDsMau(data.filter(lx => lx.is_default && String(lx.nhom_xe_id) === String(form.nhom_xe_id))))
      .catch(() => setDsMau([]))
  }, [form.nhom_xe_id])

  const chonMau = (loai) => setForm(v => ({ ...v, ten: loai.ten }))
  const themDong = () => { const last = bangGio[bangGio.length - 1]; setBangGio([...bangGio, { tuGio: last.denGio + 1, denGio: last.denGio + 2, gia: '' }]) }
  const xoaDong = (idx) => { if (bangGio.length > 1) setBangGio(bangGio.filter((_, i) => i !== idx)) }
  const updateDong = (idx, field, value) => { const arr = [...bangGio]; arr[idx][field] = value; setBangGio(arr) }
  const buildJsonGio = () => {
    const arr = bangGio.map(d => ({ tu_gio: Number(d.tuGio), den_gio: Number(d.denGio), gia: Number(d.gia) }))
    if (giaMoiGioTiep) arr.push({ moi_gio_tiep: Number(giaMoiGioTiep) })
    return JSON.stringify(arr)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.ten.trim()) { setError('Vui lòng nhập tên loại xe.'); return }
    if (!form.nhom_xe_id) { setError('Vui lòng chọn nhóm xe.'); return }
    if (kieu === 'theo_gio' && !bangGio.some(d => d.gia)) { setError('Vui lòng nhập ít nhất một mốc giờ với giá.'); return }
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('ten', form.ten.trim()); fd.append('nhom_xe_id', form.nhom_xe_id); fd.append('mau_sac', form.mau_sac)
    fd.append('kieu_tinh_gia', kieu)
    if (kieu === 'theo_luot') fd.append('gia_luot', form.gia_luot || 0)
    else if (kieu === 'theo_gio') fd.append('cau_hinh_theo_gio', buildJsonGio())
    else if (kieu === 'theo_ngay_dem') {
      fd.append('gia_ngay', form.gia_ngay || 0); fd.append('gia_dem', form.gia_dem || 0); fd.append('gia_ngay_dem', form.gia_ngay_dem || 0)
    }
    if (form.gia_ve_thang) fd.append('gia_ve_thang', form.gia_ve_thang)
    try { await loaiXeApi.create(fd); onSuccess() } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleDongGiaClick = () => {
    const nhom = nhomList.find(n => String(n.id) === String(form.nhom_xe_id))
    if (nhom) onDongGia(nhom)
  }

  return (
    <Modal onClose={onClose} title="➕ Thêm loại xe tùy chỉnh">
      <form onSubmit={submit}>
        <Field label="Thuộc nhóm xe" required>
          <select value={form.nhom_xe_id} onChange={upd('nhom_xe_id')} required>
            {nhomList.map(n => <option key={n.id} value={n.id}>{NHOM_ICON[n.id] || '🚘'} {n.ten}</option>)}
          </select>
        </Field>

        {/* Phần chọn nhanh loại xe mẫu (chỉ hiển thị nếu có) */}
        {dsMau.length > 0 && (
          <Field label="Chọn nhanh loại xe">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dsMau.map(lx => (
                <button type="button" key={lx.id} className={`btn btn-sm ${form.ten === lx.ten ? 'btn-accent' : 'btn-outline'}`} onClick={() => chonMau(lx)}>{lx.ten}</button>
              ))}
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setForm(v => ({ ...v, ten: '' }))}>✏️ Tự nhập</button>
            </div>
          </Field>
        )}

        {/* Nút đồng giá luôn hiển thị, không phụ thuộc dsMau */}
        <div style={{ marginBottom: '1rem' }}>
          <button type="button" className="btn btn-sm btn-outline" onClick={handleDongGiaClick}>
            ⚖️ Đồng giá cả nhóm
          </button>
          <small style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Áp một mức giá chung cho tất cả loại xe trong nhóm đã chọn.
          </small>
        </div>

        <Field label="Tên loại xe" required>
          <input value={form.ten} onChange={upd('ten')} placeholder="VD: Xe ba gác máy..." required autoFocus />
        </Field>
        <Field label="Màu đại diện">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.mau_sac} onChange={upd('mau_sac')} style={{ height: 38, width: 60 }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Màu hiển thị trên bản đồ vị trí</span>
          </div>
        </Field>
        <Field label="Kiểu tính giá">
          <select value={kieu} onChange={e => setKieu(e.target.value)}>
            <option value="theo_luot">Theo lượt</option>
            <option value="theo_gio">Theo giờ</option>
            <option value="theo_ngay_dem">Theo ngày / đêm</option>
          </select>
        </Field>
        {kieu === 'theo_luot' && <Field label="Giá mỗi lượt (VNĐ)" required><input type="number" value={form.gia_luot} onChange={upd('gia_luot')} min="0" step="1000" required /></Field>}
        {kieu === 'theo_ngay_dem' && (
          <>
            <Field label="Giá ban ngày (đ)" required><input type="number" value={form.gia_ngay} onChange={upd('gia_ngay')} min="0" step="1000" required /></Field>
            <Field label="Giá ban đêm (đ)" required><input type="number" value={form.gia_dem} onChange={upd('gia_dem')} min="0" step="1000" required /></Field>
            <Field label="Giá qua đêm (đ)" required><input type="number" value={form.gia_ngay_dem} onChange={upd('gia_ngay_dem')} min="0" step="1000" required /></Field>
          </>
        )}
        {kieu === 'theo_gio' && (
          <Field label="Cấu hình giá theo giờ">
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 10 }}>
              {bangGio.map((dong, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span>Từ giờ</span>
                  <input type="number" value={dong.tuGio} style={{ width: 50 }} onChange={e => updateDong(idx, 'tuGio', Number(e.target.value))} />
                  <span>đến</span>
                  <input type="number" value={dong.denGio} style={{ width: 50 }} onChange={e => updateDong(idx, 'denGio', Number(e.target.value))} />
                  <input type="number" value={dong.gia} style={{ width: 90 }} placeholder="VNĐ" onChange={e => updateDong(idx, 'gia', e.target.value)} />
                  {bangGio.length > 1 && <button type="button" onClick={() => xoaDong(idx)}>Xóa</button>}
                </div>
              ))}
              <button type="button" onClick={themDong} className="btn btn-sm btn-outline">+ Thêm mốc giờ</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: '0.82rem' }}>Mỗi giờ tiếp theo</label>
              <input type="number" value={giaMoiGioTiep} onChange={e => setGiaMoiGioTiep(e.target.value)} min="0" step="1000" style={{ width: '100%', marginTop: 4 }} />
            </div>
          </Field>
        )}
        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={form.gia_ve_thang} onChange={upd('gia_ve_thang')} min="0" step="10000" placeholder="Không bắt buộc" />
        </Field>
        {error && <Alert type="danger">{error}</Alert>}
        <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }} disabled={loading}>
          {loading ? 'Đang lưu...' : '✓ Thêm loại xe'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Card loại xe (giữ nguyên) ──────────────────────────────────────────
function LoaiXeCard({ lx, onXoa }) {
  const giaVeThang = lx.gia_ve_thang ? `· Vé tháng ${Number(lx.gia_ve_thang).toLocaleString('vi-VN')}đ` : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: lx.mau_sac || '#FFD700', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{lx.ten}</span>
          {lx.is_default ? <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>hệ thống</span> : <span style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>tùy chỉnh</span>}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtGia(lx)} {giaVeThang}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="badge badge-gray" style={{ fontSize: '0.62rem' }}>{KIEU_LABEL[lx.kieu_tinh_gia]}</span>
        <button onClick={() => onXoa(lx.id, lx.ten)} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 4 }}>Ẩn</button>
      </div>
    </div>
  )
}

// ─── Card nhóm xe (có gộp đồng giá) ────────────────────────────────────
function NhomXeCard({ nhom, loaiXeList, onXoa, onXoaDongGia, isOpen, onToggle }) {
  const loaiDaCauHinh = loaiXeList.filter(lx => lx.nhom_xe_id === nhom.id && coGiaThucTe(lx))
  if (loaiDaCauHinh.length === 0) return null

  const dongGiaXe = loaiDaCauHinh.filter(lx => lx.is_dong_gia)
  const riengLeXe = loaiDaCauHinh.filter(lx => !lx.is_dong_gia)
  const daiDienDongGia = dongGiaXe[0] || null

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: isOpen ? 8 : 0, borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ fontSize: '1.1rem' }}>{NHOM_ICON[nhom.id] || '🚘'}</span>
        <strong style={{ flex: 1 }}>{nhom.ten}</strong>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {daiDienDongGia ? '⚖️ đồng giá' : ''}{daiDienDongGia && riengLeXe.length > 0 ? ' · ' : ''}{riengLeXe.length > 0 ? `${riengLeXe.length} riêng` : ''}
        </span>
        <span>{isOpen ? '▴' : '▾'}</span>
      </div>
      {isOpen && (
        <div style={{ marginTop: 6 }}>
          {daiDienDongGia && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0.6rem 0', borderBottom:'1px solid var(--border)' }}>
              <span>⚖️</span>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontWeight:600 }}>Toàn bộ {nhom.ten}</span>
                  <span style={{ fontSize:'0.62rem', background:'var(--accent)', color:'#fff', padding:'0.1em 0.5em', borderRadius:4 }}>
                    đồng giá · {dongGiaXe.length} loại
                  </span>
                </div>
                <div style={{ fontSize:'0.76rem', color:'var(--text-muted)' }}>{fmtGia(daiDienDongGia)}</div>
              </div>
              <span className="badge badge-gray">{KIEU_LABEL[daiDienDongGia.kieu_tinh_gia]}</span>
              {/* ← THÊM NÚT NÀY */}
              <button
                onClick={() => onXoaDongGia(nhom.id, nhom.ten)}
                title="Xóa đồng giá, hiện lại từng loại xe riêng"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--text-muted)',
                  color: 'var(--text-muted)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                Bỏ ĐG
              </button>
            </div>
          )}
          {riengLeXe.map(lx => <LoaiXeCard key={lx.id} lx={lx} onXoa={onXoa} />)}
        </div>
      )}
    </div>
  )
}

// ─── Component chính ──────────────────────────────────────────────────
export default function LoaiXe() {
  const [nhomList, setNhomList] = useState([])
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [openNhomId, setOpenNhomId] = useState(null)
  const [dongGiaNhom, setDongGiaNhom] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [nhom, loai] = await Promise.all([loaiXeApi.listNhom(), loaiXeApi.list()])
      setNhomList(nhom)
      setList(loai)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleXoa(id, ten) {
    if (!window.confirm(`Ẩn loại xe "${ten}"?`)) return
    try { await loaiXeApi.delete(id); setList(prev => prev.filter(lx => lx.id !== id)) } catch (err) { setError(err.message) }
  }

  const toggleNhom = (id) => setOpenNhomId(prev => prev === id ? null : id)

  const filteredList = useMemo(() => list.filter(coGiaThucTe), [list])
  const stats = useMemo(() => {
    const totalXe = filteredList.length
    const totalNhomCoXe = nhomList.filter(n => filteredList.some(lx => lx.nhom_xe_id === n.id)).length
    const customCount = filteredList.filter(lx => !lx.is_default).length
    return { totalXe, totalNhomCoXe, customCount }
  }, [filteredList, nhomList])

  const handleDongGia = (nhom) => { setShowModal(false); setDongGiaNhom(nhom) }

  return (
    <PageLayout title="🏷️ Loại xe" backTo="/">
      {!loading && stats.totalXe > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>📦 {stats.totalNhomCoXe} nhóm</span>
          <span>🏷️ {stats.totalXe} loại xe đã cấu hình</span>
          <span>⚙️ {stats.customCount} tùy chỉnh</span>
        </div>
      )}
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {nhomList.map(nhom => (
        <NhomXeCard
          key={nhom.id}
          nhom={nhom}
          loaiXeList={list}
          onXoa={handleXoa}
          onXoaDongGia={handleXoaDongGia}
          isOpen={openNhomId === nhom.id}
          onToggle={() => toggleNhom(nhom.id)}
        />
      ))}      
      {!loading && filteredList.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
          Chưa có loại xe nào được cấu hình giá...
        </p>
      )}
      <button className="btn btn-accent" style={{ marginTop: '0.75rem' }} onClick={() => setShowModal(true)} disabled={nhomList.length === 0 || loading}>
        + Thêm loại xe tùy chỉnh
      </button>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
        💡 Chỉ những loại xe đã được thiết lập giá mới hiển thị bên trên...
      </p>
      {showModal && nhomList.length > 0 && (
        <ThemLoaiXeModal
          nhomList={nhomList}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
          onDongGia={handleDongGia}
        />
      )}
      {dongGiaNhom && (
        <DongGiaModal
          nhom={dongGiaNhom}
          allLoaiXe={list}
          onClose={() => setDongGiaNhom(null)}
          onSuccess={() => { setDongGiaNhom(null); load() }}
        />
      )}
    </PageLayout>
  )
}