// src/pages/XeDaRa.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, Field, fmtDt, fmtTien } from '../components/UI'
import { xeDaRaApi } from '../services/api'

export default function XeDaRa() {
  const today = new Date().toISOString().slice(0, 10)
  const [ngay, setNgay] = useState(today)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    if (!ngay) return  // tránh gọi API với ngày rỗng
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
    if (ngay) fetchData()
  }, [ngay])

  return (
    <PageLayout title="📋 Xe đã ra" backTo="/">
      {/* Bộ lọc ngày – thiết kế gọn, đẹp */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end',
        background: 'rgba(255,255,255,0.03)', borderRadius: 16,
        padding: '16px 20px', border: '1px solid var(--border)',
        flexWrap: 'wrap'
      }}>
        <Field label="Chọn ngày">
          <input
            type="date"
            value={ngay}
            onChange={e => setNgay(e.target.value)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 14px',
              color: 'var(--text)',
              fontSize: '0.95rem',
              minWidth: 160,
            }}
          />
        </Field>
        <button
          className="btn btn-accent"
          onClick={fetchData}
          disabled={loading}
          style={{
            height: 44,
            padding: '0 24px',
            fontSize: '0.95rem',
            fontWeight: 600,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {loading ? '⏳ Đang tải...' : '🔄 Làm mới'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {/* Trạng thái rỗng */}
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
              padding: '18px 20px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {/* Ảnh biển số */}
            {xe.anh_bien_so ? (
              <img
                src={xe.anh_bien_so}
                alt="biển số"
                style={{
                  width: 85,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  flexShrink: 0,
                }}
                onError={e => { e.target.style.display = 'none' }}
              />
            ) : (
              <div style={{
                width: 85, height: 60, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: '1.4rem',
              }}>
                🚗
              </div>
            )}

            {/* Thông tin chính */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '1.15rem',
                  color: 'var(--text)',
                }}>
                  {xe.bien_so}
                </span>
                {xe.la_xe_ve_thang && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'var(--info)',
                    color: '#fff',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    Vé tháng
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                🟢 {fmtDt(xe.gio_vao)}  →  🔴 {fmtDt(xe.gio_ra)}
              </div>

              {xe.ten_chu_xe && (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  👤 {xe.ten_chu_xe}
                </div>
              )}
            </div>

            {/* Tiền + ảnh người lái */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
                marginBottom: 6,
              }}>
                {fmtTien(xe.so_tien)}
              </div>
              {xe.anh_nguoi_lai ? (
                <img
                  src={xe.anh_nguoi_lai}
                  alt="người lái"
                  style={{
                    width: 46,
                    height: 46,
                    objectFit: 'cover',
                    borderRadius: '50%',
                    border: '2px solid var(--border)',
                  }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div style={{
                  width: 46, height: 46,
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