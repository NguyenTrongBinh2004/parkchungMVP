// Danh sách tiền tố đặc biệt (quân đội, công an, ngoại giao...)
const SPECIAL_PREFIXES = [
  'QK','QH','TC','NN','NG','CV','CA','KV','VT','KT','LD','DA','HC','CD','CC',
  'AD','BT','LT','PX','RM','XM','HQ','CS','CT','DT'
];

/**
 * Chuẩn hóa biển số: bỏ dấu cách, gạch ngang, dấu chấm, chuyển thành chữ hoa.
 * @param {string} bienSo - Biển số người dùng nhập.
 * @returns {string} Biển số đã chuẩn hóa.
 */
export function chuanHoaBienSo(bienSo) {
  return bienSo.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Kiểm tra biển số đã chuẩn hóa có hợp lệ không.
 * @param {string} bienSoSach - Biển số đã được chuẩn hóa.
 * @returns {boolean} true nếu hợp lệ.
 */
export function isValidBienSo(bienSoSach) {
  if (bienSoSach.length < 6 || bienSoSach.length > 10) return false;
  if (!/^[A-Z0-9]+$/.test(bienSoSach)) return false;
  if (!/\d/.test(bienSoSach)) return false; // phải có ít nhất 1 chữ số

  const prefix2 = bienSoSach.slice(0, 2);
  if (!/^\d{2}$/.test(prefix2) && !SPECIAL_PREFIXES.includes(prefix2)) return false;

  // Phải có ít nhất 1 chữ cái sau phần đầu
  if (!/[A-Z]/.test(bienSoSach.slice(2))) return false;

  // Đuôi phải có 3-5 số, có thể kết thúc bằng 1 chữ cái
  if (!/\d{3,5}[A-Z]?$/.test(bienSoSach)) return false;

  // Giới hạn số chữ cái
  const letterCount = (bienSoSach.match(/[A-Z]/g) || []).length;
  if (letterCount > 4) return false;

  return true;
}
export const isMaTuSinhXeDap = (s) => /^XD\d+$/i.test(s)