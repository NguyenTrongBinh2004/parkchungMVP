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
import QuenMatKhau from './pages/QuenMatKhau' 
import NhanVien from './pages/NhanVien'
import DatChoWeb from './pages/DatChoWeb' 

function LogoParkchung({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 10 105 90" xmlns="http://www.w3.org/2000/svg">
      <path transform="matrix(1,0,0,-1,60.9868,45.0564)" d="M0 0C1.669 1.669 1.669 4.374 0 6.043-1.669 7.712-4.374 7.712-6.043 6.043-7.712 4.374-7.712 1.669-6.043 0-4.374-1.669-1.669-1.669 0 0" fill="#13b47e"/>
      <path transform="matrix(1,0,0,-1,48.9003,32.969903)" d="M0 0C5.006 5.006 13.123 5.006 18.13 0 23.136-5.006 23.136-13.123 18.13-18.13L9.064-27.195 0-18.13C-5.006-13.123-5.006-5.006 0 0M36.259 18.129C21.241 33.149-3.11 33.149-18.129 18.129L-39.281-3.022-45.324-9.064-39.281-15.108 9.064-63.454 15.107-57.411-33.238-9.064-12.086 12.086C-.405 23.768 18.535 23.768 30.216 12.086 41.897 .405 41.897-18.535 30.216-30.216L21.152-39.281 15.107-33.238 24.173-24.173C32.517-15.83 32.517-2.301 24.173 6.043 15.83 14.387 2.301 14.387-6.043 6.043-14.203-2.115-14.382-15.232-6.584-23.61L-6.595-23.621 15.107-45.324 21.152-51.367 27.195-45.324 36.259-36.259C51.278-21.241 51.278 3.11 36.259 18.129" fill="#13b47e"/>
    </svg>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <style>{`
        @keyframes pc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pc-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes pc-dot {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
      `}</style>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          position: 'relative',
          width: 72,
          height: 72,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Vòng tròn xoay bao quanh logo */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#13b47e',
            borderRightColor: 'rgba(19, 180, 126, 0.25)',
            animation: 'pc-spin 1s linear infinite',
          }} />
          {/* Logo pulse nhẹ ở giữa */}
          <div style={{
            animation: 'pc-pulse 1.6s ease-in-out infinite',
            filter: 'drop-shadow(0 0 6px rgba(19, 180, 126, 0.35))',
          }}>
            <LogoParkchung size={34} />
          </div>
        </div>

        <div style={{
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}>
          <span>Đang tải</span>
          <span style={{ animation: 'pc-dot 1.4s ease-in-out infinite', animationDelay: '0s' }}>.</span>
          <span style={{ animation: 'pc-dot 1.4s ease-in-out infinite', animationDelay: '0.2s' }}>.</span>
          <span style={{ animation: 'pc-dot 1.4s ease-in-out infinite', animationDelay: '0.4s' }}>.</span>
        </div>
      </div>
    </div>
  )
}


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
  return <LoadingScreen />
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
      <Route path="/quen-mat-khau" element={<QuenMatKhau />} />

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
            <Route path="/nhan-vien" element={<NhanVien />} />
            <Route path="/thong-ke" element={<ThongKe />} />
            <Route path="/tim-xe" element={<TimXe />} />
            <Route path="/cai-dat" element={<CaiDat />} />
            <Route path="/dat-cho-web" element={<DatChoWeb />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </RequireAuth>
      } />
    </Routes>
  )
}