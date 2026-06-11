// Tập trung tất cả các API call vào một nơi

// Lấy link API từ biến môi trường của Vercel/Vite, nếu không có thì dùng link Render (để chạy local)
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

  // Đọc raw text (để an toàn, không parse ngay)
  const text = await res.text();

  if (!res.ok) {
    console.error('❌ HTTP ERROR', res.status, text.substring(0, 500));
    // Nếu có JSON trong response lỗi thì parse, nếu không thì quăng nguyên text
    let detail = text;
    if (contentType && contentType.includes('application/json')) {
      try {
        const errData = JSON.parse(text);
        detail = errData.detail || text;
      } catch {}
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  // Nếu thành công nhưng không phải JSON -> log cảnh báo
  if (!contentType || !contentType.includes('application/json')) {
    console.error('⚠️ NOT JSON response:', text.substring(0, 500));
    throw new Error('Server trả về HTML thay vì JSON');
  }

  return JSON.parse(text);
}


// ─── Loại xe ───
// services/api.js (phần liên quan đến loaiXeApi)
export const loaiXeApi = {
  list: (params) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request('/loai-xe/' + qs)
  },
  listNhom: () => request('/loai-xe/nhom'),
  listNhomGia: () => request('/loai-xe/nhom-gia'),   // ← mới
  create: (formData) => request('/loai-xe/', { method: 'POST', body: formData }),
  dongGia: (formData) => request('/loai-xe/dong-gia', { method: 'POST', body: formData }),
  xoaDongGia: (nhomId) => request(`/loai-xe/dong-gia/${nhomId}`, { method: 'DELETE' }),  // ← đổi sang DELETE
  update: (id, formData) => request(`/loai-xe/${id}`, { method: 'PUT', body: formData }),
  delete: (id) => request(`/loai-xe/${id}`, { method: 'DELETE' }),
}
// ─── Xe vào ───
export const xeVaoApi = {
  nhanDien: (formData) => request('/xe-vao/nhan-dien/', { method: 'POST', body: formData }),
  kiemTraBienSo: (formData) => request('/xe-vao/kiem-tra-bien-so/', { method: 'POST', body: formData }), // thêm dòng này
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
  xoa: (idVe) => request(`/ve-thang/${idVe}`, { method: 'DELETE' }),
};