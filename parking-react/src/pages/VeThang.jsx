// src/pages/VeThang.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Spinner, Alert, TrangThaiBadge, Modal, fmtTien } from '../components/UI'
import { veThangApi } from '../services/api'
import { PLACEHOLDER } from '../components/UI';
import SuaXeModal from '../components/SuaXeModal'

function GiaHanModal({ ve, onClose, onSuccess }) {
  const [ghiChu, setGhiChu] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    setLoading(true)
    const fd = new FormData()
    if (ghiChu) fd.append('ghi_chu', ghiChu)
    try {
      await veThangApi.giaHan(ve.id, fd)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} title={`Gia hạn vé — ${ve.bien_so}`}>
      <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Hết hạn hiện tại: <strong>{ve.ngay_het_han}</strong>
      </p>
      <div style={{ marginBottom: '0.75rem' }}>
        <label className="form-label">Ghi chú (không bắt buộc)</label>
        <input value={ghiChu} onChange={e => setGhiChu(e.target.value)} placeholder="Ghi chú gia hạn..." />
      </div>
      {error && <Alert type="danger">{error}</Alert>}
      <button className="btn btn-accent" onClick={submit} disabled={loading} style={{ marginTop: '0.75rem' }}>
        {loading ? 'Đang xử lý...' : 'Xác nhận gia hạn (+30 ngày)'}
      </button>
    </Modal>
  )
}

// ─── Thẻ vé tháng (hỗ trợ chế độ chọn) ─────────────────────────
function VeCard({ ve, mode, onSelect }) {
  const daHetHan = !(ve.trang_thai === 'con_han' || ve.trang_thai === 'sap_het')
  // Sửa chỉ cho phép với vé còn hạn; Gia hạn & Xóa cho phép với mọi vé
  const khongChonDuoc = mode === 'sua' && daHetHan
  const chonDuoc = mode !== null && !khongChonDuoc

  const mauNen = mode === 'xoa'
    ? 'rgba(239,68,68,0.06)'
    : mode === 'gia_han'
      ? 'rgba(96,165,250,0.06)'
      : mode === 'sua'
        ? 'rgba(255,215,0,0.06)'
        : 'transparent'

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        cursor: chonDuoc ? 'pointer' : 'default',
        opacity: khongChonDuoc ? 0.4 : 1,
        background: chonDuoc ? mauNen : undefined,
        transition: 'background 0.12s, opacity 0.12s',
      }}
      onClick={chonDuoc ? () => onSelect(ve) : undefined}
    >
      <div style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>

        {/* Cột 1: ảnh biển số & người đăng ký */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Biển số</small>
            <img
              src={ve.anh_bien_so || PLACEHOLDER}
              className="thumb"
              alt="Biển số"
              onError={e => e.target.src = PLACEHOLDER}
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            <small style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Người đăng ký</small>
            <img
              src={ve.anh_nguoi_dung || PLACEHOLDER}
              className="thumb"
              alt="Người dùng"
              onError={e => e.target.src = PLACEHOLDER}
            />
          </div>
        </div>

        {/* Cột 2: thông tin chi tiết */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem' }}>{ve.bien_so}</span>
            <TrangThaiBadge trangThai={ve.trang_thai} />
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div>Chủ xe: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{ve.ten_chu_xe}</span></div>
            <div>SĐT: {ve.sdt || 'N/A'}</div>
            <div>Loại: {ve.ten_loai_xe}</div>
            <div>Hết hạn: <strong style={{ color: 'var(--text)' }}>{ve.ngay_het_han}</strong>
              <span style={{ marginLeft: 5 }}>({ve.so_ngay_con >= 0 ? `còn ${ve.so_ngay_con} ngày` : 'đã hết hạn'})</span>
            </div>
            <div style={{ marginTop: 4 }}>
              Tiền: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{Number(ve.so_tien).toLocaleString('vi-VN')} đ</span>
            </div>
            {ve.dang_trong_bai && (
              <span className="badge badge-success" style={{ marginTop: 4 }}>🟢 Đang trong bãi</span>
            )}
          </div>
        </div>

        {/* Cột 3: mã QR + icon chế độ */}
        <div style={{ flexShrink: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {ve.anh_qr && (
            <div>
              <img
                src={ve.anh_qr}
                style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 2 }}
                alt="QR"
              />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Mã vé</div>
            </div>
          )}
          {chonDuoc && (
            <span style={{
              fontSize: '0.9rem',
              color: mode === 'xoa' ? 'var(--danger)' : mode === 'gia_han' ? '#60a5fa' : 'var(--accent)',
            }}>
              {mode === 'xoa' ? '🗑️' : mode === 'gia_han' ? '🔄' : '✏️'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VeThang() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [giaHanVe, setGiaHanVe] = useState(null)
  const [suaPhienId, setSuaPhienId] = useState(null)

  // Chế độ chọn: null | 'sua' | 'gia_han' | 'xoa'
  const [mode, setMode] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setList(await veThangApi.list())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleXoa(ve) {
    if (!window.confirm(`Bạn có chắc muốn xóa vé tháng ${ve.bien_so}?`)) return
    try {
      await veThangApi.xoa(ve.id)
      load()
      // giữ nguyên mode 'xoa' để xóa tiếp nhiều vé liên tiếp
    } catch (err) {
      alert(err.message)
    }
  }

  function handleSelectVe(ve) {
    if (mode === 'sua') {
      setSuaPhienId(ve.id_phien_dang_bai || ve.id)
      setMode(null)
    } else if (mode === 'gia_han') {
      setGiaHanVe(ve)
      setMode(null)
    } else if (mode === 'xoa') {
      handleXoa(ve)
    }
  }

  return (
    <PageLayout title="🎫 Vé tháng" backTo="/#bai-xe">

      {/* ── Thanh thao tác chính: Đăng ký / Sửa / Gia hạn / Xóa ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          className="btn btn-accent btn-sm"
          style={{ flex: 1, minWidth: 110 }}
          onClick={() => navigate('/dang-ky-ve-thang')}
          disabled={mode !== null}
        >
          + Đăng ký
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
        >
          ✏️ Sửa
        </button>
        <button
          className="btn btn-sm"
          style={{
            flex: 1, minWidth: 110,
            background: mode === 'gia_han' ? '#60a5fa' : 'transparent',
            border: '1px solid #60a5fa',
            color: mode === 'gia_han' ? '#1e293b' : '#60a5fa',
          }}
          onClick={() => setMode(mode === 'gia_han' ? null : 'gia_han')}
        >
          🔄 Gia hạn
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
        >
          🗑️ Xóa
        </button>
      </div>

      {/* ── Banner hướng dẫn khi đang ở chế độ chọn ── */}
      {mode && (
        <div style={{
          padding: '0.6rem 0.9rem', borderRadius: 10, marginBottom: 14,
          background: mode === 'xoa' ? 'rgba(239,68,68,0.1)' : mode === 'gia_han' ? 'rgba(96,165,250,0.1)' : 'rgba(255,215,0,0.1)',
          border: `1px solid ${mode === 'xoa' ? 'var(--danger)' : mode === 'gia_han' ? '#60a5fa' : 'var(--accent)'}`,
        }}>
          <span style={{ fontSize: '0.85rem' }}>
            {mode === 'sua' && '✏️ Bấm vào vé còn hạn muốn sửa thông tin xe'}
            {mode === 'gia_han' && '🔄 Bấm vào vé muốn gia hạn thêm 30 ngày'}
            {mode === 'xoa' && '🗑️ Bấm vào vé muốn xóa'}
            {' · '}
            <span style={{ color: 'var(--text-muted)' }}>
              bấm lại nút {mode === 'sua' ? '"Sửa"' : mode === 'gia_han' ? '"Gia hạn"' : '"Xóa"'} để thoát
            </span>
          </span>
        </div>
      )}

      {loading && <Spinner />}
      {error && <Alert type="danger">{error}</Alert>}
      {!loading && !error && list.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Chưa có vé tháng nào.</p>
      )}

      {list.map(ve => (
        <VeCard key={ve.id} ve={ve} mode={mode} onSelect={handleSelectVe} />
      ))}

      {giaHanVe && (
        <GiaHanModal
          ve={giaHanVe}
          onClose={() => setGiaHanVe(null)}
          onSuccess={() => { setGiaHanVe(null); load() }}
        />
      )}

      {suaPhienId && (
        <SuaXeModal
          phienId={suaPhienId}
          onClose={() => setSuaPhienId(null)}
          onSuccess={() => { setSuaPhienId(null); load() }}
        />
      )}
    </PageLayout>
  )
}