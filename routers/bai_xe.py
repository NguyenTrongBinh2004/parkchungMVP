# routers/bai_xe.py
import json
import re
import datetime
import mysql.connector
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from database import lay_ket_noi_CSDL
from services.auth_service import (
    lay_nguoi_dung_hien_tai,
    lay_id_bai_xe_hien_tai,      # <-- dùng dependency mới
    yeu_cau_admin                # <-- chặn nhân viên
)

router = APIRouter(prefix="/bai-xe", tags=["Bãi xe"])

# ── Danh sách tiện ích cố định (khớp với frontend) ────────────
TIEN_ICH_HOP_LE = {
    "mai_che", "camera_an_ninh", "bao_ve_24_7", "rua_xe",
    "sac_xe_dien", "wifi_mien_phi", "nha_ve_sinh", "cho_ngoi_cho",
}

# ── Regex kiểm tra giờ HH:MM ──────────────────────────────────
REGEX_GIO = re.compile(r'^([01]\d|2[0-3]):([0-5]\d)$')


# ── Helpers ─────────────────────────────────────────────────────
def _chuan_hoa_gio(gio: Optional[str]) -> Optional[str]:
    """Chuẩn hóa giờ từ HH:MM thành HH:MM:SS để lưu vào TIME column."""
    if gio is None or gio == "":
        return None
    gio = gio.strip()
    if not REGEX_GIO.match(gio):
        raise HTTPException(422, f"Định dạng giờ không hợp lệ: '{gio}' (cần dạng HH:MM)")
    return gio + ":00"


def _format_gio_tra_ve(val) -> Optional[str]:
    """Chuẩn hóa giá trị giờ đọc từ MySQL (timedelta hoặc string) về đúng 'HH:MM'."""
    if val is None:
        return None
    if isinstance(val, datetime.timedelta):
        tong_giay = int(val.total_seconds())
        gio = (tong_giay // 3600) % 24
        phut = (tong_giay % 3600) // 60
        return f"{gio:02d}:{phut:02d}"
    # Trường hợp driver trả về string (phòng hờ)
    parts = str(val).split(':')
    if len(parts) >= 2:
        try:
            return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
        except ValueError:
            return None
    return None


def _lay_bai_xe_hien_tai(id_bai_xe: int, KetNoi) -> dict:
    """Lấy thông tin bãi xe theo id (được lấy từ token, không cần id_nguoi_dung)."""
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM bai_xe WHERE id = %s LIMIT 1", (id_bai_xe,))
        bai_xe = cur.fetchone()
    if not bai_xe:
        raise HTTPException(404, "Không tìm thấy bãi xe")

    # Parse các cột JSON (driver có thể trả về string)
    for field in ("cac_ngay_hoat_dong", "tien_ich"):
        val = bai_xe.get(field)
        if isinstance(val, str):
            try:
                bai_xe[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                bai_xe[field] = []
        elif val is None:
            bai_xe[field] = []

    # Chuẩn hóa giờ mở/đóng cửa sang định dạng HH:MM
    for field in ("gio_mo_cua", "gio_dong_cua"):
        bai_xe[field] = _format_gio_tra_ve(bai_xe.get(field))

    return bai_xe


def kiem_tra_bai_xe_day_du(id_bai_xe: int, KetNoi) -> None:
    """Raise lỗi 400 nếu bãi xe chưa điền đủ: tên, địa chỉ, khung giờ, ngày hoạt động."""
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            "SELECT ten, dia_chi, gio_mo_cua, gio_dong_cua, cac_ngay_hoat_dong FROM bai_xe WHERE id = %s",
            (id_bai_xe,)
        )
        bx = cur.fetchone()

    if not bx:
        raise HTTPException(404, "Không tìm thấy bãi xe")

    thieu = []
    if not bx.get("ten"):
        thieu.append("Tên bãi xe")
    if not bx.get("dia_chi"):
        thieu.append("Địa chỉ")
    if not bx.get("gio_mo_cua") or not bx.get("gio_dong_cua"):
        thieu.append("Khung giờ hoạt động")

    ngay = bx.get("cac_ngay_hoat_dong")
    if isinstance(ngay, str):
        try:
            ngay = json.loads(ngay)
        except (json.JSONDecodeError, TypeError):
            ngay = []
    if not ngay:
        thieu.append("Ngày hoạt động")

    if thieu:
        raise HTTPException(
            400,
            f"Vui lòng hoàn thiện thông tin bãi xe trước khi tiếp tục: {', '.join(thieu)}."
        )


# ── Models ──────────────────────────────────────────────────────
class CapNhatThongTinBody(BaseModel):
    ten:                Optional[str]       = Field(None, min_length=2, max_length=100)
    dia_chi:            Optional[str]       = Field(None, max_length=255)
    mo_ta:              Optional[str]       = None
    gio_mo_cua:         Optional[str]       = None   # "HH:MM"
    gio_dong_cua:       Optional[str]       = None   # "HH:MM"
    cac_ngay_hoat_dong: Optional[List[int]] = None
    tien_ich:           Optional[List[str]] = None

    @field_validator("cac_ngay_hoat_dong")
    @classmethod
    def _validate_ngay(cls, v):
        if v is not None:
            if not all(1 <= n <= 7 for n in v):
                raise ValueError("Ngày hoạt động phải trong khoảng 1 (Thứ 2) đến 7 (Chủ nhật)")
        return v

    @field_validator("tien_ich")
    @classmethod
    def _validate_tien_ich(cls, v):
        if v is not None:
            khong_hop_le = set(v) - TIEN_ICH_HOP_LE
            if khong_hop_le:
                raise ValueError(f"Tiện ích không hợp lệ: {', '.join(khong_hop_le)}")
        return v


# ── 1. Lấy thông tin bãi xe hiện tại ────────────────────────────
@router.get("/thong-tin/")
def lay_thong_tin(
    id_bai_xe: int = Depends(lay_id_bai_xe_hien_tai),   # <-- đổi dependency
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    return _lay_bai_xe_hien_tai(id_bai_xe, KetNoi)


# ── 2. Cập nhật thông tin bãi xe ────────────────────────────────
@router.put("/thong-tin/")
def cap_nhat_thong_tin(
    body: CapNhatThongTinBody,
    id_bai_xe: int = Depends(lay_id_bai_xe_hien_tai),   # <-- đổi dependency
    _: str = Depends(yeu_cau_admin),                     # <-- chỉ admin mới được sửa
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    bai_xe = _lay_bai_xe_hien_tai(id_bai_xe, KetNoi)

    du_lieu = body.model_dump(exclude_unset=True)
    if not du_lieu:
        raise HTTPException(422, "Không có dữ liệu để cập nhật")

    # Chuẩn hóa giờ mở/đóng cửa nếu có
    if "gio_mo_cua" in du_lieu:
        du_lieu["gio_mo_cua"] = _chuan_hoa_gio(du_lieu["gio_mo_cua"])
    if "gio_dong_cua" in du_lieu:
        du_lieu["gio_dong_cua"] = _chuan_hoa_gio(du_lieu["gio_dong_cua"])

    set_clauses = []
    values = []
    for key, val in du_lieu.items():
        if key in ("cac_ngay_hoat_dong", "tien_ich"):
            val = json.dumps(val, ensure_ascii=False)
        set_clauses.append(f"{key} = %s")
        values.append(val)

    values.append(id_bai_xe)   # dùng trực tiếp id_bai_xe từ token

    try:
        with KetNoi.cursor() as cur:
            cur.execute(
                f"UPDATE bai_xe SET {', '.join(set_clauses)} WHERE id = %s",
                tuple(values),
            )
        KetNoi.commit()
    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(500, f"Lỗi CSDL: {err}")

    return _lay_bai_xe_hien_tai(id_bai_xe, KetNoi)


# ── 3. Lấy danh sách tiện ích hợp lệ (để frontend render checklist) ──
@router.get("/tien-ich-kha-dung/")
def lay_tien_ich_kha_dung():
    return {"tien_ich": sorted(TIEN_ICH_HOP_LE)}