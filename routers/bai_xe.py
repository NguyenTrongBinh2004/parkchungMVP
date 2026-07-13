# routers/bai_xe.py
import json
import mysql.connector
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from database import lay_ket_noi_CSDL
from services.auth_service import lay_nguoi_dung_hien_tai

router = APIRouter(prefix="/bai-xe", tags=["Bãi xe"])

# ── Danh sách tiện ích cố định (khớp với frontend) ────────────
TIEN_ICH_HOP_LE = {
    "mai_che", "camera_an_ninh", "bao_ve_24_7", "rua_xe",
    "sac_xe_dien", "wifi_mien_phi", "nha_ve_sinh", "cho_ngoi_cho",
}


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


# ── Helper ──────────────────────────────────────────────────────
def _lay_bai_xe_hien_tai(id_nguoi_dung: int, KetNoi) -> dict:
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM bai_xe WHERE id_chu_bai = %s LIMIT 1", (id_nguoi_dung,))
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

    for field in ("gio_mo_cua", "gio_dong_cua"):
        val = bai_xe.get(field)
        if val is not None:
            bai_xe[field] = str(val)[:5]  # "HH:MM:SS" -> "HH:MM"

    return bai_xe


# ── 1. Lấy thông tin bãi xe hiện tại ────────────────────────────
@router.get("/thong-tin/")
def lay_thong_tin(
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    return _lay_bai_xe_hien_tai(id_nguoi_dung, KetNoi)


# ── 2. Cập nhật thông tin bãi xe ────────────────────────────────
@router.put("/thong-tin/")
def cap_nhat_thong_tin(
    body: CapNhatThongTinBody,
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    bai_xe = _lay_bai_xe_hien_tai(id_nguoi_dung, KetNoi)

    du_lieu = body.model_dump(exclude_unset=True)
    if not du_lieu:
        raise HTTPException(422, "Không có dữ liệu để cập nhật")

    set_clauses = []
    values = []
    for key, val in du_lieu.items():
        if key in ("cac_ngay_hoat_dong", "tien_ich"):
            val = json.dumps(val, ensure_ascii=False)
        set_clauses.append(f"{key} = %s")
        values.append(val)

    values.append(bai_xe["id"])

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

    return _lay_bai_xe_hien_tai(id_nguoi_dung, KetNoi)


# ── 3. Lấy danh sách tiện ích hợp lệ (để frontend render checklist) ──
@router.get("/tien-ich-kha-dung/")
def lay_tien_ich_kha_dung():
    return {"tien_ich": sorted(TIEN_ICH_HOP_LE)}