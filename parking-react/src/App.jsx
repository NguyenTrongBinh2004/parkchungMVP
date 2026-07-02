// src/App.jsx
import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Các trang
import Dashboard from './pages/Dashboard'
import XeVao from './pages/XeVao'
import XeRa from './pages/XeRa'
import DanhSach from './pages/DanhSach'
import VeThang from './pages/VeThang'
import DangKyVeThang from './pages/DangKyVeThang'
import LoaiXe from './pages/LoaiXe'
import CaiDat from './pages/CaiDat'
import ThongKe from './pages/ThongKe'
import TimXe from './pages/TimXe'
import XeDaRa from './pages/XeDaRa'
import DangKy from './pages/DangKy'
import DangNhap from './pages/DangNhap'

// Component bảo vệ route yêu cầu đăng nhập
function RequireAuth({ children }) {
  const { daDangNhap, dangTai } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!dangTai && !daDangNhap) {
      navigate('/dang-nhap', { replace: true, state: { from: location } })
    }
  }, [daDangNhap, dangTai, navigate, location])

  // Đang kiểm tra token → hiển thị loading
  if (dangTai) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🅿️</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang tải...</div>
        </div>
      </div>
    )
  }

  // Chưa đăng nhập → không render gì (useEffect sẽ redirect)
  if (!daDangNhap) return null

  // Đã đăng nhập → render children
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Các route KHÔNG cần đăng nhập */}
      <Route path="/dang-ky" element={<DangKy />} />
      <Route path="/dang-nhap" element={<DangNhap />} />

      {/* Tất cả route còn lại yêu cầu đăng nhập */}
      <Route path="/*" element={
        <RequireAuth>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/xe-vao" element={<XeVao />} />
            <Route path="/xe-ra" element={<XeRa />} />
            <Route path="/danh-sach" element={<DanhSach />} />
            <Route path="/xe-da-ra" element={<XeDaRa />} />
            <Route path="/ve-thang" element={<VeThang />} />
            <Route path="/dang-ky-ve-thang" element={<DangKyVeThang />} />
            <Route path="/loai-xe" element={<LoaiXe />} />
            <Route path="/thong-ke" element={<ThongKe />} />
            <Route path="/tim-xe" element={<TimXe />} />
            <Route path="/cai-dat" element={<CaiDat />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </RequireAuth>
      } />
    </Routes>
  )
}