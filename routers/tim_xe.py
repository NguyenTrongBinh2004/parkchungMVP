# routers/tim_xe.py
from fastapi import APIRouter, Depends, Query
from typing import Optional

from database import lay_ket_noi_CSDL
from utils import chuan_hoa_bien_so, build_url

router = APIRouter(prefix="/tim-xe", tags=["Tìm xe"])

MIN_DO_DAI_TIM = 2  # tránh quét toàn bảng khi mới gõ 1 ký tự


@router.get("/")
def tim_xe(
    bien_so: str = Query(..., description="Biển số đầy đủ hoặc một phần"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    cleaned = chuan_hoa_bien_so(bien_so)

    if len(cleaned) < MIN_DO_DAI_TIM:
        return {"total": 0, "page": page, "limit": limit, "items": []}

    pattern = f"%{cleaned}%"
    offset = (page - 1) * limit

    with KetNoi.cursor(dictionary=True) as ConTro:
        # Tổng số biển số khác nhau khớp tìm kiếm (để phân trang)
        ConTro.execute(
            """
            SELECT COUNT(DISTINCT bien_so) AS tong
            FROM phien_gui_xe
            WHERE REPLACE(REPLACE(REPLACE(bien_so, '-', ''), '.', ''), ' ', '') LIKE %s
            """,
            (pattern,),
        )
        tong = ConTro.fetchone()["tong"]

        # Lấy phiên gần nhất (gio_vao lớn nhất) cho mỗi biển số khớp
        ConTro.execute(
            """
            SELECT p.id, p.ma_phien, p.bien_so, p.duoi_bien_so,
                   p.gio_vao, p.gio_ra, p.so_tien, p.hinh_thuc_thanh_toan,
                   p.is_in_bai, p.id_ve_thang, p.ghi_chu,
                   p.duong_dan_anh_bien_so, p.duong_dan_anh_nguoi_lai,
                   l.ten AS ten_loai_xe,
                   k.ten AS ten_chu_xe, k.sdt
            FROM (
                SELECT *,
                       ROW_NUMBER() OVER (
                           PARTITION BY bien_so ORDER BY gio_vao DESC
                       ) AS rn
                FROM phien_gui_xe
                WHERE REPLACE(REPLACE(REPLACE(bien_so, '-', ''), '.', ''), ' ', '') LIKE %s
            ) p
            JOIN loai_xe l ON p.id_loai_xe = l.id
            LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
            WHERE p.rn = 1
            ORDER BY p.gio_vao DESC
            LIMIT %s OFFSET %s
            """,
            (pattern, limit, offset),
        )
        rows = ConTro.fetchall()

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "ma_phien": r["ma_phien"],
            "bien_so": r["bien_so"],
            "ten_loai_xe": r["ten_loai_xe"],
            "ten_chu_xe": r.get("ten_chu_xe"),
            "sdt": r.get("sdt"),
            "gio_vao": str(r["gio_vao"]) if r["gio_vao"] else None,
            "gio_ra": str(r["gio_ra"]) if r["gio_ra"] else None,
            "so_tien": float(r["so_tien"]) if r["so_tien"] is not None else None,
            "hinh_thuc_thanh_toan": r.get("hinh_thuc_thanh_toan"),
            "dang_trong_bai": bool(r["is_in_bai"]),
            "la_ve_thang": r["id_ve_thang"] is not None,
            "ghi_chu": r.get("ghi_chu"),
            "anh_bien_so": build_url(r.get("duong_dan_anh_bien_so")),
            "anh_nguoi_lai": build_url(r.get("duong_dan_anh_nguoi_lai")),
        })

    return {"total": tong, "page": page, "limit": limit, "items": items}