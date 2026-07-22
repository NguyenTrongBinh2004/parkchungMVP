# routers/bao_cao.py
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date, timedelta, datetime
from database import lay_ket_noi_CSDL
from services.auth_service import lay_nguoi_dung_hien_tai, yeu_cau_admin

router = APIRouter(prefix="/bao-cao", tags=["Thống kê"])


@router.get("/nhan-vien-list")
def danh_sach_nhan_vien_thong_ke(
    _: str = Depends(yeu_cau_admin),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    """Danh sách nhân viên + admin để lọc thống kê (chỉ admin xem được)."""
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id, sdt, ho_ten, vai_tro FROM nguoi_dung ORDER BY vai_tro, ho_ten")
        return cur.fetchall()


@router.get("/thong-ke")
def thong_ke(
    loai: str = Query("hom_nay", description="hom_nay | ngay | tuan | thang"),
    ngay: date = Query(None, description="Chỉ dùng khi loai='ngay'"),
    id_nhan_vien: Optional[int] = Query(None, description="Lọc theo người xử lý"),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    today = date.today()
    if loai == "hom_nay":
        tu_ngay = today
        den_ngay = today
    elif loai == "hom_qua":
        tu_ngay = today - timedelta(days=1)
        den_ngay = today - timedelta(days=1)
    elif loai == "ngay":
        if not ngay:
            ngay = today
        tu_ngay = ngay
        den_ngay = ngay
    elif loai == "tuan":
        den_ngay = today - timedelta(days=1)
        tu_ngay = den_ngay - timedelta(days=6)
    elif loai == "thang":
        den_ngay = today - timedelta(days=1)
        tu_ngay = den_ngay - timedelta(days=29)
    else:
        tu_ngay = today
        den_ngay = today

    tu_ngay_str = f"{tu_ngay} 00:00:00"
    den_ngay_str = f"{den_ngay} 23:59:59"

    with KetNoi.cursor(dictionary=True) as cur:
        # 1. Xe đã phục vụ (đã ra) và doanh thu — lọc theo người thu tiền nếu có
        if id_nhan_vien:
            cur.execute("""
                SELECT COUNT(*) AS so_luot, COALESCE(SUM(so_tien), 0) AS doanh_thu
                FROM phien_gui_xe
                WHERE gio_ra BETWEEN %s AND %s AND is_in_bai = 0 AND id_nguoi_ra = %s
            """, (tu_ngay_str, den_ngay_str, id_nhan_vien))
        else:
            cur.execute("""
                SELECT COUNT(*) AS so_luot, COALESCE(SUM(so_tien), 0) AS doanh_thu
                FROM phien_gui_xe
                WHERE gio_ra BETWEEN %s AND %s AND is_in_bai = 0
            """, (tu_ngay_str, den_ngay_str))
        xe_luot = cur.fetchone()

        # 2. Xe đang trong bãi (không lọc theo nhân viên — số liệu vận hành hiện tại)
        cur.execute("SELECT COUNT(*) AS so_luong FROM phien_gui_xe WHERE is_in_bai = 1")
        dang_trong_bai = cur.fetchone()["so_luong"]

        # 3. Doanh thu vé tháng — lọc theo người thực hiện nếu có
        if id_nhan_vien:
            cur.execute("""
                SELECT COALESCE(SUM(so_tien), 0) AS doanh_thu
                FROM lich_su_ve_thang
                WHERE ngay_thuc_hien BETWEEN %s AND %s AND id_nguoi_thuc_hien = %s
            """, (tu_ngay, den_ngay, id_nhan_vien))
        else:
            cur.execute("""
                SELECT COALESCE(SUM(so_tien), 0) AS doanh_thu
                FROM lich_su_ve_thang
                WHERE ngay_thuc_hien BETWEEN %s AND %s
            """, (tu_ngay, den_ngay))
        ve_thang = cur.fetchone()["doanh_thu"]

        # 4. Chi tiết theo loại xe (chỉ xe lượt) — lọc theo nhân viên nếu có
        if id_nhan_vien:
            cur.execute("""
                SELECT l.ten AS ten_loai_xe, COUNT(*) AS so_luot, COALESCE(SUM(p.so_tien), 0) AS doanh_thu
                FROM phien_gui_xe p
                JOIN loai_xe l ON p.id_loai_xe = l.id
                WHERE p.gio_ra BETWEEN %s AND %s AND p.is_in_bai = 0 AND p.id_nguoi_ra = %s
                GROUP BY l.ten
                ORDER BY doanh_thu DESC
            """, (tu_ngay_str, den_ngay_str, id_nhan_vien))
        else:
            cur.execute("""
                SELECT l.ten AS ten_loai_xe, COUNT(*) AS so_luot, COALESCE(SUM(p.so_tien), 0) AS doanh_thu
                FROM phien_gui_xe p
                JOIN loai_xe l ON p.id_loai_xe = l.id
                WHERE p.gio_ra BETWEEN %s AND %s AND p.is_in_bai = 0
                GROUP BY l.ten
                ORDER BY doanh_thu DESC
            """, (tu_ngay_str, den_ngay_str))
        chi_tiet = cur.fetchall()

    return {
        "loai": loai,
        "tu_ngay": str(tu_ngay),
        "den_ngay": str(den_ngay),
        "id_nhan_vien": id_nhan_vien,
        "tong_xe_da_phuc_vu": xe_luot["so_luot"],
        "xe_dang_trong_bai": dang_trong_bai,
        "doanh_thu_xe_luot": float(xe_luot["doanh_thu"]),
        "doanh_thu_ve_thang": float(ve_thang),
        "tong_doanh_thu": float(xe_luot["doanh_thu"]) + float(ve_thang),
        "chi_tiet_loai_xe": [
            {"ten_loai_xe": r["ten_loai_xe"], "so_luot": r["so_luot"], "doanh_thu": float(r["doanh_thu"])}
            for r in chi_tiet
        ],
    }