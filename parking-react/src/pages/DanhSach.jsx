// src/pages/DanhSach.jsx
import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, fmtDt, fmtTien } from '../components/UI'
import { xeTrongBaiApi } from '../services/api'
import SuaXeModal from '../components/SuaXeModal'
import ChiTietXeModal from '../components/ChiTietXeModal'

function AnhBienSo({ src }) {
  if (src) {
    return (
      <img
        src={src}
        className="thumb"
        alt="biển số"
        onError={e => { e.target.style.display = 'none' }}
        style={{ flexShrink: 0 }}
      />
    )
  }
  return (
    <div className="thumb" style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '1.4rem',
      border: '1px solid var(--border)',
    }}>
      🚗
    </div>
  )
}

function AnhNguoiLai({ src }) {
  if (src) {
    return (
      <img
        src={src}
        className="thumb-round"
        alt="người lái"
        onError={e => { e.target.style.display = 'none' }}
        style={{ marginLeft: 10, flexShrink: 0 }}
      />
    )
  }
  return (
    <div className="thumb-round" style={{
      marginLeft: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '1.2rem',
      border: '1px solid var(--border)',
    }}>
      👤
    </div>
  )
}

export default function DanhSach() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [suaPhienId, setSuaPhienId] = useState(null)
  const [xemChiTiet, setXemChiTiet] = useState(null) // ← xe đang được xem chi tiết

  async function fetchData() {
    setLoading(true)
    try {
      const data = await xeTrongBaiApi.list()
      setList(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 30000)
    return () => clearInterval(timer)
  }, [])

  return (
    <PageLayout title="🚗 Xe đang trong bãi" backTo="/#bai-xe">
      <button
        className="btn btn-outline btn-sm"
        onClick={fetchData}
        style={{ marginBottom: '1rem', width: 'auto' }}
        disabled={loading}
      >
        🔄 Làm mới
      </button>

      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {!loading && !error && list.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Bãi xe đang trống.</p>
      )}

      {list.map(xe => (
        <div
          key={xe.id}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, cursor: 'pointer' }}
          onClick={() => setXemChiTiet(xe)}
        >
          <AnhBienSo src={xe.anh_bien_so} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem' }}>{xe.bien_so}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vào lúc: {fmtDt(xe.gio_vao)}</div>
            {xe.ten_chu_xe && <div style={{ fontSize: '0.85rem' }}>Chủ xe: {xe.ten_chu_xe}</div>}
            <div style={{ fontSize: '0.85rem' }}>
              Tạm tính: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtTien(xe.so_tien_tam_tinh)}</span>
            </div>
            {xe.la_xe_ve_thang && <span className="badge badge-info" style={{ marginTop: 4 }}>Vé tháng</span>}
          </div>
          <AnhNguoiLai src={xe.anh_nguoi_lai} />
        </div>
      ))}

      {xemChiTiet && (
        <ChiTietXeModal
          xe={xemChiTiet}
          onClose={() => setXemChiTiet(null)}
          onSua={(id) => { setXemChiTiet(null); setSuaPhienId(id) }}
        />
      )}

      {suaPhienId && (
        <SuaXeModal
          phienId={suaPhienId}
          onClose={() => setSuaPhienId(null)}
          onSuccess={() => { setSuaPhienId(null); fetchData() }}
        />
      )}
    </PageLayout>
  )
}