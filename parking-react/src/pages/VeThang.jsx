import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, Spinner, Alert, TrangThaiBadge, Modal, fmtTien } from '../components/UI'
import { veThangApi } from '../services/api'
import { PLACEHOLDER } from '../components/UI';
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
        <div key={ve.id} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>
            
            {/* Cột 1: Chứa ảnh Biển số và ảnh Người đăng ký */}
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

            {/* Cột 2: Thông tin chi tiết */}
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
              </div>
            </div>

            {/* Cột 3: Mã QR */}
            {ve.anh_qr && (
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                <img 
                  src={ve.anh_qr} 
                  style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 2 }} 
                  alt="QR" 
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Mã vé</div>
              </div>
            )}
          </div>

          {/* Nút gia hạn phía dưới cùng của card */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10 }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ width: 'auto' }}
              onClick={() => setGiaHanVe(ve)}
            >
              ➕ Gia hạn vé
            </button>
          </div>
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
