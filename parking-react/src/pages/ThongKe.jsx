// src/pages/ThongKe.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, Field } from '../components/UI'
import { baoCaoApi } from '../services/api'

const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

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
      // reset ngay về hôm nay cho các chế độ khác
      setNgay(new Date().toISOString().slice(0, 10))
    }
  }

  return (
    <PageLayout title="📊 Thống kê" backTo="/">
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <Field label="Chế độ">
          <select value={loai} onChange={handleLoaiChange}>
            <option value="hom_nay">Hôm nay</option>
            <option value="ngay">Ngày cụ thể</option>
            <option value="tuan">7 ngày qua</option>
            <option value="thang">30 ngày qua</option>
          </select>
        </Field>
        {loai === 'ngay' && (
          <Field label="Chọn ngày">
            <input type="date" value={ngay} onChange={e => setNgay(e.target.value)} />
          </Field>
        )}
        <button className="btn btn-accent" onClick={fetchData} disabled={loading} style={{ height: 38 }}>
          {loading ? 'Đang tải...' : 'Xem'}
        </button>
      </div>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {data && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h5 style={{ marginBottom: 12 }}>
              {data.loai === 'hom_nay' ? 'HÔM NAY' : `Từ ${data.tu_ngay} đến ${data.den_ngay}`}
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p><strong>Tổng xe đã phục vụ:</strong> {data.tong_xe_da_phuc_vu} xe</p>
                <p><strong>Xe đang trong bãi:</strong> {data.xe_dang_trong_bai} xe</p>
              </div>
              <div>
                <p><strong>Doanh thu xe lượt:</strong> {formatVND(data.doanh_thu_xe_luot)}</p>
                <p><strong>Doanh thu vé tháng:</strong> {formatVND(data.doanh_thu_ve_thang)}</p>
                <p><strong>Tổng doanh thu:</strong> <span style={{ color: 'var(--accent)' }}>{formatVND(data.tong_doanh_thu)}</span></p>
              </div>
            </div>
          </div>

          {data.chi_tiet_loai_xe.length > 0 && (
            <div className="card">
              <h5 style={{ marginBottom: 12 }}>Chi tiết theo loại xe</h5>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Loại xe</th>
                    <th>Số lượt</th>
                    <th>Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.chi_tiet_loai_xe.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.ten_loai_xe}</td>
                      <td>{item.so_luot}</td>
                      <td>{formatVND(item.doanh_thu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </PageLayout>
  )
}