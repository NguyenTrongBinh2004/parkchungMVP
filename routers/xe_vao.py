# routers/xe_vao.py
from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
import re, os, uuid, asyncio, logging
from typing import Optional
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
import mysql.connector
import aiofiles

from database import lay_ket_noi_CSDL
from models import PhanHoiXeVao
from services.qr_service import tao_ma_qr, doc_ma_qr
from services.ocr import nhan_dien_bien_so
from services.email_service import gui_email_qr
from services.sms_service import gui_thong_bao_xe_vao

router = APIRouter(prefix="/xe-vao", tags=["Xe Vào"])

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
def chuan_hoa_bien_so(bien_so: str) -> str:
    """Loại bỏ tất cả ký tự không phải chữ cái hoặc số."""
    return re.sub(r'[^A-Z0-9]', '', bien_so.upper().strip())
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB

def bay_gio_vn():
    return datetime.now(VN_TZ).replace(tzinfo=None)

def build_url(path: str | None) -> str | None:
    return f"{BASE_URL}/{path}" if path else None

async def luu_anh(file: UploadFile, thu_muc: str) -> str:
    """Lưu file upload, giới hạn kích thước."""
    os.makedirs(thu_muc, exist_ok=True)
    du_lieu = await file.read(MAX_IMAGE_SIZE + 1)
    if len(du_lieu) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Ảnh quá lớn (tối đa 10MB).")
    ten_file = f"{uuid.uuid4().hex}_{file.filename}"
    duong_dan = os.path.join(thu_muc, ten_file)
    async with aiofiles.open(duong_dan, "wb") as f:
        await f.write(du_lieu)
    return duong_dan.replace("\\", "/")

async def gui_thong_bao(email, sdt, ten_chu_xe, bien_so, gio_vao, duong_dan_qr, ma_phien):
    """Gửi thông báo bất đồng bộ qua email và SMS (Zalo/SMS)."""
    if email:
        asyncio.create_task(gui_email_qr(
            den=email, ten_chu_xe=ten_chu_xe, bien_so=bien_so,
            gio_vao=str(gio_vao), duong_dan_qr=duong_dan_qr
        ))
    if sdt:
        # gui_thong_bao_xe_vao chỉ cần sdt, bien_so, ma_phien
        asyncio.create_task(asyncio.to_thread(
            gui_thong_bao_xe_vao, sdt, bien_so, ma_phien
        ))

# ───────────────────────────────────────────
# 1. NHẬN DIỆN (CHỈ OCR / QR, KHÔNG DB)
# ───────────────────────────────────────────
@router.post("/nhan-dien/")
async def nhan_dien_xe_vao(
    anh: UploadFile = File(...),
    KetNoi=Depends(lay_ket_noi_CSDL)   # thêm dòng này
):
    du_lieu_anh = await anh.read(MAX_IMAGE_SIZE + 1)
    if len(du_lieu_anh) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Ảnh quá lớn (tối đa 10MB).")

    # ── 1. Thử QR trước ──
    try:
        du_lieu_qr = doc_ma_qr(du_lieu_anh)
        ma_qr = du_lieu_qr.get("ma_qr")
        loai_qr = du_lieu_qr.get("loai")
        if loai_qr == "ve_thang" and ma_qr:
            # Tìm vé tháng trong DB
            with KetNoi.cursor(dictionary=True) as ConTro:
                ConTro.execute("""
                    SELECT v.*, k.ten AS ten_chu_xe, k.sdt, k.cho_phep_lay_ho
                    FROM ve_thang v
                    JOIN khach_hang k ON v.id_khach_hang = k.id
                    WHERE v.ma_qr = %s AND v.ngay_het_han >= %s
                """, (ma_qr, date.today()))
                ve = ConTro.fetchone()

            if ve:
                so_ngay_con = (ve["ngay_het_han"] - date.today()).days
                return {
                    "loai": "ve_thang_qr",
                    "ma_qr": ve["ma_qr"],
                    "bien_so": ve["bien_so"],
                    "ten_chu_xe": ve["ten_chu_xe"],
                    "sdt": ve.get("sdt"),
                    "ngay_het_han": str(ve["ngay_het_han"]),
                    "so_ngay_con": so_ngay_con,
                    "canh_bao": f"⚠️ Vé tháng còn {so_ngay_con} ngày" if so_ngay_con <= 7 else None,
                    "anh_bien_so": build_url(ve.get("duong_dan_anh_bien_so")),
                    "anh_nguoi_dung": build_url(ve.get("duong_dan_anh_nguoi_dung")),
                    "cho_phep_lay_ho": bool(ve.get("cho_phep_lay_ho", False)),
                    "ghi_chu": ve.get("ghi_chu") or "Đọc QR vé tháng thành công. Xác nhận để cho xe vào."
                }
            # Nếu QR không tìm thấy vé (hết hạn hoặc sai) → rơi xuống OCR
    except Exception:
        pass  # QR không hợp lệ → tiếp tục OCR

    # ── 2. OCR biển số ──
    bien_so_ocr = nhan_dien_bien_so(du_lieu_anh)
    if not bien_so_ocr:
        raise HTTPException(status_code=400, detail="Không nhận diện được QR hay biển số trong ảnh.")

    return {
        "loai": "bien_so",
        "bien_so_nhan_dien": bien_so_ocr,
        "ghi_chu": "Kiểm tra và sửa biển số nếu cần, sau đó nhấn Kiểm tra."
    }

# ───────────────────────────────────────────
# 2. KIỂM TRA BIỂN SỐ (SAU KHI NGƯỜI DÙNG SỬA / XÁC NHẬN)
# ───────────────────────────────────────────
@router.post("/kiem-tra-bien-so/")
def kiem_tra_bien_so(
    bien_so: str = Form(...),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    # Chuẩn hóa biển số đầu vào
    bien_so_sach = chuan_hoa_bien_so(bien_so)
    if len(bien_so_sach) < 5:
        raise HTTPException(status_code=422, detail="Biển số quá ngắn.")

    with KetNoi.cursor(dictionary=True) as ConTro:
        # Kiểm tra xe đang trong bãi (dùng chuẩn hóa)
        ConTro.execute(
            """SELECT id FROM phien_gui_xe
            WHERE REPLACE(REPLACE(REPLACE(bien_so, '-', ''), '.', ''), ' ', '') = %s
                AND is_in_bai = 1""",
            (bien_so_sach,)
        )
        if ConTro.fetchone():
            raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi.")

        # Tìm vé tháng còn hạn (dùng chuẩn hóa)
        ConTro.execute("""
            SELECT v.*, k.ten AS ten_chu_xe, k.sdt, k.email, k.cho_phep_lay_ho
            FROM ve_thang v
            JOIN khach_hang k ON v.id_khach_hang = k.id
            WHERE REPLACE(REPLACE(REPLACE(v.bien_so, '-', ''), '.', ''), ' ', '') = %s
            AND v.ngay_het_han >= %s
        """, (bien_so_sach, date.today()))
        ve_thang = ConTro.fetchone()

    # Phần còn lại giữ nguyên (xử lý kết quả ve_thang hoặc trả về xe_thuong)
    if ve_thang:
        so_ngay_con = (ve_thang["ngay_het_han"] - date.today()).days
        return {
            "loai": "ve_thang",
            "ma_qr": ve_thang["ma_qr"],
            "bien_so": ve_thang["bien_so"],
            "ten_chu_xe": ve_thang["ten_chu_xe"],
            "sdt": ve_thang.get("sdt"),
            "ngay_het_han": str(ve_thang["ngay_het_han"]),
            "so_ngay_con": so_ngay_con,
            "canh_bao": f"⚠️ Vé tháng còn {so_ngay_con} ngày" if so_ngay_con <= 7 else None,
            "anh_bien_so":   build_url(ve_thang.get("duong_dan_anh_bien_so")),
            "anh_nguoi_dung": build_url(ve_thang.get("duong_dan_anh_nguoi_dung")),
            "cho_phep_lay_ho": bool(ve_thang.get("cho_phep_lay_ho", False)),
            "ghi_chu": "Tìm thấy vé tháng. Xác nhận để cho xe vào."
        }

    # Không có vé tháng → xe thường
    return {
        "loai": "xe_thuong",
        "bien_so": bien_so,  # giữ nguyên input để hiển thị
        "ghi_chu": "Không có vé tháng. Tiếp tục cho xe vào dạng vé thường."
    }

# ───────────────────────────────────────────
# 3. XE VÀO – VÉ THÁNG
# ───────────────────────────────────────────
@router.post("/ve-thang/xac-nhan/", response_model=PhanHoiXeVao)
async def xac_nhan_xe_vao_ve_thang(
    ma_qr: str = Form(...),
    ghi_chu: Optional[str] = Form(None),
    anh_bien_so: UploadFile = File(...),
    anh_nguoi_lai: UploadFile = File(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    bay_gio = bay_gio_vn()
    try:
        # ── 1. Kiểm tra vé tháng ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("""
                SELECT v.*, k.ten AS ten_chu_xe, k.sdt, k.email, k.cho_phep_lay_ho
                FROM ve_thang v
                JOIN khach_hang k ON v.id_khach_hang = k.id
                WHERE v.ma_qr = %s AND v.ngay_het_han >= %s
            """, (ma_qr, date.today()))
            ve_thang = ConTro.fetchone()

        if not ve_thang:
            raise HTTPException(status_code=404, detail="Vé tháng không còn hạn.")

        # ── 2. Kiểm tra xe đang trong bãi ──
        bien_so = ve_thang["bien_so"]
        bien_so_sach = chuan_hoa_bien_so(bien_so)
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute(
                """SELECT id FROM phien_gui_xe
                WHERE REPLACE(REPLACE(REPLACE(bien_so, '-', ''), '.', ''), ' ', '') = %s
                    AND is_in_bai = 1""",
                (bien_so_sach,)
            )
            if ConTro.fetchone():
                raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi.")

        # ── 3. Lưu ảnh ──
        duong_dan_bien_so   = await luu_anh(anh_bien_so,   "uploads/bien_so")
        duong_dan_nguoi_lai = await luu_anh(anh_nguoi_lai, "uploads/nguoi_lai") if anh_nguoi_lai else None

        bien_so      = ve_thang["bien_so"]
        duoi_bien_so = re.sub(r'[^0-9]', '', bien_so)[-5:]
        ma_phien     = f"GX{uuid.uuid4().hex[:8].upper()}"

        # ── 4. Tạo QR riêng cho phiên (trước khi INSERT) ──
        du_lieu_qr_phien = {
            "ma_phien": ma_phien,
            "bien_so": bien_so,
            "ten_chu_xe": ve_thang["ten_chu_xe"],
            "sdt": ve_thang.get("sdt") or "",
            "gio_vao": str(bay_gio),
            "anh_bien_so":   build_url(duong_dan_bien_so)   or "",
            "anh_nguoi_lai": build_url(duong_dan_nguoi_lai) or "",
        }
        ma_qr_moi, duong_dan_qr_moi = tao_ma_qr(du_lieu_qr_phien)

        # ── 5. INSERT phiên (duy nhất 1 commit) ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            try:
                ConTro.execute("""
                    INSERT INTO phien_gui_xe
                    (ma_phien, bien_so, duoi_bien_so, id_loai_xe, id_khach_hang,
                     id_ve_thang, ma_qr, duong_dan_anh_bien_so, duong_dan_anh_nguoi_lai,
                     gio_vao, so_tien, cho_phep_lay_ho, is_in_bai)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1)
                """, (
                    ma_phien, bien_so, duoi_bien_so,
                    ve_thang["id_loai_xe"], ve_thang["id_khach_hang"],
                    ve_thang["id"], ma_qr_moi,
                    duong_dan_bien_so, duong_dan_nguoi_lai,
                    bay_gio, 0,
                    int(ve_thang.get("cho_phep_lay_ho", 0))
                ))
                id_moi = ConTro.lastrowid
                KetNoi.commit()
            except mysql.connector.IntegrityError:
                KetNoi.rollback()
                raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi (biển số trùng).")

        # ── 6. Gửi thông báo ──
        so_ngay_con    = (ve_thang["ngay_het_han"] - date.today()).days
        ghi_chu_tra_ve = f"Vé tháng còn {so_ngay_con} ngày" if so_ngay_con <= 7 else "Vé tháng hợp lệ"
        if ghi_chu:
            ghi_chu_tra_ve = f"{ghi_chu_tra_ve} | {ghi_chu}"

        await gui_thong_bao(
            ve_thang.get("email"), ve_thang.get("sdt"),
            ve_thang["ten_chu_xe"], bien_so, bay_gio,
            duong_dan_qr_moi,
            ma_phien
        )

        return {
            "id": id_moi, "ma_phien": ma_phien, "bien_so": bien_so,
            "id_loai_xe": ve_thang["id_loai_xe"],
            "ten_chu_xe": ve_thang["ten_chu_xe"],
            "gio_vao": bay_gio, "ma_qr": ma_qr_moi,
            "qr_image_url": f"{BASE_URL}/{duong_dan_qr_moi}",
            "ghi_chu": ghi_chu_tra_ve
        }

    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise

# ───────────────────────────────────────────
# 4. XE VÀO – XE THƯỜNG
# ───────────────────────────────────────────
@router.post("/ve-thuong/xac-nhan/", response_model=PhanHoiXeVao)
async def xac_nhan_xe_vao_ve_thuong(
    id_loai_xe: int = Form(...),
    bien_so_xac_nhan: str = Form(...),
    ten_chu_xe: Optional[str] = Form(None),
    sdt: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    ghi_chu: Optional[str] = Form(None),
    cho_phep_lay_ho: bool = Form(False),
    anh_bien_so: UploadFile = File(...),
    anh_nguoi_lai: UploadFile = File(...),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    sdt   = sdt.strip()   if sdt   else None
    email = email.strip() if email else None

    if sdt and not re.match(r'^(0|\+84)[0-9]{8,10}$', sdt):
        raise HTTPException(status_code=422, detail="Số điện thoại không hợp lệ.")
    if email and not re.match(r'^[\w\.-]+@[\w\.-]+\.\w{2,}$', email):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")

    bay_gio      = bay_gio_vn()
    bien_so_goc  = bien_so_xac_nhan.upper().strip()          # Giữ nguyên để lưu DB
    bien_so_sach = chuan_hoa_bien_so(bien_so_xac_nhan)       # Dùng để so sánh
    duoi_bien_so = bien_so_sach[-5:] if len(bien_so_sach) >= 5 else bien_so_sach
    ten_khach    = ten_chu_xe.strip() if ten_chu_xe else None

    try:
        # ── 1. Validate loại xe và kiểm tra vé tháng (chuẩn hóa) ──
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("SELECT id FROM loai_xe WHERE id=%s", (id_loai_xe,))
            if not ConTro.fetchone():
                raise HTTPException(status_code=404, detail=f"Không tìm thấy loại xe id: {id_loai_xe}")

            ConTro.execute(
                """SELECT id FROM ve_thang
                WHERE REPLACE(REPLACE(REPLACE(bien_so, '-', ''), '.', ''), ' ', '') = %s
                    AND ngay_het_han >= %s""",
                (bien_so_sach, date.today())
            )
            if ConTro.fetchone():
                raise HTTPException(status_code=400,
                    detail="Xe đang có vé tháng. Vui lòng cho xe vào bằng chức năng quét QR.")

        # ── 2. Kiểm tra xe đang trong bãi (chuẩn hóa) ──
            ConTro.execute(
                """SELECT id FROM phien_gui_xe
                WHERE REPLACE(REPLACE(REPLACE(bien_so, '-', ''), '.', ''), ' ', '') = %s
                    AND is_in_bai = 1""",
                (bien_so_sach,)
            )
            if ConTro.fetchone():
                raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi.")

        # ── 3. Lưu ảnh ──
        duong_dan_bien_so   = await luu_anh(anh_bien_so,   "uploads/bien_so")
        duong_dan_nguoi_lai = await luu_anh(anh_nguoi_lai, "uploads/nguoi_lai") if anh_nguoi_lai else None

        with KetNoi.cursor(dictionary=True) as ConTro:
            # ── 4. Tạo khách hàng nếu có thông tin ──
            id_khach_hang = None
            if ten_khach or sdt or email:
                ConTro.execute("""
                    INSERT INTO khach_hang (ten, sdt, email, cho_phep_lay_ho)
                    VALUES (%s,%s,%s,%s)
                """, (ten_khach or "Khách vãng lai", sdt, email, int(cho_phep_lay_ho)))
                id_khach_hang = ConTro.lastrowid

            ma_phien = f"GX{uuid.uuid4().hex[:8].upper()}"

            # ── 5. Tạo QR phiên ──
            du_lieu_qr = {
                "ma_phien": ma_phien, "bien_so": bien_so_goc,
                "ten_chu_xe": ten_khach or "Khách vãng lai", "sdt": sdt or "",
                "gio_vao": str(bay_gio),
                "anh_bien_so":   build_url(duong_dan_bien_so)   or "",
                "anh_nguoi_lai": build_url(duong_dan_nguoi_lai) or "",
            }
            ma_qr, duong_dan_qr = tao_ma_qr(du_lieu_qr)

            # ── 6. INSERT phiên ──
            try:
                ConTro.execute("""
                    INSERT INTO phien_gui_xe
                    (ma_phien, bien_so, duoi_bien_so, id_loai_xe, id_khach_hang,
                     duong_dan_anh_bien_so, duong_dan_anh_nguoi_lai, gio_vao, ghi_chu,
                     cho_phep_lay_ho, ma_qr, is_in_bai)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1)
                """, (
                    ma_phien, bien_so_goc, duoi_bien_so, id_loai_xe, id_khach_hang,
                    duong_dan_bien_so, duong_dan_nguoi_lai, bay_gio, ghi_chu,
                    int(cho_phep_lay_ho), ma_qr
                ))
                id_moi = ConTro.lastrowid
                KetNoi.commit()
            except mysql.connector.IntegrityError:
                KetNoi.rollback()
                raise HTTPException(status_code=400, detail="Xe này hiện đang trong bãi (biển số trùng).")

        # ── 7. Gửi thông báo ──
        await gui_thong_bao(
            email, sdt, ten_khach or "Khách vãng lai", bien_so_goc, bay_gio,
            duong_dan_qr, ma_phien
        )

        return {
            "id": id_moi, "ma_phien": ma_phien, "bien_so": bien_so_goc,
            "id_loai_xe": id_loai_xe,
            "ten_chu_xe": ten_khach or "Khách vãng lai",
            "gio_vao": bay_gio, "ma_qr": ma_qr,
            "qr_image_url": f"{BASE_URL}/{duong_dan_qr}",
            "ghi_chu": ghi_chu or "Xe vãng lai vào bãi thành công"
        }

    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise