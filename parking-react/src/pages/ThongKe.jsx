// src/pages/ThongKe.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert } from '../components/UI'
import { baoCaoApi } from '../services/api'

const formatVND = (v) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v)

const CHE_DO = [
  { key: 'hom_nay', label: 'Hôm nay' },
  { key: 'hom_qua', label: 'Hôm qua' },
  { key: 'tuan',    label: '7 ngày' },
  { key: 'thang',   label: '30 ngày' },
]

export default function ThongKe() {
  const [loai, setLoai] = useState('hom_nay')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { loai }
      const res = await baoCaoApi.thongKe(params)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [loai])

  return (
    <PageLayout title="📊 Thống kê" backTo="/">
      {/* Nút chọn chế độ – to, rõ ràng */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 28,
        flexWrap: 'wrap'
      }}>
        {CHE_DO.map(cd => (
          <button
            key={cd.key}
            onClick={() => setLoai(cd.key)}
            style={{
              padding: '12px 24px',
              fontSize: '1.05rem',
              fontWeight: 600,
              borderRadius: 40,
              border: cd.key === loai ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: cd.key === loai ? 'var(--accent)' : 'transparent',
              color: cd.key === loai ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: 100,
            }}
          >
            {cd.label}
          </button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <>
          {/* 3 con số CHÍNH – cực lớn, dễ đọc */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 32,
            flexWrap: 'wrap'
          }}>
            {/* Card: Tổng xe đã phục vụ */}
            <div style={{
              background: '#1e293b', borderRadius: 20, padding: '24px 32px',
              textAlign: 'center', minWidth: 160, flex: 1, maxWidth: 220,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#38bdf8' }}>
                {data.tong_xe_da_phuc_vu}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.95rem' }}>
                🏍️ Xe đã phục vụ
              </div>
            </div>

            {/* Card: Xe đang trong bãi */}
            <div style={{
              background: '#1e293b', borderRadius: 20, padding: '24px 32px',
              textAlign: 'center', minWidth: 160, flex: 1, maxWidth: 220,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#fbbf24' }}>
                {data.xe_dang_trong_bai}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.95rem' }}>
                🅿️ Đang trong bãi
              </div>
            </div>

            {/* Card: Tổng doanh thu */}
            <div style={{
              background: '#1e293b', borderRadius: 20, padding: '24px 32px',
              textAlign: 'center', minWidth: 180, flex: 1, maxWidth: 260,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, color: '#4ade80' }}>
                {formatVND(data.tong_doanh_thu)}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.95rem' }}>
                💰 Tổng doanh thu
              </div>
            </div>
          </div>

          {/* Dòng phụ: doanh thu xe lượt + vé tháng (nếu muốn xem chi tiết hơn) */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 28,
            color: '#94a3b8', fontSize: '0.95rem', flexWrap: 'wrap'
          }}>
            <span>💵 Xe lượt: <strong style={{ color: '#e2e8f0' }}>{formatVND(data.doanh_thu_xe_luot)}</strong></span>
            <span>🎫 Vé tháng: <strong style={{ color: '#e2e8f0' }}>{formatVND(data.doanh_thu_ve_thang)}</strong></span>
          </div>

          {/* Chi tiết theo loại xe – chỉ hiển thị nếu có */}
          {data.chi_tiet_loai_xe.length > 0 && (
            <div style={{
              maxWidth: 500, margin: '0 auto', background: '#1e293b',
              borderRadius: 16, padding: '16px 20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ color: '#94a3b8', marginBottom: 12, fontWeight: 600 }}>
                📋 Chi tiết theo loại xe
              </div>
              {data.chi_tiet_loai_xe.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid #334155'
                }}>
                  <span style={{ color: '#e2e8f0' }}>{item.ten_loai_xe}</span>
                  <span style={{ color: '#94a3b8' }}>
                    {item.so_luot} lượt · {formatVND(item.doanh_thu)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
          Chọn chế độ xem để hiển thị số liệu
        </div>
      )}
    </PageLayout>
  )
}