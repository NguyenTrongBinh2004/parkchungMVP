import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Spinner, Alert, TrangThaiBadge, Modal, fmtTien } from '../components/UI'
import { veThangApi } from '../services/api'

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

export default function VeThang() {
  const navigate = useNavigate()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [giaHanVe, setGiaHanVe] = useState(null)

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

  return (
    <PageLayout title="🎫 Vé tháng" backTo="/">
      <button className="btn btn-accent" style={{ marginBottom: '1rem' }} onClick={() => navigate('/dang-ky-ve-thang')}>
        + Đăng ký vé tháng mới
      </button>

      {loading && <Spinner />}
      {error && <Alert type="danger">{error}</Alert>}
      {!loading && !error && list.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Chưa có vé tháng nào.</p>
      )}

      {list.map(ve => (
        <div key={ve.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {/* Ảnh */}
            {ve.anh_bien_so
              ? <img src={ve.anh_bien_so} style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 8 }} alt="biển số" />
              : <div style={{ width: 100, height: 70, background: '#333', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#666' }}>No img</div>
            }

            {/* Thông tin */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{ve.bien_so}</span>
                <TrangThaiBadge trangThai={ve.trang_thai} />
              </div>
              <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <div>Chủ xe: <span style={{ color: 'var(--text)' }}>{ve.ten_chu_xe}</span></div>
                <div>SĐT: {ve.sdt || 'N/A'}</div>
                <div>Loại: {ve.ten_loai_xe}</div>
                <div>Hết hạn: <strong>{ve.ngay_het_han}</strong>{' '}
                  {ve.so_ngay_con >= 0 ? `(còn ${ve.so_ngay_con} ngày)` : '(đã hết hạn)'}
                </div>
                <div>Tiền: <span style={{ color: 'var(--accent)' }}>{fmtTien(ve.so_tien)}</span></div>
                {ve.ghi_chu && <div>{ve.ghi_chu}</div>}
              </div>
            </div>

            {/* QR */}
            {ve.anh_qr && (
              <img src={ve.anh_qr} style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 6 }} alt="QR" />
            )}
          </div>

          {/* Nút gia hạn */}
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: '0.75rem', width: 'auto' }}
            onClick={() => setGiaHanVe(ve)}
          >
            🔄 Gia hạn
          </button>
        </div>
      ))}

      {giaHanVe && (
        <GiaHanModal
          ve={giaHanVe}
          onClose={() => setGiaHanVe(null)}
          onSuccess={() => { setGiaHanVe(null); load() }}
        />
      )}
    </PageLayout>
  )
}
