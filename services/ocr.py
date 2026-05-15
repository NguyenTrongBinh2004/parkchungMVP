import ssl
ssl._create_default_https_context = ssl._create_unverified_context  # an toàn cho môi trường hạn chế

import easyocr
import re
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import io
import logging

logger = logging.getLogger(__name__)

# Biến toàn cục để cache model (chỉ tải một lần)
_reader = None

def _get_reader():
    """Lazy load EasyOCR reader – chỉ tải khi cần, và luôn dùng CPU."""
    global _reader
    if _reader is None:
        logger.info("Đang tải mô hình EasyOCR (CPU)...")
        # Luôn dùng GPU=False để phù hợp với Render (không có GPU)
        _reader = easyocr.Reader(['vi', 'en'], gpu=False)
        logger.info("Đã tải xong mô hình EasyOCR.")
    return _reader

def xu_ly_anh(du_lieu_anh: bytes) -> np.ndarray:
    """Tiền xử lý ảnh trước khi nhận dạng."""
    anh = Image.open(io.BytesIO(du_lieu_anh))
    if anh.mode in ("RGBA", "P"):
        anh = anh.convert("RGB")
    w, h = anh.size
    if w < 600:
        anh = anh.resize((w * 2, h * 2), Image.LANCZOS)
    anh = anh.convert("L")
    anh = ImageEnhance.Contrast(anh).enhance(2.0)
    anh = anh.filter(ImageFilter.SHARPEN)
    anh = anh.filter(ImageFilter.SHARPEN)
    return np.array(anh)

def nhan_dien_bien_so(du_lieu_anh: bytes) -> str:
    """Nhận dạng biển số từ ảnh, trả về chuỗi biển số (VD: 59F1-12345)."""
    reader = _get_reader()  # Lazy load model nếu chưa có
    anh_numpy = xu_ly_anh(du_lieu_anh)
    ket_qua = reader.readtext(anh_numpy, detail=0)
    van_ban = " ".join(ket_qua).upper()
    van_ban_sach = re.sub(r'[^A-Z0-9]', '', van_ban)
    pattern = r'(\d{2})([A-Z]{1,2}\d?)(\d{4,5})'
    tim_thay = re.search(pattern, van_ban_sach)
    if tim_thay:
        phan1 = tim_thay.group(1)
        phan2 = tim_thay.group(2)
        phan3 = tim_thay.group(3)
        return f"{phan1}-{phan2}-{phan3}"
    return van_ban_sach if van_ban_sach else " | ".join(ket_qua)