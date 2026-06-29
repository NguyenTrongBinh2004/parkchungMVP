# routers/ve_thang.py
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from typing import Optional
import re, uuid, asyncio
from datetime import date, timedelta
import mysql.connector

from database import lay_ket_noi_CSDL
from models import PhanHoiVeThang
from services.qr_service import tao_ma_qr
from services.email_service import gui_email_qr
from services.sms_service import gui_thong_bao_ve_thang
from utils import (
    bay_gio_vn, build_url, chuan_hoa_bien_so,
    tinh_trang_thai, luu_anh, is_valid_bien_so
)

router = APIRouter(prefix="", tags=["Vé tháng"]) 


# ── Helper: lấy giá vé tháng (ưu tiên giá riêng của loại xe, nếu không có thì lấy từ nhom_xe_gia) ──
def lay_gia_ve_thang(loai_xe: dict, cur) -> int:
    """
    `loai_xe` là dict chứa ít nhất các trường: id, nhom_xe_id, gia_ve_thang
    `cur` là cursor còn mở để truy vấn nhom_xe_gia nếu cần.
    Trả về số tiền (int) hoặc raise HTTPException nếu không có giá.
    """
    # 1. Ưu tiên giá riêng trên loại xe
    if loai_xe.get("gia_ve_thang") and float(loai_xe["gia_ve_thang"]) > 0:
        return int(loai_xe["gia_ve_thang"])

    # 2. Nếu không có, kiểm tra đồng giá nhóm
    cur.execute(
        "SELECT gia_ve_thang FROM nhom_xe_gia WHERE nhom_xe_id = %s",
        (loai_xe["nhom_xe_id"],)
    )
    nhom_gia = cur.fetchone()
    if nhom_gia and nhom_gia.get("gia_ve_thang") and float(nhom_gia["gia_ve_thang"]) > 0:
        return int(nhom_gia["gia_ve_thang"])

    # 3. Không có cả hai → báo lỗi
    raise HTTPException(
        status_code=400,
        detail="Loại xe này chưa được thiết lập giá vé tháng (cả riêng lẻ và đồng giá nhóm). Vui lòng chọn loại khác."
    )


# ── Đăng ký vé tháng ───────────────────────────────────────────
@router.post("/dang-ky-ve-thang/", response_model=PhanHoiVeThang)
async def dang_ky_ve_thang(
    bien_so: str = Form(""),
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
        raise HTTPException(status_code=422, detail="Vui lòng cung cấp ít nhất số điện thoại hoặc email.")

    hom_nay       = date.today()
    ngay_het_han  = hom_nay + timedelta(days=30)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM loai_xe WHERE id = %s", (id_loai_xe,))
        loai_xe_row = cur.fetchone()
        if not loai_xe_row:
            raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

        # 🚫 Không cho phép chọn trực tiếp xe mồi (chỉ được thông qua dòng đồng giá)
        if "(đồng giá)" in (loai_xe_row["ten"] or ""):
            raise HTTPException(
                status_code=422,
                detail="Vui lòng chọn loại xe cụ thể hoặc sử dụng lựa chọn đồng giá của nhóm."
            )

        # Số tiền vé tháng (theo logic ưu tiên mới)
        so_tien = lay_gia_ve_thang(loai_xe_row, cur)

        # Kiểm tra yêu cầu biển số (tạm thời dựa vào tên loại)
        yeu_cau_bien = not ("đạp" in loai_xe_row["ten"].lower() or "xe đạp" in loai_xe_row["ten"].lower())

    # ─── Xử lý biển số ───
    if yeu_cau_bien:
        if not bien_so.strip():
            raise HTTPException(status_code=422, detail="Biển số không được để trống.")
        bien_so_chuan = bien_so.upper().strip()
        bien_so_sach = chuan_hoa_bien_so(bien_so_chuan)
        if not is_valid_bien_so(bien_so_sach):
            raise HTTPException(status_code=400, detail="Biển số không đúng định dạng")
    else:
        if not bien_so.strip():
            bien_so_chuan = f"XD{uuid.uuid4().hex[:8].upper()}"
        else:
            bien_so_chuan = bien_so.upper().strip()
        bien_so_sach = chuan_hoa_bien_so(bien_so_chuan)

    # ─── Lưu ảnh ───
    duong_dan_bien_so    = await luu_anh(anh_bien_so,    "uploads/bien_so")    if anh_bien_so    else None
    duong_dan_nguoi_dung = await luu_anh(anh_nguoi_dung, "uploads/nguoi_dung") if anh_nguoi_dung else None

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            # Kiểm tra trùng vé tháng
            cur.execute(
                """
                SELECT id FROM ve_thang
                 WHERE REPLACE(REPLACE(REPLACE(bien_so,'-',''),'.',''),' ','') = %s
                   AND ngay_het_han >= %s
                 LIMIT 1 FOR UPDATE
                """,
                (bien_so_sach, hom_nay),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail=f"Biển số {bien_so_chuan} đã có vé tháng còn hạn.",
                )

            # Upsert khách hàng
            id_khach_hang = None
            if sdt:
                cur.execute("SELECT id FROM khach_hang WHERE sdt = %s", (sdt,))
                row = cur.fetchone()
                if row:
                    id_khach_hang = row["id"]
                    cur.execute(
                        "UPDATE khach_hang SET ten=%s, email=%s, dia_chi=%s, cho_phep_lay_ho=%s WHERE id=%s",
                        (ten_chu_xe, email, dia_chi, int(cho_phep_lay_ho), id_khach_hang),
                    )
                else:
                    cur.execute(
                        """
                        SELECT v.id FROM ve_thang v
                          JOIN khach_hang k ON v.id_khach_hang = k.id
                         WHERE k.sdt = %s AND v.ngay_het_han >= %s LIMIT 1
                        """,
                        (sdt, hom_nay),
                    )
                    if cur.fetchone():
                        raise HTTPException(status_code=400, detail="SĐT này đã đăng ký vé tháng còn hạn.")

            if not id_khach_hang and email:
                cur.execute("SELECT id FROM khach_hang WHERE email = %s", (email,))
                row = cur.fetchone()
                if row:
                    id_khach_hang = row["id"]
                    cur.execute(
                        "UPDATE khach_hang SET ten=%s, sdt=%s, dia_chi=%s, cho_phep_lay_ho=%s WHERE id=%s",
                        (ten_chu_xe, sdt, dia_chi, int(cho_phep_lay_ho), id_khach_hang),
                    )
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
                        raise HTTPException(status_code=400, detail="Email này đã đăng ký vé tháng còn hạn.")

            if not id_khach_hang:
                cur.execute(
                    "INSERT INTO khach_hang (ten, sdt, email, dia_chi, cho_phep_lay_ho)"
                    " VALUES (%s,%s,%s,%s,%s)",
                    (ten_chu_xe, sdt, email, dia_chi, int(cho_phep_lay_ho)),
                )
                id_khach_hang = cur.lastrowid

            # Tạo vé tháng
            duoi_bien_so = re.sub(r"[^0-9]", "", bien_so_chuan)[-5:]
            cur.execute(
                """
                INSERT INTO ve_thang
                (id_khach_hang, bien_so, duoi_bien_so, id_loai_xe,
                 ngay_dang_ky, ngay_het_han, so_tien, ghi_chu,
                 duong_dan_anh_bien_so, duong_dan_anh_nguoi_dung)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    id_khach_hang, bien_so_chuan, duoi_bien_so,
                    id_loai_xe, hom_nay, ngay_het_han, so_tien, ghi_chu,
                    duong_dan_bien_so, duong_dan_nguoi_dung,
                ),
            )
            id_ve = cur.lastrowid

            du_lieu_qr = {
                "loai": "ve_thang", "id": id_ve,
                "bien_so": bien_so_chuan, "ten_chu_xe": ten_chu_xe,
                "ngay_het_han": str(ngay_het_han),
            }
            ma_qr, duong_dan_qr = tao_ma_qr(du_lieu_qr)
            cur.execute("UPDATE ve_thang SET ma_qr = %s WHERE id = %s", (ma_qr, id_ve))

            cur.execute(
                """
                INSERT INTO lich_su_ve_thang
                (id_ve_thang, loai, ngay_thuc_hien, ngay_het_han_cu, ngay_het_han_moi, so_tien, ghi_chu)
                VALUES (%s,'dang_ky_moi',%s,NULL,%s,%s,%s)
                """,
                (id_ve, hom_nay, ngay_het_han, so_tien, ghi_chu),
            )

            KetNoi.commit()

        # Gửi thông báo
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
            "so_tien": so_tien, "ma_qr": ma_qr,
            "qr_image_url": build_url(duong_dan_qr),
            "ghi_chu": ghi_chu,
            "trang_thai": "con_han",
            "so_ngay_con": (ngay_het_han - date.today()).days,
        }

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise


# ── Gia hạn vé tháng (ĐÃ XÓA QUERY THỪA) ─────────────────────
@router.post("/ve-thang/{id_ve}/gia-han/")
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
                       l.*
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
            so_tien          = lay_gia_ve_thang(ve, cur)

            du_lieu_qr = {
                "loai": "ve_thang", "id": id_ve,
                "bien_so": ve["bien_so"], "ten_chu_xe": ve["ten_chu_xe"],
                "ngay_het_han": str(ngay_het_han_moi),
            }
            ma_qr_moi, duong_dan_qr_moi = tao_ma_qr(du_lieu_qr)

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

        # Gửi thông báo (dùng biến ve vẫn còn hiệu lực)
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
@router.get("/danh-sach-ve-thang/")
def danh_sach_ve_thang(KetNoi=Depends(lay_ket_noi_CSDL)):
    hom_nay = date.today()
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            """
            SELECT v.id, v.bien_so, v.ngay_dang_ky, v.ngay_het_han,
                   v.so_tien, v.ma_qr, v.ghi_chu,
                   v.duong_dan_anh_bien_so, v.duong_dan_anh_nguoi_dung,
                   k.ten AS ten_chu_xe, k.sdt, k.email,
                   l.ten AS ten_loai_xe,
                   p.id AS id_phien_dang_bai
              FROM ve_thang v
              LEFT JOIN khach_hang k ON v.id_khach_hang = k.id
              LEFT JOIN loai_xe    l ON v.id_loai_xe    = l.id
              LEFT JOIN phien_gui_xe p ON p.id_ve_thang = v.id AND p.is_in_bai = 1
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
            "dang_trong_bai": ve.get("id_phien_dang_bai") is not None,
            "id_phien_dang_bai": ve.get("id_phien_dang_bai"),
        }
        for ve in danh_sach
    ]


# ── Lịch sử vé tháng ──────────────────────────────────────────
@router.get("/ve-thang/{id_ve}/lich-su/")
def lich_su_ve_thang(id_ve: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            "SELECT * FROM lich_su_ve_thang WHERE id_ve_thang = %s ORDER BY ngay_thuc_hien DESC",
            (id_ve,),
        )
        return cur.fetchall()


# ── Xóa vé tháng ──────────────────────────────────────────────
@router.delete("/ve-thang/{id_ve}")
def xoa_ve_thang(id_ve: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute("SELECT * FROM ve_thang WHERE id = %s", (id_ve,))
            ve = cur.fetchone()
            if not ve:
                raise HTTPException(status_code=404, detail="Không tìm thấy vé tháng.")

            cur.execute(
                "SELECT id FROM phien_gui_xe WHERE id_ve_thang = %s AND is_in_bai = 1 LIMIT 1",
                (id_ve,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="Không thể xóa vé tháng đang có xe trong bãi. Vui lòng cho xe ra trước."
                )

            cur.execute("DELETE FROM ve_thang WHERE id = %s", (id_ve,))
            KetNoi.commit()
            return {"message": f"Đã xóa vé tháng {ve['bien_so']} thành công."}

    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise