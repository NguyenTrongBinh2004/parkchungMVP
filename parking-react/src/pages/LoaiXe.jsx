// src/pages/LoaiXe.jsx
import { useState, useEffect, useMemo } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal } from '../components/UI'
import { loaiXeApi } from '../services/api'

// ─── Cấu hình nhóm xe ───────────────────────────────────────────────────────
const NHOM_ICON = { 1: '🛵', 2: '🚗', 3: '🚛', 4: '🚲' }

// ─── Helper: hiển thị giá gọn ───────────────────────────────────────────────
function fmtGia(lx) {
  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN')

  if (lx.kieu_tinh_gia === 'theo_luot') {
    return `${fmt(lx.gia_luot)} đ / lượt`
  }
  if (lx.kieu_tinh_gia === 'theo_gio') {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { cfg = [] } }
    if (Array.isArray(cfg) && cfg.length) {
      return cfg.map(b =>
        b.den_gio
          ? `${b.den_gio}h: ${b.gia.toLocaleString()}đ`
          : `+${b.moi_gio_tiep.toLocaleString()}đ/h`
      ).join(' · ')
    }
    return 'Chưa cấu hình'
  }
  if (lx.kieu_tinh_gia === 'theo_ngay_dem') {
    return `Ngày ${fmt(lx.gia_ngay)} · Đêm ${fmt(lx.gia_dem)} · Qua đêm ${fmt(lx.gia_ngay_dem)} đ`
  }
  return ''
}

const KIEU_LABEL = {
  theo_luot:    'Lượt',
  theo_gio:     'Giờ',
  theo_ngay_dem:'Ngày/đêm',
}

// ─── Hàm kiểm tra loại xe đã có giá thực tế hay chưa ──────────────────────
function coGiaThucTe(lx) {
  if (lx.kieu_tinh_gia === 'theo_luot') {
    return Number(lx.gia_luot || 0) > 0
  }
  if (lx.kieu_tinh_gia === 'theo_gio') {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg) } catch { return false }
    }
    if (Array.isArray(cfg) && cfg.length > 0) {
      return cfg.some(b => (b.gia && b.gia > 0) || (b.moi_gio_tiep && b.moi_gio_tiep > 0))
    }
    return false
  }
  if (lx.kieu_tinh_gia === 'theo_ngay_dem') {
    return (Number(lx.gia_ngay || 0) > 0) || (Number(lx.gia_dem || 0) > 0) || (Number(lx.gia_ngay_dem || 0) > 0)
  }
  return false
}

// ─── Modal thêm loại xe tùy chỉnh ──────────────────────────────────────────
function ThemLoaiXeModal({ nhomList, onClose, onSuccess }) {
  const [kieu, setKieu] = useState('theo_luot')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Danh sách loại xe mẫu tương ứng nhóm đang chọn
  const [dsMau, setDsMau] = useState([])

  const [form, setForm] = useState({
    ten: '',
    nhom_xe_id: String(nhomList[0]?.id || ''),
    mau_sac: '#FFD700',
    gia_luot: '',
    cau_hinh_theo_gio: '',
    gia_ngay: '',
    gia_dem: '',
    gia_ngay_dem: '',
    gia_ve_thang: '',
  })

  // State cho bảng giá giờ trực quan
  const [bangGio, setBangGio] = useState([{ tuGio: 1, denGio: 2, gia: '' }])
  const [giaMoiGioTiep, setGiaMoiGioTiep] = useState('')

  const upd = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }))

  // Khi thay đổi nhóm, load loại xe mẫu (chỉ lấy xe mặc định của nhóm đó)
  useEffect(() => {
    if (!form.nhom_xe_id) return
    loaiXeApi.list({ include_deleted: true })  // lấy cả mẫu đã ẩn
      .then(data => {
        const filtered = data.filter(
          lx => lx.is_default && String(lx.nhom_xe_id) === String(form.nhom_xe_id)
        )
        setDsMau(filtered)
      })
      .catch(() => setDsMau([]))
  }, [form.nhom_xe_id])

  // Chọn loại xe mẫu -> điền tên
  const chonMau = (loai) => setForm(v => ({ ...v, ten: loai.ten }))

  // Thêm/xóa dòng bảng giờ
  const themDong = () => {
    const last = bangGio[bangGio.length - 1]
    setBangGio([...bangGio, { tuGio: last.denGio + 1, denGio: last.denGio + 2, gia: '' }])
  }
  const xoaDong = (idx) => {
    if (bangGio.length === 1) return
    setBangGio(bangGio.filter((_, i) => i !== idx))
  }
  const updateDong = (idx, field, value) => {
    const newArr = [...bangGio]
    newArr[idx][field] = value
    setBangGio(newArr)
  }

  // Build JSON từ bảng giờ
  const buildJsonGio = () => {
    const arr = bangGio.map(d => ({
      tu_gio: Number(d.tuGio),
      den_gio: Number(d.denGio),
      gia: Number(d.gia)
    }))
    if (giaMoiGioTiep) {
      arr.push({ moi_gio_tiep: Number(giaMoiGioTiep) })
    }
    return JSON.stringify(arr)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.ten.trim()) { setError('Vui lòng nhập tên loại xe.'); return }
    if (!form.nhom_xe_id) { setError('Vui lòng chọn nhóm xe.'); return }

    // Validate và build JSON nếu kiểu giờ
    if (kieu === 'theo_gio') {
      const validRows = bangGio.filter(d => d.gia && d.tuGio && d.denGio)
      if (validRows.length === 0) {
        setError('Vui lòng nhập ít nhất một mốc giờ với giá.')
        return
      }
      form.cau_hinh_theo_gio = buildJsonGio()
    }

    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('ten', form.ten.trim())
    fd.append('nhom_xe_id', form.nhom_xe_id)
    fd.append('mau_sac', form.mau_sac)
    fd.append('kieu_tinh_gia', kieu)

    if (kieu === 'theo_luot') {
      fd.append('gia_luot', form.gia_luot || 0)
    } else if (kieu === 'theo_gio') {
      fd.append('cau_hinh_theo_gio', form.cau_hinh_theo_gio)
    } else if (kieu === 'theo_ngay_dem') {
      fd.append('gia_ngay', form.gia_ngay || 0)
      fd.append('gia_dem', form.gia_dem || 0)
      fd.append('gia_ngay_dem', form.gia_ngay_dem || 0)
    }
    if (form.gia_ve_thang) fd.append('gia_ve_thang', form.gia_ve_thang)

    try {
      await loaiXeApi.create(fd)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title="➕ Thêm loại xe tùy chỉnh">
      <form onSubmit={submit}>

        <Field label="Thuộc nhóm xe" required>
          <select value={form.nhom_xe_id} onChange={upd('nhom_xe_id')} required>
            {nhomList.map((n) => (
              <option key={n.id} value={n.id}>{NHOM_ICON[n.id] || '🚘'} {n.ten}</option>
            ))}
          </select>
        </Field>

        {/* Chọn nhanh loại xe mẫu */}
        {dsMau.length > 0 && (
          <Field label="Chọn nhanh loại xe">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dsMau.map(lx => (
                <button
                  type="button"
                  key={lx.id}
                  className={`btn btn-sm ${form.ten === lx.ten ? 'btn-accent' : 'btn-outline'}`}
                  onClick={() => chonMau(lx)}
                >
                  {lx.ten}
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

        <Field label="Tên loại xe" required>
          <input
            value={form.ten}
            onChange={upd('ten')}
            placeholder="VD: Xe ba gác máy, Xe limousine..."
            required
            autoFocus
          />
        </Field>

        <Field label="Màu đại diện">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={form.mau_sac}
              onChange={upd('mau_sac')}
              style={{ height: 38, width: 60, padding: '0.15rem', flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Màu hiển thị trên bản đồ vị trí
            </span>
          </div>
        </Field>

        <Field label="Kiểu tính giá">
          <select value={kieu} onChange={(e) => setKieu(e.target.value)}>
            <option value="theo_luot">Theo lượt (xe vào ra 1 lần)</option>
            <option value="theo_gio">Theo giờ (tính lũy tiến)</option>
            <option value="theo_ngay_dem">Theo ngày / đêm</option>
          </select>
        </Field>

        {/* Theo lượt */}
        {kieu === 'theo_luot' && (
          <Field label="Giá mỗi lượt (VNĐ)" required>
            <input
              type="number"
              value={form.gia_luot}
              onChange={upd('gia_luot')}
              min="0"
              step="1000"
              placeholder="5000"
              required
            />
          </Field>
        )}

        {/* Theo ngày/đêm */}
        {kieu === 'theo_ngay_dem' && (
          <>
            <Field label="Giá ban ngày 06:00–22:00 (đ)" required>
              <input type="number" value={form.gia_ngay} onChange={upd('gia_ngay')} min="0" step="1000" required />
            </Field>
            <Field label="Giá ban đêm 22:00–06:00 (đ)" required>
              <input type="number" value={form.gia_dem} onChange={upd('gia_dem')} min="0" step="1000" required />
            </Field>
            <Field label="Giá qua đêm (cả ngày lẫn đêm) (đ)" required>
              <input type="number" value={form.gia_ngay_dem} onChange={upd('gia_ngay_dem')} min="0" step="1000" required />
            </Field>
          </>
        )}

        {/* Theo giờ - bảng trực quan */}
        {kieu === 'theo_gio' && (
          <Field label="Cấu hình giá theo giờ">
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 10 }}>
              {bangGio.map((dong, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem' }}>Từ giờ thứ</span>
                  <input
                    type="number"
                    value={dong.tuGio}
                    style={{ width: 50 }}
                    min="1"
                    onChange={e => updateDong(idx, 'tuGio', Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.8rem' }}>đến giờ thứ</span>
                  <input
                    type="number"
                    value={dong.denGio}
                    style={{ width: 50 }}
                    min={dong.tuGio + 1}
                    onChange={e => updateDong(idx, 'denGio', Number(e.target.value))}
                  />
                  <span style={{ fontSize: '0.8rem' }}>giá</span>
                  <input
                    type="number"
                    value={dong.gia}
                    style={{ width: 90 }}
                    min="0"
                    step="1000"
                    placeholder="VNĐ"
                    onChange={e => updateDong(idx, 'gia', e.target.value)}
                  />
                  {bangGio.length > 1 && (
                    <button type="button" onClick={() => xoaDong(idx)}
                      style={{ background: 'none', border: '1px solid #f44', color: '#f44', borderRadius: 4, cursor: 'pointer' }}>
                      Xóa
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={themDong} className="btn btn-sm btn-outline" style={{ marginTop: 4 }}>
                + Thêm mốc giờ
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: '0.82rem' }}>Mỗi giờ tiếp theo giá (VNĐ)</label>
              <input
                type="number"
                value={giaMoiGioTiep}
                onChange={e => setGiaMoiGioTiep(e.target.value)}
                min="0"
                step="1000"
                placeholder="Nếu có nhiều giờ hơn"
                style={{ width: '100%', marginTop: 4 }}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginTop: 2 }}>
                Áp dụng khi thời gian gửi vượt quá các mốc giờ trên.
              </small>
            </div>
          </Field>
        )}

        <Field label="Giá vé tháng (đ) — để trống nếu không có">
          <input
            type="number"
            value={form.gia_ve_thang}
            onChange={upd('gia_ve_thang')}
            min="0"
            step="10000"
            placeholder="Không bắt buộc"
          />
        </Field>

        {error && <Alert type="danger">{error}</Alert>}

        <button
          type="submit"
          className="btn btn-accent"
          style={{ marginTop: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Đang lưu...' : '✓ Thêm loại xe'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Card 1 loại xe ─────────────────────────────────────────────────────────
function LoaiXeCard({ lx, onXoa }) {
  const giaVeThang = lx.gia_ve_thang
    ? `· Vé tháng ${Number(lx.gia_ve_thang).toLocaleString('vi-VN')}đ`
    : ''

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0.6rem 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        width: 10, height: 10,
        borderRadius: '50%',
        background: lx.mau_sac || '#FFD700',
        flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.15)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{lx.ten}</span>
          {lx.is_default
            ? <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>hệ thống</span>
            : <span style={{ fontSize: '0.62rem', color: 'var(--accent)' }}>tùy chỉnh</span>
          }
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {fmtGia(lx)} {giaVeThang}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span className="badge badge-gray" style={{ fontSize: '0.62rem', padding: '0.15em 0.5em' }}>
          {KIEU_LABEL[lx.kieu_tinh_gia] || lx.kieu_tinh_gia}
        </span>
          <button
            onClick={() => onXoa(lx.id, lx.ten)}
            title="Ngừng sử dụng loại xe này"
            style={{
              background: 'transparent',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.75rem',
              lineHeight: 1.4,
            }}
          >
            Ẩn
          </button>
      </div>
    </div>
  )
}

// ─── Card 1 nhóm xe ─────────────────────────────────────────────────────────
function NhomXeCard({ nhom, loaiXeList, onXoa, isOpen, onToggle }) {
  // Lọc chỉ lấy các loại xe đã có giá thực tế
  const loaiDaCauHinh = loaiXeList.filter(lx => lx.nhom_xe_id === nhom.id && coGiaThucTe(lx))

  if (loaiDaCauHinh.length === 0) return null  // ẩn nhóm nếu không có loại nào

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingBottom: isOpen ? 8 : 0,
          borderBottom: isOpen ? '1px solid var(--border)' : 'none',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <span style={{ fontSize: '1.1rem' }}>{NHOM_ICON[nhom.id] || '🚘'}</span>
        <strong style={{ fontSize: '0.95rem', flex: 1 }}>{nhom.ten}</strong>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {loaiDaCauHinh.length} loại
        </span>
        <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>
          {isOpen ? '▴' : '▾'}
        </span>
      </div>

      {isOpen && (
        <div style={{ marginTop: 6 }}>
          {loaiDaCauHinh.map(lx => (
            <LoaiXeCard key={lx.id} lx={lx} onXoa={onXoa} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Component chính ────────────────────────────────────────────────────────
export default function LoaiXe() {
  const [nhomList, setNhomList] = useState([])
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [openNhomId, setOpenNhomId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [nhom, loai] = await Promise.all([
        loaiXeApi.listNhom(),
        loaiXeApi.list(),   // lấy tất cả loại xe (kể cả chưa cấu hình, để hiển thị nút ẩn)
      ])
      setNhomList(nhom)
      setList(loai)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleXoa(id, ten) {
    if (!window.confirm(`Ẩn loại xe "${ten}"?\nLoại xe này sẽ không còn hiển thị khi tạo phiếu gửi mới. Dữ liệu cũ không bị ảnh hưởng.`)) return
    try {
      await loaiXeApi.delete(id)
      setList(prev => prev.filter(lx => lx.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleNhom = (id) => {
    setOpenNhomId(prev => prev === id ? null : id)
  }

  // Chỉ lọc một lần khi list thay đổi
  const filteredList = useMemo(() => list.filter(coGiaThucTe), [list])

  // Thống kê cũng chỉ tính khi filteredList hoặc nhomList thay đổi
  const stats = useMemo(() => {
    const totalXe = filteredList.length
    const totalNhomCoXe = nhomList.filter(n => filteredList.some(lx => lx.nhom_xe_id === n.id)).length
    const customCount = filteredList.filter(lx => !lx.is_default).length
    return { totalXe, totalNhomCoXe, customCount }
  }, [filteredList, nhomList])

  return (
    <PageLayout title="🏷️ Loại xe" backTo="/">
      {!loading && stats.totalXe > 0 && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 14,
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        }}>
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
          loaiXeList={list}   // truyền toàn bộ, component tự lọc
          onXoa={handleXoa}
          isOpen={openNhomId === nhom.id}
          onToggle={() => toggleNhom(nhom.id)}
        />
      ))}

      {!loading && filteredList.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
          Chưa có loại xe nào được cấu hình giá. Hãy thêm loại xe tùy chỉnh hoặc cập nhật giá cho các loại mặc định.
        </p>
      )}

      <button
        className="btn btn-accent"
        style={{ marginTop: '0.75rem' }}
        onClick={() => setShowModal(true)}
        disabled={nhomList.length === 0 || loading}
      >
        + Thêm loại xe tùy chỉnh
      </button>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', lineHeight: 1.5 }}>
        💡 Chỉ những loại xe đã được thiết lập giá mới hiển thị bên trên. Loại xe <em>hệ thống</em> chưa có giá sẽ được ẩn đi.
      </p>

      {showModal && nhomList.length > 0 && (
        <ThemLoaiXeModal
          nhomList={nhomList}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
    </PageLayout>
  )
}