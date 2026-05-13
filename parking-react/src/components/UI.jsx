import { useNavigate } from 'react-router-dom'

// ─── Spinner ───
export function Spinner() {
  return <div className="spinner" />
}

// ─── Alert ───
export function Alert({ type = 'danger', children, onClose }) {
  return (
    <div className={`alert alert-${type}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span>{children}</span>
      {onClose && (
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: '0.5rem' }}>✕</button>
      )}
    </div>
  )
}

// ─── Page wrapper với tiêu đề + nút quay lại ───
export function PageLayout({ title, backTo, children }) {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1.25rem 1rem' }}>
      <div className="page-header">
        {backTo && (
          <button className="back-btn" onClick={() => navigate(backTo)}>←</button>
        )}
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── Modal ───
export function Modal({ onClose, title, children }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>✕</button>
        {title && <h5 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{title}</h5>}
        {children}
      </div>
    </div>
  )
}

// ─── File input với preview ───
export function ImageInput({ label, id, onChange, previewSrc, required }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label className="form-label">{label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}</label>
      <input
        type="file"
        id={id}
        accept="image/*"
        capture="environment"
        onChange={onChange}
      />
      {previewSrc && (
        <img
          src={previewSrc}
          alt="preview"
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
        />
      )}
    </div>
  )
}

// ─── Field nhập liệu ───
export function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Badge trạng thái vé tháng ───
export function TrangThaiBadge({ trangThai }) {
  const map = {
    con_han:  { cls: 'badge-success', text: 'Còn hạn' },
    sap_het:  { cls: 'badge-warning', text: 'Sắp hết' },
    het_han:  { cls: 'badge-danger',  text: 'Hết hạn' },
  }
  const { cls, text } = map[trangThai] || { cls: 'badge-gray', text: trangThai }
  return <span className={`badge ${cls}`}>{text}</span>
}

// ─── Hình thức thanh toán select ───
export function HinhThucSelect({ id, value, onChange }) {
  return (
    <Field label="Hình thức thanh toán">
      <select id={id} value={value} onChange={onChange}>
        <option value="tien_mat">Tiền mặt</option>
        <option value="chuyen_khoan">Chuyển khoản</option>
      </select>
    </Field>
  )
}

// ─── Util: preview file ───
export function previewBlob(file) {
  if (!file) return null
  return URL.createObjectURL(file)
}

// ─── Util: format tiền ───
export function fmtTien(n) {
  return Number(n || 0).toLocaleString('vi-VN') + ' đ'
}

// ─── Util: format datetime ───
export function fmtDt(dt) {
  if (!dt) return ''
  return new Date(dt).toLocaleString('vi-VN')
}
