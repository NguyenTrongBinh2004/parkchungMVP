const BASE = import.meta.env.VITE_API_URL || 'https://parking-mvp-backend.onrender.com';
console.log('BASE URL:', BASE);
console.log('ENV:', import.meta.env.VITE_API_URL);

async function request(url, options = {}) {
  const fullUrl = BASE + url;
  console.log('🌐 REQUEST:', fullUrl, options.method || 'GET');

  let res;
  try {
    res = await fetch(fullUrl, options);
  } catch (err) {
    console.error('🚨 FETCH FAILED:', fullUrl, err);
    throw err;
  }

  const contentType = res.headers.get('content-type');
  console.log('📬 RESPONSE:', res.status, contentType);

  const text = await res.text();

  if (!res.ok) {
    console.error('❌ HTTP ERROR', res.status, text.substring(0, 500));
    let detail = text;
    if (contentType && contentType.includes('application/json')) {
      try {
        const errData = JSON.parse(text);
        detail = errData.detail || text;
      } catch {}
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  if (!contentType || !contentType.includes('application/json')) {
    console.error('⚠️ NOT JSON response:', text.substring(0, 500));
    throw new Error('Server trả về HTML thay vì JSON');
  }

  return JSON.parse(text);
}

function authHeader() {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ─── Loại xe ───
export const loaiXeApi = {
  list: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request('/loai-xe/' + qs)
  },
  listNhom: () => request('/loai-xe/nhom'),
  getToanBo: () => request('/loai-xe/toan-bo'),
  listNhomGia: () => request('/loai-xe/nhom-gia'),
  create: (formData) => request('/loai-xe/', { method: 'POST', body: formData }),
  dongGia: (formData) => request('/loai-xe/dong-gia', { method: 'POST', body: formData }),
  xoaDongGia: (nhomId) => request(`/loai-xe/dong-gia/${nhomId}`, { method: 'DELETE' }),
  update: (id, formData) => request(`/loai-xe/${id}`, { method: 'PUT', body: formData }),
  delete: (id) => request(`/loai-xe/${id}`, { method: 'DELETE' }),
  capNhatSoChoNhom: (nhomId, formData) => request(`/loai-xe/nhom/${nhomId}/so-cho`, { method: 'PUT', body: formData }),
  laySucChuaTheoNhom: () => request('/loai-xe/nhom/suc-chua'),
}

// ─── Xe vào ───
export const xeVaoApi = {
  nhanDien: (formData) => request('/xe-vao/nhan-dien/', { method: 'POST', body: formData }),
  kiemTraBienSo: (formData) => request('/xe-vao/kiem-tra-bien-so/', { method: 'POST', body: formData }),
  xacNhanVeThang: (formData) => request('/xe-vao/ve-thang/xac-nhan/', { method: 'POST', body: formData }),
  xacNhanThuong: (formData) => request('/xe-vao/ve-thuong/xac-nhan/', { method: 'POST', body: formData }),
}

// ─── Xe ra ───
export const xeRaApi = {
  nhanDien: (formData) => request('/xe-ra/nhan-dien/', { method: 'POST', body: formData }),
  quetQR: (formData) => request('/xe-ra/quet-qr/', { method: 'POST', body: formData }),
  timBienSo: (formData) => request('/xe-ra/bien-so/', { method: 'POST', body: formData }),
}

// ─── Thanh toán ───
export const thanhToanApi = {
  xacNhanQR: (maQr, formData) => request(`/thanh-toan/xac-nhan-qr/${maQr}`, { method: 'POST', body: formData }),
  xacNhanPhiRa: (formData) => request('/thanh-toan/xac-nhan-phi-ra/', { method: 'POST', body: formData }),
}

// ─── Xe trong bãi ───
export const xeTrongBaiApi = {
  list: () => request('/danh-sach-xe/trong-bai'),   // URL mới
}

// ─── Xe đã ra ───
export const xeDaRaApi = {
  list: (ngay) => request(`/danh-sach-xe/da-ra?ngay=${ngay}`),
}

// ─── Vé tháng ───
export const veThangApi = {
  list: () => request('/danh-sach-ve-thang/'),
  dangKy: (formData) => request('/dang-ky-ve-thang/', { method: 'POST', body: formData }),
  giaHan: (idVe, formData) => request(`/ve-thang/${idVe}/gia-han/`, { method: 'POST', body: formData }),
  lichSu: (idVe) => request(`/ve-thang/${idVe}/lich-su/`),
  xoa: (idVe) => request(`/ve-thang/${idVe}`, { method: 'DELETE' }),
};

export const baoCaoApi = {
  dashboard: (tuNgay, denNgay) =>
    request(`/bao-cao/dashboard/?tu_ngay=${tuNgay}&den_ngay=${denNgay}`),
  thongKe: (params) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/bao-cao/thong-ke?${qs}`)
  },
}

export const timXeApi = {
  timKiem: (params) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/tim-xe/?${qs}`)
  },
}

export const suaXeApi = {
  chiTiet: (id) => request(`/danh-sach-xe/phien/${id}`),
  capNhat: (id, formData) => request(`/danh-sach-xe/phien/${id}`, { method: 'PUT', body: formData }),
}

export const authApi = {
  dangKy:     (data) => request('/auth/dang-ky/',      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  xacNhanOtp: (data) => request('/auth/xac-nhan-otp/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  guiLaiOtp:  (data) => request('/auth/gui-lai-otp/',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  dangNhap:   (data) => request('/auth/dang-nhap/',    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  refresh:    (data) => request('/auth/refresh/',      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  dangXuat:   (data) => request('/auth/dang-xuat/',    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  quenMatKhau:    (data) => request('/auth/quen-mat-khau/',     { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  xacNhanOtpQmk:  (data) => request('/auth/xac-nhan-otp-qmk/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  datLaiMatKhau:  (data) => request('/auth/dat-lai-mat-khau/',  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    doiMatKhau: (data) => request('/auth/doi-mat-khau/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data)
  }),
}
export const baiXeApi = {
  layThongTin: () => request('/bai-xe/thong-tin/', { headers: authHeader() }),
  capNhat: (data) => request('/bai-xe/thong-tin/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data),
  }),
  layTienIchKhaDung: () => request('/bai-xe/tien-ich-kha-dung/'),
};