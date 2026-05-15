# routers/thanh_toan.py
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Optional
from database import lay_ket_noi_CSDL
from models import PhanHoiXeRa, HinhThucThanhToan
from services.billing_service import BillingService
from datetime import datetime
from zoneinfo import ZoneInfo
import mysql.connector

router = APIRouter(prefix="/thanh-toan", tags=["Thanh Toán"])  # prefix đúng

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

def bay_gio_vn():
    return datetime.now(VN_TZ).replace(tzinfo=None)

def cap_nhat_xe_ra(Phien, KetNoi, bay_gio, httt):
    with KetNoi.cursor(dictionary=True) as ConTro:
        gio_vao = Phien["gio_vao"]
        if Phien.get("id_ve_thang"):
            so_tien = 0
        else:
            ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (Phien["id_loai_xe"],))
            loai_xe = ConTro.fetchone()
            so_tien = BillingService.tinh_tien_chi_tiet(loai_xe, gio_vao, bay_gio)
        so_phut = int((bay_gio - gio_vao).total_seconds() / 60)
        ConTro.execute("""
            UPDATE phien_gui_xe
            SET gio_ra=%s, so_tien=%s, hinh_thuc_thanh_toan=%s, da_thu_tien=1, is_in_bai=NULL
            WHERE id=%s
        """, (bay_gio, so_tien, httt, Phien["id"]))
        KetNoi.commit()
    return so_tien, so_phut, gio_vao

@router.post("/xac-nhan-qr/{ma_qr}", response_model=PhanHoiXeRa)
def thanh_toan_xac_nhan_qr(
    ma_qr: str,
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    bay_gio = bay_gio_vn()
    try:
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("""
                SELECT p.*, k.ten AS ten_chu_xe
                FROM phien_gui_xe p
                LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                WHERE p.ma_qr=%s AND p.is_in_bai = 1
            """, (ma_qr,))
            Phien = ConTro.fetchone()
        if not Phien:
            raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc xe đã ra.")
        if not Phien.get("id_ve_thang") and not hinh_thuc_thanh_toan:
            raise HTTPException(status_code=422, detail="Vui lòng chọn hình thức thanh toán.")

        httt = hinh_thuc_thanh_toan.value if hinh_thuc_thanh_toan else None
        so_tien, so_phut, gio_vao = cap_nhat_xe_ra(Phien, KetNoi, bay_gio, httt)
        return {
            "id": Phien["id"], "ma_phien": Phien["ma_phien"],
            "bien_so": Phien["bien_so"], "ten_chu_xe": Phien.get("ten_chu_xe"),
            "gio_vao": gio_vao, "gio_ra": bay_gio,
            "thoi_gian_gui_phut": so_phut, "so_tien": so_tien,
            "hinh_thuc_thanh_toan": hinh_thuc_thanh_toan
        }
    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise

@router.post("/xac-nhan-phi-ra/", response_model=PhanHoiXeRa)   # endpoint đúng
def xac_nhan_thanh_toan_bien_so(
    id_phien: int = Form(...),
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    bay_gio = bay_gio_vn()
    try:
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("""
                SELECT p.*, k.ten AS ten_chu_xe
                FROM phien_gui_xe p
                LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                WHERE p.id=%s AND p.is_in_bai = 1
            """, (id_phien,))
            Phien = ConTro.fetchone()

        if not Phien:
            raise HTTPException(status_code=404, detail="Phiên gửi xe không tồn tại hoặc đã kết thúc.")
        if not Phien.get("id_ve_thang") and not hinh_thuc_thanh_toan:
            raise HTTPException(status_code=422, detail="Vui lòng chọn hình thức thanh toán.")

        httt = hinh_thuc_thanh_toan.value if hinh_thuc_thanh_toan else None
        so_tien, so_phut, gio_vao = cap_nhat_xe_ra(Phien, KetNoi, bay_gio, httt)
        return {
            "id": Phien["id"], "ma_phien": Phien["ma_phien"],
            "bien_so": Phien["bien_so"], "ten_chu_xe": Phien.get("ten_chu_xe"),
            "gio_vao": gio_vao, "gio_ra": bay_gio,
            "thoi_gian_gui_phut": so_phut, "so_tien": so_tien,
            "hinh_thuc_thanh_toan": hinh_thuc_thanh_toan
        }
    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise# routers/thanh_toan.py
import mysql.connector
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Form

from database import lay_ket_noi_CSDL
from models import PhanHoiXeRa, HinhThucThanhToan
from services.billing_service import BillingService
from utils import bay_gio_vn

router = APIRouter(prefix="/thanh-toan", tags=["Thanh Toán"])


def _cap_nhat_xe_ra(phien: dict, KetNoi, bay_gio: datetime, httt: str | None):
    """
    Tính tiền + cập nhật phiên gửi xe thành 'đã ra'.
    Trả về (so_tien, so_phut, gio_vao).
    """
    gio_vao = phien["gio_vao"]

    with KetNoi.cursor(dictionary=True) as cur:
        if phien.get("id_ve_thang"):
            so_tien = 0
        else:
            cur.execute("SELECT * FROM loai_xe WHERE id = %s", (phien["id_loai_xe"],))
            loai_xe = cur.fetchone()
            so_tien = BillingService.tinh_tien_chi_tiet(loai_xe, gio_vao, bay_gio)

        so_phut = int((bay_gio - gio_vao).total_seconds() / 60)

        # ✅ is_in_bai = 0 (đã ra), không dùng NULL nữa
        cur.execute(
            """
            UPDATE phien_gui_xe
               SET gio_ra               = %s,
                   so_tien              = %s,
                   hinh_thuc_thanh_toan = %s,
                   da_thu_tien          = 1,
                   is_in_bai            = 0
             WHERE id = %s
            """,
            (bay_gio, so_tien, httt, phien["id"]),
        )
        KetNoi.commit()

    return so_tien, so_phut, gio_vao


# ── Thanh toán qua mã QR ───────────────────────────────────────
@router.post("/xac-nhan-qr/{ma_qr}", response_model=PhanHoiXeRa)
def thanh_toan_xac_nhan_qr(
    ma_qr: str,
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    bay_gio = bay_gio_vn()
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute(
                """
                SELECT p.*, k.ten AS ten_chu_xe
                  FROM phien_gui_xe p
                  LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                 WHERE p.ma_qr = %s AND p.is_in_bai = 1
                """,
                (ma_qr,),
            )
            phien = cur.fetchone()

        if not phien:
            raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc xe đã ra.")
        if not phien.get("id_ve_thang") and not hinh_thuc_thanh_toan:
            raise HTTPException(status_code=422, detail="Vui lòng chọn hình thức thanh toán.")

        httt = hinh_thuc_thanh_toan.value if hinh_thuc_thanh_toan else None
        so_tien, so_phut, gio_vao = _cap_nhat_xe_ra(phien, KetNoi, bay_gio, httt)

        return {
            "id": phien["id"],
            "ma_phien": phien["ma_phien"],
            "bien_so": phien["bien_so"],
            "ten_chu_xe": phien.get("ten_chu_xe"),
            "gio_vao": gio_vao,
            "gio_ra": bay_gio,
            "thoi_gian_gui_phut": so_phut,
            "so_tien": so_tien,
            "hinh_thuc_thanh_toan": hinh_thuc_thanh_toan,
        }

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise


# ── Thanh toán qua ID phiên (biển số) ─────────────────────────
@router.post("/xac-nhan-phi-ra/", response_model=PhanHoiXeRa)
def xac_nhan_thanh_toan_bien_so(
    id_phien: int = Form(...),
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    bay_gio = bay_gio_vn()
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute(
                """
                SELECT p.*, k.ten AS ten_chu_xe
                  FROM phien_gui_xe p
                  LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
                 WHERE p.id = %s AND p.is_in_bai = 1
                """,
                (id_phien,),
            )
            phien = cur.fetchone()

        if not phien:
            raise HTTPException(status_code=404, detail="Phiên không tồn tại hoặc đã kết thúc.")
        if not phien.get("id_ve_thang") and not hinh_thuc_thanh_toan:
            raise HTTPException(status_code=422, detail="Vui lòng chọn hình thức thanh toán.")

        httt = hinh_thuc_thanh_toan.value if hinh_thuc_thanh_toan else None
        so_tien, so_phut, gio_vao = _cap_nhat_xe_ra(phien, KetNoi, bay_gio, httt)

        return {
            "id": phien["id"],
            "ma_phien": phien["ma_phien"],
            "bien_so": phien["bien_so"],
            "ten_chu_xe": phien.get("ten_chu_xe"),
            "gio_vao": gio_vao,
            "gio_ra": bay_gio,
            "thoi_gian_gui_phut": so_phut,
            "so_tien": so_tien,
            "hinh_thuc_thanh_toan": hinh_thuc_thanh_toan,
        }

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise