// src/pages/LoaiXe.jsx
import { useState, useMemo, useEffect } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal } from '../components/UI'
import { loaiXeApi } from '../services/api'
import { useLoaiXe } from '../context/LoaiXeContext'

const NHOM_ICON = { 1: '🛵', 2: '🚗', 3: '🚛', 4: '🚲' }

const TEN_MAU = {
  1: ['Xe máy phổ thông (Số, ga)', 'Xe mô tô PKL / Xe tay côn'],
  2: ['Ô tô 4 - 7 chỗ', 'Ô tô 9 - 16 chỗ', 'Xe bán tải (Pick-up)'],
  3: ['Xe tải / Xe khách lớn (>16 chỗ)'],
  4: ['Xe đạp / Xe đạp điện'],
}

// ─── Editor giá dùng chung: cho phép tích chọn nhiều kiểu cùng lúc ──
function KieuGiaEditor({ gia, onChange }) {
  const upd = (patch) => onChange({ ...gia, ...patch })
  const toggleKieu = (key) => upd({ [key]: !gia[key] })

  const themDong = () => {
    const last = gia.bangGio[gia.bangGio.length - 1]
    upd({ bangGio: [...gia.bangGio, { tuGio: last.denGio + 1, denGio: last.denGio + 2, gia: '' }] })
  }
  const xoaDong = (idx) => {
    if (gia.bangGio.length > 1) upd({ bangGio: gia.bangGio.filter((_, i) => i !== idx) })
  }
  const updateDong = (idx, field, value) => {
    const arr = [...gia.bangGio]; arr[idx][field] = value; upd({ bangGio: arr })
  }

  return (
    <div>
      <Field label="Kiểu tính giá (có thể chọn nhiều)">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button"
            className={`btn btn-sm ${gia.coGiaLuot ? 'btn-accent' : 'btn-outline'}`}
            onClick={() => toggleKieu('coGiaLuot')}>
            {gia.coGiaLuot ? '✓ ' : ''}Theo lượt
          </button>
          <button type="button"
            className={`btn btn-sm ${gia.coGiaGio ? 'btn-accent' : 'btn-outline'}`}
            onClick={() => toggleKieu('coGiaGio')}>
            {gia.coGiaGio ? '✓ ' : ''}Theo giờ
          </button>
          <button type="button"
            className={`btn btn-sm ${gia.coGiaNgayDem ? 'btn-accent' : 'btn-outline'}`}
            onClick={() => toggleKieu('coGiaNgayDem')}>
            {gia.coGiaNgayDem ? '✓ ' : ''}Theo ngày/đêm
          </button>
        </div>
        <small style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
          Chọn từ 1 đến 3 kiểu. Nhân viên sẽ chọn kiểu áp dụng lúc xe vào/ra nếu loại xe có nhiều hơn 1 kiểu.
        </small>
      </Field>

      {gia.coGiaLuot && (
        <Field label="Giá mỗi lượt (VNĐ)" required>
          <input type="number" value={gia.giaLuot} onChange={e => upd({ giaLuot: e.target.value })} min="0" step="1000" required />
        </Field>
      )}

      {gia.coGiaNgayDem && (
        <>
          <Field label="Giá ban ngày (đ)" required><input type="number" value={gia.giaNgay} onChange={e => upd({ giaNgay: e.target.value })} min="0" step="1000" required /></Field>
          <Field label="Giá ban đêm (đ)" required><input type="number" value={gia.giaDem} onChange={e => upd({ giaDem: e.target.value })} min="0" step="1000" required /></Field>
          <Field label="Giá qua đêm (đ)" required><input type="number" value={gia.giaNgayDem} onChange={e => upd({ giaNgayDem: e.target.value })} min="0" step="1000" required /></Field>
        </>
      )}

      {gia.coGiaGio && (
        <Field label="Cấu hình giá theo giờ">
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 10 }}>
            {gia.bangGio.map((dong, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span>Từ giờ</span>
                <input type="number" value={dong.tuGio} style={{ width: 50 }} onChange={e => updateDong(idx, 'tuGio', Number(e.target.value))} />
                <span>đến</span>
                <input type="number" value={dong.denGio} style={{ width: 50 }} onChange={e => updateDong(idx, 'denGio', Number(e.target.value))} />
                <input type="number" value={dong.gia} style={{ width: 90 }} placeholder="VNĐ" onChange={e => updateDong(idx, 'gia', e.target.value)} />
                {gia.bangGio.length > 1 && <button type="button" onClick={() => xoaDong(idx)}>Xóa</button>}
              </div>
            ))}
            <button type="button" onClick={themDong} className="btn btn-sm btn-outline">+ Thêm mốc giờ</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: '0.82rem' }}>Mỗi giờ tiếp theo</label>
            <input type="number" value={gia.giaMoiGioTiep} onChange={e => upd({ giaMoiGioTiep: e.target.value })} min="0" step="1000" style={{ width: '100%', marginTop: 4 }} />
          </div>
        </Field>
      )}
    </div>
  )
}

function giaMacDinh() {
  return {
    coGiaLuot: true, giaLuot: '',
    coGiaGio: false, bangGio: [{ tuGio: 1, denGio: 2, gia: '' }], giaMoiGioTiep: '',
    coGiaNgayDem: false, giaNgay: '', giaDem: '', giaNgayDem: '',
  }
}

function validateGia(gia) {
  if (!gia.coGiaLuot && !gia.coGiaGio && !gia.coGiaNgayDem) {
    return 'Vui lòng chọn ít nhất 1 kiểu tính giá.'
  }
  if (gia.coGiaGio && !gia.bangGio.some(d => d.gia)) {
    return 'Vui lòng nhập ít nhất một mốc giờ với giá.'
  }
  return null
}

function buildFormDataGia(fd, gia) {
  fd.append('co_gia_luot', gia.coGiaLuot)
  fd.append('co_gia_gio', gia.coGiaGio)
  fd.append('co_gia_ngay_dem', gia.coGiaNgayDem)
  if (gia.coGiaLuot) fd.append('gia_luot', gia.giaLuot || 0)
  if (gia.coGiaNgayDem) {
    fd.append('gia_ngay', gia.giaNgay || 0)
    fd.append('gia_dem', gia.giaDem || 0)
    fd.append('gia_ngay_dem', gia.giaNgayDem || 0)
  }
  if (gia.coGiaGio) {
    const arr = gia.bangGio.map(d => ({ tu_gio: Number(d.tuGio), den_gio: Number(d.denGio), gia: Number(d.gia) }))
    if (gia.giaMoiGioTiep) arr.push({ moi_gio_tiep: Number(gia.giaMoiGioTiep) })
    fd.append('cau_hinh_theo_gio', JSON.stringify(arr))
  }
}

// ─── Modal đồng giá cho cả nhóm ─────────────────────────────────────────
function DongGiaModal({ nhom, onClose, onSuccess }) {
  const { refetchLoaiXe } = useLoaiXe()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [gia, setGia] = useState(giaMacDinh())
  const [giaVeThang, setGiaVeThang] = useState('')

  async function submit(e) {
    e.preventDefault()
    const errGia = validateGia(gia)
    if (errGia) { setError(errGia); return }
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('nhom_xe_id', nhom.id)
    buildFormDataGia(fd, gia)
    if (giaVeThang) fd.append('gia_ve_thang', giaVeThang)
    try {
      await loaiXeApi.dongGia(fd)
      await refetchLoaiXe(true)
      onSuccess()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <Modal onClose={onClose} title={`⚖️ Đồng giá nhóm "${nhom.ten}"`}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Áp một mức giá chung cho <strong>tất cả loại xe</strong> trong nhóm này.
      </p>
      <form onSubmit={submit}>
        <KieuGiaEditor gia={gia} onChange={setGia} />
        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={giaVeThang} onChange={e => setGiaVeThang(e.target.value)} min="0" step="10000" placeholder="Không bắt buộc" />
        </Field>
        {error && <Alert type="danger">{error}</Alert>}
        <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }} disabled={loading}>
          {loading ? 'Đang lưu...' : '⚖️ Áp đồng giá'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Modal thêm loại xe ─────────────────────────────────────────────
function ThemLoaiXeModal({ nhomList, onClose, onSuccess, onDongGia }) {
  const { refetchLoaiXe } = useLoaiXe()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [gia, setGia] = useState(giaMacDinh())

  const [form, setForm] = useState({
    ten: '',
    nhom_xe_id: nhomList[0]?.id || 0,
    mau_sac: '#FFD700',
    gia_ve_thang: '',
  })

  const upd = (f) => (e) => setForm(v => ({ ...v, [f]: e.target.value }))
  const dsMau = TEN_MAU[form.nhom_xe_id] || []

  async function submit(e) {
    e.preventDefault()
    if (!form.ten.trim()) { setError('Vui lòng nhập tên loại xe.'); return }
    if (!form.nhom_xe_id) { setError('Vui lòng chọn nhóm xe.'); return }
    const errGia = validateGia(gia)
    if (errGia) { setError(errGia); return }
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('ten', form.ten.trim()); fd.append('nhom_xe_id', form.nhom_xe_id); fd.append('mau_sac', form.mau_sac)
    buildFormDataGia(fd, gia)
    if (form.gia_ve_thang) fd.append('gia_ve_thang', form.gia_ve_thang)
    try {
      await loaiXeApi.create(fd)
      await refetchLoaiXe(true)
      onSuccess()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  const handleDongGiaClick = () => {
    const nhom = nhomList.find(n => n.id === form.nhom_xe_id)
    if (nhom) onDongGia(nhom)
  }

  return (
    <Modal onClose={onClose} title="➕ Thêm loại xe tùy chỉnh">
      <form onSubmit={submit}>
        <Field label="Thuộc nhóm xe" required>
          <select
            value={form.nhom_xe_id}
            onChange={e => setForm(v => ({ ...v, nhom_xe_id: Number(e.target.value) }))}
            required
          >
            {nhomList.map(n => <option key={n.id} value={n.id}>{NHOM_ICON[n.id] || '🚘'} {n.ten}</option>)}
          </select>
        </Field>

        {dsMau.length > 0 && (
          <Field label="Chọn nhanh tên xe">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dsMau.map(ten => (
                <button
                  type="button"
                  key={ten}
                  className={`btn btn-sm ${form.ten === ten ? 'btn-accent' : 'btn-outline'}`}
                  onClick={() => setForm(v => ({ ...v, ten }))}
                >
                  {ten}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setForm(v => ({ ...v, ten: '' }))}
              >
                ✏️ Tự nhập
              </button>
            </div>
          </Field>
        )}

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

        <KieuGiaEditor gia={gia} onChange={setGia} />

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

// ─── Modal sửa giá loại xe ───────────────────────────────────────
function SuaLoaiXeModal({ lx, onClose, onSuccess }) {
  const { refetchLoaiXe } = useLoaiXe()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [gia, setGia] = useState(() => {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { cfg = [] } }
    cfg = Array.isArray(cfg) ? cfg : []
    const mocGoc = cfg.filter(b => b.den_gio !== undefined).map(b => ({ tuGio: b.tu_gio, denGio: b.den_gio, gia: b.gia }))
    const tiepGoc = cfg.find(b => b.moi_gio_tiep !== undefined)?.moi_gio_tiep ?? ''
    return {
      coGiaLuot: !!lx.co_gia_luot, giaLuot: lx.gia_luot ?? '',
      coGiaGio: !!lx.co_gia_gio, bangGio: mocGoc.length ? mocGoc : [{ tuGio: 1, denGio: 2, gia: '' }], giaMoiGioTiep: tiepGoc,
      coGiaNgayDem: !!lx.co_gia_ngay_dem, giaNgay: lx.gia_ngay ?? '', giaDem: lx.gia_dem ?? '', giaNgayDem: lx.gia_ngay_dem ?? '',
    }
  })
  const [giaVeThang, setGiaVeThang] = useState(lx.gia_ve_thang ?? '')

  async function submit(e) {
    e.preventDefault()
    const errGia = validateGia(gia)
    if (errGia) { setError(errGia); return }
    setLoading(true); setError(null)
    const fd = new FormData()
    buildFormDataGia(fd, gia)
    if (giaVeThang) fd.append('gia_ve_thang', giaVeThang)
    try {
      await loaiXeApi.update(lx.id, fd)
      await refetchLoaiXe(true)
      onSuccess()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <Modal onClose={onClose} title={`✏️ Sửa giá — ${lx.ten}`}>
      <form onSubmit={submit}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem',
          padding: '0.6rem 0.8rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: lx.mau_sac || '#FFD700', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lx.ten}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Không đổi được tên/nhóm ở đây</span>
        </div>

        <KieuGiaEditor gia={gia} onChange={setGia} />

        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={giaVeThang} onChange={e => setGiaVeThang(e.target.value)} min="0" step="10000" placeholder="Không bắt buộc" />
        </Field>
        {error && <Alert type="danger">{error}</Alert>}
        <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }} disabled={loading}>
          {loading ? 'Đang lưu...' : '✓ Lưu thay đổi'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Hiển thị giá tổng hợp & badge kiểu giá ──────────────────────
function fmtGia(lx) {
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')
  const parts = []
  if (lx.co_gia_luot) parts.push(`${fmt(lx.gia_luot)} đ/lượt`)
  if (lx.co_gia_ngay_dem) parts.push(`Ngày ${fmt(lx.gia_ngay)} · Đêm ${fmt(lx.gia_dem)} · Qua đêm ${fmt(lx.gia_ngay_dem)} đ`)
  if (lx.co_gia_gio) {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { cfg = [] } }
    if (Array.isArray(cfg) && cfg.length) {
      parts.push(cfg.map(b => b.den_gio ? `${b.den_gio}h: ${b.gia.toLocaleString()}đ` : `+${b.moi_gio_tiep.toLocaleString()}đ/h`).join(' · '))
    } else {
      parts.push('Giờ: chưa cấu hình')
    }
  }
  return parts.join('  |  ') || 'Chưa cấu hình giá'
}

function KieuBadges({ lx }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {lx.co_gia_luot && <span className="badge badge-gray" style={{ fontSize: '0.62rem' }}>Lượt</span>}
      {lx.co_gia_gio && <span className="badge badge-gray" style={{ fontSize: '0.62rem' }}>Giờ</span>}
      {lx.co_gia_ngay_dem && <span className="badge badge-gray" style={{ fontSize: '0.62rem' }}>Ngày/đêm</span>}
    </div>
  )
}

// ─── Card loại xe (hỗ trợ chế độ chọn) ─────────────────────────
function LoaiXeCard({ lx, mode, onSelect }) {
  const giaVeThang = lx.gia_ve_thang ? `· Vé tháng ${Number(lx.gia_ve_thang).toLocaleString('vi-VN')}đ` : ''
  const chonDuoc = mode === 'sua' || mode === 'xoa'

  return (
    <div
      onClick={chonDuoc ? () => onSelect(lx) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.4rem',
        borderBottom: '1px solid var(--border)',
        cursor: chonDuoc ? 'pointer' : 'default',
        borderRadius: chonDuoc ? 8 : 0,
        background: chonDuoc ? (mode === 'xoa' ? 'rgba(239,68,68,0.06)' : 'rgba(255,215,0,0.06)') : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: lx.mau_sac || '#FFD700', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{lx.ten}</span>
          {lx.is_default ? <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>hệ thống</span> : <span style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>tùy chỉnh</span>}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtGia(lx)} {giaVeThang}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <KieuBadges lx={lx} />
        {chonDuoc && (
          <span style={{ fontSize: '0.75rem', color: mode === 'xoa' ? 'var(--danger)' : 'var(--accent)' }}>
            {mode === 'xoa' ? '🗑️' : '✏️'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Card nhóm xe ─────────────────────────────────────────────────
function NhomXeCard({ nhom, loaiXeList, nhomGia, sucChua, onXoa, onXoaDongGia, onLuuSoCho, isOpen, onToggle, mode, onSelectLoaiXe }) {
  const loaiTrongNhom = loaiXeList.filter(lx => 
    lx.nhom_xe_id === nhom.id && lx.co_gia && 
    !(lx.gia_luot === 0 && lx.ten && lx.ten.includes('(đồng giá)'))
  )

  const [soChoInput, setSoChoInput] = useState(sucChua?.so_cho ?? '')
  const [dirty, setDirty] = useState(false)
  const daDung = sucChua?.da_dung ?? 0
  const soCho = sucChua?.so_cho

  useEffect(() => {
    if (!dirty) {
      setSoChoInput(sucChua?.so_cho ?? '')
    }
  }, [sucChua?.so_cho])

  if (!nhomGia && loaiTrongNhom.length === 0) return null

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: isOpen ? 8 : 0, borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ fontSize: '1.1rem' }}>{NHOM_ICON[nhom.id] || '🚘'}</span>
        <strong style={{ flex: 1 }}>{nhom.ten}</strong>
        <span style={{
          fontSize: '0.68rem', padding: '2px 8px', borderRadius: 20,
          background: soCho != null ? 'rgba(255,215,0,0.12)' : 'transparent',
          color: soCho != null ? 'var(--accent)' : 'var(--text-muted)',
          border: soCho != null ? 'none' : '1px solid var(--border)',
        }}>
          {soCho != null ? `${daDung}/${soCho} chỗ` : 'Chưa giới hạn'}
        </span>
        <span>{isOpen ? '▴' : '▾'}</span>
      </div>

      {isOpen && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }}>Sức chứa nhóm này</span>
            <input
              type="number" min="0" placeholder="Không giới hạn"
              value={soChoInput}
              onChange={e => { setSoChoInput(e.target.value); setDirty(true) }}
              style={{ width: 110, fontSize: '0.85rem' }}
            />
            {dirty && (
              <button
                className="btn btn-accent btn-sm"
                onClick={() => { onLuuSoCho(nhom.id, soChoInput === '' ? null : Number(soChoInput)); setDirty(false) }}
                style={{ width: 'auto', whiteSpace: 'nowrap' }}
              >
                Lưu
              </button>
            )}
          </div>

          {nhomGia && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
              <span>⚖️</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Toàn bộ {nhom.ten}</span>
                  <span style={{ fontSize: '0.62rem', background: 'var(--accent)', color: '#fff', padding: '0.1em 0.5em', borderRadius: 4 }}>
                    đồng giá
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtGia(nhomGia)}</div>
              </div>
              <KieuBadges lx={nhomGia} />
              <button
                onClick={() => onXoaDongGia(nhom.id, nhom.ten)}
                title="Bỏ đồng giá"
                style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Bỏ ĐG
              </button>
            </div>
          )}
          {loaiTrongNhom.map(lx => (
            <LoaiXeCard key={lx.id} lx={lx} mode={mode} onSelect={onSelectLoaiXe} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Component chính ──────────────────────────────────────────────
export default function LoaiXe() {
  const { allLoaiXe, groupedLoaiXe, sucChuaList, dataLoading, refetchLoaiXe, refetchSucChua } = useLoaiXe()
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [openNhomId, setOpenNhomId] = useState(null)
  const [dongGiaNhom, setDongGiaNhom] = useState(null)

  const [mode, setMode] = useState(null)
  const [suaLx, setSuaLx] = useState(null)

  const [savingSoCho, setSavingSoCho] = useState(false)

  const sucChuaMap = useMemo(() => {
    const map = {}
    sucChuaList.forEach(item => { map[item.nhom_xe_id] = item })
    return map
  }, [sucChuaList])

  async function handleLuuSoCho(nhomId, soCho) {
    setSavingSoCho(true)
    try {
      const fd = new FormData()
      if (soCho !== null) fd.append('so_cho', soCho)
      await loaiXeApi.capNhatSoChoNhom(nhomId, fd)
      await refetchSucChua()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSoCho(false)
    }
  }

  const nhomList = useMemo(() => {
    return groupedLoaiXe.map(g => ({ id: g.nhom_id, ten: g.ten_nhom, thu_tu: g.thu_tu }))
  }, [groupedLoaiXe])

  const allNhomList = useMemo(() => {
    const map = {}
    allLoaiXe.forEach(lx => {
      if (!map[lx.nhom_xe_id]) {
        map[lx.nhom_xe_id] = { id: lx.nhom_xe_id, ten: lx.ten_nhom, thu_tu: lx.thu_tu_nhom }
      }
    })
    return Object.values(map).sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0))
  }, [allLoaiXe])

  const nhomGiaMap = useMemo(() => {
    const map = {}
    groupedLoaiXe.forEach(g => {
      const dongGiaItem = g.items.find(item => item._la_dai_dien_dong_gia)
      if (dongGiaItem) {
        map[g.nhom_id] = {
          ...dongGiaItem,
          nhom_xe_id: g.nhom_id,
        }
      }
    })
    return map
  }, [groupedLoaiXe])

  const list = useMemo(() => allLoaiXe.filter(lx => lx.co_gia), [allLoaiXe])

  async function handleXoa(id, ten) {
    if (!window.confirm(`Ẩn loại xe "${ten}"?`)) return
    try {
      await loaiXeApi.delete(id)
      await refetchLoaiXe(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleXoaDongGia(nhomId, tenNhom) {
    if (!window.confirm(`Bỏ đồng giá nhóm "${tenNhom}"?`)) return
    try {
      await loaiXeApi.xoaDongGia(nhomId)
      await refetchLoaiXe(true)
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleNhom = (id) => setOpenNhomId(prev => prev === id ? null : id)

  const filteredList = useMemo(() => list, [list])
  const stats = useMemo(() => {
    const totalXe = filteredList.length
    const totalNhomCoXe = nhomList.filter(n => filteredList.some(lx => lx.nhom_xe_id === n.id) || nhomGiaMap[n.id]).length
    const customCount = filteredList.filter(lx => !lx.is_default).length
    return { totalXe, totalNhomCoXe, customCount }
  }, [filteredList, nhomList, nhomGiaMap])

  const handleDongGia = (nhom) => { setShowModal(false); setDongGiaNhom(nhom) }

  function handleSelectLoaiXe(lx) {
    if (mode === 'sua') {
      setSuaLx(lx)
      setMode(null)
    } else if (mode === 'xoa') {
      handleXoa(lx.id, lx.ten)
    }
  }

  return (
    <PageLayout title="🏷️ Loại xe" backTo="/#quan-ly">
      {!dataLoading && stats.totalXe > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>📦 {stats.totalNhomCoXe} nhóm</span>
          <span>🏷️ {stats.totalXe} loại xe đã cấu hình</span>
          <span>⚙️ {stats.customCount} tùy chỉnh</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          className="btn btn-accent btn-sm"
          style={{ flex: 1, minWidth: 110 }}
          onClick={() => setShowModal(true)}
          disabled={allNhomList.length === 0 || dataLoading || mode !== null}
        >
          + Thêm
        </button>
        <button
          className="btn btn-sm"
          style={{
            flex: 1, minWidth: 110,
            background: mode === 'sua' ? 'var(--accent)' : 'transparent',
            border: '1px solid var(--accent)',
            color: mode === 'sua' ? '#1e293b' : 'var(--accent)',
          }}
          onClick={() => setMode(mode === 'sua' ? null : 'sua')}
          disabled={dataLoading}
        >
          ✏️ Sửa
        </button>
        <button
          className="btn btn-sm"
          style={{
            flex: 1, minWidth: 110,
            background: mode === 'xoa' ? 'var(--danger)' : 'transparent',
            border: '1px solid var(--danger)',
            color: mode === 'xoa' ? '#fff' : 'var(--danger)',
          }}
          onClick={() => setMode(mode === 'xoa' ? null : 'xoa')}
          disabled={dataLoading}
        >
          🗑️ Xóa
        </button>
      </div>

      {mode && (
        <div style={{
          padding: '0.6rem 0.9rem', borderRadius: 10, marginBottom: 14,
          background: mode === 'xoa' ? 'rgba(239,68,68,0.1)' : 'rgba(255,215,0,0.1)',
          border: `1px solid ${mode === 'xoa' ? 'var(--danger)' : 'var(--accent)'}`,
        }}>
          <span style={{ fontSize: '0.85rem' }}>
            {mode === 'sua' ? '✏️ Bấm vào loại xe muốn sửa giá' : '🗑️ Bấm vào loại xe muốn ẩn/xóa'}
            {' · '}
            <span style={{ color: 'var(--text-muted)' }}>bấm lại nút {mode === 'sua' ? '"Sửa"' : '"Xóa"'} để thoát</span>
          </span>
        </div>
      )}

      {dataLoading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {allNhomList.map(nhom => (
        <NhomXeCard
          key={nhom.id}
          nhom={nhom}
          loaiXeList={list}
          nhomGia={nhomGiaMap[nhom.id] || null}
          sucChua={sucChuaMap[nhom.id]}
          onXoa={handleXoa}
          onXoaDongGia={handleXoaDongGia}
          onLuuSoCho={handleLuuSoCho}
          isOpen={openNhomId === nhom.id}
          onToggle={() => toggleNhom(nhom.id)}
          mode={mode}
          onSelectLoaiXe={handleSelectLoaiXe}
        />
      ))}
      {!dataLoading && filteredList.length === 0 && Object.keys(nhomGiaMap).length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
          Chưa có loại xe nào được cấu hình giá...
        </p>
      )}

      {showModal && allNhomList.length > 0 && (
        <ThemLoaiXeModal
          nhomList={allNhomList}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); }}
          onDongGia={handleDongGia}
        />
      )}

      {suaLx && (
        <SuaLoaiXeModal
          lx={suaLx}
          onClose={() => setSuaLx(null)}
          onSuccess={() => setSuaLx(null)}
        />
      )}

      {dongGiaNhom && (
        <DongGiaModal
          nhom={dongGiaNhom}
          onClose={() => setDongGiaNhom(null)}
          onSuccess={() => { setDongGiaNhom(null); }}
        />
      )}
    </PageLayout>
  )
}