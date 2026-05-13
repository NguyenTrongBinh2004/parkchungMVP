import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import easyocr
import re
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import io

try:
    DocBienSo = easyocr.Reader(['vi', 'en'], gpu=True)
except Exception:
    DocBienSo = easyocr.Reader(['vi', 'en'], gpu=False)

def xu_ly_anh(du_lieu_anh: bytes) -> np.ndarray:
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
    anh_numpy = xu_ly_anh(du_lieu_anh)
    ket_qua = DocBienSo.readtext(anh_numpy, detail=0)
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