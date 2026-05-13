import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, Field, Modal } from '../components/UI'
import { loaiXeApi } from '../services/api'

// ─── Helper hiển thị chi tiết giá (khớp HTML) ───
function fmtLoaiGia(lx) {
  if (lx.kieu_tinh_gia === 'theo_luot') {
    return `Giá lượt: ${Number(lx.gia_luot).toLocaleString('vi-VN')} đ`
  }
  if (lx.kieu_tinh_gia === 'theo_gio') {
    let cfg = lx.cau_hinh_theo_gio
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg) } catch { cfg = [] }
    }
    if (Array.isArray(cfg) && cfg.length) {
      return 'Giá giờ: ' + cfg.map(b =>
        b.den_gio
          ? `${b.den_gio}h đầu: ${b.gia.toLocaleString()}đ/h`
          : `Tiếp theo: ${b.moi_gio_tiep.toLocaleString()}đ/h`
      ).join(', ')
    }
    return 'Cấu hình giờ không rõ'
  }
  if (lx.kieu_tinh_gia === 'theo_ngay_dem') {
    return `Ngày: ${Number(lx.gia_ngay || 0).toLocaleString()}đ, Đêm: ${Number(lx.gia_dem || 0).toLocaleString()}đ, Ngày-đêm: ${Number(lx.gia_ngay_dem || 0).toLocaleString()}đ`
  }
  return ''
}

const KIEU_LABEL = {
  theo_luot: 'Theo lượt',
  theo_gio: 'Theo giờ',
  theo_ngay_dem: 'Theo ngày đêm',
}

// ─── Modal thêm loại xe (bám sát HTML) ───
function ThemLoaiXeModal({ onClose, onSuccess }) {
  const [kieu, setKieu] = useState('theo_luot')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    ten: '',
    mau_sac: '#FFD700',
    gia_luot: 0,
    cau_hinh_theo_gio: '',
    gia_ngay: 0,
    gia_dem: 0,
    gia_ngay_dem: 0,
    gia_ve_thang: '',
  })

  function upd(f) {
    return e => setForm(v => ({ ...v, [f]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (kieu === 'theo_gio') {
      try { JSON.parse(form.cau_hinh_theo_gio) }
      catch { setError('Cấu hình giờ không đúng định dạng JSON.'); setLoading(false); return }
    }
    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('ten', form.ten)
    fd.append('mau_sac', form.mau_sac)
    fd.append('kieu_tinh_gia', kieu)

    if (kieu === 'theo_luot') {
      fd.append('gia_luot', form.gia_luot)
    } else if (kieu === 'theo_gio') {
      fd.append('cau_hinh_theo_gio', form.cau_hinh_theo_gio)
    } else if (kieu === 'theo_ngay_dem') {
      fd.append('gia_ngay', form.gia_ngay)
      fd.append('gia_dem', form.gia_dem)
      fd.append('gia_ngay_dem', form.gia_ngay_dem)
    }

    if (form.gia_ve_thang) {
      fd.append('gia_ve_thang', form.gia_ve_thang)
    }

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
    <Modal onClose={onClose} title="Thêm loại xe">
      <form onSubmit={submit}>
        <Field label="Tên loại xe" required>
          <input value={form.ten} onChange={upd('ten')} required />
        </Field>

        <Field label="Màu sắc">
          <input
            type="color"
            value={form.mau_sac}
            onChange={upd('mau_sac')}
            style={{ height: 40, padding: '0.2rem' }}
          />
        </Field>

        <Field label="Kiểu tính giá">
          <select value={kieu} onChange={e => setKieu(e.target.value)}>
            <option value="theo_luot">Theo lượt</option>
            <option value="theo_gio">Theo giờ</option>
            <option value="theo_ngay_dem">Theo ngày đêm</option>
          </select>
        </Field>

        {/* Fields theo lượt */}
        {kieu === 'theo_luot' && (
          <Field label="Giá mỗi lượt">
            <input
              type="number"
              value={form.gia_luot}
              onChange={upd('gia_luot')}
              min="0"
            />
          </Field>
        )}

        {/* Fields theo giờ */}
        {kieu === 'theo_gio' && (
          <Field label="Cấu hình giá theo giờ (JSON)" required>
            <input
              value={form.cau_hinh_theo_gio}
              onChange={upd('cau_hinh_theo_gio')}
              placeholder='[{"den_gio":4,"gia":4000},{"moi_gio_tiep":5000}]'
              required
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              VD: {`[{"den_gio":2,"gia":15000},{"moi_gio_tiep":20000}]`}
            </small>
          </Field>
        )}

        {/* Fields theo ngày đêm */}
        {kieu === 'theo_ngay_dem' && (
          <>
            <Field label="Giá ngày" required>
              <input
                type="number"
                value={form.gia_ngay}
                onChange={upd('gia_ngay')}
                min="0"
                required
              />
            </Field>
            <Field label="Giá đêm" required>
              <input
                type="number"
                value={form.gia_dem}
                onChange={upd('gia_dem')}
                min="0"
                required
              />
            </Field>
            <Field label="Giá ngày đêm" required>
              <input
                type="number"
                value={form.gia_ngay_dem}
                onChange={upd('gia_ngay_dem')}
                min="0"
                required
              />
            </Field>
          </>
        )}

        <Field label="Giá vé tháng (nếu có)">
          <input
            type="number"
            value={form.gia_ve_thang}
            onChange={upd('gia_ve_thang')}
            placeholder="Để trống nếu không có"
          />
        </Field>

        {error && <Alert type="danger">{error}</Alert>}

        <button
          type="submit"
          className="btn btn-accent"
          style={{ marginTop: '0.75rem' }}
          disabled={loading}
        >
          {loading ? 'Đang lưu...' : 'Thêm loại xe'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Component chính ───
export default function LoaiXe() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setList(await loaiXeApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <PageLayout title="🏷️ Loại xe" backTo="/">
      {loading && <Spinner />}
      {error && <Alert type="danger">{error}</Alert>}

      {list.map(lx => (
        <div key={lx.id} className="card" style={{ marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{lx.ten}</strong>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: lx.mau_sac,
                  display: 'inline-block',
                }}
              />
            </div>
            <span className="badge badge-gray">
              {KIEU_LABEL[lx.kieu_tinh_gia]}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {fmtLoaiGia(lx)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {lx.gia_ve_thang
              ? `Vé tháng: ${Number(lx.gia_ve_thang).toLocaleString('vi-VN')} đ`
              : 'Chưa đặt vé tháng'}
          </div>
        </div>
      ))}

      <button
        className="btn btn-accent"
        style={{ marginTop: '0.75rem' }}
        onClick={() => setShowModal(true)}
      >
        + Thêm loại xe mới
      </button>

      {showModal && (
        <ThemLoaiXeModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            load()
          }}
        />
      )}
    </PageLayout>
  )
}