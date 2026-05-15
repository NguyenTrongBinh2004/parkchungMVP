// Tập trung tất cả các API call vào một nơi

const BASE = import.meta.env.VITE_API_URL || '';

async function request(url, options = {}) {
  const res = await fetch(BASE + url, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

// ─── Loại xe ───
export const loaiXeApi = {
  list: () => request('/loai-xe/'),
  create: (formData) => request('/loai-xe/', { method: 'POST', body: formData }),
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
  list: () => request('/xe-trong-bai/'),
}

// ─── Vé tháng ───
export const veThangApi = {
  list: () => request('/danh-sach-ve-thang/'),
  dangKy: (formData) => request('/dang-ky-ve-thang/', { method: 'POST', body: formData }),
  giaHan: (idVe, formData) => request(`/ve-thang/${idVe}/gia-han/`, { method: 'POST', body: formData }),
  lichSu: (idVe) => request(`/ve-thang/${idVe}/lich-su/`),
}