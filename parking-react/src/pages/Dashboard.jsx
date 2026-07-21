// src/pages/Dashboard.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBaiXe } from '../context/BaiXeContext'

function LogoParkchung({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 10 105 90" xmlns="http://www.w3.org/2000/svg">
      <path transform="matrix(1,0,0,-1,60.9868,45.0564)" d="M0 0C1.669 1.669 1.669 4.374 0 6.043-1.669 7.712-4.374 7.712-6.043 6.043-7.712 4.374-7.712 1.669-6.043 0-4.374-1.669-1.669-1.669 0 0" fill="#13b47e"/>
      <path transform="matrix(1,0,0,-1,48.9003,32.969903)" d="M0 0C5.006 5.006 13.123 5.006 18.13 0 23.136-5.006 23.136-13.123 18.13-18.13L9.064-27.195 0-18.13C-5.006-13.123-5.006-5.006 0 0M36.259 18.129C21.241 33.149-3.11 33.149-18.129 18.129L-39.281-3.022-45.324-9.064-39.281-15.108 9.064-63.454 15.107-57.411-33.238-9.064-12.086 12.086C-.405 23.768 18.535 23.768 30.216 12.086 41.897 .405 41.897-18.535 30.216-30.216L21.152-39.281 15.107-33.238 24.173-24.173C32.517-15.83 32.517-2.301 24.173 6.043 15.83 14.387 2.301 14.387-6.043 6.043-14.203-2.115-14.382-15.232-6.584-23.61L-6.595-23.621 15.107-45.324 21.152-51.367 27.195-45.324 36.259-36.259C51.278-21.241 51.278 3.11 36.259 18.129" fill="#13b47e"/>
    </svg>
  )
}

const LABEL_NGAY = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }

function gomChuoiNgay(dsNgay) {
  if (!dsNgay || dsNgay.length === 0) return null
  if (dsNgay.length === 7) return 'Tất cả các ngày'
  const sorted = [...dsNgay].sort((a, b) => a - b)
  const nhoms = []
  let start = sorted[0], prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i]
    if (cur === prev + 1) { prev = cur; continue }
    nhoms.push(start === prev ? LABEL_NGAY[start] : `${LABEL_NGAY[start]} - ${LABEL_NGAY[prev]}`)
    start = cur; prev = cur
  }
  return nhoms.join(', ')
}

// ── Icon SVG outline đơn sắc (thay cho emoji) ──────────────────
function IconGhim() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
function IconDongHo() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}
function IconLich() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

// ─── Thẻ thông tin bãi xe (layout gọn, icon outline) ──────────
function ThongTinBaiXeCard() {
  const { thongTin: data } = useBaiXe()

  if (!data) return null

  const khungGio = data.gio_mo_cua && data.gio_dong_cua ? `${data.gio_mo_cua} - ${data.gio_dong_cua}` : null
  const ngayHoatDong = gomChuoiNgay(data.cac_ngay_hoat_dong)

  if (!data.dia_chi && !khungGio && !ngayHoatDong) return null

  return (
    <div style={{
      padding: '2px 2px 14px',
      marginBottom: 16,
      borderBottom: '1px solid var(--border)',
    }}>
      {data.dia_chi && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          fontSize: '0.85rem', color: 'var(--text)', fontWeight: 500,
          lineHeight: 1.4,
        }}>
          <span style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }}><IconGhim /></span>
          <span>{data.dia_chi}</span>
        </div>
      )}
      {(khungGio || ngayHoatDong) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginTop: 6, fontSize: '0.76rem', color: 'var(--text-muted)',
        }}>
          {khungGio && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconDongHo />{khungGio}
            </span>
          )}
          {khungGio && ngayHoatDong && <span style={{ opacity: 0.5 }}>·</span>}
          {ngayHoatDong && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconLich />{ngayHoatDong}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Định nghĩa TABS với quyền admin
const TABS = [
  {
    id: 'ban-gui-xe',
    label: 'Bảng giữ xe',
    icon: <LogoParkchung size={24} />,
    items: [
      { label: 'Xe vào',  icon: '📸', path: '/xe-vao',  color: '#22c55e' },
      { label: 'Xe ra',   icon: '📤', path: '/xe-ra',   color: '#ef4444' },
    ],
  },
  {
    id: 'quan-ly',
    label: 'Quản lý',
    icon: '🏷️',
    items: [
      { label: 'Loại xe & giá', icon: '🏷️', path: '/loai-xe', color: '#f59e0b', adminOnly: true },          // <-- thêm adminOnly
       { label: 'Quản lý nhân viên', icon: '👥', path: '/nhan-vien', color: '#0ea5e9', adminOnly: true }, 
    ],
  },
  {
    id: 'bai-xe',
    label: 'QL Bãi xe',
    icon: '🚗',
    items: [
      { label: 'Trong bãi', icon: '🅿️', path: '/danh-sach', color: '#3b82f6' },
      { label: 'Đã ra',     icon: '✅', path: '/xe-da-ra',   color: '#6366f1' },
      { label: 'Tìm xe',    icon: '🔍', path: '/tim-xe',     color: '#06b6d4' },
      { label: 'Vé tháng',  icon: '🎫', path: '/ve-thang',   color: '#f97316' },
      { label: 'Thống kê',  icon: '📊', path: '/thong-ke',   color: '#8b5cf6' },
    ],
  },
  {
    id: 'nguoi-dung',
    label: 'Người dùng',
    icon: '👤',
    items: [
      { label: 'Cài đặt',   icon: '⚙️', path: '/cai-dat',    color: '#64748b' },
      { label: 'Đăng xuất', icon: '🚪', action: 'dang-xuat', color: '#ef4444' },
    ],
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { dangXuat, tenBaiXe, laAdmin } = useAuth()   // lấy thêm laAdmin

  // Lọc tab theo quyền: bỏ item adminOnly nếu không phải admin, sau đó ẩn cả tab nếu không còn item nào
  const tabsHienThi = TABS
    .map(tab => ({
      ...tab,
      items: tab.items.filter(item => !item.adminOnly || laAdmin),
    }))
    .filter(tab => tab.items.length > 0)

  const hash = location.hash.replace('#', '') || tabsHienThi[0].id
  const activeTab = tabsHienThi.find(t => t.id === hash) || tabsHienThi[0]

  function setTab(id) {
    navigate({ hash: id }, { replace: true })
  }

  function handleItemClick(item) {
    if (item.action === 'dang-xuat') {
      if (window.confirm('Bạn có chắc muốn đăng xuất?')) dangXuat()
    } else {
      navigate(item.path)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      maxWidth: 520,
      margin: '0 auto',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '20px 20px 10px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoParkchung size={40} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.04em', color: '#13b47e', textShadow: '0 0 8px rgba(19,180,126,0.4)' }}>
              PARKCHUNG
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
              version: 1.0.0 &nbsp;·&nbsp; 📞 0903.229.906
            </div>
          </div>
        </div>
      </div>

      {/* ── Nội dung tab ── */}
      <div style={{ flex: 1, padding: '24px 16px 20px', overflowY: 'auto' }}>
        <p style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          marginBottom: 16,
        }}>
          {activeTab.label}
        </p>

        {/* Thông tin bãi xe — chỉ hiện ở tab Bảng giữ xe */}
        {activeTab.id === 'ban-gui-xe' && <ThongTinBaiXeCard />}

        {/* Tên bãi xe — chỉ hiện ở tab Người dùng */}
        {activeTab.id === 'nguoi-dung' && tenBaiXe && (
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 14,
            padding: '14px 16px', marginBottom: 12,
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.4rem' }}>🏢</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bãi xe</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{tenBaiXe}</div>
            </div>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: activeTab.items.length === 1 ? '1fr' : 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {activeTab.items.map(item => (
            <button
              key={item.path || item.action}
              onClick={() => handleItemClick(item)}
              style={{
                background: item.color,
                border: 'none',
                borderRadius: 18,
                padding: '28px 16px 22px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transition: 'transform 0.12s, filter 0.12s',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: `0 4px 20px ${item.color}55`,
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = 'scale(0.94)'
                e.currentTarget.style.filter = 'brightness(0.85)'
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.filter = 'brightness(1)'
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.filter = 'brightness(1)'
              }}
            >
              <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{item.icon}</span>
              <span style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#fff',
                textAlign: 'center',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <nav style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        padding: '6px 0 max(6px, env(safe-area-inset-bottom))',
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
      }}>
        {tabsHienThi.map(tab => {   {/* dùng tabsHienThi thay vì TABS */}
          const isActive = tab.id === activeTab.id
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontSize: '1.35rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: isActive ? 'none' : 'grayscale(0.8) opacity(0.5)',
                transition: 'filter 0.15s',
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                letterSpacing: '0.02em',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  width: 20,
                  height: 3,
                  borderRadius: 2,
                  background: 'var(--accent)',
                  marginTop: -2,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}