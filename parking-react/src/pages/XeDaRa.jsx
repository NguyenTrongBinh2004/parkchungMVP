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
      {/* Bộ lọc ngày */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end',
        background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 18px',
        border: '1px solid var(--border)',
      }}>
        <Field label="Chọn ngày">
          <input
            type="date"
            value={ngay}
            onChange={e => setNgay(e.target.value)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text)',
              fontSize: '0.9rem',
            }}
          />
        </Field>
        <button
          className="btn btn-accent"
          onClick={fetchData}
          disabled={loading}
          style={{ height: 42, padding: '0 20px', fontSize: '0.95rem', fontWeight: 600 }}
        >
          {loading ? '⏳ Đang tải...' : '🔄 Làm mới'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {/* Trạng thái không có dữ liệu */}
      {!loading && !error && list.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.02)', borderRadius: 16,
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 12 }}>📭</span>
          <p>Không có xe nào ra trong ngày này</p>
        </div>
      )}

      {/* Danh sách xe */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.map(xe => (
          <div
            key={xe.id}
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              transition: 'all 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {/* Ảnh biển số */}
            <img
              src={xe.anh_bien_so || PLACEHOLDER}
              alt="biển số"
              style={{
                width: 80,
                height: 56,
                objectFit: 'cover',
                borderRadius: 10,
                border: '1px solid var(--border)',
                flexShrink: 0,
              }}
              onError={e => { e.target.src = PLACEHOLDER }}
            />

            {/* Thông tin chính */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Biển số + trạng thái vé tháng */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: 'var(--text)',
                }}>
                  {xe.bien_so}
                </span>
                {xe.la_xe_ve_thang && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'var(--info)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    Vé tháng
                  </span>
                )}
              </div>

              {/* Thời gian vào/ra */}
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                🟢 {fmtDt(xe.gio_vao)}  →  🔴 {fmtDt(xe.gio_ra)}
              </div>

              {/* Tên chủ xe (nếu có) */}
              {xe.ten_chu_xe && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  👤 {xe.ten_chu_xe}
                </div>
              )}
            </div>

            {/* Tiền + ảnh người lái */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                marginBottom: 4,
              }}>
                {fmtTien(xe.so_tien)}
              </div>
              {xe.anh_nguoi_lai ? (
                <img
                  src={xe.anh_nguoi_lai}
                  alt="người lái"
                  style={{
                    width: 44,
                    height: 44,
                    objectFit: 'cover',
                    borderRadius: '50%',
                    border: '2px solid var(--border)',
                  }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: 'var(--text-muted)',
                  border: '2px solid var(--border)',
                }}>
                  👤
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}