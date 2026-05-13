# routers/xe_ra.py
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
import re, os
from database import lay_ket_noi_CSDL
from services.qr_service import doc_ma_qr
from services.ocr import nhan_dien_bien_so
from services.billing_service import BillingService
from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import Optional
import mysql.connector

router = APIRouter(prefix="/xe-ra", tags=["Quản lý Xe Ra"])
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
def chuan_hoa_bien_so(bien_so: str) -> str:
    """Loại bỏ tất cả ký tự không phải chữ cái hoặc số."""
    return re.sub(r'[^A-Z0-9]', '', bien_so.upper().strip())

def bay_gio_vn():
    return datetime.now(VN_TZ).replace(tzinfo=None)

def build_url(path: str | None) -> str | None:
    return f"{os.getenv('BASE_URL', 'http://localhost:8000')}/{path}" if path else None

# ── Helper dùng chung: tra cứu phiên theo QR, trả về dict thông tin xe (chưa tính tiền) ──
def _tra_cuu_qr(ma_qr: str, KetNoi):
    with KetNoi.cursor(dictionary=True) as ConTro:
        ConTro.execute("""
            SELECT p.*, 
                   k.ten AS ten_chu_xe, 
                   k.sdt, 
                   k.email, 
                   k.cho_phep_lay_ho
            FROM phien_gui_xe p
            LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
            WHERE p.ma_qr=%s AND p.is_in_bai = 1
        """, (ma_qr,))
        phien = ConTro.fetchone()
    if not phien:
        raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc xe đã ra.")
    return phien

# ───────────────────────────────────────────
# NHẬN DIỆN XE RA (QR + OCR) – thông minh
# ───────────────────────────────────────────
@router.post("/nhan-dien/")
async def nhan_dien_xe_ra(
    anh: UploadFile = File(...),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    du_lieu_anh = await anh.read()
    await anh.seek(0)

    # ── 1. Thử đọc QR trước ──
    try:
        du_lieu_qr = doc_ma_qr(du_lieu_anh)
        ma_qr = du_lieu_qr.get("ma_qr")
        if ma_qr:
            Phien = _tra_cuu_qr(ma_qr, KetNoi)

            bay_gio = bay_gio_vn()
            so_phut = int((bay_gio - Phien["gio_vao"]).total_seconds() / 60)

            if Phien.get("id_ve_thang"):
                so_tien_tam = 0
            else:
                with KetNoi.cursor(dictionary=True) as ConTro:
                    ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (Phien["id_loai_xe"],))
                    so_tien_tam = BillingService.tinh_tien_chi_tiet(
                        ConTro.fetchone(), Phien["gio_vao"], bay_gio
                    )

            return {
                "loai": "qr",
                "ma_qr": ma_qr,
                "la_xe_ve_thang": bool(Phien.get("id_ve_thang")),
                "ma_phien": Phien["ma_phien"],
                "bien_so": Phien["bien_so"],
                "ten_chu_xe": Phien.get("ten_chu_xe"),
                "sdt": Phien.get("sdt"),
                "email": Phien.get("email"),
                "cho_phep_lay_ho": bool(Phien.get("cho_phep_lay_ho")),  # thêm
                "gio_vao": str(Phien["gio_vao"]),
                "thoi_gian_gui_phut": so_phut,
                "so_tien_tam_tinh": so_tien_tam,
                "anh_bien_so":  build_url(Phien.get("duong_dan_anh_bien_so")),
                "anh_nguoi_lai": build_url(Phien.get("duong_dan_anh_nguoi_lai")),
                "ghi_chu": Phien.get("ghi_chu") or "Kiểm tra thông tin và xác nhận cho xe ra."  # lấy từ DB
            }
    except HTTPException:
        raise
    except (ValueError, KeyError):
        pass  # Không đọc được QR → chạy tiếp OCR

    # ── 2. Không có QR → OCR biển số ──
    bien_so_ocr = nhan_dien_bien_so(du_lieu_anh)
    return {
        "loai": "bien_so",
        "bien_so_nhan_dien": bien_so_ocr or "",
        "ghi_chu": "Kiểm tra và sửa biển số nếu cần, sau đó gửi POST /xe-ra/bien-so/ để tìm xe."
    }


# ───────────────────────────────────────────
# QUÉT QR (thủ công) – chỉ nhận ảnh QR
# ───────────────────────────────────────────
@router.post("/quet-qr/")
async def quet_qr_xem_thong_tin(
    anh_qr: UploadFile = File(...),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    try:
        du_lieu_qr = doc_ma_qr(await anh_qr.read())
        ma_qr = du_lieu_qr.get("ma_qr")
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="Ảnh QR không hợp lệ hoặc không đọc được.")

    if not ma_qr:
        raise HTTPException(status_code=400, detail="Không tìm thấy mã QR trong ảnh.")

    Phien = _tra_cuu_qr(ma_qr, KetNoi)

    bay_gio = bay_gio_vn()
    so_phut = int((bay_gio - Phien["gio_vao"]).total_seconds() / 60)

    if Phien.get("id_ve_thang"):
        so_tien_tam = 0
    else:
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (Phien["id_loai_xe"],))
            loai_xe = ConTro.fetchone()
        so_tien_tam = BillingService.tinh_tien_chi_tiet(loai_xe, Phien["gio_vao"], bay_gio)

    return {
        "ma_qr": ma_qr,
        "la_xe_ve_thang": bool(Phien.get("id_ve_thang")),
        "ma_phien": Phien["ma_phien"],
        "bien_so": Phien["bien_so"],
        "ten_chu_xe": Phien.get("ten_chu_xe"),
        "sdt": Phien.get("sdt"),
        "cho_phep_lay_ho": bool(Phien.get("cho_phep_lay_ho")),  # thêm
        "gio_vao": str(Phien["gio_vao"]),
        "thoi_gian_gui_phut": so_phut,
        "so_tien_tam_tinh": so_tien_tam,
        "anh_bien_so": build_url(Phien.get("duong_dan_anh_bien_so")),
        "anh_nguoi_lai": build_url(Phien.get("duong_dan_anh_nguoi_lai")),
        "ghi_chu": Phien.get("ghi_chu")  # thêm
    }


# ───────────────────────────────────────────
# TÌM KIẾM BẰNG BIỂN SỐ
# ───────────────────────────────────────────
@router.post("/bien-so/")
def kiem_tra_xe_ra_bien_so(
    bien_so: str = Form(...),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    # Chuẩn hóa biển số đầu vào (chỉ giữ chữ và số)
    bien_so_sach = chuan_hoa_bien_so(bien_so)
    if len(bien_so_sach) < 3:
        raise HTTPException(status_code=400, detail="Vui lòng nhập ít nhất 3 ký tự.")

    try:
        with KetNoi.cursor(dictionary=True) as ConTro:
            # 1. Tìm chính xác bằng biển số đã chuẩn hóa (loại bỏ dấu trong DB)
            ConTro.execute("""
                SELECT p.*, 
                    k.ten AS ten_chu_xe, 
                    k.sdt, 
                    k.cho_phep_lay_ho
                FROM phien_gui_xe p
                LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                WHERE REPLACE(REPLACE(REPLACE(p.bien_so, '-', ''), '.', ''), ' ', '') = %s
                  AND p.is_in_bai = 1
            """, (bien_so_sach,))
            DanhSach = ConTro.fetchall()

        la_tim_mo = False
        if not DanhSach:
            la_tim_mo = True
            # Lấy 5 số cuối của chuỗi chuẩn hóa (chỉ số)
            duoi = re.sub(r'[^0-9]', '', bien_so_sach)[-5:]
            if len(duoi) < 4:
                raise HTTPException(status_code=404, detail="Vui lòng nhập ít nhất 4 số cuối để tìm kiếm.")
            with KetNoi.cursor(dictionary=True) as ConTro:
                ConTro.execute("""
                    SELECT p.*, 
                        k.ten AS ten_chu_xe, 
                        k.sdt, 
                        k.cho_phep_lay_ho
                    FROM phien_gui_xe p
                    LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                    WHERE p.duoi_bien_so LIKE %s AND p.is_in_bai = 1
                """, (f"%{duoi}",))
                DanhSach = ConTro.fetchall()

        if not DanhSach:
            raise HTTPException(status_code=404, detail="Không tìm thấy xe trong bãi.")

        # Phần xử lý nhiều xe / một xe giữ nguyên như cũ (chỉ cần thay đổi biến `xe` nếu cần)
        if la_tim_mo or len(DanhSach) > 1:
            bay_gio_tmp = bay_gio_vn()
            danh_sach_ket_qua = []
            for x in DanhSach:
                if x.get("id_ve_thang"):
                    so_tien_tam = 0
                else:
                    with KetNoi.cursor(dictionary=True) as ConTro:
                        ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (x["id_loai_xe"],))
                        loai_xe = ConTro.fetchone()
                    so_tien_tam = BillingService.tinh_tien_chi_tiet(loai_xe, x["gio_vao"], bay_gio_tmp)
                danh_sach_ket_qua.append({
                    "id": x["id"],
                    "ma_phien": x["ma_phien"],
                    "bien_so": x["bien_so"],
                    "ten_chu_xe": x.get("ten_chu_xe"),
                    "gio_vao": str(x["gio_vao"]),
                    "anh_bien_so": build_url(x.get("duong_dan_anh_bien_so")),
                    "so_tien_tam_tinh": so_tien_tam,
                    "cho_phep_lay_ho": bool(x.get("cho_phep_lay_ho")),
                })
            return {
                "nhieu_ket_qua": True,
                "danh_sach": danh_sach_ket_qua,
                "ghi_chu": "Vui lòng chọn đúng xe và gửi ID phiên để xác nhận ra."
            }

        xe = DanhSach[0]
        bay_gio = bay_gio_vn()
        so_phut = int((bay_gio - xe["gio_vao"]).total_seconds() / 60)

        if xe.get("id_ve_thang"):
            so_tien_tam = 0
        else:
            with KetNoi.cursor(dictionary=True) as ConTro:
                ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (xe["id_loai_xe"],))
                loai_xe = ConTro.fetchone()
            so_tien_tam = BillingService.tinh_tien_chi_tiet(loai_xe, xe["gio_vao"], bay_gio)

        return {
            "id": xe["id"], "ma_phien": xe["ma_phien"], "bien_so": xe["bien_so"],
            "ten_chu_xe": xe.get("ten_chu_xe"), "sdt": xe.get("sdt"),
            "cho_phep_lay_ho": bool(xe.get("cho_phep_lay_ho")),
            "gio_vao": str(xe["gio_vao"]), "thoi_gian_gui_phut": so_phut,
            "so_tien_tam_tinh": so_tien_tam,
            "anh_bien_so": build_url(xe.get("duong_dan_anh_bien_so")),
            "anh_nguoi_lai": build_url(xe.get("duong_dan_anh_nguoi_lai")),
            "ghi_chu": xe.get("ghi_chu"),
            "la_xe_ve_thang": bool(xe.get("id_ve_thang"))
        }
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise