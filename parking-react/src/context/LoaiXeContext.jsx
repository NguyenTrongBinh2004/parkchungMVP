// context/LoaiXeContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { loaiXeApi } from '../services/api'

const LoaiXeContext = createContext(null)

function groupByNhomWithGia(configuredData, nhomGiaList, allLoaiXe) {
  const nhomGiaMap = {}
  nhomGiaList.forEach(ng => { nhomGiaMap[ng.nhom_xe_id] = ng })

  const coGiaRieng = (lx) => {
    if (lx.kieu_tinh_gia === 'theo_luot') return Number(lx.gia_luot || 0) > 0
    if (lx.kieu_tinh_gia === 'theo_gio') {
      let cfg = lx.cau_hinh_theo_gio
      if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg) } catch { return false } }
      if (Array.isArray(cfg) && cfg.length) return cfg.some(b => (b.gia && b.gia > 0) || (b.moi_gio_tiep && b.moi_gio_tiep > 0))
      return false
    }
    if (lx.kieu_tinh_gia === 'theo_ngay_dem') return (Number(lx.gia_ngay || 0) > 0) || (Number(lx.gia_dem || 0) > 0) || (Number(lx.gia_ngay_dem || 0) > 0)
    return false
  }

  const map = {}
  configuredData.forEach(lx => {
    if (!map[lx.nhom_xe_id]) {
      map[lx.nhom_xe_id] = { nhom_id: lx.nhom_xe_id, ten_nhom: lx.ten_nhom, thu_tu: lx.thu_tu_nhom, items: [] }
    }
    if (!lx.ten || !lx.ten.includes('(đồng giá)')) {
      map[lx.nhom_xe_id].items.push(lx)
    }
  })

  nhomGiaList.forEach(ng => {
    if (!map[ng.nhom_xe_id]) {
      map[ng.nhom_xe_id] = { nhom_id: ng.nhom_xe_id, ten_nhom: ng.ten_nhom || '', thu_tu: 0, items: [] }
    }
  })

  return Object.values(map)
    .sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0))
    .map(group => {
      let danhSachXeRieng = [...group.items]
      const nhomGia = nhomGiaMap[group.nhom_id]

      if (!nhomGia) {
        return { ...group, items: danhSachXeRieng }
      }

      const coXeChuaCoGiaRieng = allLoaiXe.some(lx => lx.nhom_xe_id === group.nhom_id && !coGiaRieng(lx))

      if (coXeChuaCoGiaRieng) {
        let xeDaiDien = allLoaiXe.find(lx => lx.nhom_xe_id === group.nhom_id && lx.is_default && !coGiaRieng(lx))
                     || allLoaiXe.find(lx => lx.nhom_xe_id === group.nhom_id && !coGiaRieng(lx))

        if (xeDaiDien) {
          danhSachXeRieng.unshift({
            ...xeDaiDien,
            ...nhomGia,
            id: xeDaiDien.id,
            ten: group.ten_nhom,
            _la_dai_dien_dong_gia: true,
          })
        }
      }

      return { ...group, items: danhSachXeRieng }
    })
    .filter(g => g.items.length > 0)
}

export function LoaiXeProvider({ children }) {
  const [allLoaiXe, setAllLoaiXe]           = useState([])
  const [configuredLoaiXe, setConfigured]   = useState([])
  const [groupedLoaiXe, setGrouped]         = useState([])
  const [dataLoading, setDataLoading]       = useState(true)
  const [error, setError]                   = useState(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setDataLoading(true)
    setError(null)
    try {
      const [all, configured, nhomGia] = await Promise.all([
        loaiXeApi.list(),
        loaiXeApi.list({ da_cau_hinh: true }),
        loaiXeApi.listNhomGia().catch(() => [])
      ])
      setAllLoaiXe(all)
      setConfigured(configured)
      setGrouped(groupByNhomWithGia(configured, nhomGia, all))
    } catch (err) {
      setError(err)
    } finally {
      if (!silent) setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const value = useMemo(() => ({
    allLoaiXe,
    configuredLoaiXe,
    groupedLoaiXe,
    dataLoading,
    error,
    refetchLoaiXe: fetchData
  }), [allLoaiXe, configuredLoaiXe, groupedLoaiXe, dataLoading, error, fetchData])

  return (
    <LoaiXeContext.Provider value={value}>
      {children}
    </LoaiXeContext.Provider>
  )
}

export function useLoaiXe() {
  const ctx = useContext(LoaiXeContext)
  if (!ctx) throw new Error('useLoaiXe phải được dùng bên trong LoaiXeProvider')
  return ctx
}