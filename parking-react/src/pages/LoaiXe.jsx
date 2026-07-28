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

const KIEU_META = {
  luot: { icon: '🎫', label: 'Theo lượt' },
  gio: { icon: '⏱️', label: 'Theo giờ' },
  ngayDem: { icon: '🌗', label: 'Theo ngày/đêm' },
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
      <Field label="Kiểu tính giá">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            ['coGiaLuot', 'luot'],
            ['coGiaGio', 'gio'],
            ['coGiaNgayDem', 'ngayDem'],
          ].map(([key, metaKey]) => {
            const meta = KIEU_META[metaKey]
            const active = gia[key]
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggleKieu(key)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 6px', borderRadius: 10,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'rgba(255,215,0,0.1)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{meta.icon}</span>
                <span style={{ fontSize: '0.74rem', fontWeight: active ? 700 : 500, textAlign: 'center' }}>{meta.label}</span>
                {active && <span style={{ fontSize: '0.62rem' }}>✓ đang bật</span>}
              </button>
            )
          })}
        </div>
        <small style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Có thể chọn nhiều kiểu cùng lúc — nhân viên sẽ chọn kiểu áp dụng lúc xe vào/ra nếu có hơn 1 kiểu.
        </small>
      </Field>

      {(gia.coGiaLuot || gia.coGiaNgayDem || gia.coGiaGio) && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>

          {gia.coGiaLuot && (
            <div style={{ marginBottom: gia.coGiaNgayDem || gia.coGiaGio ? 12 : 0 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                🎫 Giá mỗi lượt <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" value={gia.giaLuot} onChange={e => upd({ giaLuot: e.target.value })}
                  min="0" step="1000" required
                  style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', paddingRight: 32 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)', pointerEvents: 'none' }}>đ</span>
              </div>
            </div>
          )}

          {gia.coGiaNgayDem && (
            <div style={{ marginBottom: gia.coGiaGio ? 12 : 0 }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                🌗 Giá theo ngày / đêm <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  ['giaNgay', 'Ban ngày'],
                  ['giaDem', 'Ban đêm'],
                  ['giaNgayDem', 'Qua đêm'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3, textAlign: 'center' }}>{label}</div>
                    <input
                      type="number" value={gia[field]} onChange={e => upd({ [field]: e.target.value })}
                      min="0" step="1000" required
                      style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', padding: '8px 8px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {gia.coGiaGio && (
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                ⏱️ Cấu hình giá theo giờ
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr 1.2fr auto', gap: 6, fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0 2px 4px', alignItems: 'center' }}>
                <span>Từ giờ</span><span></span><span>Đến giờ</span><span style={{ textAlign: 'right' }}>Giá (đ)</span><span></span>
              </div>

              {gia.bangGio.map((dong, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr 1.2fr auto', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <input type="number" value={dong.tuGio} style={{ textAlign: 'center', padding: '6px 4px' }} onChange={e => updateDong(idx, 'tuGio', Number(e.target.value))} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→</span>
                  <input type="number" value={dong.denGio} style={{ textAlign: 'center', padding: '6px 4px' }} onChange={e => updateDong(idx, 'denGio', Number(e.target.value))} />
                  <input type="number" value={dong.gia} placeholder="0" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 8px' }} onChange={e => updateDong(idx, 'gia', e.target.value)} />
                  {gia.bangGio.length > 1 ? (
                    <button type="button" onClick={() => xoaDong(idx)}
                      style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: '0.75rem' }}>
                      ✕
                    </button>
                  ) : <span />}
                </div>
              ))}
              <button type="button" onClick={themDong} className="btn btn-sm btn-outline" style={{ marginTop: 4 }}>+ Thêm mốc giờ</button>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Mỗi giờ tiếp theo (đ)</label>
                <input type="number" value={gia.giaMoiGioTiep} onChange={e => upd({ giaMoiGioTiep: e.target.value })} min="0" step="1000"
                  style={{ width: '100%', textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          )}
        </div>
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
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.9rem' }}>
        Áp một mức giá chung cho <strong>tất cả loại xe</strong> trong nhóm này.
      </p>
      <form onSubmit={submit}>
        <KieuGiaEditor gia={gia} onChange={setGia} />
        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={giaVeThang} onChange={e => setGiaVeThang(e.target.value)} min="0" step="10000" placeholder="Không bắt buộc"
            style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
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

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)', marginBottom: '1rem', gap: 10,
        }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Cần áp giá chung cho cả nhóm thay vì từng xe?
          </span>
          <button type="button" className="btn btn-sm btn-outline" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={handleDongGiaClick}>
            ⚖️ Đồng giá cả nhóm
          </button>
        </div>

        <Field label="Tên loại xe" required>
          <input value={form.ten} onChange={upd('ten')} placeholder="VD: Xe ba gác máy..." required autoFocus />
        </Field>
        <Field label="Màu đại diện">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.mau_sac} onChange={upd('mau_sac')} style={{ height: 38, width: 60, padding: 2 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Màu hiển thị trên bản đồ vị trí</span>
          </div>
        </Field>

        <KieuGiaEditor gia={gia} onChange={setGia} />

        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={form.gia_ve_thang} onChange={upd('gia_ve_thang')} min="0" step="10000" placeholder="Không bắt buộc"
            style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
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
          border: '1px solid var(--border)',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: lx.mau_sac || '#FFD700', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lx.ten}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Không đổi được tên/nhóm ở đây</span>
        </div>

        <KieuGiaEditor gia={gia} onChange={setGia} />

        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input type="number" value={giaVeThang} onChange={e => setGiaVeThang(e.target.value)} min="0" step="10000" placeholder="Không bắt buộc"
            style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
        </Field>
        {error && <Alert type="danger">{error}</Alert>}
        <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }} disabled={loading}>
          {loading ? 'Đang lưu...' : '✓ Lưu thay đổi'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Hiển thị giá tổng hợp (nhiều dòng, số căn phải) ─────────────
function DongGiaLine({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.76rem' }}>
      <span style={{ color: 'var(--text-muted)' }}>{icon} {label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function GiaChiTiet({ lx }) {
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ'
  const dong = []

  if (lx.co_gia_luot) dong.push(<DongGiaLine key="luot" icon="🎫" label="Mỗi lượt" value={fmt(lx.gia_luot)} />)

  if (lx.co_gia_ngay_dem) {
    dong.push(
      <DongGiaLine key="ngaydem" icon="🌗" label="Ngày / Đêm / Qua đêm" value={`${fmt(lx.gia_ngay)} · ${fmt(lx.gia_dem)} · ${fmt(lx.gia_ngay_dem)}`} />
    )
  }

  if (lx.co_gia_gio) {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { cfg = [] } }
    const text = Array.isArray(cfg) && cfg.length
      ? cfg.map(b => b.den_gio ? `${b.den_gio}h: ${Number(b.gia).toLocaleString('vi-VN')}đ` : `+${Number(b.moi_gio_tiep).toLocaleString('vi-VN')}đ/h`).join(' · ')
      : 'chưa cấu hình'
    dong.push(<DongGiaLine key="gio" icon="⏱️" label="Theo giờ" value={text} />)
  }

  if (dong.length === 0) return <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Chưa cấu hình giá</div>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{dong}</div>
}

// ─── Card loại xe (hỗ trợ chế độ chọn) ─────────────────────────
function LoaiXeCard({ lx, mode, onSelect }) {
  const chonDuoc = mode === 'sua' || mode === 'xoa'

  return (
    <div
      onClick={chonDuoc ? () => onSelect(lx) : undefined}
      style={{
        padding: '10px 10px', marginBottom: 4,
        borderBottom: '1px solid var(--border)',
        cursor: chonDuoc ? 'pointer' : 'default',
        borderRadius: chonDuoc ? 10 : 0,
        background: chonDuoc ? (mode === 'xoa' ? 'rgba(239,68,68,0.06)' : 'rgba(255,215,0,0.06)') : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* Dòng 1: tên + tag + icon thao tác */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: lx.mau_sac || '#FFD700', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '0.92rem', flex: 1 }}>{lx.ten}</span>
        {lx.is_default
          ? <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 8px' }}>hệ thống</span>
          : <span style={{ fontSize: '0.62rem', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 20, padding: '1px 8px' }}>tùy chỉnh</span>
        }
        {chonDuoc && (
          <span style={{ fontSize: '0.85rem', color: mode === 'xoa' ? 'var(--danger)' : 'var(--accent)', flexShrink: 0 }}>
            {mode === 'xoa' ? '🗑️' : '✏️'}
          </span>
        )}
      </div>

      {/* Dòng 2: chi tiết giá, thụt lề theo chấm màu */}
      <div style={{ paddingLeft: 17 }}>
        <GiaChiTiet lx={lx} />
        {lx.gia_ve_thang > 0 && (
          <div style={{ fontSize: '0.76rem', color: 'var(--info)', marginTop: 3 }}>
            🎟️ Vé tháng {Number(lx.gia_ve_thang).toLocaleString('vi-VN')} đ
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card nhóm xe ─────────────────────────────────────────────────
function NhomXeCard({ nhom, loaiXeList, nhomGia, sucChua, onXoaDongGia, onLuuSoCho, isOpen, onToggle, mode, onSelectLoaiXe }) {
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
    <div className="card" style={{ marginBottom: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: isOpen ? 10 : 0, borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ fontSize: '1.15rem' }}>{NHOM_ICON[nhom.id] || '🚘'}</span>
        <strong style={{ flex: 1, fontSize: '0.95rem' }}>{nhom.ten}</strong>
        <span style={{
          fontSize: '0.7rem', padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-mono)',
          background: soCho != null ? 'rgba(255,215,0,0.12)' : 'transparent',
          color: soCho != null ? 'var(--accent)' : 'var(--text-muted)',
          border: soCho != null ? 'none' : '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}>
          {soCho != null ? `${daDung}/${soCho} chỗ` : 'Chưa giới hạn'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{isOpen ? '▴' : '▾'}</span>
      </div>

      {isOpen && (
        <div style={{ marginTop: 10 }}>

          {/* Sức chứa nhóm */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 10,
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1 }}>Sức chứa nhóm này</span>
            <input
              type="number" min="0" placeholder="Không giới hạn"
              value={soChoInput}
              onChange={e => { setSoChoInput(e.target.value); setDirty(true) }}
              style={{ width: 90, fontSize: '0.85rem', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px' }}
            />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', width: 30 }}>chỗ</span>
            <button
              className="btn btn-accent btn-sm"
              onClick={() => { onLuuSoCho(nhom.id, soChoInput === '' ? null : Number(soChoInput)); setDirty(false) }}
              disabled={!dirty}
              style={{ width: 'auto', whiteSpace: 'nowrap', opacity: dirty ? 1 : 0.35, pointerEvents: dirty ? 'auto' : 'none' }}
            >
              Lưu
            </button>
          </div>

          {/* Đồng giá nhóm (nếu có) */}
          {nhomGia && (
            <div style={{
              padding: '10px 12px', marginBottom: 6, borderRadius: 10,
              background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', flex: 1 }}>⚖️ Toàn bộ {nhom.ten}</span>
                <span style={{ fontSize: '0.62rem', background: 'var(--accent)', color: '#1e293b', fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  ĐỒNG GIÁ
                </span>
                <button
                  onClick={() => onXoaDongGia(nhom.id, nhom.ten)}
                  title="Bỏ đồng giá"
                  style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem' }}
                >
                  Bỏ
                </button>
              </div>
              <GiaChiTiet lx={nhomGia} />
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
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14,
        }}>
          {[
            ['📦', stats.totalNhomCoXe, 'nhóm'],
            ['🏷️', stats.totalXe, 'loại xe'],
            ['⚙️', stats.customCount, 'tùy chỉnh'],
          ].map(([icon, num, label]) => (
            <div key={label} style={{
              textAlign: 'center', padding: '8px 4px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{icon} {num}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
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