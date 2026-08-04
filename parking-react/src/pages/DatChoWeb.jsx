// src/pages/DatChoWeb.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, fmtDt, fmtTien } from '../components/UI'
import { datChoWebApi } from '../services/api'

const LOC = [
  { key: 'cho_xu_ly', label: 'Chờ xử lý' },
  { key: 'da_xu_ly', label: 'Đã xử lý' },
  { key: 'da_huy', label: 'Đã hủy' },
]

function DonCard({ don, onXacNhan, onHuy }) {
  const daXongViec = don.trang_thai_xu_ly !== 'cho_xu_ly'

  return (
    <div className="card" style={{ marginBottom: 12, opacity: daXongViec ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{don.ten_khach || 'Khách vãng lai'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            #{don.ma_dat_cho}
          </div>
        </div>
        {don.trang_thai_xu_ly === 'cho_xu_ly' && <span className="badge badge-warning">Chờ xử lý</span>}
        {don.trang_thai_xu_ly === 'da_xu_ly' && <span className="badge badge-success">Đã xử lý</span>}
        {don.trang_thai_xu_ly === 'da_huy' && <span className="badge badge-danger">Đã hủy</span>}
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        {don.sdt && <div>SĐT: {don.sdt}</div>}
        {don.email && <div>Email: {don.email}</div>}
        {don.thoi_gian_nhan_xe && <div>🟢 Nhận xe: <strong style={{ color: 'var(--text)' }}>{fmtDt(don.thoi_gian_nhan_xe)}</strong></div>}
        {don.thoi_gian_tra_xe && <div>🔴 Trả xe: <strong style={{ color: 'var(--text)' }}>{fmtDt(don.thoi_gian_tra_xe)}</strong></div>}
        {don.phuong_thuc_thanh_toan && <div>Phương thức: {don.phuong_thuc_thanh_toan}</div>}
        {don.tong_tien != null && (
          <div>Tổng tiền: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtTien(don.tong_tien)}</span></div>
        )}
      </div>

      {don.trang_thai_xu_ly === 'cho_xu_ly' && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', gap: 8 }}>
          <button className="btn btn-accent btn-sm" style={{ width: 'auto' }} onClick={() => onXacNhan(don.id)}>
            ✅ Đánh dấu đã xử lý
          </button>
          <button className="btn btn-sm" style={{ width: 'auto', background: 'var(--danger)', color: '#fff' }} onClick={() => onHuy(don.id)}>
            🗑️ Hủy đơn
          </button>
        </div>
      )}
    </div>
  )
}

export default function DatChoWeb() {
  const [loc, setLoc] = useState('cho_xu_ly')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setList(await datChoWebApi.list(loc))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000) // tự làm mới mỗi 30s để nhận đơn mới từ web
    return () => clearInterval(timer)
  }, [loc])

  async function handleXacNhan(id) {
    try { await datChoWebApi.xacNhan(id); load() } catch (err) { alert(err.message) }
  }

  async function handleHuy(id) {
    if (!window.confirm('Hủy đơn đặt chỗ này?')) return
    try { await datChoWebApi.huy(id); load() } catch (err) { alert(err.message) }
  }

  return (
    <PageLayout title="🌐 Đơn đặt chỗ từ Web" backTo="/#bai-xe">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {LOC.map(l => (
          <button
            key={l.key}
            onClick={() => setLoc(l.key)}
            className={`btn btn-sm ${loc === l.key ? 'btn-accent' : 'btn-outline'}`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {!loading && !error && list.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Không có đơn nào.</p>
      )}

      {list.map(don => (
        <DonCard key={don.id} don={don} onXacNhan={handleXacNhan} onHuy={handleHuy} />
      ))}
    </PageLayout>
  )
}