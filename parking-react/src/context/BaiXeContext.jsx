// context/BaiXeContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { baiXeApi } from '../services/api'
import { useAuth } from './AuthContext'

const BaiXeContext = createContext(null)

export function BaiXeProvider({ children }) {
  const { daDangNhap } = useAuth()
  const [thongTin, setThongTin] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setDataLoading(true)
    setError(null)
    try {
      const data = await baiXeApi.layThongTin()
      setThongTin(data)
    } catch (err) {
      setError(err)
    } finally {
      if (!silent) setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (daDangNhap) {
      fetchData()
    } else {
      // Chưa đăng nhập → không fetch, xóa dữ liệu cũ (nếu vừa đăng xuất)
      setThongTin(null)
      setDataLoading(false)
    }
  }, [daDangNhap, fetchData])

  const value = useMemo(() => ({
    thongTin,
    dataLoading,
    error,
    refetchBaiXe: fetchData,
  }), [thongTin, dataLoading, error, fetchData])

  return (
    <BaiXeContext.Provider value={value}>
      {children}
    </BaiXeContext.Provider>
  )
}

export function useBaiXe() {
  const ctx = useContext(BaiXeContext)
  if (!ctx) throw new Error('useBaiXe phải được dùng bên trong BaiXeProvider')
  return ctx
}