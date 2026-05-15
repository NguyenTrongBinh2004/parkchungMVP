import { useState, useEffect } from 'react'
import { PageLayout, Spinner, Alert, ImageInput, Field, HinhThucSelect, fmtDt, fmtTien } from '../components/UI'
import { xeRaApi, thanhToanApi } from '../services/api'
import { PLACEHOLDER } from '../components/UI';
// Helper tính thời gian đã gửi (chỉ một định nghĩa duy nhất)
function fmtThoiGianGui(phut) {
  if (phut == null) return null;
  const h = Math.floor(phut / 60);
  const m = phut % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}p`);
  return `${phut} phút${parts.length ? ` (${parts.join(' ')})` : ''}`;
}

// Component hiển thị đầy đủ thông tin xe
function XeInfo({ xe }) {
  const thoiGianGui = xe.thoi_gian_gui_phut != null
    ? fmtThoiGianGui(xe.thoi_gian_gui_phut)
    : (() => {
        if (!xe.gio_vao) return null;
        const vao = new Date(xe.gio_vao);
        const now = new Date();
        const diffPhut = Math.floor((now - vao) / 60000);
        return fmtThoiGianGui(diffPhut);
      })();

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <p><strong>Biển số:</strong> {xe.bien_so}</p>
      <p><strong>Giờ vào:</strong> {fmtDt(xe.gio_vao)}</p>
      {thoiGianGui && <p><strong>Thời gian đã gửi:</strong> {thoiGianGui}</p>}
      <p>
        <strong>Tiền tạm tính:</strong>{' '}
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          {fmtTien(xe.so_tien_tam_tinh)}
        </span>
      </p>
      {xe.ghi_chu && (
        <p><strong>Ghi chú:</strong> <span style={{ color: 'var(--info)' }}>{xe.ghi_chu}</span></p>
      )}
      <p>
        <strong>Cho phép lấy hộ:</strong>{' '}
        <span style={{ color: xe.cho_phep_lay_ho ? 'var(--success)' : 'var(--text-muted)' }}>
          {xe.cho_phep_lay_ho ? '✅ Có' : '❌ Không'}
        </span>
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {xe.anh_bien_so && (
          <img src={xe.anh_bien_so} className="thumb" alt="biển số" onError={e => e.target.src = PLACEHOLDER} />
        )}
        {xe.anh_nguoi_lai && (
          <img src={xe.anh_nguoi_lai} className="thumb-round" alt="người lái" />
        )}
      </div>
    </div>
  );
}

// ─── Tab chụp ảnh thông minh ───
function SmartPanel({ onChuyenTabBienSo }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [success, setSuccess] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const [htttQR, setHtttQR] = useState('tien_mat')
  const [bienSoText, setBienSoText] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSuccess(false)
    setBienSoText('')
    const fd = new FormData()
    fd.append('anh', file)
    try {
      const data = await xeRaApi.nhanDien(fd)
      setResult(data)
      if (data.loai === 'bien_so') {
        setBienSoText(data.bien_so_nhan_dien || '')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function thanhToanQR() {
    if (!result?.ma_qr) return
    const fd = new FormData()
    fd.append('hinh_thuc_thanh_toan', htttQR)
    setLoading(true)
    try {
      await thanhToanApi.xacNhanQR(result.ma_qr, fd)
      setSuccess(true)
      setResult(null)
      setResetKey(k => k + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function xacNhanBienSo() {
    const bs = bienSoText.trim()
    if (!bs) {
      setError('Vui lòng nhập biển số')
      return
    }
    onChuyenTabBienSo(bs)
  }

  return (
    <div className="card">
      <ImageInput
        key={resetKey}
        label="Chụp ảnh (QR hoặc biển số)"
        id="smart-file"
        onChange={handleFile}
      />
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Thanh toán thành công!</Alert>}

      {result?.loai === 'qr' && (
        <>
          <XeInfo xe={result} />
          <HinhThucSelect id="smart-httt-qr" value={htttQR} onChange={e => setHtttQR(e.target.value)} />
          <button className="btn btn-accent" onClick={thanhToanQR} disabled={loading}>
            Xác nhận thanh toán
          </button>
        </>
      )}

      {result?.loai === 'bien_so' && (
        <div style={{ marginTop: '1rem' }}>
          <Field label="Biển số nhận diện (sửa nếu cần)">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={bienSoText}
                onChange={e => setBienSoText(e.target.value)}
                placeholder="Nhập biển số"
                style={{ textTransform: 'uppercase', flex: 1 }}
              />
              <button
                className="btn btn-accent btn-sm"
                onClick={xacNhanBienSo}
                disabled={!bienSoText.trim()}
                style={{ width: 'auto', whiteSpace: 'nowrap' }}
              >
                Tìm xe
              </button>
            </div>
          </Field>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Kiểm tra và sửa biển số nếu cần, sau đó bấm "Tìm xe" để chuyển sang tab Biển số.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Tab quét QR ───
function QRPanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [xe, setXe] = useState(null)
  const [httt, setHttt] = useState('tien_mat')
  const [success, setSuccess] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    setError(null)
    setXe(null)
    setSuccess(false)
    const fd = new FormData()
    fd.append('anh_qr', file)
    try {
      const data = await xeRaApi.quetQR(fd)
      if (data.ma_qr) setXe(data)
      else setError('Không tìm thấy xe.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function thanhToan() {
    if (!xe?.ma_qr) return
    const fd = new FormData()
    fd.append('hinh_thuc_thanh_toan', httt)
    setLoading(true)
    try {
      await thanhToanApi.xacNhanQR(xe.ma_qr, fd)
      setSuccess(true)
      setXe(null)
      setResetKey(k => k + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <ImageInput key={resetKey} label="Chụp ảnh QR" id="qr-file" onChange={handleFile} />
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Thanh toán thành công!</Alert>}
      {xe && (
        <>
          <XeInfo xe={xe} />
          <HinhThucSelect id="qr-httt" value={httt} onChange={e => setHttt(e.target.value)} />
          <button className="btn btn-accent" onClick={thanhToan} disabled={loading}>
            Xác nhận thanh toán
          </button>
        </>
      )}
    </div>
  )
}

// ─── Tab Biển số ───
function BienSoPanel({ bienSoMacDinh }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [bienSo, setBienSo] = useState('')
  const [xe, setXe] = useState(null)
  const [nhieu, setNhieu] = useState(null)
  const [httt, setHttt] = useState('tien_mat')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (bienSoMacDinh && bienSoMacDinh.trim()) {
      setBienSo(bienSoMacDinh.trim())
      kiemTra(bienSoMacDinh.trim())
    }
  }, [bienSoMacDinh]) // eslint-disable-line react-hooks/exhaustive-deps

  async function kiemTra(bs) {
    const searchBien = bs || bienSo.trim()
    if (!searchBien) return
    setLoading(true)
    setError(null)
    setXe(null)
    setNhieu(null)
    setSuccess(false)
    const fd = new FormData()
    fd.append('bien_so', searchBien)
    try {
      const data = await xeRaApi.timBienSo(fd)
      if (data.nhieu_ket_qua) {
        setNhieu(data.danh_sach)
      } else if (data.id) {
        setXe(data)
      } else {
        setError('Không tìm thấy xe.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function thanhToan(xeData) {
    const fd = new FormData()
    fd.append('id_phien', xeData.id)
    fd.append('hinh_thuc_thanh_toan', httt)
    setLoading(true)
    try {
      await thanhToanApi.xacNhanPhiRa(fd)
      setSuccess(true)
      setXe(null)
      setNhieu(null)
      setBienSo('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function chonXe(x) {
    setXe(x)
    setNhieu(null)
  }

  return (
    <div className="card">
      <Field label="Nhập biển số">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={bienSo}
            onChange={e => setBienSo(e.target.value)}
            placeholder="VD: 51F-12345"
            onKeyDown={e => e.key === 'Enter' && kiemTra()}
            style={{ flex: 1, textTransform: 'uppercase' }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => kiemTra()}
            disabled={loading}
            style={{ width: 'auto', whiteSpace: 'nowrap' }}
          >
            Kiểm tra
          </button>
        </div>
      </Field>
      {loading && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert type="success">✅ Thanh toán thành công!</Alert>}

      {nhieu && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ color: 'var(--warning)', marginBottom: '0.5rem', fontSize: '0.88rem' }}>
            Có nhiều xe trùng số cuối. Vui lòng chọn:
          </p>
          {nhieu.map(x => (
            <div
              key={x.id}
              className="card"
              style={{ marginBottom: 8, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}
              onClick={() => chonXe(x)}
            >
              <img src={x.anh_bien_so || PLACEHOLDER} className="thumb" onError={e => e.target.src = PLACEHOLDER} alt="" />
              <div style={{ flex: 1 }}>
                <strong>{x.bien_so}</strong>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Vào: {fmtDt(x.gio_vao)}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Chủ xe: {x.ten_chu_xe || 'Không rõ'}</div>
              </div>
              <span className="badge badge-warning">{fmtTien(x.so_tien_tam_tinh)}</span>
            </div>
          ))}
        </div>
      )}

      {xe && (
        <>
          <XeInfo xe={xe} />
          <HinhThucSelect id="bien-httt" value={httt} onChange={e => setHttt(e.target.value)} />
          <button className="btn btn-accent" onClick={() => thanhToan(xe)} disabled={loading}>
            Xác nhận thanh toán
          </button>
        </>
      )}
    </div>
  )
}

// ─── Trang chính XeRa ───
export default function XeRa() {
  const [tab, setTab] = useState('smart')
  const [bienSoTuSmart, setBienSoTuSmart] = useState('')

  const chuyenTabBienSo = (bienSo) => {
    setBienSoTuSmart(bienSo)
    setTab('bien')
  }

  const tabs = [
    { id: 'smart', label: '📷 Chụp ảnh' },
    { id: 'qr',    label: '🔳 Quét QR' },
    { id: 'bien',  label: '🔢 Biển số' },
  ]

  return (
    <PageLayout title="📤 Xe ra" backTo="/">
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'smart' && <SmartPanel onChuyenTabBienSo={chuyenTabBienSo} />}
      {tab === 'qr'    && <QRPanel />}
      {tab === 'bien'  && <BienSoPanel bienSoMacDinh={bienSoTuSmart} />}
    </PageLayout>
  )
}