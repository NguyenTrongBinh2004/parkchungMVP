// src/pages/ThongKe.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert } from '../components/UI'
import { baoCaoApi } from '../services/api'
import { useAuth } from '../context/AuthContext'

const formatVND = (v) => {
  if (v === undefined || v === null) return '0 đ';
  return v.toLocaleString('vi-VN') + ' đ';
}

const CHE_DO = [
  { key: 'hom_nay', label: 'Hôm nay' },
  { key: 'hom_qua', label: 'Hôm qua' },
  { key: 'tuan',    label: '7 ngày' },
  { key: 'thang',   label: '30 ngày' },
]

const KHUNG_RONG = 480 // maxWidth thống nhất cho toàn bộ trang, để mọi khối thẳng lề nhau

export default function ThongKe() {
  const { laAdmin } = useAuth()
  const [loai, setLoai] = useState('hom_nay')
  const [idNhanVien, setIdNhanVien] = useState('')   // '' = tất cả
  const [dsNhanVien, setDsNhanVien] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!laAdmin) return
    (async () => {
      try {
        const list = await baoCaoApi.danhSachNhanVien()
        setDsNhanVien(list)
      } catch {
        // im lặng bỏ qua — không chặn trang thống kê nếu lỗi
      }
    })()
  }, [laAdmin])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { loai }
      if (idNhanVien) params.id_nhan_vien = idNhanVien
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
  }, [loai, idNhanVien])

  return (
    <PageLayout title="📊 Thống kê" backTo="/#bai-xe">
      <div style={{ maxWidth: KHUNG_RONG, margin: '0 auto' }}>

        {/* Chọn kỳ — lưới 2x2 đều nhau, không bị lệch khi wrap */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14,
        }}>
          {CHE_DO.map(cd => (
            <button
              key={cd.key}
              onClick={() => setLoai(cd.key)}
              style={{
                padding: '12px 8px',
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: 14,
                border: cd.key === loai ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: cd.key === loai ? 'var(--accent)' : 'var(--bg-secondary)',
                color: cd.key === loai ? '#1e293b' : 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {cd.label}
            </button>
          ))}
        </div>

        {/* Bộ lọc nhân viên — gộp vào cùng khung, không tách rời/lệch tâm nữa */}
        {laAdmin && dsNhanVien.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6,
            }}>
              👤 Xem theo nhân viên
            </label>
            <select
              value={idNhanVien}
              onChange={(e) => setIdNhanVien(e.target.value)}
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 12,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text)', fontSize: '0.92rem',
              }}
            >
              <option value="">Tất cả</option>
              {dsNhanVien.map(nv => (
                <option key={nv.id} value={nv.id}>
                  {nv.ho_ten || nv.sdt} {nv.vai_tro === 'admin' ? '(chủ bãi)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && <Spinner />}
        {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

        {data && (
          <>
            {/* Tổng tiền thu */}
            <div style={{
              background: '#14532d', borderRadius: 20, padding: '28px 20px',
              textAlign: 'center', marginBottom: 16,
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            }}>
              <div style={{ color: '#bbf7d0', fontSize: '0.95rem', marginBottom: 6, fontWeight: 600 }}>
                💰 Tổng tiền thu
              </div>
              <div style={{
                fontSize: 'clamp(2.2rem, 9vw, 3rem)', fontWeight: 800,
                color: '#4ade80', lineHeight: 1.15, wordBreak: 'break-word',
              }}>
                {formatVND(data.tong_doanh_thu)}
              </div>
            </div>

            {/* Tiền xe gửi / Tiền vé tháng — lưới 2 cột bằng nhau, cao bằng nhau */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12,
              alignItems: 'stretch',
            }}>
              <div style={{
                background: '#1e293b', borderRadius: 16, padding: '18px 14px',
                textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 'clamp(1.3rem, 6vw, 1.7rem)', fontWeight: 800, color: '#38bdf8' }}>
                  {formatVND(data.doanh_thu_xe_luot)}
                </div>
                <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.85rem' }}>
                  💵 Tiền xe gửi
                </div>
              </div>

              <div style={{
                background: '#1e293b', borderRadius: 16, padding: '18px 14px',
                textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                <div style={{ fontSize: 'clamp(1.3rem, 6vw, 1.7rem)', fontWeight: 800, color: '#fbbf24' }}>
                  {formatVND(data.doanh_thu_ve_thang)}
                </div>
                <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.85rem' }}>
                  🎫 Tiền vé tháng
                </div>
              </div>
            </div>

            {/* Ghi chú trạng thái rỗng — tách riêng để không làm lệch chiều cao 2 khối trên */}
            {(data.doanh_thu_xe_luot === 0 || data.doanh_thu_ve_thang === 0) && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
                fontSize: '0.75rem', color: '#64748b', textAlign: 'center',
              }}>
                <div>{data.doanh_thu_xe_luot === 0 ? 'Chưa có xe nào trả phí' : ''}</div>
                <div>{data.doanh_thu_ve_thang === 0 ? 'Chưa có vé tháng mua/gia hạn' : ''}</div>
              </div>
            )}

            {/* Xe đã phục vụ / Đang trong bãi */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
            }}>
              <div style={{
                background: '#1e293b', borderRadius: 16, padding: '16px 14px',
                textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e2e8f0' }}>
                  {data.tong_xe_da_phuc_vu}
                </div>
                <div style={{ color: '#94a3b8', marginTop: 4, fontSize: '0.82rem' }}>
                  🏍️ Xe đã phục vụ
                </div>
              </div>

              <div style={{
                background: '#1e293b', borderRadius: 16, padding: '16px 14px',
                textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e2e8f0' }}>
                  {data.xe_dang_trong_bai}
                </div>
                <div style={{ color: '#94a3b8', marginTop: 4, fontSize: '0.82rem' }}>
                  🅿️ Đang trong bãi
                </div>
              </div>
            </div>

            {/* Chi tiết theo loại xe */}
            {data.chi_tiet_loai_xe.length > 0 && (
              <div style={{
                background: '#1e293b', borderRadius: 16, padding: '16px 18px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}>
                <div style={{ color: '#94a3b8', marginBottom: 10, fontWeight: 600, fontSize: '0.9rem' }}>
                  📋 Chi tiết theo loại xe
                </div>
                {data.chi_tiet_loai_xe.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: 10, padding: '9px 0',
                    borderBottom: idx < data.chi_tiet_loai_xe.length - 1 ? '1px solid #334155' : 'none',
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{item.ten_loai_xe}</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
      </div>
    </PageLayout>
  )
}