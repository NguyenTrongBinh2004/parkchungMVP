# routers/xe_ra.py
import mysql.connector
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File

from database import lay_ket_noi_CSDL
from services.qr_service import doc_ma_qr
from services.ocr import nhan_dien_bien_so
from services.billing_service import BillingService
from utils import bay_gio_vn, build_url, chuan_hoa_bien_so

router = APIRouter(prefix="/xe-ra", tags=["Quản lý Xe Ra"])


# ── Helper: tra cứu phiên qua mã QR ───────────────────────────
def _tra_cuu_qr(ma_qr: str, KetNoi):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            """
            SELECT p.*, k.ten AS ten_chu_xe, k.sdt, k.email, k.cho_phep_lay_ho
              FROM phien_gui_xe p
              LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
             WHERE p.ma_qr = %s AND p.is_in_bai = 1
            """,
            (ma_qr,),
        )
        phien = cur.fetchone()
    if not phien:
        raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc xe đã ra.")
    return phien


def _so_tien_tam(phien: dict, KetNoi, bay_gio) -> int:
    if phien.get("id_ve_thang"):
        return 0
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM loai_xe WHERE id = %s", (phien["id_loai_xe"],))
        return BillingService.tinh_tien_chi_tiet(cur.fetchone(), phien["gio_vao"], bay_gio)


# ── 1. Nhận diện thông minh (QR ưu tiên → OCR) ────────────────
@router.post("/nhan-dien/")
async def nhan_dien_xe_ra(
    anh: UploadFile = File(...),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    du_lieu_anh = await anh.read()
    await anh.seek(0)

    # Thử đọc QR trước
    try:
        du_lieu_qr = doc_ma_qr(du_lieu_anh)
        ma_qr = du_lieu_qr.get("ma_qr")
        if ma_qr:
            phien = _tra_cuu_qr(ma_qr, KetNoi)
            bay_gio = bay_gio_vn()
            so_phut = int((bay_gio - phien["gio_vao"]).total_seconds() / 60)
            return {
                "loai": "qr",
                "ma_qr": ma_qr,
                "la_xe_ve_thang": bool(phien.get("id_ve_thang")),
                "ma_phien": phien["ma_phien"],
                "bien_so": phien["bien_so"],
                "ten_chu_xe": phien.get("ten_chu_xe"),
                "sdt": phien.get("sdt"),
                "email": phien.get("email"),
                "cho_phep_lay_ho": bool(phien.get("cho_phep_lay_ho")),
                "gio_vao": str(phien["gio_vao"]),
                "thoi_gian_gui_phut": so_phut,
                "so_tien_tam_tinh": _so_tien_tam(phien, KetNoi, bay_gio),
                "anh_bien_so": build_url(phien.get("duong_dan_anh_bien_so")),
                "anh_nguoi_lai": build_url(phien.get("duong_dan_anh_nguoi_lai")),
                "ghi_chu": phien.get("ghi_chu") or "Kiểm tra thông tin và xác nhận cho xe ra.",
            }
    except HTTPException:
        raise
    except (ValueError, KeyError):
        pass  # Không đọc được QR → thử OCR

    # OCR biển số
    bien_so_ocr = nhan_dien_bien_so(du_lieu_anh)
    return {
        "loai": "bien_so",
        "bien_so_nhan_dien": bien_so_ocr or "",
        "ghi_chu": "Kiểm tra và sửa biển số nếu cần, sau đó gửi POST /xe-ra/bien-so/.",
    }


# ── 2. Quét QR (ảnh QR thuần) ─────────────────────────────────
@router.post("/quet-qr/")
async def quet_qr_xem_thong_tin(
    anh_qr: UploadFile = File(...),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    try:
        du_lieu_qr = doc_ma_qr(await anh_qr.read())
        ma_qr = du_lieu_qr.get("ma_qr")
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="Ảnh QR không hợp lệ hoặc không đọc được.")

    if not ma_qr:
        raise HTTPException(status_code=400, detail="Không tìm thấy mã QR trong ảnh.")

    phien = _tra_cuu_qr(ma_qr, KetNoi)
    bay_gio = bay_gio_vn()
    so_phut = int((bay_gio - phien["gio_vao"]).total_seconds() / 60)

    return {
        "ma_qr": ma_qr,
        "la_xe_ve_thang": bool(phien.get("id_ve_thang")),
        "ma_phien": phien["ma_phien"],
        "bien_so": phien["bien_so"],
        "ten_chu_xe": phien.get("ten_chu_xe"),
        "sdt": phien.get("sdt"),
        "cho_phep_lay_ho": bool(phien.get("cho_phep_lay_ho")),
        "gio_vao": str(phien["gio_vao"]),
        "thoi_gian_gui_phut": so_phut,
        "so_tien_tam_tinh": _so_tien_tam(phien, KetNoi, bay_gio),
        "anh_bien_so": build_url(phien.get("duong_dan_anh_bien_so")),
        "anh_nguoi_lai": build_url(phien.get("duong_dan_anh_nguoi_lai")),
        "ghi_chu": phien.get("ghi_chu"),
    }


# ── 3. Tìm theo biển số ────────────────────────────────────────
@router.post("/bien-so/")
def kiem_tra_xe_ra_bien_so(
    bien_so: str = Form(...),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    bien_so_sach = chuan_hoa_bien_so(bien_so)
    if len(bien_so_sach) < 3:
        raise HTTPException(status_code=400, detail="Vui lòng nhập ít nhất 3 ký tự.")

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            # Tìm chính xác
            cur.execute(
                """
                SELECT p.*, k.ten AS ten_chu_xe, k.sdt, k.cho_phep_lay_ho
                  FROM phien_gui_xe p
                  LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                 WHERE REPLACE(REPLACE(REPLACE(p.bien_so,'-',''),'.',''),' ','') = %s
                   AND p.is_in_bai = 1
                """,
                (bien_so_sach,),
            )
            danh_sach = cur.fetchall()

        la_tim_mo = False
        if not danh_sach:
            la_tim_mo = True
            duoi = __import__("re").sub(r"[^0-9]", "", bien_so_sach)[-5:]
            if len(duoi) < 4:
                raise HTTPException(
                    status_code=404,
                    detail="Vui lòng nhập ít nhất 4 số cuối để tìm kiếm.",
                )
            with KetNoi.cursor(dictionary=True) as cur:
                cur.execute(
                    """
                    SELECT p.*, k.ten AS ten_chu_xe, k.sdt, k.cho_phep_lay_ho
                      FROM phien_gui_xe p
                      LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                     WHERE p.duoi_bien_so LIKE %s AND p.is_in_bai = 1
                    """,
                    (f"%{duoi}",),
                )
                danh_sach = cur.fetchall()

        if not danh_sach:
            raise HTTPException(status_code=404, detail="Không tìm thấy xe trong bãi.")

        bay_gio = bay_gio_vn()

        if la_tim_mo or len(danh_sach) > 1:
            return {
                "nhieu_ket_qua": True,
                "danh_sach": [
                    {
                        "id": x["id"],
                        "ma_phien": x["ma_phien"],
                        "bien_so": x["bien_so"],
                        "ten_chu_xe": x.get("ten_chu_xe"),
                        "gio_vao": str(x["gio_vao"]),
                        "anh_bien_so": build_url(x.get("duong_dan_anh_bien_so")),
                        "so_tien_tam_tinh": _so_tien_tam(x, KetNoi, bay_gio),
                        "cho_phep_lay_ho": bool(x.get("cho_phep_lay_ho")),
                    }
                    for x in danh_sach
                ],
                "ghi_chu": "Vui lòng chọn đúng xe và gửi ID phiên để xác nhận ra.",
            }

        xe = danh_sach[0]
        so_phut = int((bay_gio - xe["gio_vao"]).total_seconds() / 60)

        return {
            "id": xe["id"],
            "ma_phien": xe["ma_phien"],
            "bien_so": xe["bien_so"],
            "ten_chu_xe": xe.get("ten_chu_xe"),
            "sdt": xe.get("sdt"),
            "cho_phep_lay_ho": bool(xe.get("cho_phep_lay_ho")),
            "gio_vao": str(xe["gio_vao"]),
            "thoi_gian_gui_phut": so_phut,
            "so_tien_tam_tinh": _so_tien_tam(xe, KetNoi, bay_gio),
            "anh_bien_so": build_url(xe.get("duong_dan_anh_bien_so")),
            "anh_nguoi_lai": build_url(xe.get("duong_dan_anh_nguoi_lai")),
            "ghi_chu": xe.get("ghi_chu"),
            "la_xe_ve_thang": bool(xe.get("id_ve_thang")),
        }

    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise