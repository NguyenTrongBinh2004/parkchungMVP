# routers/thanh_toan.py
import mysql.connector
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Form

from database import lay_ket_noi_CSDL
from models import PhanHoiXeRa, HinhThucThanhToan, KieuTinhGia
from services.billing_service import BillingService, _co_gia_rieng, cac_kieu_co_san
from services.auth_service import lay_nguoi_dung_hien_tai
from utils import bay_gio_vn

router = APIRouter(prefix="/thanh-toan", tags=["Thanh Toán"])


def _cap_nhat_xe_ra(
    phien: dict,
    KetNoi,
    bay_gio: datetime,
    httt: str | None,
    id_nguoi_dung: int,
    kieu_tinh_gia_override: Optional[str] = None,
):
    gio_vao = phien["gio_vao"]

    with KetNoi.cursor(dictionary=True) as cur:
        kieu_dung = None
        if phien.get("id_ve_thang"):
            so_tien = 0
        else:
            cur.execute("SELECT * FROM loai_xe WHERE id = %s", (phien["id_loai_xe"],))
            loai_xe = cur.fetchone()
            if not loai_xe:
                raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

            # Kiểm tra nếu xe không có giá riêng → lấy đồng giá nhóm
            nhom_gia = None
            if not _co_gia_rieng(loai_xe):
                cur.execute(
                    "SELECT * FROM nhom_xe_gia WHERE nhom_xe_id = %s",
                    (loai_xe["nhom_xe_id"],)
                )
                nhom_gia = cur.fetchone()

            # Xác định kiểu giá áp dụng: ưu tiên override > kiểu đã chọn lúc vào
            kieu_dung = kieu_tinh_gia_override or phien.get("kieu_tinh_gia_ap_dung")

            # Nếu vẫn chưa có (phiên cũ trước khi có tính năng này, hoặc chưa chọn) và
            # xe không dùng đồng giá nhóm → thử tự suy ra nếu chỉ có đúng 1 kiểu
            if not kieu_dung and not nhom_gia:
                cac_kieu = cac_kieu_co_san(loai_xe)
                if len(cac_kieu) == 1:
                    kieu_dung = cac_kieu[0]
                elif len(cac_kieu) > 1:
                    raise HTTPException(
                        status_code=422,
                        detail="Loại xe này có nhiều kiểu tính giá. Vui lòng chọn kiểu giá áp dụng trước khi thanh toán."
                    )

            so_tien = BillingService.tinh_tien_chi_tiet(
                loai_xe, gio_vao, bay_gio, nhom_gia=nhom_gia, kieu_ap_dung=kieu_dung
            )

        so_phut = int((bay_gio - gio_vao).total_seconds() / 60)

        cur.execute(
            """
            UPDATE phien_gui_xe
               SET gio_ra               = %s,
                   so_tien              = %s,
                   hinh_thuc_thanh_toan = %s,
                   da_thu_tien          = 1,
                   is_in_bai            = 0,
                   id_nguoi_ra          = %s,
                   kieu_tinh_gia_ap_dung = COALESCE(%s, kieu_tinh_gia_ap_dung)
             WHERE id = %s
            """,
            (bay_gio, so_tien, httt, id_nguoi_dung, kieu_dung, phien["id"]),
        )
        KetNoi.commit()

    return so_tien, so_phut, gio_vao


# ── Thanh toán qua mã QR ───────────────────────────────────────
@router.post("/xac-nhan-qr/{ma_qr}", response_model=PhanHoiXeRa)
def thanh_toan_xac_nhan_qr(
    ma_qr: str,
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    kieu_tinh_gia: Optional[KieuTinhGia] = Form(None),
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
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
        kieu_override = kieu_tinh_gia.value if kieu_tinh_gia else None
        so_tien, so_phut, gio_vao = _cap_nhat_xe_ra(phien, KetNoi, bay_gio, httt, id_nguoi_dung, kieu_override)

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
    kieu_tinh_gia: Optional[KieuTinhGia] = Form(None),
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
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
        kieu_override = kieu_tinh_gia.value if kieu_tinh_gia else None
        so_tien, so_phut, gio_vao = _cap_nhat_xe_ra(phien, KetNoi, bay_gio, httt, id_nguoi_dung, kieu_override)

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