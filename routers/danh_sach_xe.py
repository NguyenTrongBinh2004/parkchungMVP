# routers/danh_sach_xe.py
from fastapi import APIRouter, Depends, Query
from datetime import date
import json
from database import lay_ket_noi_CSDL
from services.billing_service import BillingService
from utils import bay_gio_vn, build_url

router = APIRouter(prefix="/danh-sach-xe", tags=["Danh sách xe"])

@router.get("/trong-bai")
def xe_trong_bai(KetNoi=Depends(lay_ket_noi_CSDL)):
    bay_gio = bay_gio_vn()
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT p.id, p.ma_phien, p.bien_so, p.gio_vao, p.id_ve_thang,
                   p.duong_dan_anh_bien_so, p.duong_dan_anh_nguoi_lai,
                   k.ten AS ten_chu_xe,
                   l.*
              FROM phien_gui_xe p
              JOIN loai_xe l ON p.id_loai_xe = l.id
              LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
             WHERE p.is_in_bai = 1
             ORDER BY p.gio_vao DESC
        """)
        danh_sach = cur.fetchall()

    ket_qua = []
    for xe in danh_sach:
        try:
            if xe.get("id_ve_thang"):
                so_tien = 0
            else:
                co_gia_rieng = False
                if xe.get("kieu_tinh_gia") == "theo_luot":
                    if (xe.get("gia_luot") or 0) > 0:
                        co_gia_rieng = True
                elif xe.get("kieu_tinh_gia") == "theo_gio":
                    cfg = xe.get("cau_hinh_theo_gio")
                    if cfg:
                        if isinstance(cfg, str):
                            try:
                                cfg = json.loads(cfg)
                            except:
                                cfg = []
                        if isinstance(cfg, list) and len(cfg) > 0:
                            for b in cfg:
                                if (b.get("gia") or 0) > 0 or (b.get("moi_gio_tiep") or 0) > 0:
                                    co_gia_rieng = True
                                    break
                elif xe.get("kieu_tinh_gia") == "theo_ngay_dem":
                    if any([
                        (xe.get("gia_ngay") or 0) > 0,
                        (xe.get("gia_dem") or 0) > 0,
                        (xe.get("gia_ngay_dem") or 0) > 0,
                    ]):
                        co_gia_rieng = True

                nhom_gia = None
                if not co_gia_rieng:
                    with KetNoi.cursor(dictionary=True) as cur2:
                        cur2.execute(
                            "SELECT * FROM nhom_xe_gia WHERE nhom_xe_id = %s",
                            (xe["nhom_xe_id"],)
                        )
                        nhom_gia = cur2.fetchone()

                so_tien = BillingService.tinh_tien_chi_tiet(
                    xe, xe["gio_vao"], bay_gio, nhom_gia=nhom_gia
                )
        except Exception as e:
            so_tien = 0
            print(f"Lỗi tính tiền xe id={xe.get('id')}: {e}")

        ket_qua.append({
            "id": xe["id"],
            "ma_phien": xe["ma_phien"],
            "bien_so": xe["bien_so"],
            "ten_loai_xe": xe.get("ten", ""),
            "ten_chu_xe": xe.get("ten_chu_xe"),
            "gio_vao": str(xe["gio_vao"]),
            "so_tien_tam_tinh": so_tien,
            "la_xe_ve_thang": bool(xe.get("id_ve_thang")),
            "anh_bien_so": build_url(xe.get("duong_dan_anh_bien_so")),
            "anh_nguoi_lai": build_url(xe.get("duong_dan_anh_nguoi_lai")),
        })
    return ket_qua


@router.get("/da-ra")
def xe_da_ra(
    ngay: date = Query(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    if not ngay:
        ngay = date.today()
    tu_str = f"{ngay} 00:00:00"
    den_str = f"{ngay} 23:59:59"

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT p.id, p.ma_phien, p.bien_so, p.gio_vao, p.gio_ra, p.so_tien,
                   p.id_ve_thang, p.duong_dan_anh_bien_so, p.duong_dan_anh_nguoi_lai,
                   k.ten AS ten_chu_xe, l.ten AS ten_loai_xe, l.mau_sac
            FROM phien_gui_xe p
            JOIN loai_xe l ON p.id_loai_xe = l.id
            LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
            WHERE p.is_in_bai = 0 AND p.gio_ra BETWEEN %s AND %s
            ORDER BY p.gio_ra DESC
            LIMIT 200
        """, (tu_str, den_str))
        danh_sach = cur.fetchall()

    return [{
        "id": x["id"],
        "ma_phien": x["ma_phien"],
        "bien_so": x["bien_so"],
        "ten_loai_xe": x["ten_loai_xe"],
        "ten_chu_xe": x.get("ten_chu_xe"),
        "gio_vao": str(x["gio_vao"]),
        "gio_ra": str(x["gio_ra"]),
        "so_tien": float(x["so_tien"] or 0),
        "la_xe_ve_thang": bool(x.get("id_ve_thang")),
        "anh_bien_so": build_url(x.get("duong_dan_anh_bien_so")),
        "anh_nguoi_lai": build_url(x.get("duong_dan_anh_nguoi_lai")),
    } for x in danh_sach]