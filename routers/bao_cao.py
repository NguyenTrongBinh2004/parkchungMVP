# routers/bao_cao.py
from fastapi import APIRouter, Depends, Query
from datetime import date, timedelta, datetime
from database import lay_ket_noi_CSDL

router = APIRouter(prefix="/bao-cao", tags=["Thống kê"])

@router.get("/thong-ke")
def thong_ke(
    loai: str = Query("hom_nay", description="hom_nay | ngay | tuan | thang"),
    ngay: date = Query(None, description="Chỉ dùng khi loai='ngay'"),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    # Xác định khoảng thời gian
    today = date.today()
    if loai == "hom_nay":
        tu_ngay = today
        den_ngay = today
    elif loai == "ngay":
        if not ngay:
            ngay = today
        tu_ngay = ngay
        den_ngay = ngay
    elif loai == "tuan":
        # 7 ngày gần nhất, kết thúc hôm qua
        den_ngay = today - timedelta(days=1)
        tu_ngay = den_ngay - timedelta(days=6)
    elif loai == "thang":
        # 30 ngày gần nhất
        den_ngay = today - timedelta(days=1)
        tu_ngay = den_ngay - timedelta(days=29)
    else:
        tu_ngay = today
        den_ngay = today

    tu_ngay_str = f"{tu_ngay} 00:00:00"
    den_ngay_str = f"{den_ngay} 23:59:59"

    with KetNoi.cursor(dictionary=True) as cur:
        # 1. Xe đã phục vụ (đã ra) và doanh thu
        cur.execute("""
            SELECT COUNT(*) AS so_luot, COALESCE(SUM(so_tien), 0) AS doanh_thu
            FROM phien_gui_xe
            WHERE gio_ra BETWEEN %s AND %s AND is_in_bai = 0
        """, (tu_ngay_str, den_ngay_str))
        xe_luot = cur.fetchone()

        # 2. Xe đang trong bãi
        cur.execute("SELECT COUNT(*) AS so_luong FROM phien_gui_xe WHERE is_in_bai = 1")
        dang_trong_bai = cur.fetchone()["so_luong"]

        # 3. Doanh thu vé tháng (cùng khoảng thời gian)
        cur.execute("""
            SELECT COALESCE(SUM(so_tien), 0) AS doanh_thu
            FROM lich_su_ve_thang
            WHERE ngay_thuc_hien BETWEEN %s AND %s
        """, (tu_ngay, den_ngay))
        ve_thang = cur.fetchone()["doanh_thu"]

        # 4. Chi tiết theo loại xe (chỉ xe lượt)
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