// src/components/SuaXeModal.jsx
import { useState, useEffect } from 'react'
import { Modal, Field, Spinner, Alert } from './UI'
import { suaXeApi, loaiXeApi } from '../services/api'

export default function SuaXeModal({ phienId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loaiXeOptions, setLoaiXeOptions] = useState([])

  const [bienSo, setBienSo] = useState('')
  const [idLoaiXe, setIdLoaiXe] = useState('')
  const [tenChuXe, setTenChuXe] = useState('')
  const [sdt, setSdt] = useState('')
  const [email, setEmail] = useState('')
  const [ghiChu, setGhiChu] = useState('')

  useEffect(() => {
    let huy = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const d = await suaXeApi.chiTiet(phienId)
        if (huy) return
        setDetail(d)
        setBienSo(d.bien_so || '')
        setIdLoaiXe(d.id_loai_xe || '')
        setTenChuXe(d.ten_chu_xe || '')
        setSdt(d.sdt || '')
        setEmail(d.email || '')
        setGhiChu(d.ghi_chu || '')

        if (!d.la_ve_thang) {
          const list = await loaiXeApi.list({ da_cau_hinh: true })
          if (!huy) setLoaiXeOptions(list.filter(lx => !lx.ten.includes('(đồng giá)')))
        }
      } catch (err) {
        if (!huy) setError(err.message)
      } finally {
        if (!huy) setLoading(false)
      }
    }
    load()
    return () => { huy = true }
  }, [phienId])

  async function submit() {
    setSaving(true); setError(null)
    const fd = new FormData()
    fd.append('bien_so', bienSo.trim().toUpperCase())
    if (!detail.la_ve_thang) fd.append('id_loai_xe', idLoaiXe)
    fd.append('ten_chu_xe', tenChuXe || '')
    fd.append('sdt', sdt || '')
    fd.append('email', email || '')
    fd.append('ghi_chu', ghiChu || '')
    try {
      await suaXeApi.capNhat(phienId, fd)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} title="✏️ Sửa thông tin xe">
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {!loading && detail && !detail.dang_trong_bai && (
        <Alert type="danger">Xe này đã ra bãi, không thể sửa thông tin.</Alert>
      )}

      {!loading && detail && detail.dang_trong_bai && (
        <>
          {detail.la_ve_thang && (
            <div style={{ fontSize: '0.82rem', color: 'var(--info)', marginBottom: 10 }}>
              🎫 Xe đang dùng vé tháng — không thể đổi loại xe. Sửa biển số sẽ tự đồng bộ vào vé tháng gốc.
            </div>
          )}

          <Field label="Biển số" required>
            <input value={bienSo} onChange={e => setBienSo(e.target.value)} style={{ textTransform: 'uppercase' }} />
          </Field>

          <Field label="Loại xe" required>
            {detail.la_ve_thang ? (
              <input value={detail.ten_loai_xe || ''} disabled />
            ) : (
              <select value={idLoaiXe} onChange={e => setIdLoaiXe(e.target.value)}>
                {loaiXeOptions.map(lx => (
                  <option key={lx.id} value={lx.id}>{lx.ten}</option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Tên chủ xe">
            <input value={tenChuXe} onChange={e => setTenChuXe(e.target.value)} />
          </Field>
          <Field label="Số điện thoại">
            <input value={sdt} onChange={e => setSdt(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </Field>
          <Field label="Ghi chú">
            <input value={ghiChu} onChange={e => setGhiChu(e.target.value)} />
          </Field>

          <button className="btn btn-accent" onClick={submit} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
          </button>
        </>
      )}
    </Modal>
  )
}