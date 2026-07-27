// src/components/ChiTietXeModal.jsx
import { useState, useEffect } from 'react'
import { Modal, Spinner, Alert, fmtDt, fmtTien } from './UI'
import { suaXeApi } from '../services/api'

export default function ChiTietXeModal({ xe, onClose, onSua }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chiTiet, setChiTiet] = useState(null)

  useEffect(() => {
    let huy = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const d = await suaXeApi.chiTiet(xe.id)
        if (!huy) setChiTiet(d)
      } catch (err) {
        if (!huy) setError(err.message)
      } finally {
        if (!huy) setLoading(false)
      }
    }
    load()
    return () => { huy = true }
  }, [xe.id])

  return (
    <Modal onClose={onClose} title={`🚗 Chi tiết xe — ${xe.bien_so}`}>
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {!loading && !error && (
        <>
          {/* Ảnh biển số + người lái */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {xe.anh_bien_so ? (
              <img
                src={xe.anh_bien_so}
                alt="biển số"
                style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                onError={e => { e.target.style.display = 'none' }}
              />
            ) : (
              <div style={{
                width: 140, height: 90, borderRadius: 8, border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: '1.6rem',
              }}>🚗</div>
            )}
            {xe.anh_nguoi_lai ? (
              <img
                src={xe.anh_nguoi_lai}
                alt="người lái"
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border)' }}
                onError={e => { e.target.style.display = 'none' }}
              />
            ) : (
              <div style={{
                width: 90, height: 90, borderRadius: '50%', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: '1.6rem',
              }}>👤</div>
            )}
          </div>

          {/* Thông tin đã đăng ký */}
          <div style={{ fontSize: '0.92rem', display: 'grid', rowGap: 8 }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.2rem' }}>
                {xe.bien_so}
              </span>
              {xe.la_xe_ve_thang && (
                <span className="badge badge-info" style={{ marginLeft: 8 }}>🎫 Vé tháng</span>
              )}
            </div>
            <div><strong>Loại xe:</strong> {chiTiet?.ten_loai_xe || xe.ten_loai_xe || '—'}</div>
            <div><strong>Chủ xe:</strong> {chiTiet?.ten_chu_xe || xe.ten_chu_xe || 'Khách vãng lai'}</div>
            {chiTiet?.sdt && <div><strong>Số điện thoại:</strong> {chiTiet.sdt}</div>}
            {chiTiet?.email && <div><strong>Email:</strong> {chiTiet.email}</div>}
            <div><strong>Giờ vào:</strong> {fmtDt(xe.gio_vao)}</div>
            {chiTiet?.ghi_chu && <div><strong>Ghi chú:</strong> {chiTiet.ghi_chu}</div>}
            <div>
              <strong>Tạm tính:</strong>{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtTien(xe.so_tien_tam_tinh)}</span>
            </div>
          </div>

          {/* Nút sửa */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ width: 'auto' }}
              onClick={() => onSua(xe.id)}
            >
              ✏️ Sửa
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}