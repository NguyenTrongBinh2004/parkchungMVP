import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import XeVao from './pages/XeVao'
import XeRa from './pages/XeRa'
import DanhSach from './pages/DanhSach'
import VeThang from './pages/VeThang'
import DangKyVeThang from './pages/DangKyVeThang'
import LoaiXe from './pages/LoaiXe'
import CaiDat from './pages/CaiDat'

export default function App() {
  return (
    <Routes>
      <Route path="/"                   element={<Dashboard />} />
      <Route path="/xe-vao"             element={<XeVao />} />
      <Route path="/xe-ra"              element={<XeRa />} />
      <Route path="/danh-sach"          element={<DanhSach />} />
      <Route path="/ve-thang"           element={<VeThang />} />
      <Route path="/dang-ky-ve-thang"   element={<DangKyVeThang />} />
      <Route path="/loai-xe"            element={<LoaiXe />} />
      <Route path="/cai-dat"            element={<CaiDat />} />
      <Route path="*"                   element={<Navigate to="/" />} />
    </Routes>
  )
}
