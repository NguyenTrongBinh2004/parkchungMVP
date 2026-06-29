// src/pages/TimXe.jsx
import { useState, useRef, useCallback } from 'react'
import { PageLayout, Spinner, Alert, Field, fmtDt } from '../components/UI'
import { timXeApi } from '../services/api'

const formatVND = (v) => {
  if (v === undefined || v === null) return ''
  return v.toLocaleString('vi-VN') + ' đ'
}

const LIMIT = 20

function ResultCard({ item }) {
  const [showAnh, setShowAnh] = useState(false)
  const coAnh = item.anh_bien_so || item.anh_nguoi_lai

  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700 }}>
            {item.bien_so}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 2 }}>
            {item.ten_loai_xe}
            {item.la_ve_thang && <span style={{ color: 'var(--info)' }}> · 🎫 Vé tháng</span>}
          </div>
        </div>
        <span
          style={{
            padding: '4px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
            background: item.dang_trong_bai ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)',
            color: item.dang_trong_bai ? '#4ade80' : '#94a3b8',
            whiteSpace: 'nowrap',
          }}
        >
          {item.dang_trong_bai ? '🟢 Đang trong bãi' : '⚪ Đã ra'}
        </span>
      </div>

      <div style={{ marginTop: 10, fontSize: '0.88rem', display: 'grid', rowGap: 4 }}>
        {(item.ten_chu_xe || item.sdt) && (
          <div>
            <strong>Chủ xe:</strong> {item.ten_chu_xe || 'Khách vãng lai'}
            {item.sdt && ` · ${item.sdt}`}
          </div>
        )}
        <div><strong>Giờ vào:</strong> {fmtDt(item.gio_vao)}</div>
        {item.gio_ra && <div><strong>Giờ ra:</strong> {fmtDt(item.gio_ra)}</div>}
        {item.so_tien !== null && (
          <div>
            <strong>Số tiền:</strong> {formatVND(item.so_tien)}
            {item.hinh_thuc_thanh_toan && ` (${item.hinh_thuc_thanh_toan === 'tien_mat' ? 'Tiền mặt' : 'Chuyển khoản'})`}
          </div>
        )}
        {item.ghi_chu && <div style={{ color: 'var(--text-muted)' }}>📝 {item.ghi_chu}</div>}
      </div>

      {coAnh && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowAnh(s => !s)}
          >
            {showAnh ? 'Ẩn ảnh' : '🖼 Xem ảnh'}
          </button>
          {showAnh && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {item.anh_bien_so && (
                <img src={item.anh_bien_so} alt="Biển số" style={{ width: 140, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              )}
              {item.anh_nguoi_lai && (
                <img src={item.anh_nguoi_lai} alt="Người lái" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TimXe() {
  const [bienSo, setBienSo] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [daTimKiem, setDaTimKiem] = useState(false)
  const debounceRef = useRef(null)

  const search = useCallback(async (raw, pageToLoad = 1) => {
    const text = raw.trim()
    if (text.length < 2) {
      setItems([]); setTotal(0); setDaTimKiem(false); setError(null)
      return
    }
    setLoading(true); setError(null); setDaTimKiem(true)
    try {
      const data = await timXeApi.timKiem({ bien_so: text, page: pageToLoad, limit: LIMIT })
      setItems(prev => pageToLoad === 1 ? data.items : [...prev, ...data.items])
      setTotal(data.total)
      setPage(pageToLoad)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  function onChangeBienSo(value) {
    setBienSo(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value, 1), 400)
  }

  function loadMore() {
    search(bienSo, page + 1)
  }

  const conThem = items.length < total

  return (
    <PageLayout title="🔍 Tìm xe" backTo="/">
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <Field label="Nhập biển số (đầy đủ hoặc một phần)">
          <input
            value={bienSo}
            onChange={e => onChangeBienSo(e.target.value)}
            placeholder="VD: 51F hoặc 12345"
            style={{ textTransform: 'uppercase' }}
            autoFocus
          />
        </Field>
      </div>

      {loading && page === 1 && <Spinner />}
      {error && <Alert type="danger" onClose={() => setError(null)}>{error}</Alert>}

      {daTimKiem && !loading && items.length === 0 && !error && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 24 }}>
          Không tìm thấy xe nào khớp với "{bienSo}"
        </div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 10 }}>
            Tìm thấy {total} biển số khớp
          </div>
          {items.map(item => <ResultCard key={item.id} item={item} />)}

          {conThem && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={loadMore} disabled={loading}>
                {loading ? 'Đang tải...' : 'Xem thêm'}
              </button>
            </div>
          )}
        </>
      )}

      {!daTimKiem && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
          Nhập ít nhất 2 ký tự để tìm kiếm
        </div>
      )}
    </PageLayout>
  )
}