// src/pages/XeDaRa.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, Field, fmtDt, fmtTien } from '../components/UI'
import { xeDaRaApi } from '../services/api'
import { PLACEHOLDER } from '../components/UI'

export default function XeDaRa() {
  const today = new Date().toISOString().slice(0, 10)
  const [ngay, setNgay] = useState(today)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await xeDaRaApi.list(ngay)
      setList(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [ngay])

  return (
    <PageLayout title="📋 Xe đã ra" backTo="/">
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
        <Field label="Chọn ngày">
          <input type="date" value={ngay} onChange={e => setNgay(e.target.value)} />
        </Field>
        <button
          className="btn btn-outline btn-sm"
          onClick={fetchData}
          disabled={loading}
          style={{ height: 38 }}
        >
          🔄 Làm mới
        </button>
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {!loading && !error && list.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
          Không có xe nào ra trong ngày này.
        </p>
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
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Vào: {fmtDt(xe.gio_vao)} · Ra: {fmtDt(xe.gio_ra)}
            </div>
            {xe.ten_chu_xe && <div style={{ fontSize: '0.85rem' }}>Chủ xe: {xe.ten_chu_xe}</div>}
            <div style={{ fontSize: '0.85rem' }}>
              Tiền: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtTien(xe.so_tien)}</span>
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