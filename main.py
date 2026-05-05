from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from database import lay_ket_noi_CSDL
from models import (XeVaoCreate, PhanHoiXeVao, XeRaCreate, PhanHoiXeRa,
                    PhanHoiXeTrongBai, VeThangCreate, PhanHoiVeThang, HinhThucThanhToan)
from services.ocr import nhan_dien_bien_so
from services.qr_service import tao_ma_qr, doc_ma_qr
from services.email_service import gui_email_qr
import mysql.connector
import re
from typing import List, Optional
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
import os, uuid, aiofiles
import json
import asyncio
from services.sms_service import gui_sms_ma_phien

app = FastAPI(title="Parking MVP API", version="1.0.0")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# ───────────────────────────────────────────
# HELPER: Tính tiền
# ───────────────────────────────────────────

def tinh_tien(loai_xe: dict, gio_vao: datetime, gio_ra: datetime) -> float:
    so_phut = (gio_ra - gio_vao).total_seconds() / 60
    if loai_xe["kieu_tinh_gia"] == "theo_luot":
        return int(loai_xe["gia_luot"])
    elif loai_xe["kieu_tinh_gia"] == "theo_ngay_dem":
        qua_dem = gio_ra.date() > gio_vao.date()
        if qua_dem:
            return loai_xe["gia_ngay_dem"] or loai_xe["gia_luot"]
        elif 6 <= gio_vao.hour < 22:
            return loai_xe["gia_ngay"] or loai_xe["gia_luot"]
        else:
            return loai_xe["gia_dem"] or loai_xe["gia_luot"]
    elif loai_xe["kieu_tinh_gia"] == "theo_gio":
        cau_hinh = loai_xe["cau_hinh_theo_gio"]
        if isinstance(cau_hinh, str):
            cau_hinh = json.loads(cau_hinh)
        so_gio = so_phut / 60
        tong_tien = 0
        gio_con_lai = so_gio
        for bac in cau_hinh:
            if "den_gio" in bac:
                gio_bac = min(gio_con_lai, bac["den_gio"])
                tong_tien += gio_bac * bac["gia"]
                gio_con_lai -= gio_bac
                if gio_con_lai <= 0:
                    break
            elif "moi_gio_tiep" in bac:
                tong_tien += gio_con_lai * bac["moi_gio_tiep"]
                break
        return round(tong_tien)
    return int(loai_xe["gia_luot"])


# ── Helpers ──────────────────────────────────

def tinh_trang_thai(ngay_het_han: date) -> str:
    hom_nay = date.today()
    con_lai = (ngay_het_han - hom_nay).days
    if con_lai < 0:
        return "het_han"
    elif con_lai <= 7:
        return "sap_het"
    return "con_han"


# ───────────────────────────────────────────
# HELPER: Lưu ảnh
# ───────────────────────────────────────────
async def luu_anh(file: UploadFile, thu_muc: str) -> str:
    os.makedirs(thu_muc, exist_ok=True)
    ten_file = f"{uuid.uuid4().hex}_{file.filename}"
    duong_dan = os.path.join(thu_muc, ten_file)
    async with aiofiles.open(duong_dan, "wb") as f:
        await f.write(await file.read())
    return duong_dan.replace("\\", "/")


# ───────────────────────────────────────────
# GENERAL
# ───────────────────────────────────────────
@app.get("/")
def chao_mung():
    return {"message": "Parking MVP API"}


@app.get("/loai-xe/")
def lay_danh_sach_loai_xe(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as ConTro:
        ConTro.execute("""
    SELECT id, ten, mau_sac, kieu_tinh_gia, gia_luot, gia_ve_thang
    FROM loai_xe
""")
        return ConTro.fetchall()


# ───────────────────────────────────────────
# OCR
# ───────────────────────────────────────────
@app.post("/nhan-dien-bien-so/")
async def nhan_dien(anh: UploadFile = File(...)):
    du_lieu = await anh.read()
    bien_so = nhan_dien_bien_so(du_lieu)
    return {"bien_so_nhan_dien": bien_so, "ghi_chu": "Kiểm tra lại trước khi xác nhận"}


# ───────────────────────────────────────────
# XE VÀO
# ───────────────────────────────────────────
@app.post("/xe-vao/ve-thang/", response_model=PhanHoiXeVao)
async def xe_vao_ve_thang(
    bien_so: str = Form(...),
    ghi_chu: Optional[str] = Form(None),
    anh_bien_so: UploadFile = File(...),
    anh_nguoi_lai: UploadFile = File(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
    bien_so = bien_so.upper().strip()

    try:
        # 1. Kiểm tra vé tháng và xe trong bãi
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("""
                SELECT * FROM ve_thang 
                WHERE bien_so = %s AND ngay_het_han >= %s
            """, (bien_so, date.today()))
            ve_thang = ConTro.fetchone()

            if not ve_thang:
                raise HTTPException(status_code=404, detail="Biển số này không có vé tháng còn hạn.")

            ConTro.execute("SELECT id FROM phien_gui_xe WHERE bien_so = %s AND gio_ra IS NULL", (bien_so,))
            if ConTro.fetchone():
                raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi.")

        # 2. Lưu ảnh
        duong_dan_bien_so = await luu_anh(anh_bien_so, "uploads/bien_so")
        duong_dan_nguoi_lai = await luu_anh(anh_nguoi_lai, "uploads/nguoi_lai") if anh_nguoi_lai else None

        # 3. INSERT phiên gửi xe bằng chính mã QR của vé tháng
        with KetNoi.cursor(dictionary=True) as ConTro:
            duoi_bien_so = re.sub(r'[^0-9]', '', bien_so)[-5:]
            ma_phien = f"GX{uuid.uuid4().hex[:8].upper()}"
            
            # Lấy ma_qr cũ từ bảng ve_thang để dùng cho phiên này
            ma_qr_co_dinh = ve_thang["ma_qr"] 

            sql = """
                INSERT INTO phien_gui_xe 
                (ma_phien, bien_so, duoi_bien_so, id_loai_xe, ten_chu_xe, sdt, email, 
                 cho_phep_lay_ho, duong_dan_anh_bien_so, duong_dan_anh_nguoi_lai, 
                 gio_vao, so_tien, id_ve_thang, ma_qr)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """
            ConTro.execute(sql, (
                ma_phien, bien_so, duoi_bien_so, 
                ve_thang["id_loai_xe"], ve_thang["ten_chu_xe"],
                ve_thang.get("sdt"), ve_thang.get("email"),
                ve_thang["cho_phep_lay_ho"], 
                duong_dan_bien_so, duong_dan_nguoi_lai,
                bay_gio, 0, ve_thang["id"], ma_qr_co_dinh
            ))
            KetNoi.commit()
            id_moi = ConTro.lastrowid

        so_ngay_con = (ve_thang["ngay_het_han"] - date.today()).days
        ghi_chu_tra_ve = f"⚠️ Vé tháng còn {so_ngay_con} ngày" if so_ngay_con <= 7 else "Vé tháng — miễn phí"
        # ── Gửi thông báo xác nhận vào bãi ──
        email = ve_thang.get("email")
        sdt = ve_thang.get("sdt")
        if email:
            asyncio.create_task(gui_email_qr(
                den=email,
                ten_chu_xe=ve_thang["ten_chu_xe"],
                bien_so=bien_so,
                gio_vao=str(bay_gio),
                duong_dan_qr=duong_dan_bien_so  # gửi ảnh biển số thay QR làm bằng chứng
            ))
        if sdt:
            asyncio.create_task(
                asyncio.to_thread(
                    gui_sms_ma_phien,
                    sdt,
                    ma_phien,  # mã phiên lần vào này, không phải ma_qr
                    bien_so
                )
            )
        return {
            "id": id_moi,
            "ma_phien": ma_phien,
            "bien_so": bien_so,
            "id_loai_xe": ve_thang["id_loai_xe"],
            "ten_chu_xe": ve_thang["ten_chu_xe"],
            "gio_vao": bay_gio,
            "ma_qr": ma_qr_co_dinh, # Trả về mã QR cũ
            "ghi_chu": ghi_chu_tra_ve
        }

    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise  # ← re-raise đúng status code, không convert thành 500
    except Exception as err:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(err)}")
    

@app.post("/xe-vao/", response_model=PhanHoiXeVao)
async def xe_vao(
    id_loai_xe: int = Form(...),
    bien_so_xac_nhan: str = Form(...),
    ten_chu_xe: str = Form(...),
    sdt: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    cho_phep_lay_ho: bool = Form(False),
    anh_bien_so: UploadFile = File(...),
    anh_nguoi_lai: UploadFile = File(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    # ── Chuẩn hóa trước khi validate ──
    sdt = sdt.strip() if sdt else None
    email = email.strip() if email else None
    if sdt and not re.match(r'^(0|\+84)[0-9]{8,10}$', sdt):
        raise HTTPException(status_code=422, detail="Số điện thoại không hợp lệ.")

    if email and not re.match(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$', email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")

    if not sdt and not email:
        raise HTTPException(status_code=422, detail="Vui lòng cung cấp ít nhất số điện thoại hoặc email.")
    bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
    bien_so = bien_so_xac_nhan.upper().strip()
    duoi_bien_so = re.sub(r'[^0-9]', '', bien_so)[-5:]

    try:
        # ── 1. Kiểm tra DB TRƯỚC khi lưu ảnh ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute(
                "SELECT id FROM phien_gui_xe WHERE bien_so = %s AND gio_ra IS NULL",
                (bien_so,)
            )
            if ConTro.fetchone():
                raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi.")

            # ── Kiểm tra vé tháng còn hạn ──
            ConTro.execute("""
                SELECT id, ngay_het_han FROM ve_thang
                WHERE bien_so = %s AND ngay_het_han >= %s
            """, (bien_so, date.today()))
            ve_thang = ConTro.fetchone()
            if ve_thang:
                so_ngay_con = (ve_thang["ngay_het_han"] - date.today()).days
                raise HTTPException(
                    status_code=400,
                    detail=f"Xe {bien_so} đang có vé tháng còn {so_ngay_con} ngày "
                           f"(hết hạn {ve_thang['ngay_het_han']}). "
                           f"Vui lòng dùng POST /xe-vao/ve-thang/ thay thế."
                )

            ConTro.execute("SELECT id FROM loai_xe WHERE id = %s", (id_loai_xe,))
            if not ConTro.fetchone():
                raise HTTPException(status_code=404, detail=f"Không tìm thấy loại xe id: {id_loai_xe}")

        # ── 2. Lưu ảnh sau khi chắc chắn hợp lệ ──
        duong_dan_bien_so = await luu_anh(anh_bien_so, "uploads/bien_so")
        duong_dan_nguoi_lai = await luu_anh(anh_nguoi_lai, "uploads/nguoi_lai") if anh_nguoi_lai else None

        # ── 3. INSERT ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            ma_phien = f"GX{uuid.uuid4().hex[:8].upper()}"
            sql = """INSERT INTO phien_gui_xe
                    (ma_phien, bien_so, duoi_bien_so, id_loai_xe, ten_chu_xe, sdt, email,
                     cho_phep_lay_ho, duong_dan_anh_bien_so, duong_dan_anh_nguoi_lai, gio_vao)
                     VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
            ConTro.execute(sql, (ma_phien, bien_so, duoi_bien_so, id_loai_xe, ten_chu_xe,
                                 sdt, email, int(cho_phep_lay_ho),
                                 duong_dan_bien_so, duong_dan_nguoi_lai, bay_gio))
            KetNoi.commit()
            id_moi = ConTro.lastrowid

            du_lieu_qr = {
                "ma_phien": ma_phien, "bien_so": bien_so,
                "ten_chu_xe": ten_chu_xe, "sdt": sdt or "",
                "gio_vao": str(bay_gio), "cho_phep_lay_ho": cho_phep_lay_ho,
                "anh_bien_so": f"{BASE_URL}/{duong_dan_bien_so}" if duong_dan_bien_so else "",
                "anh_nguoi_lai": f"{BASE_URL}/{duong_dan_nguoi_lai}" if duong_dan_nguoi_lai else "",
            }
            ma_qr, duong_dan_qr = tao_ma_qr(du_lieu_qr)
            ConTro.execute("UPDATE phien_gui_xe SET ma_qr=%s WHERE id=%s", (ma_qr, id_moi))
            KetNoi.commit()

        # ── 4. Gửi thông báo ──
        if email:
            asyncio.create_task(gui_email_qr(
                den=email, ten_chu_xe=ten_chu_xe,
                bien_so=bien_so, gio_vao=str(bay_gio),
                duong_dan_qr=duong_dan_qr
            ))
        if sdt:
            asyncio.create_task(asyncio.to_thread(gui_sms_ma_phien, sdt, ma_phien, bien_so))

        return {
            "id": id_moi, "ma_phien": ma_phien, "bien_so": bien_so,
            "id_loai_xe": id_loai_xe, "ten_chu_xe": ten_chu_xe,
            "gio_vao": bay_gio, "ma_qr": ma_qr
        }

    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise

# ───────────────────────────────────────────
# XE RA
# ───────────────────────────────────────────
def _tinh_va_cap_nhat_xe_ra(Phien, KetNoi, bay_gio, hinh_thuc_thanh_toan):
    with KetNoi.cursor(dictionary=True) as ConTro:
        gio_vao = Phien["gio_vao"]

        if Phien.get("id_ve_thang"):
            so_tien = 0 
        else:
            ConTro.execute("SELECT * FROM loai_xe WHERE id = %s", (Phien["id_loai_xe"],))
            LoaiXe = ConTro.fetchone()
            so_tien = tinh_tien(LoaiXe, gio_vao, bay_gio)

        so_phut = int((bay_gio - gio_vao).total_seconds() / 60)
        ConTro.execute(
            """UPDATE phien_gui_xe
               SET gio_ra=%s, so_tien=%s, hinh_thuc_thanh_toan=%s, da_thu_tien=1
               WHERE id=%s""",
            (bay_gio, so_tien, hinh_thuc_thanh_toan, Phien["id"])
        )
        KetNoi.commit()
    return so_tien, so_phut, gio_vao


# Xe ra bằng mã QR

@app.post("/xe-ra/quet-qr/")
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

    with KetNoi.cursor(dictionary=True) as ConTro:
        ConTro.execute(
            "SELECT * FROM phien_gui_xe WHERE ma_qr=%s AND gio_ra IS NULL",
            (ma_qr,)
        )
        Phien = ConTro.fetchone()

    if not Phien:
        raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc xe đã ra.")

    # 1. Tính toán thời gian trước
    bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
    so_phut = int((bay_gio - Phien["gio_vao"]).total_seconds() / 60)

    # 2. Xử lý logic tính tiền tạm tính chuẩn xác
    if Phien.get("id_ve_thang"):
        # Nếu là vé tháng -> Tiền = 0, không cần gọi Database thêm
        so_tien_tam = 0
    else:
        # Nếu là vé lượt -> Gọi Database lấy giá tiền và tính toán
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (Phien["id_loai_xe"],))
            LoaiXe = ConTro.fetchone()
        so_tien_tam = tinh_tien(LoaiXe, Phien["gio_vao"], bay_gio)

    return {
        "ma_qr": ma_qr,
        "la_xe_ve_thang": bool(Phien.get("id_ve_thang")),                          
        "ma_phien": Phien["ma_phien"],
        "bien_so": Phien["bien_so"],
        "ten_chu_xe": Phien.get("ten_chu_xe"),
        "sdt": Phien.get("sdt"),
        "gio_vao": str(Phien["gio_vao"]),
        "thoi_gian_gui_phut": so_phut,
        "so_tien_tam_tinh": so_tien_tam,
        "anh_bien_so": f"{BASE_URL}/{Phien['duong_dan_anh_bien_so']}" if Phien.get("duong_dan_anh_bien_so") else None,
        "anh_nguoi_lai": f"{BASE_URL}/{Phien['duong_dan_anh_nguoi_lai']}" if Phien.get("duong_dan_anh_nguoi_lai") else None,
    }

@app.post("/xe-ra/xac-nhan-qr/{ma_qr}", response_model=PhanHoiXeRa)
def xe_ra_xac_nhan(
    ma_qr: str,
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
    try:
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute(
                "SELECT * FROM phien_gui_xe WHERE ma_qr=%s AND gio_ra IS NULL",
                (ma_qr,)
            )
            Phien = ConTro.fetchone()

        if not Phien:
            raise HTTPException(status_code=404, detail="Mã QR không hợp lệ hoặc xe đã ra.")

        # Xe thường bắt buộc có hình thức thanh toán, xe vé tháng thì không cần
        if not Phien.get("id_ve_thang") and not hinh_thuc_thanh_toan:
            raise HTTPException(status_code=422, detail="Vui lòng chọn hình thức thanh toán.")

        httt = hinh_thuc_thanh_toan.value if hinh_thuc_thanh_toan else None
        so_tien, so_phut, gio_vao = _tinh_va_cap_nhat_xe_ra(
            Phien, KetNoi, bay_gio, httt
        )
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

# Xe ra bằng biển số (fallback)
@app.post("/xe-ra/bien-so/")
def kiem_tra_xe_ra_bien_so(
    bien_so: str = Form(...),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    try:
        # 1. Tìm chính xác biển số
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute(
                "SELECT * FROM phien_gui_xe WHERE bien_so=%s AND gio_ra IS NULL",
                (bien_so.upper(),)
            )
            DanhSach = ConTro.fetchall()

        la_tim_mo = False
        if not DanhSach:
            la_tim_mo = True
            duoi = re.sub(r'[^0-9]', '', bien_so)[-5:]
            if len(duoi) < 4:
                raise HTTPException(status_code=404, detail="Vui lòng nhập ít nhất 4 số cuối.")
            with KetNoi.cursor(dictionary=True) as ConTro:
                ConTro.execute(
                    "SELECT * FROM phien_gui_xe WHERE duoi_bien_so LIKE %s AND gio_ra IS NULL",
                    (f"%{duoi}",)
                )
                DanhSach = ConTro.fetchall()

        if not DanhSach:
            raise HTTPException(status_code=404, detail="Không tìm thấy xe trong bãi.")

        # 2. Nếu nhiều kết quả (hoặc tìm mờ) → trả danh sách rút gọn
        if la_tim_mo or len(DanhSach) > 1:
            return {
                "nhieu_ket_qua": True,
                "danh_sach": [
                    {
                        "id": x["id"],
                        "ma_phien": x["ma_phien"],
                        "bien_so": x["bien_so"],
                        "ten_chu_xe": x.get("ten_chu_xe"),
                        "gio_vao": str(x["gio_vao"]),
                        "anh_bien_so": f"{BASE_URL}/{x['duong_dan_anh_bien_so']}" if x.get("duong_dan_anh_bien_so") else None
                    } for x in DanhSach
                ],
                "ghi_chu": "Vui lòng chọn đúng xe và gửi ID phiên để xác nhận ra."
            }

        # 3. Chỉ 1 xe khớp chính xác → trả về đầy đủ thông tin
        xe = DanhSach[0]
        bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
        so_phut = int((bay_gio - xe["gio_vao"]).total_seconds() / 60)

        # Tính tiền tạm tính
        if xe.get("id_ve_thang"):
            so_tien_tam = 0
        else:
            with KetNoi.cursor(dictionary=True) as ConTro:
                ConTro.execute("SELECT * FROM loai_xe WHERE id=%s", (xe["id_loai_xe"],))
                loai_xe = ConTro.fetchone()
            so_tien_tam = tinh_tien(loai_xe, xe["gio_vao"], bay_gio)

        return {
            "id": xe["id"],
            "ma_phien": xe["ma_phien"],
            "bien_so": xe["bien_so"],
            "ten_chu_xe": xe.get("ten_chu_xe"),
            "sdt": xe.get("sdt"),
            "gio_vao": str(xe["gio_vao"]),
            "thoi_gian_gui_phut": so_phut,
            "so_tien_tam_tinh": so_tien_tam,
            "anh_bien_so": f"{BASE_URL}/{xe['duong_dan_anh_bien_so']}" if xe.get("duong_dan_anh_bien_so") else None,
            "anh_nguoi_lai": f"{BASE_URL}/{xe['duong_dan_anh_nguoi_lai']}" if xe.get("duong_dan_anh_nguoi_lai") else None,
            "la_xe_ve_thang": bool(xe.get("id_ve_thang"))
        }
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise

@app.post("/xe-ra/bien-so/xac-nhan")
def xac_nhan_xe_ra_bien_so(
    id_phien: int = Form(...),
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
    try:
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute(
                "SELECT * FROM phien_gui_xe WHERE id=%s AND gio_ra IS NULL",
                (id_phien,)
            )
            Phien = ConTro.fetchone()

        if not Phien:
            raise HTTPException(status_code=404, detail="Phiên gửi xe không tồn tại hoặc đã kết thúc.")

        if not Phien.get("id_ve_thang") and not hinh_thuc_thanh_toan:
            raise HTTPException(status_code=422, detail="Vui lòng chọn hình thức thanh toán.")

        httt = hinh_thuc_thanh_toan.value if hinh_thuc_thanh_toan else None
        so_tien, so_phut, gio_vao = _tinh_va_cap_nhat_xe_ra(
            Phien, KetNoi, bay_gio, httt
        )

        return {
            "id": Phien["id"],
            "ma_phien": Phien["ma_phien"],
            "bien_so": Phien["bien_so"],
            "ten_chu_xe": Phien.get("ten_chu_xe"),
            "gio_vao": gio_vao,
            "gio_ra": bay_gio,
            "thoi_gian_gui_phut": so_phut,
            "so_tien": so_tien,
            "hinh_thuc_thanh_toan": hinh_thuc_thanh_toan
        }
    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise
# ───────────────────────────────────────────
# DANH SÁCH XE TRONG BÃI
# ───────────────────────────────────────────
@app.get("/xe-trong-bai/")
def xe_trong_bai(KetNoi=Depends(lay_ket_noi_CSDL)):
    bay_gio = datetime.now(VN_TZ).replace(tzinfo=None)
    with KetNoi.cursor(dictionary=True) as ConTro:
        ConTro.execute("""
            SELECT p.id, p.ma_phien, p.bien_so, p.ten_chu_xe, p.gio_vao,
                   p.id_ve_thang, p.duong_dan_anh_bien_so, p.duong_dan_anh_nguoi_lai,
                   l.ten AS ten_loai_xe, l.kieu_tinh_gia, l.gia_luot,
                   l.gia_ngay, l.gia_dem, l.gia_ngay_dem, l.cau_hinh_theo_gio
            FROM phien_gui_xe p
            JOIN loai_xe l ON p.id_loai_xe = l.id
            WHERE p.gio_ra IS NULL
            ORDER BY p.gio_vao DESC
        """)
        DanhSach = ConTro.fetchall()
    KetQua = []
    for xe in DanhSach:
        if xe.get("id_ve_thang"):
            so_tien_tam = 0
        else:
            so_tien_tam = tinh_tien(xe, xe["gio_vao"], bay_gio)

        url_anh_bien = f"{BASE_URL}/{xe['duong_dan_anh_bien_so']}" if xe.get('duong_dan_anh_bien_so') else None
        url_anh_nguoi = f"{BASE_URL}/{xe['duong_dan_anh_nguoi_lai']}" if xe.get('duong_dan_anh_nguoi_lai') else None

        KetQua.append({
            "anh_bien_so": url_anh_bien,
            "anh_nguoi_lai": url_anh_nguoi,
            "id": xe["id"],
            "ma_phien": xe["ma_phien"],
            "bien_so": xe["bien_so"],
            "ten_loai_xe": xe["ten_loai_xe"],
            "ten_chu_xe": xe.get("ten_chu_xe"),
            "gio_vao": str(xe["gio_vao"]),
            "so_tien_tam_tinh": so_tien_tam
        })
    return KetQua


# ───────────────────────────────────────────
# VÉ THÁNG
# ───────────────────────────────────────────
@app.post("/ve-thang/", response_model=PhanHoiVeThang)
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
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    sdt = sdt.strip() if sdt else None
    email = email.strip() if email else None

    if sdt and not re.match(r'^(0|\+84)[0-9]{8,10}$', sdt):
        raise HTTPException(status_code=422, detail="Số điện thoại không hợp lệ.")
    if email and not re.match(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$', email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")
    if not sdt and not email:
        raise HTTPException(status_code=422, detail="Vui lòng cung cấp ít nhất số điện thoại hoặc email.")

    bien_so_chuan = bien_so.upper().strip()
    hom_nay = date.today()
    ngay_het_han = hom_nay + timedelta(days=30)

    try:
        # ── 1. Kiểm tra DB trước ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("""
                SELECT id, ngay_het_han FROM ve_thang
                WHERE bien_so = %s AND ngay_het_han >= %s
                LIMIT 1
            """, (bien_so_chuan, hom_nay))
            ve_ton_tai = ConTro.fetchone()
            if ve_ton_tai:
                raise HTTPException(
                    status_code=400,
                    detail=f"Biển số {bien_so_chuan} đã có vé tháng còn hạn đến ngày {ve_ton_tai['ngay_het_han']}."
                )

            ConTro.execute("SELECT gia_luot, gia_ve_thang FROM loai_xe WHERE id=%s", (id_loai_xe,))
            LoaiXe = ConTro.fetchone()
            if not LoaiXe:
                raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

        so_tien = LoaiXe["gia_ve_thang"] or LoaiXe["gia_luot"]
        duoi_bien_so = re.sub(r'[^0-9]', '', bien_so_chuan)[-5:]

        # ── 2. Lưu ảnh sau khi DB xác nhận OK ──
        duong_dan_bien_so = await luu_anh(anh_bien_so, "uploads/bien_so") if anh_bien_so else None
        duong_dan_nguoi_dung = await luu_anh(anh_nguoi_dung, "uploads/nguoi_dung") if anh_nguoi_dung else None

        # ── 3. INSERT ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            sql = """INSERT INTO ve_thang
                     (bien_so, duoi_bien_so, ten_chu_xe, sdt, email, dia_chi, ghi_chu,
                      cho_phep_lay_ho, id_loai_xe, duong_dan_anh_bien_so,
                      duong_dan_anh_nguoi_dung, ngay_dang_ky, ngay_het_han, so_tien)
                     VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
            ConTro.execute(sql, (
                bien_so_chuan, duoi_bien_so, ten_chu_xe, sdt, email, dia_chi, ghi_chu,
                int(cho_phep_lay_ho), id_loai_xe, duong_dan_bien_so,
                duong_dan_nguoi_dung, hom_nay, ngay_het_han, so_tien
            ))
            KetNoi.commit()
            id_moi = ConTro.lastrowid

            du_lieu_qr = {
                "loai": "ve_thang",
                "id": id_moi,
                "bien_so": bien_so_chuan,
                "ten_chu_xe": ten_chu_xe,
                "ngay_het_han": str(ngay_het_han)
            }
            ma_qr, duong_dan_qr = tao_ma_qr(du_lieu_qr)
            ConTro.execute("UPDATE ve_thang SET ma_qr=%s WHERE id=%s", (ma_qr, id_moi))
            KetNoi.commit()

        # ── 4. Gửi email ──
        if email:
            asyncio.create_task(gui_email_qr(
                den=email, ten_chu_xe=ten_chu_xe, bien_so=bien_so_chuan,
                gio_vao=f"Ngày đăng ký: {hom_nay} | Hết hạn: {ngay_het_han}",
                duong_dan_qr=duong_dan_qr
            ))

        return {
            "id": id_moi,
            "bien_so": bien_so_chuan,
            "ten_chu_xe": ten_chu_xe,
            "ngay_dang_ky": hom_nay,
            "ngay_het_han": ngay_het_han,
            "so_tien": so_tien,
            "ma_qr": ma_qr,
            "trang_thai": "con_han"
        }
    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise
@app.get("/ve-thang/")
def danh_sach_ve_thang(KetNoi=Depends(lay_ket_noi_CSDL)):
    hom_nay = date.today()
    with KetNoi.cursor(dictionary=True) as ConTro:
        ConTro.execute("""
            SELECT v.*, l.ten AS ten_loai_xe
            FROM ve_thang v
            JOIN loai_xe l ON v.id_loai_xe = l.id
            ORDER BY v.ngay_het_han ASC
        """)
        DanhSach = ConTro.fetchall()

    KetQua = []
    # Sau — xóa dòng thừa
    for ve in DanhSach:
        ngay_het_han = ve["ngay_het_han"]
        ve["trang_thai"] = tinh_trang_thai(ngay_het_han)
        ve["so_ngay_con"] = (ngay_het_han - hom_nay).days
        KetQua.append(ve)
    return KetQua