# routers/danh_sach_xe.py
from fastapi import APIRouter, Depends, Query, Form, HTTPException
from typing import Optional
from datetime import date
import json
import re
import mysql.connector

from database import lay_ket_noi_CSDL
from services.billing_service import BillingService, _co_gia_rieng    # <-- sửa import
from utils import (
    bay_gio_vn, build_url, chuan_hoa_bien_so,
    is_valid_bien_so, la_ma_xe_khong_bien_so, tach_bien_so,
)

router = APIRouter(prefix="/danh-sach-xe", tags=["Danh sách xe"])


# ─── 1. Xe đang trong bãi ─────────────────────────────────────────
@router.get("/trong-bai")
def xe_trong_bai(KetNoi=Depends(lay_ket_noi_CSDL)):
    bay_gio = bay_gio_vn()
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT p.id, p.ma_phien, p.bien_so, p.gio_vao, p.id_ve_thang,
                   p.kieu_tinh_gia_ap_dung,                   -- thêm cột này
                   p.duong_dan_anh_bien_so, p.duong_dan_anh_nguoi_lai,
                   k.ten AS ten_chu_xe,
                   l.ten, l.kieu_tinh_gia, l.gia_luot,
                   l.gia_ngay, l.gia_dem, l.gia_ngay_dem,
                   l.cau_hinh_theo_gio, l.nhom_xe_id
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
                nhom_gia = None
                # Dùng _co_gia_rieng từ billing_service thay vì tự viết
                if not _co_gia_rieng(xe):
                    with KetNoi.cursor(dictionary=True) as cur2:
                        cur2.execute(
                            "SELECT * FROM nhom_xe_gia WHERE nhom_xe_id = %s",
                            (xe["nhom_xe_id"],)
                        )
                        nhom_gia = cur2.fetchone()

                # Truyền kieu_ap_dung từ phiên
                so_tien = BillingService.tinh_tien_chi_tiet(
                    xe, xe["gio_vao"], bay_gio,
                    nhom_gia=nhom_gia,
                    kieu_ap_dung=xe.get("kieu_tinh_gia_ap_dung"),
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


# ─── 2. Xe đã ra ───────────────────────────────────────────────────
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


# ─── 3. Chi tiết phiên/xe (dùng cho modal sửa) ─────────────────────
@router.get("/phien/{id_phien}")
def chi_tiet_phien(id_phien: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        # Thử tìm trong phien_gui_xe
        cur.execute("""
            SELECT p.id, p.ma_phien, p.bien_so, p.id_loai_xe, p.id_khach_hang,
                   p.id_ve_thang, p.ghi_chu, p.is_in_bai,
                   l.ten AS ten_loai_xe,
                   k.ten AS ten_chu_xe, k.sdt, k.email
              FROM phien_gui_xe p
              JOIN loai_xe l ON p.id_loai_xe = l.id
              LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
             WHERE p.id = %s
        """, (id_phien,))
        phien = cur.fetchone()

        if phien:
            return {
                "id": phien["id"],
                "ma_phien": phien["ma_phien"],
                "bien_so": phien["bien_so"],
                "id_loai_xe": phien["id_loai_xe"],
                "ten_loai_xe": phien["ten_loai_xe"],
                "ten_chu_xe": phien.get("ten_chu_xe"),
                "sdt": phien.get("sdt"),
                "email": phien.get("email"),
                "ghi_chu": phien.get("ghi_chu"),
                "dang_trong_bai": bool(phien["is_in_bai"]),
                "la_ve_thang": phien["id_ve_thang"] is not None,
                "id_ve_thang": phien["id_ve_thang"],
            }

        # Nếu không tìm thấy phiên, thử tìm trong ve_thang (dành cho màn VeThang gửi ID vé)
        cur.execute("""
            SELECT v.id, v.bien_so, v.id_loai_xe, v.ghi_chu,
                   k.ten AS ten_chu_xe, k.sdt, k.email,
                   l.ten AS ten_loai_xe
              FROM ve_thang v
              LEFT JOIN khach_hang k ON v.id_khach_hang = k.id
              LEFT JOIN loai_xe l ON v.id_loai_xe = l.id
             WHERE v.id = %s
        """, (id_phien,))
        ve = cur.fetchone()
        if not ve:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên xe hoặc vé tháng.")

        return {
            "id": ve["id"],
            "ma_phien": None,
            "bien_so": ve["bien_so"],
            "id_loai_xe": ve["id_loai_xe"],
            "ten_loai_xe": ve["ten_loai_xe"],
            "ten_chu_xe": ve.get("ten_chu_xe"),
            "sdt": ve.get("sdt"),
            "email": ve.get("email"),
            "ghi_chu": ve.get("ghi_chu"),
            "dang_trong_bai": False,
            "la_ve_thang": True,
            "id_ve_thang": ve["id"],
        }


# ─── 4. Cập nhật thông tin xe (có hỗ trợ vé tháng) ─────────────────
@router.put("/phien/{id_phien}")
def sua_thong_tin_xe(
    id_phien: int,
    bien_so: str = Form(...),
    id_loai_xe: Optional[int] = Form(None),
    ten_chu_xe: Optional[str] = Form(None),
    sdt: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    ghi_chu: Optional[str] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    sdt = sdt.strip() if sdt else None
    email = email.strip() if email else None
    ten_chu_xe = ten_chu_xe.strip() if ten_chu_xe else None

    if sdt and not re.match(r'^(0|\+84)[0-9]{8,10}$', sdt):
        raise HTTPException(status_code=422, detail="Số điện thoại không hợp lệ.")
    if email and not re.match(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$', email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            # Xác định nguồn gốc ID: phiên hay vé tháng
            cur.execute(
                """SELECT id, bien_so, id_loai_xe, id_khach_hang, id_ve_thang, is_in_bai
                     FROM phien_gui_xe WHERE id = %s""",
                (id_phien,)
            )
            phien = cur.fetchone()

            la_ve_thang = False
            id_ve_thang = None

            if phien:
                # Có phiên gửi xe
                id_ve_thang = phien["id_ve_thang"]
                la_ve_thang = id_ve_thang is not None

                if la_ve_thang:
                    # Vé tháng: kiểm tra vé còn hạn
                    cur.execute(
                        "SELECT id FROM ve_thang WHERE id = %s AND ngay_het_han >= CURDATE()",
                        (id_ve_thang,)
                    )
                    if not cur.fetchone():
                        raise HTTPException(status_code=400, detail="Vé tháng đã hết hạn, không thể sửa.")
                else:
                    # Xe thường: phải đang trong bãi
                    if not phien["is_in_bai"]:
                        raise HTTPException(
                            status_code=403,
                            detail="Không thể sửa thông tin xe đã ra bãi (xe thường)."
                        )
            else:
                # Không tìm thấy phiên → thử coi id_phien là id của vé tháng
                cur.execute(
                    "SELECT id FROM ve_thang WHERE id = %s AND ngay_het_han >= CURDATE()",
                    (id_phien,)
                )
                ve = cur.fetchone()
                if ve:
                    la_ve_thang = True
                    id_ve_thang = id_phien
                    phien = None  # không có phiên để cập nhật
                else:
                    raise HTTPException(status_code=404, detail="Không tìm thấy phiên xe hoặc vé tháng còn hạn.")

            # ── Loại xe ──
            if la_ve_thang:
                if id_loai_xe is not None:
                    raise HTTPException(
                        status_code=422,
                        detail="Không thể đổi loại xe của phiên/vé tháng."
                    )
            else:
                if id_loai_xe is not None and id_loai_xe != phien["id_loai_xe"]:
                    cur.execute("SELECT id, ten FROM loai_xe WHERE id = %s", (id_loai_xe,))
                    loai_xe_row = cur.fetchone()
                    if not loai_xe_row:
                        raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")
                    if "(đồng giá)" in (loai_xe_row["ten"] or ""):
                        raise HTTPException(
                            status_code=422,
                            detail="Vui lòng chọn loại xe cụ thể, không chọn dòng đồng giá."
                        )
                    cur.execute(
                        "UPDATE phien_gui_xe SET id_loai_xe = %s WHERE id = %s",
                        (id_loai_xe, id_phien)
                    )

            # ── Biển số ──
            bien_so_moi = bien_so.strip().upper()
            if not bien_so_moi:
                raise HTTPException(status_code=422, detail="Biển số không được để trống.")
            bien_so_sach_moi = chuan_hoa_bien_so(bien_so_moi)

            if not la_ma_xe_khong_bien_so(bien_so_sach_moi) and not is_valid_bien_so(bien_so_sach_moi):
                raise HTTPException(status_code=422, detail="Biển số không đúng định dạng.")

            # Trùng biển số với xe khác trong bãi
            cur.execute(
                """SELECT id FROM phien_gui_xe
                    WHERE REPLACE(REPLACE(REPLACE(bien_so,'-',''),'.',''),' ','') = %s
                      AND is_in_bai = 1 AND id != %s""",
                (bien_so_sach_moi, id_phien if phien else 0)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="Biển số này đang được dùng bởi xe khác trong bãi."
                )

            # Nếu là xe thường, kiểm tra trùng vé tháng còn hạn
            if not la_ve_thang:
                cur.execute(
                    """SELECT id FROM ve_thang
                        WHERE REPLACE(REPLACE(REPLACE(bien_so,'-',''),'.',''),' ','') = %s
                          AND ngay_het_han >= CURDATE()""",
                    (bien_so_sach_moi,)
                )
                if cur.fetchone():
                    raise HTTPException(
                        status_code=400,
                        detail="Biển số này đang có vé tháng còn hạn. Vui lòng dùng chức năng quét QR vé tháng."
                    )

            _, duoi_bien_so_moi = tach_bien_so(bien_so_sach_moi)

            # Cập nhật biển số cho phiên (nếu có)
            if phien:
                cur.execute(
                    "UPDATE phien_gui_xe SET bien_so = %s, duoi_bien_so = %s WHERE id = %s",
                    (bien_so_moi, duoi_bien_so_moi, id_phien)
                )

            # Nếu là vé tháng, đồng bộ biển số vào ve_thang và tất cả phiên đang mở của vé đó
            if la_ve_thang:
                cur.execute(
                    "UPDATE ve_thang SET bien_so = %s, duoi_bien_so = %s WHERE id = %s",
                    (bien_so_moi, duoi_bien_so_moi, id_ve_thang)
                )
                cur.execute(
                    "UPDATE phien_gui_xe SET bien_so = %s, duoi_bien_so = %s WHERE id_ve_thang = %s AND is_in_bai = 1 AND id != %s",
                    (bien_so_moi, duoi_bien_so_moi, id_ve_thang, id_phien if phien else 0)
                )

            # ── Thông tin khách hàng ──
            id_khach = phien["id_khach_hang"] if phien else None
            if id_khach:
                sets, vals = [], []
                if ten_chu_xe is not None:
                    sets.append("ten = %s"); vals.append(ten_chu_xe)
                if sdt is not None:
                    sets.append("sdt = %s"); vals.append(sdt)
                if email is not None:
                    sets.append("email = %s"); vals.append(email)
                if sets:
                    vals.append(id_khach)
                    cur.execute(f"UPDATE khach_hang SET {', '.join(sets)} WHERE id = %s", tuple(vals))
            elif ten_chu_xe or sdt or email:
                cur.execute(
                    "INSERT INTO khach_hang (ten, sdt, email) VALUES (%s, %s, %s)",
                    (ten_chu_xe or "Khách vãng lai", sdt, email)
                )
                id_khach_moi = cur.lastrowid
                if phien:
                    cur.execute(
                        "UPDATE phien_gui_xe SET id_khach_hang = %s WHERE id = %s",
                        (id_khach_moi, id_phien)
                    )

            # ── Ghi chú ──
            if ghi_chu is not None:
                if phien:
                    cur.execute(
                        "UPDATE phien_gui_xe SET ghi_chu = %s WHERE id = %s",
                        (ghi_chu, id_phien)
                    )

            KetNoi.commit()

        return {"message": "Đã cập nhật thông tin thành công.", "id": id_phien if phien else id_ve_thang}

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise