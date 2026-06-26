// src/pages/ThongKe.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, Field } from '../components/UI'
import { baoCaoApi } from '../services/api'

const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

// Component hiển thị một card số liệu
function StatCard({ title, value, icon, color = 'var(--accent)', suffix = '', isCurrency = false }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1e2f 0%, #25253e 100%)',
      borderRadius: 16,
      padding: '20px 24px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      transition: 'transform 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
          {isCurrency ? formatVND(value) : value.toLocaleString('vi-VN')}{suffix}
        </div>
      </div>
    </div>
  )
}

export default function ThongKe() {
  const [loai, setLoai] = useState('hom_nay')
  const [ngay, setNgay] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { loai }
      if (loai === 'ngay') params.ngay = ngay
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
  }, [loai, ngay])

  const handleLoaiChange = (e) => {
    setLoai(e.target.value)
    if (e.target.value !== 'ngay') {
      setNgay(new Date().toISOString().slice(0, 10))
    }
  }

  return (
    <PageLayout title="📊 Thống kê" backTo="/">
      {/* Bộ lọc */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end',
        background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 18px',
        border: '1px solid var(--border)',
      }}>
        <Field label="Chế độ xem">
          <select value={loai} onChange={handleLoaiChange} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}>
            <option value="hom_nay">📅 Hôm nay</option>
            <option value="ngay">🔍 Ngày cụ thể</option>
            <option value="tuan">📆 7 ngày qua</option>
            <option value="thang">📈 30 ngày qua</option>
          </select>
        </Field>
        {loai === 'ngay' && (
          <Field label="Chọn ngày">
            <input type="date" value={ngay} onChange={e => setNgay(e.target.value)} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'var(--text)',
              fontSize: '0.9rem',
            }} />
          </Field>
        )}
        <button
          className="btn btn-accent"
          onClick={fetchData}
          disabled={loading}
          style={{ height: 42, padding: '0 20px', fontSize: '0.95rem', fontWeight: 600 }}
        >
          {loading ? '⏳ Đang tải...' : '🔍 Xem thống kê'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <>
          {/* Tiêu đề khoảng thời gian */}
          <div style={{ marginBottom: 20 }}>
            <h5 style={{
              margin: 0, fontSize: '1.1rem', color: 'var(--text)',
              background: 'linear-gradient(90deg, var(--accent), #6c63ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontWeight: 700,
            }}>
              {data.loai === 'hom_nay' ? '📌 HÔM NAY' : `📅 Từ ${data.tu_ngay} đến ${data.den_ngay}`}
            </h5>
          </div>

          {/* Grid các card tổng quan */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 28,
          }}>
            <StatCard
              icon="🏍️"
              title="Tổng xe đã phục vụ"
              value={data.tong_xe_da_phuc_vu}
              color="#4CAF50"
              suffix=" xe"
            />
            <StatCard
              icon="🅿️"
              title="Xe đang trong bãi"
              value={data.xe_dang_trong_bai}
              color="#FF9800"
              suffix=" xe"
            />
            <StatCard
              icon="💰"
              title="Doanh thu xe lượt"
              value={data.doanh_thu_xe_luot}
              color="#2196F3"
              isCurrency
            />
            <StatCard
              icon="🎫"
              title="Doanh thu vé tháng"
              value={data.doanh_thu_ve_thang}
              color="#9C27B0"
              isCurrency
            />
            <StatCard
              icon="🏆"
              title="Tổng doanh thu"
              value={data.tong_doanh_thu}
              color="var(--accent)"
              isCurrency
            />
          </div>

          {/* Bảng chi tiết theo loại xe */}
          {data.chi_tiet_loai_xe.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 16,
              padding: '20px 24px',
              border: '1px solid var(--border)',
            }}>
              <h5 style={{
                marginBottom: 16, fontSize: '1rem', color: 'var(--text)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: '1.2rem' }}>📋</span> Chi tiết theo loại xe
              </h5>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{
                    borderBottom: '2px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Loại xe</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Số lượt</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.chi_tiet_loai_xe.map((item, idx) => (
                    <tr key={idx} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{item.ten_loai_xe}</span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {item.so_luot.toLocaleString('vi-VN')}
                      </td>
                      <td style={{
                        padding: '12px', textAlign: 'right',
                        fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--accent)',
                      }}>
                        {formatVND(item.doanh_thu)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700, fontSize: '0.95rem' }}>
                    <td style={{ padding: '12px' }}>Tổng</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {data.chi_tiet_loai_xe.reduce((sum, item) => sum + item.so_luot, 0).toLocaleString('vi-VN')}
                    </td>
                    <td style={{
                      padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)',
                    }}>
                      {formatVND(data.tong_doanh_thu)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Nếu không có dữ liệu chi tiết */}
          {data.chi_tiet_loai_xe.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '2rem', color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.02)', borderRadius: 12,
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}>📭</span>
              Chưa có dữ liệu trong khoảng thời gian này
            </div>
          )}
        </>
      )}

      {/* Trạng thái rỗng khi chưa load */}
      {!data && !loading && !error && (
        <div style={{
          textAlign: 'center', padding: '3rem', color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.02)', borderRadius: 16,
          border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: 12 }}>📊</span>
          <p>Chọn chế độ xem và nhấn "Xem thống kê" để hiển thị dữ liệu</p>
        </div>
      )}
    </PageLayout>
  )
}