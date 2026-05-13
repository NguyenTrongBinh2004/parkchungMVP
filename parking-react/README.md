# Parking MVP — React Frontend

Chuyển đổi từ HTML/CSS/JS thuần sang React + Vite SPA.

## Cấu trúc

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Router
├── index.css             # Global styles (CSS variables)
├── services/
│   └── api.js            # Tất cả API calls (fetch wrapper)
├── components/
│   └── UI.jsx            # Shared components: Spinner, Alert, Modal, Field...
└── pages/
    ├── Dashboard.jsx     # Trang chủ (menu 6 chức năng)
    ├── XeVao.jsx         # Chụp ảnh biển số/QR → ghi nhận xe vào
    ├── XeRa.jsx          # Chụp ảnh / quét QR / biển số → thanh toán
    ├── DanhSach.jsx      # Danh sách xe đang trong bãi
    ├── VeThang.jsx       # Danh sách vé tháng + gia hạn
    ├── DangKyVeThang.jsx # Form đăng ký vé tháng mới
    ├── LoaiXe.jsx        # Quản lý loại xe
    └── CaiDat.jsx        # Cài đặt hệ thống
```

## Cài đặt & chạy

```bash
npm install
npm run dev        # Development (proxy → localhost:8000)
npm run build      # Build ra thư mục ../frontend
npm run preview    # Preview bản build
```

## Cấu hình proxy

`vite.config.js` đã cấu hình proxy tự động chuyển tiếp tất cả API calls
(`/loai-xe/`, `/xe-vao/`, `/xe-ra/`, ...) sang FastAPI tại `localhost:8000`.

Khi build production (`npm run build`), output được đặt vào `../frontend/`
để FastAPI mount tĩnh phục vụ.

## Điểm khác biệt so với HTML thuần

| HTML thuần | React |
|---|---|
| Mỗi trang = 1 file HTML | SPA — 1 file, điều hướng client-side |
| `fetch` + DOM manipulation | `useState` / `useEffect` |
| `alert()` | Component `<Alert>` inline |
| Bootstrap JS modal | Component `<Modal>` tự viết |
| `location.reload()` | Gọi lại hàm `load()` |
| `FormData` → `fetch` | Giữ nguyên `FormData` (backend không đổi) |
