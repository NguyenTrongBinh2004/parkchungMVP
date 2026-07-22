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

export default function ThongKe() {
  const { laAdmin } = useAuth()
  const [loai, setLoai] = useState('hom_nay')
  const [idNhanVien, setIdNhanVien] = useState('')   // '' = tất cả
  const [dsNhanVien, setDsNhanVien] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Tải danh sách nhân viên để lọc (chỉ admin)
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
      {/* Nút chọn chế độ */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20,
        flexWrap: 'wrap'
      }}>
        {CHE_DO.map(cd => (
          <button
            key={cd.key}
            onClick={() => setLoai(cd.key)}
            style={{
              padding: '12px 24px',
              fontSize: '1.05rem',
              fontWeight: 700,
              borderRadius: 40,
              border: cd.key === loai ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: cd.key === loai ? 'var(--accent)' : 'transparent',
              color: cd.key === loai ? '#1e293b' : 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: 100,
            }}
          >
            {cd.label}
          </button>
        ))}
      </div>

      {/* Bộ lọc theo nhân viên — chỉ admin thấy */}
      {laAdmin && dsNhanVien.length > 0 && (
        <div style={{ maxWidth: 320, margin: '0 auto 24px' }}>
          <label style={{
            display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)',
            marginBottom: 6, textAlign: 'center',
          }}>
            👤 Xem theo nhân viên
          </label>
          <select
            value={idNhanVien}
            onChange={(e) => setIdNhanVien(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
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
          {/* KHỐI 1: TỔNG TIỀN THU */}
          <div style={{
            maxWidth: 480, margin: '0 auto 20px', background: '#14532d',
            borderRadius: 24, padding: '32px 24px', textAlign: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
          }}>
            <div style={{ color: '#bbf7d0', fontSize: '1.05rem', marginBottom: 8, fontWeight: 600 }}>
              💰 Tổng tiền thu
            </div>
            <div style={{ fontSize: '3.4rem', fontWeight: 800, color: '#4ade80', lineHeight: 1.1 }}>
              {formatVND(data.tong_doanh_thu)}
            </div>
          </div>

          {/* KHỐI 2 */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32,
            flexWrap: 'wrap'
          }}>
            <div style={{
              background: '#1e293b', borderRadius: 18, padding: '20px 28px',
              textAlign: 'center', minWidth: 180, flex: 1, maxWidth: 240,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
            }}>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#38bdf8' }}>
                {formatVND(data.doanh_thu_xe_luot)}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.95rem' }}>
                💵 Tiền xe gửi
              </div>
              {data.doanh_thu_xe_luot === 0 && (
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 6 }}>
                  Chưa có xe nào trả phí trong khoảng này
                </div>
              )}
            </div>

            <div style={{
              background: '#1e293b', borderRadius: 18, padding: '20px 28px',
              textAlign: 'center', minWidth: 180, flex: 1, maxWidth: 240,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
            }}>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fbbf24' }}>
                {formatVND(data.doanh_thu_ve_thang)}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 6, fontSize: '0.95rem' }}>
                🎫 Tiền vé tháng
              </div>
              {data.doanh_thu_ve_thang === 0 && (
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 6 }}>
                  Chưa có vé tháng nào mua/gia hạn trong khoảng này
                </div>
              )}
            </div>
          </div>

          {/* KHỐI 3 */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 32,
            flexWrap: 'wrap'
          }}>
            <div style={{
              background: '#1e293b', borderRadius: 16, padding: '16px 24px',
              textAlign: 'center', minWidth: 140, flex: 1, maxWidth: 200,
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0' }}>
                {data.tong_xe_da_phuc_vu}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 4, fontSize: '0.85rem' }}>
                🏍️ Xe đã phục vụ
              </div>
            </div>

            <div style={{
              background: '#1e293b', borderRadius: 16, padding: '16px 24px',
              textAlign: 'center', minWidth: 140, flex: 1, maxWidth: 200,
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0' }}>
                {data.xe_dang_trong_bai}
              </div>
              <div style={{ color: '#94a3b8', marginTop: 4, fontSize: '0.85rem' }}>
                🅿️ Đang trong bãi
              </div>
            </div>
          </div>

          {/* Chi tiết theo loại xe */}
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