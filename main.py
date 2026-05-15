from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from database import lay_ket_noi_CSDL
from models import PhanHoiXeVao, PhanHoiXeRa, PhanHoiVeThang, HinhThucThanhToan
from services.ocr import nhan_dien_bien_so
from services.qr_service import tao_ma_qr, doc_ma_qr
from services.email_service import gui_email_qr
from services.sms_service import gui_thong_bao_ve_thang
from services.billing_service import BillingService
from routers import loai_xe, xe_ra, thanh_toan, xe_vao
from utils import bay_gio_vn, build_url, chuan_hoa_bien_so, tinh_trang_thai, luu_anh
from dotenv import load_dotenv

import mysql.connector
import re
from typing import Optional
from datetime import datetime, date, timedelta
import os, uuid, asyncio

load_dotenv()

app = FastAPI(title="Parking MVP API", version="1.0.0")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(loai_xe.router)
app.include_router(xe_ra.router)
app.include_router(thanh_toan.router)
app.include_router(xe_vao.router)

os.makedirs("uploads", exist_ok=True)


# ── General ────────────────────────────────────────────────────
@app.get("/api/")
def chao_mung():
    return {"message": "Parking MVP API v1.0"}


# ── Khách hàng ─────────────────────────────────────────────────
@app.get("/khach-hang/")
def danh_sach_khach_hang(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM khach_hang ORDER BY created_at DESC")
        return cur.fetchall()


@app.get("/khach-hang/{id_khach}/")
def chi_tiet_khach_hang(id_khach: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM khach_hang WHERE id = %s", (id_khach,))
        kh = cur.fetchone()
        if not kh:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng.")
        cur.execute(
            """
            SELECT v.id, v.bien_so, v.ngay_dang_ky, v.ngay_het_han, v.so_tien, v.ma_qr,
                   l.ten AS ten_loai_xe
              FROM ve_thang v JOIN loai_xe l ON v.id_loai_xe = l.id
             WHERE v.id_khach_hang = %s ORDER BY v.created_at DESC
            """,
            (id_khach,),
        )
        kh["lich_su_ve_thang"] = cur.fetchall()
    return kh


# ── Xe trong bãi ───────────────────────────────────────────────
@app.get("/xe-trong-bai/")
def xe_trong_bai(KetNoi=Depends(lay_ket_noi_CSDL)):
    bay_gio = bay_gio_vn()
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            """
            SELECT p.id, p.ma_phien, p.bien_so, p.gio_vao, p.id_ve_thang,
                   p.duong_dan_anh_bien_so, p.duong_dan_anh_nguoi_lai,
                   k.ten AS ten_chu_xe,
                   l.ten AS ten_loai_xe, l.kieu_tinh_gia, l.gia_luot,
                   l.gia_ngay, l.gia_dem, l.gia_ngay_dem, l.cau_hinh_theo_gio
              FROM phien_gui_xe p
              JOIN loai_xe l ON p.id_loai_xe = l.id
              LEFT JOIN khach_hang k ON p.id_khach_hang = k.id
             WHERE p.is_in_bai = 1
             ORDER BY p.gio_vao DESC
            """
        )
        danh_sach = cur.fetchall()

    return [
        {
            "id": xe["id"],
            "ma_phien": xe["ma_phien"],
            "bien_so": xe["bien_so"],
            "ten_loai_xe": xe["ten_loai_xe"],
            "ten_chu_xe": xe.get("ten_chu_xe"),
            "gio_vao": str(xe["gio_vao"]),
            "so_tien_tam_tinh": (
                0
                if xe.get("id_ve_thang")
                else BillingService.tinh_tien_chi_tiet(xe, xe["gio_vao"], bay_gio)
            ),
            "la_xe_ve_thang": bool(xe.get("id_ve_thang")),
            "anh_bien_so": build_url(xe.get("duong_dan_anh_bien_so")),
            "anh_nguoi_lai": build_url(xe.get("duong_dan_anh_nguoi_lai")),
        }
        for xe in danh_sach
    ]


# ── Đăng ký vé tháng ───────────────────────────────────────────
@app.post("/dang-ky-ve-thang/", response_model=PhanHoiVeThang)
async def dang_ky_ve_thang(
    bien_so: str = Form(...),
    id_loai_xe: int = Form(...),
    ten_chu_xe: str = Form(...),
    sdt: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    dia_chi: Optional[str] = Form(None),
    ghi_chu: Optional[str] = Form(None),
    cho_phep_lay_ho: bool = Form(False),
    anh_bien_so: UploadFile = File(None),
    anh_nguoi_dung: UploadFile = File(None),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    sdt   = sdt.strip()   if sdt   else None
    email = email.strip() if email else None

    if sdt and not re.match(r"^(0|\+84)[0-9]{8,10}$", sdt):
        raise HTTPException(status_code=422, detail="Số điện thoại không hợp lệ.")
    if email and not re.match(r"^[\w\.-]+@[\w\.-]+\.\w{2,}$", email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")
    if not sdt and not email:
        raise HTTPException(
            status_code=422,
            detail="Vui lòng cung cấp ít nhất số điện thoại hoặc email.",
        )

    bien_so_chuan = bien_so.upper().strip()
    bien_so_sach  = chuan_hoa_bien_so(bien_so_chuan)
    hom_nay       = date.today()
    ngay_het_han  = hom_nay + timedelta(days=30)

    # Lưu ảnh trước transaction (I/O không cần lock DB)
    duong_dan_bien_so    = await luu_anh(anh_bien_so,    "uploads/bien_so")    if anh_bien_so    else None
    duong_dan_nguoi_dung = await luu_anh(anh_nguoi_dung, "uploads/nguoi_dung") if anh_nguoi_dung else None

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            # ✅ SELECT FOR UPDATE: khóa để tránh race condition
            # Hai request đồng thời → chỉ 1 request vào được, request còn lại chờ
            cur.execute(
                """
                SELECT id, ngay_het_han FROM ve_thang
                 WHERE REPLACE(REPLACE(REPLACE(bien_so,'-',''),'.',''),' ','') = %s
                   AND ngay_het_han >= %s
                 LIMIT 1
                 FOR UPDATE
                """,
                (bien_so_sach, hom_nay),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail=f"Biển số {bien_so_chuan} đã có vé tháng còn hạn.",
                )

            # ✅ Upsert khách hàng — không tạo bản ghi trùng nếu SĐT đã có
            id_khach_hang = None
            if sdt:
                cur.execute("SELECT id FROM khach_hang WHERE sdt = %s", (sdt,))
                row = cur.fetchone()
                if row:
                    id_khach_hang = row["id"]
                    cur.execute(
                        "UPDATE khach_hang SET ten=%s, email=%s, dia_chi=%s WHERE id=%s",
                        (ten_chu_xe, email, dia_chi, id_khach_hang),
                    )
                else:
                    # Kiểm tra SĐT trùng với vé tháng còn hạn khác
                    cur.execute(
                        """
                        SELECT v.id FROM ve_thang v
                          JOIN khach_hang k ON v.id_khach_hang = k.id
                         WHERE k.sdt = %s AND v.ngay_het_han >= %s LIMIT 1
                        """,
                        (sdt, hom_nay),
                    )
                    if cur.fetchone():
                        raise HTTPException(
                            status_code=400,
                            detail="SĐT này đã đăng ký vé tháng còn hạn.",
                        )

            if not id_khach_hang and email:
                cur.execute("SELECT id FROM khach_hang WHERE email = %s", (email,))
                row = cur.fetchone()
                if row:
                    id_khach_hang = row["id"]
                else:
                    cur.execute(
                        """
                        SELECT v.id FROM ve_thang v
                          JOIN khach_hang k ON v.id_khach_hang = k.id
                         WHERE k.email = %s AND v.ngay_het_han >= %s LIMIT 1
                        """,
                        (email, hom_nay),
                    )
                    if cur.fetchone():
                        raise HTTPException(
                            status_code=400,
                            detail="Email này đã đăng ký vé tháng còn hạn.",
                        )

            if not id_khach_hang:
                cur.execute(
                    "INSERT INTO khach_hang (ten, sdt, email, dia_chi, cho_phep_lay_ho)"
                    " VALUES (%s,%s,%s,%s,%s)",
                    (ten_chu_xe, sdt, email, dia_chi, int(cho_phep_lay_ho)),
                )
                id_khach_hang = cur.lastrowid

            # Lấy giá loại xe
            cur.execute(
                "SELECT gia_luot, gia_ve_thang FROM loai_xe WHERE id = %s",
                (id_loai_xe,),
            )
            loai_xe_row = cur.fetchone()
            if not loai_xe_row:
                raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

            so_tien = int(loai_xe_row["gia_ve_thang"] or loai_xe_row["gia_luot"])

            # Tạo vé tháng
            cur.execute(
                """
                INSERT INTO ve_thang
                (id_khach_hang, bien_so, duoi_bien_so, id_loai_xe,
                 ngay_dang_ky, ngay_het_han, so_tien, ghi_chu,
                 duong_dan_anh_bien_so, duong_dan_anh_nguoi_dung)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    id_khach_hang, bien_so_chuan,
                    re.sub(r"[^0-9]", "", bien_so_chuan)[-5:],
                    id_loai_xe, hom_nay, ngay_het_han, so_tien, ghi_chu,
                    duong_dan_bien_so, duong_dan_nguoi_dung,
                ),
            )
            id_ve = cur.lastrowid

            # Tạo QR
            du_lieu_qr = {
                "loai": "ve_thang", "id": id_ve,
                "bien_so": bien_so_chuan, "ten_chu_xe": ten_chu_xe,
                "ngay_het_han": str(ngay_het_han),
            }
            ma_qr, duong_dan_qr = tao_ma_qr(du_lieu_qr)
            cur.execute("UPDATE ve_thang SET ma_qr = %s WHERE id = %s", (ma_qr, id_ve))

            # Ghi lịch sử
            cur.execute(
                """
                INSERT INTO lich_su_ve_thang
                (id_ve_thang, loai, ngay_thuc_hien, ngay_het_han_cu, ngay_het_han_moi, so_tien, ghi_chu)
                VALUES (%s,'dang_ky_moi',%s,NULL,%s,%s,%s)
                """,
                (id_ve, hom_nay, ngay_het_han, so_tien, ghi_chu),
            )

            KetNoi.commit()   # duy nhất 1 commit cho toàn bộ transaction

        # Gửi thông báo (ngoài transaction)
        if email:
            asyncio.create_task(
                gui_email_qr(
                    den=email, ten_chu_xe=ten_chu_xe, bien_so=bien_so_chuan,
                    gio_vao=f"Ngày đăng ký: {hom_nay} | Hết hạn: {ngay_het_han}",
                    duong_dan_qr=duong_dan_qr,
                )
            )
        if sdt:
            asyncio.create_task(
                asyncio.to_thread(
                    gui_thong_bao_ve_thang, sdt, bien_so_chuan,
                    str(ngay_het_han), build_url(duong_dan_qr),
                )
            )

        return {
            "id": id_ve, "id_khach_hang": id_khach_hang,
            "ten_chu_xe": ten_chu_xe, "sdt": sdt, "email": email,
            "bien_so": bien_so_chuan, "id_loai_xe": id_loai_xe,
            "ngay_dang_ky": hom_nay, "ngay_het_han": ngay_het_han,
            "so_tien": so_tien, "ma_qr": ma_qr, "ghi_chu": ghi_chu,
            "trang_thai": "con_han",
            "so_ngay_con": (ngay_het_han - date.today()).days,
        }

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise


# ── Gia hạn vé tháng ──────────────────────────────────────────
@app.post("/ve-thang/{id_ve}/gia-han/")
async def gia_han_ve_thang(
    id_ve: int,
    ghi_chu: Optional[str] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    hom_nay = date.today()
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute(
                """
                SELECT v.*, k.ten AS ten_chu_xe, k.email, k.sdt,
                       l.gia_ve_thang, l.gia_luot
                  FROM ve_thang v
                  JOIN khach_hang k ON v.id_khach_hang = k.id
                  JOIN loai_xe l    ON v.id_loai_xe    = l.id
                 WHERE v.id = %s
                """,
                (id_ve,),
            )
            ve = cur.fetchone()

        if not ve:
            raise HTTPException(status_code=404, detail="Không tìm thấy vé tháng.")

        ngay_het_han_cu  = ve["ngay_het_han"]
        ngay_bat_dau     = ngay_het_han_cu if ngay_het_han_cu >= hom_nay else hom_nay
        ngay_het_han_moi = ngay_bat_dau + timedelta(days=30)
        so_tien          = int(ve["gia_ve_thang"] or ve["gia_luot"])

        du_lieu_qr = {
            "loai": "ve_thang", "id": id_ve,
            "bien_so": ve["bien_so"], "ten_chu_xe": ve["ten_chu_xe"],
            "ngay_het_han": str(ngay_het_han_moi),
        }
        ma_qr_moi, duong_dan_qr_moi = tao_ma_qr(du_lieu_qr)

        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute(
                "UPDATE ve_thang SET ngay_het_han = %s, ma_qr = %s WHERE id = %s",
                (ngay_het_han_moi, ma_qr_moi, id_ve),
            )
            cur.execute(
                """
                INSERT INTO lich_su_ve_thang
                (id_ve_thang, loai, ngay_thuc_hien, ngay_het_han_cu, ngay_het_han_moi, so_tien, ghi_chu)
                VALUES (%s,'gia_han',%s,%s,%s,%s,%s)
                """,
                (id_ve, hom_nay, ngay_het_han_cu, ngay_het_han_moi, so_tien, ghi_chu),
            )
            KetNoi.commit()

        if ve.get("email"):
            asyncio.create_task(
                gui_email_qr(
                    den=ve["email"], ten_chu_xe=ve["ten_chu_xe"],
                    bien_so=ve["bien_so"],
                    gio_vao=f"Gia hạn đến {ngay_het_han_moi}",
                    duong_dan_qr=duong_dan_qr_moi,
                )
            )
        if ve.get("sdt"):
            asyncio.create_task(
                asyncio.to_thread(
                    gui_thong_bao_ve_thang, ve["sdt"], ve["bien_so"],
                    str(ngay_het_han_moi), build_url(duong_dan_qr_moi),
                )
            )

        return {
            "id_ve_thang": id_ve,
            "bien_so": ve["bien_so"],
            "ten_chu_xe": ve["ten_chu_xe"],
            "ngay_het_han_cu": str(ngay_het_han_cu),
            "ngay_het_han_moi": str(ngay_het_han_moi),
            "so_tien": so_tien,
            "ghi_chu": ghi_chu or "Gia hạn thành công",
        }

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise


# ── Danh sách vé tháng ─────────────────────────────────────────
@app.get("/danh-sach-ve-thang/")
def danh_sach_ve_thang(KetNoi=Depends(lay_ket_noi_CSDL)):
    hom_nay = date.today()
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            """
            SELECT v.id, v.bien_so, v.ngay_dang_ky, v.ngay_het_han,
                   v.so_tien, v.ma_qr, v.ghi_chu,
                   v.duong_dan_anh_bien_so, v.duong_dan_anh_nguoi_dung,
                   k.ten AS ten_chu_xe, k.sdt, k.email,
                   l.ten AS ten_loai_xe
              FROM ve_thang v
              LEFT JOIN khach_hang k ON v.id_khach_hang = k.id
              LEFT JOIN loai_xe    l ON v.id_loai_xe    = l.id
             ORDER BY v.ngay_het_han ASC
            """
        )
        danh_sach = cur.fetchall()

    return [
        {
            "id": ve["id"],
            "bien_so": ve["bien_so"],
            "ngay_dang_ky": ve["ngay_dang_ky"],
            "ngay_het_han": ve["ngay_het_han"],
            "so_tien": ve["so_tien"],
            "ma_qr": ve["ma_qr"],
            "ghi_chu": ve["ghi_chu"],
            "ten_chu_xe": ve["ten_chu_xe"],
            "sdt": ve.get("sdt"),
            "email": ve.get("email"),
            "ten_loai_xe": ve["ten_loai_xe"],
            "trang_thai": tinh_trang_thai(ve["ngay_het_han"]),
            "so_ngay_con": (ve["ngay_het_han"] - hom_nay).days,
            "anh_bien_so": build_url(ve.get("duong_dan_anh_bien_so")),
            "anh_nguoi_dung": build_url(ve.get("duong_dan_anh_nguoi_dung")),
            "anh_qr": build_url(f"uploads/qr/{ve['ma_qr']}.png") if ve.get("ma_qr") else None,
        }
        for ve in danh_sach
    ]


@app.get("/ve-thang/{id_ve}/lich-su/")
def lich_su_ve_thang(id_ve: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            "SELECT * FROM lich_su_ve_thang WHERE id_ve_thang = %s ORDER BY ngay_thuc_hien DESC",
            (id_ve,),
        )
        return cur.fetchall()


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = os.path.join("frontend", full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join("frontend", "index.html"))