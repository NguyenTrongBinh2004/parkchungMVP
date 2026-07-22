// context/BaiXeContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { baiXeApi } from '../services/api'
import { useAuth } from './AuthContext'

const BaiXeContext = createContext(null)

function tinhThieuThongTin(thongTin) {
  if (!thongTin) return ['Tên bãi xe', 'Địa chỉ', 'Khung giờ hoạt động', 'Ngày hoạt động']
  const thieu = []
  if (!thongTin.ten) thieu.push('Tên bãi xe')
  if (!thongTin.dia_chi) thieu.push('Địa chỉ')
  if (!thongTin.gio_mo_cua || !thongTin.gio_dong_cua) thieu.push('Khung giờ hoạt động')
  if (!thongTin.cac_ngay_hoat_dong || thongTin.cac_ngay_hoat_dong.length === 0) thieu.push('Ngày hoạt động')
  return thieu
}

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
      setThongTin(null)
      setDataLoading(false)
    }
  }, [daDangNhap, fetchData])

  const thieuThongTin = useMemo(() => tinhThieuThongTin(thongTin), [thongTin])
  const hoanThien = thieuThongTin.length === 0

  const value = useMemo(() => ({
    thongTin,
    dataLoading,
    error,
    refetchBaiXe: fetchData,
    thieuThongTin,
    hoanThien,
  }), [thongTin, dataLoading, error, fetchData, thieuThongTin, hoanThien])

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