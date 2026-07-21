import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [daDangNhap, setDaDangNhap] = useState(false)
  const [dangTai, setDangTai]       = useState(true)
  const [tenBaiXe, setTenBaiXe]     = useState('')
  const [vaiTro, setVaiTro]         = useState('admin')   // thêm state vaiTro

  // Kiểm tra refresh token khi mở app
  useEffect(() => {
    async function kiemTraPhien() {
      const rt = localStorage.getItem('refresh_token')
      if (!rt) { setDangTai(false); return }
      try {
        const data = await authApi.refresh({ refresh_token: rt })
        localStorage.setItem('access_token', data.access_token)
        setTenBaiXe(data.ten_bai_xe)
        setVaiTro(data.vai_tro || 'admin')     // lưu vai trò từ response
        setDaDangNhap(true)
      } catch {
        // Refresh token hết hạn → xóa, về màn đăng nhập
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      } finally {
        setDangTai(false)
      }
    }
    kiemTraPhien()
  }, [])

  const dangNhapThanhCong = useCallback((data) => {
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    setTenBaiXe(data.ten_bai_xe)
    setVaiTro(data.vai_tro || 'admin')          // lưu vai trò
    setDaDangNhap(true)
  }, [])

  const dangXuat = useCallback(async () => {
    const rt = localStorage.getItem('refresh_token')
    if (rt) {
      try { await authApi.dangXuat({ refresh_token: rt }) } catch {}
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setDaDangNhap(false)
    setTenBaiXe('')
    setVaiTro('admin')                          // reset về mặc định
  }, [])

  const laAdmin = vaiTro === 'admin'            // tiện ích cho UI

  return (
    <AuthContext.Provider value={{ daDangNhap, dangTai, tenBaiXe, vaiTro, laAdmin, dangNhapThanhCong, dangXuat }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}