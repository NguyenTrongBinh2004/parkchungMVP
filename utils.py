"""
utils.py — Tập trung các hàm dùng chung
Các file khác import từ đây thay vì tự định nghĩa lại.
"""
import re
import os
import uuid
from datetime import datetime, date
from zoneinfo import ZoneInfo

import aiofiles
from fastapi import UploadFile, HTTPException

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

MAX_IMAGE_SIZE = 10 * 1024 * 1024          # 10 MB
_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


# ── Thời gian ──────────────────────────────────────────────────
def bay_gio_vn() -> datetime:
    """Giờ hiện tại theo múi giờ Việt Nam (không có tzinfo, để lưu DB)."""
    return datetime.now(VN_TZ).replace(tzinfo=None)


# ── URL ────────────────────────────────────────────────────────
def build_url(path: str | None) -> str | None:
    """Ghép BASE_URL với đường dẫn tương đối. Trả None nếu path rỗng."""
    return f"{BASE_URL}/{path}" if path else None


# ── Biển số ────────────────────────────────────────────────────
def chuan_hoa_bien_so(bien_so: str) -> str:
    """Chỉ giữ lại chữ hoa và số: '51F-12 345' → '51F12345'."""
    return re.sub(r"[^A-Z0-9]", "", bien_so.upper().strip())


# ── Trạng thái vé tháng ────────────────────────────────────────
def tinh_trang_thai(ngay_het_han: date) -> str:
    con_lai = (ngay_het_han - date.today()).days
    if con_lai < 0:
        return "het_han"
    if con_lai <= 7:
        return "sap_het"
    return "con_han"


# ── File upload ────────────────────────────────────────────────
def _safe_ext(filename: str | None) -> str:
    """Trả về extension hợp lệ, mặc định '.jpg' nếu không hợp lệ."""
    ext = os.path.splitext(filename or "")[1].lower()
    return ext if ext in _ALLOWED_EXT else ".jpg"


async def luu_anh(file: UploadFile, thu_muc: str) -> str:
    """
    Lưu file ảnh upload vào thu_muc.
    - Giới hạn kích thước 10 MB.
    - Dùng UUID làm tên file để chặn path traversal.
    - Trả về đường dẫn tương đối (dùng được với build_url).
    """
    os.makedirs(thu_muc, exist_ok=True)
    du_lieu = await file.read(MAX_IMAGE_SIZE + 1)
    if len(du_lieu) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Ảnh quá lớn (tối đa 10 MB).")

    # Chỉ giữ extension, KHÔNG dùng file.filename để tránh path traversal
    ten_file = f"{uuid.uuid4().hex}{_safe_ext(file.filename)}"
    duong_dan = os.path.join(thu_muc, ten_file)

    async with aiofiles.open(duong_dan, "wb") as f:
        await f.write(du_lieu)

    return duong_dan.replace("\\", "/")