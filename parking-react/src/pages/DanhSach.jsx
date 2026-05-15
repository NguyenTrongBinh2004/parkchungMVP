import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, fmtDt, fmtTien } from '../components/UI'
import { xeTrongBaiApi } from '../services/api'
import { PLACEHOLDER } from '../components/UI';
export default function DanhSach() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function fetchData() {
    setLoading(true)
    try {
      const data = await xeTrongBaiApi.list()
      setList(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()                           // lấy dữ liệu lần đầu
    const timer = setInterval(fetchData, 30000) // tự động làm mới mỗi 30 giây
    return () => clearInterval(timer)      // cleanup khi component unmount
  }, [])

  return (
    <PageLayout title="🚗 Xe đang trong bãi" backTo="/">
      <button
        className="btn btn-outline btn-sm"
        onClick={fetchData}
        style={{ marginBottom: '1rem', width: 'auto' }}
        disabled={loading}
      >
        🔄 Làm mới
      </button>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {!loading && !error && list.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Bãi xe đang trống.</p>
      )}

      {list.map(xe => (
        <div key={xe.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <img
            src={xe.anh_bien_so || PLACEHOLDER}
            className="thumb"
            alt="biển số"
            onError={e => e.target.src = PLACEHOLDER}
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem' }}>{xe.bien_so}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vào lúc: {fmtDt(xe.gio_vao)}</div>
            {xe.ten_chu_xe && <div style={{ fontSize: '0.85rem' }}>Chủ xe: {xe.ten_chu_xe}</div>}
            <div style={{ fontSize: '0.85rem' }}>
              Tạm tính: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtTien(xe.so_tien_tam_tinh)}</span>
            </div>
            {xe.la_xe_ve_thang && <span className="badge badge-info" style={{ marginTop: 4 }}>Vé tháng</span>}
          </div>
          {xe.anh_nguoi_lai && (
            <img
              src={xe.anh_nguoi_lai}
              className="thumb-round"
              alt="người lái"
              style={{ marginLeft: 10, flexShrink: 0 }}
            />
          )}
        </div>
      ))}
    </PageLayout>
  )
}