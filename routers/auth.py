import re, hashlib, mysql.connector
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import lay_ket_noi_CSDL
from services.auth_service import (
    hash_mat_khau, xac_minh_mat_khau, tao_otp,
    tao_access_token, tao_refresh_token,
    lay_nguoi_dung_hien_tai
)
from services.sms_service import gui_otp
from utils import bay_gio_vn

router = APIRouter(prefix="/auth", tags=["Xác thực"])

REGEX_SDT         = re.compile(r'^(0[3-9][0-9]{8}|\+84[3-9][0-9]{8})$')
OTP_TTL_PHUT      = 5
OTP_COOLDOWN_GIAY = 60
OTP_GIOI_HAN_NGAY = 5
DANG_NHAP_KHOA_SAU = 10   # lần
DANG_NHAP_KHOA_PHUT = 15


# ── Models ──────────────────────────────────────────────────────
class DangKyBody(BaseModel):
    sdt:        str
    mat_khau:   str  = Field(..., min_length=8, max_length=20)
    ten_bai_xe: str  = Field(..., min_length=2, max_length=100)

class XacNhanOTPBody(BaseModel):
    sdt:        str
    ma_otp:     str  = Field(..., min_length=6, max_length=6)
    mat_khau:   str
    ten_bai_xe: str

class GuiLaiOTPBody(BaseModel):
    sdt: str

class DangNhapBody(BaseModel):
    sdt:      str
    mat_khau: str

class RefreshBody(BaseModel):
    refresh_token: str

class DangXuatBody(BaseModel):
    refresh_token: str

class QuenMatKhauBody(BaseModel):
    sdt: str

class XacNhanOTPQMKBody(BaseModel):
    sdt:    str
    ma_otp: str = Field(..., min_length=6, max_length=6)

class DatLaiMatKhauBody(BaseModel):
    sdt:        str
    ma_otp:     str = Field(..., min_length=6, max_length=6)
    mat_khau:   str = Field(..., min_length=8, max_length=20)

class DoiMatKhauBody(BaseModel):
    mat_khau_hien_tai: str
    mat_khau_moi:      str = Field(..., min_length=8, max_length=20)

# ── Helpers ─────────────────────────────────────────────────────
def _validate_sdt(sdt: str):
    if not REGEX_SDT.match(sdt):
        raise HTTPException(422, "Số điện thoại không đúng định dạng Việt Nam")

def _validate_mat_khau(mat_khau: str):
    if len(mat_khau) < 8:
        raise HTTPException(422, "Mật khẩu phải có ít nhất 8 ký tự")
    if len(mat_khau) > 20:
        raise HTTPException(422, "Mật khẩu không được vượt quá 20 ký tự")
    if not re.search(r'[a-zA-Z]', mat_khau) or not re.search(r'[0-9]', mat_khau):
        raise HTTPException(422, "Mật khẩu phải có ít nhất 1 chữ cái và 1 chữ số")
    if not re.search(r'[A-Z]', mat_khau):
        raise HTTPException(422, "Mật khẩu phải có ít nhất 1 chữ hoa")

def _kiem_tra_cooldown(sdt: str, KetNoi):
    bay_gio = bay_gio_vn().replace(tzinfo=None)
    with KetNoi.cursor(dictionary=True) as cur:
        # Cooldown 60 giây giữa 2 lần gửi
        cur.execute("""
            SELECT created_at FROM otp
            WHERE sdt = %s AND muc_dich = 'dang_ky'
            ORDER BY created_at DESC LIMIT 1
        """, (sdt,))
        row = cur.fetchone()
        if row:
            delta = (bay_gio - row["created_at"]).total_seconds()
            if delta < OTP_COOLDOWN_GIAY:
                con_lai = int(OTP_COOLDOWN_GIAY - delta)
                raise HTTPException(429, f"Vui lòng chờ {con_lai} giây trước khi gửi lại")

        # Tối đa 5 OTP/ngày/SĐT
        cur.execute("""
            SELECT COUNT(*) AS so_lan FROM otp
            WHERE sdt = %s AND muc_dich = 'dang_ky'
              AND DATE(created_at) = CURDATE()
        """, (sdt,))
        if cur.fetchone()["so_lan"] >= OTP_GIOI_HAN_NGAY:
            raise HTTPException(429, "Đã vượt giới hạn gửi OTP trong ngày. Thử lại vào ngày mai.")
        

def _kiem_tra_cooldown_qmk(sdt: str, KetNoi):
    bay_gio = bay_gio_vn().replace(tzinfo=None)
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT created_at FROM otp
            WHERE sdt = %s AND muc_dich = 'quen_mat_khau'
            ORDER BY created_at DESC LIMIT 1
        """, (sdt,))
        row = cur.fetchone()
        if row:
            delta = (bay_gio - row["created_at"]).total_seconds()
            if delta < OTP_COOLDOWN_GIAY:
                con_lai = int(OTP_COOLDOWN_GIAY - delta)
                raise HTTPException(429, f"Vui lòng chờ {con_lai} giây trước khi gửi lại")

        cur.execute("""
            SELECT COUNT(*) AS so_lan FROM otp
            WHERE sdt = %s AND muc_dich = 'quen_mat_khau'
              AND DATE(created_at) = CURDATE()
        """, (sdt,))
        if cur.fetchone()["so_lan"] >= OTP_GIOI_HAN_NGAY:
            raise HTTPException(429, "Đã vượt giới hạn gửi OTP trong ngày. Thử lại vào ngày mai.")


def _lay_bai_xe(id_nguoi_dung: int, KetNoi) -> dict:
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            "SELECT id, ten FROM bai_xe WHERE id_chu_bai = %s LIMIT 1",
            (id_nguoi_dung,)
        )
        bai_xe = cur.fetchone()
    if not bai_xe:
        raise HTTPException(404, "Không tìm thấy bãi xe")
    return bai_xe


# ── 1. Đăng ký — gửi OTP ────────────────────────────────────────
@router.post("/dang-ky/")
def dang_ky(body: DangKyBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)
    _validate_mat_khau(body.mat_khau)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM nguoi_dung WHERE sdt = %s", (body.sdt,))
        if cur.fetchone():
            raise HTTPException(400, "Số điện thoại này đã được đăng ký")

    _kiem_tra_cooldown(body.sdt, KetNoi)

    ma_otp  = tao_otp()
    bay_gio = bay_gio_vn().replace(tzinfo=None)
    het_han = bay_gio + timedelta(minutes=OTP_TTL_PHUT)

    with KetNoi.cursor() as cur:
        # Hủy OTP cũ chưa dùng
        cur.execute("""
            UPDATE otp SET da_dung = 1
            WHERE sdt = %s AND muc_dich = 'dang_ky' AND da_dung = 0
        """, (body.sdt,))
        cur.execute("""
            INSERT INTO otp (sdt, ma_otp, muc_dich, het_han_luc)
            VALUES (%s, %s, 'dang_ky', %s)
        """, (body.sdt, ma_otp, het_han))
    KetNoi.commit()

    try:
        gui_otp(body.sdt, ma_otp)
    except Exception as e:
        raise HTTPException(500, f"Không gửi được SMS: {e}")

    return {"message": "Mã OTP đã được gửi", "het_han_sau_giay": OTP_TTL_PHUT * 60}


# ── 2. Xác nhận OTP → tạo tài khoản ────────────────────────────
@router.post("/xac-nhan-otp/")
def xac_nhan_otp(body: XacNhanOTPBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)
    bay_gio = bay_gio_vn().replace(tzinfo=None)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT * FROM otp
            WHERE sdt = %s AND muc_dich = 'dang_ky' AND da_dung = 0
            ORDER BY created_at DESC LIMIT 1
        """, (body.sdt,))
        otp_row = cur.fetchone()

    if not otp_row:
        raise HTTPException(400, "Không tìm thấy mã OTP. Vui lòng gửi lại.")
    if otp_row["so_lan_thu"] >= 5:
        raise HTTPException(400, "OTP đã bị hủy do nhập sai quá 5 lần. Vui lòng gửi lại.")
    if otp_row["het_han_luc"] < bay_gio:
        raise HTTPException(400, "Mã OTP đã hết hạn. Vui lòng gửi lại.")

    if otp_row["ma_otp"] != body.ma_otp:
        with KetNoi.cursor() as cur:
            cur.execute(
                "UPDATE otp SET so_lan_thu = so_lan_thu + 1 WHERE id = %s",
                (otp_row["id"],)
            )
        KetNoi.commit()
        con_lai = 5 - (otp_row["so_lan_thu"] + 1)
        raise HTTPException(400, f"Mã OTP không đúng. Còn {con_lai} lần thử.")

    # Đánh dấu OTP đã dùng
    with KetNoi.cursor() as cur:
        cur.execute("UPDATE otp SET da_dung = 1 WHERE id = %s", (otp_row["id"],))
    KetNoi.commit()

    # Kiểm tra race condition
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM nguoi_dung WHERE sdt = %s", (body.sdt,))
        if cur.fetchone():
            KetNoi.commit()
            raise HTTPException(400, "Số điện thoại này đã được đăng ký")

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute(
                "INSERT INTO nguoi_dung (sdt, mat_khau_hash) VALUES (%s, %s)",
                (body.sdt, hash_mat_khau(body.mat_khau))
            )
            id_nguoi_dung = cur.lastrowid
            cur.execute(
                "INSERT INTO bai_xe (id_chu_bai, ten) VALUES (%s, %s)",
                (id_nguoi_dung, body.ten_bai_xe)
            )
            id_bai_xe = cur.lastrowid

        raw_refresh, hash_refresh = tao_refresh_token()
        het_han_rt = bay_gio + timedelta(days=30)
        with KetNoi.cursor() as cur:
            cur.execute(
                "INSERT INTO refresh_token (id_nguoi_dung, token_hash, het_han_luc) VALUES (%s, %s, %s)",
                (id_nguoi_dung, hash_refresh, het_han_rt)
            )
        KetNoi.commit()

        return {
            "access_token":  tao_access_token(id_nguoi_dung, id_bai_xe),
            "refresh_token": raw_refresh,
            "ten_bai_xe":    body.ten_bai_xe,
            "id_bai_xe":     id_bai_xe,
        }
    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(500, f"Lỗi CSDL: {err}")
    except HTTPException:
        raise
    except Exception as err:
        KetNoi.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Lỗi không xác định: {err}")


# ── 3. Gửi lại OTP ──────────────────────────────────────────────
@router.post("/gui-lai-otp/")
def gui_lai_otp(body: GuiLaiOTPBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM nguoi_dung WHERE sdt = %s", (body.sdt,))
        if cur.fetchone():
            raise HTTPException(400, "Số điện thoại này đã được đăng ký")

    _kiem_tra_cooldown(body.sdt, KetNoi)

    ma_otp  = tao_otp()
    bay_gio = bay_gio_vn().replace(tzinfo=None)
    het_han = bay_gio + timedelta(minutes=OTP_TTL_PHUT)

    with KetNoi.cursor() as cur:
        cur.execute("""
            UPDATE otp SET da_dung = 1
            WHERE sdt = %s AND muc_dich = 'dang_ky' AND da_dung = 0
        """, (body.sdt,))
        cur.execute("""
            INSERT INTO otp (sdt, ma_otp, muc_dich, het_han_luc)
            VALUES (%s, %s, 'dang_ky', %s)
        """, (body.sdt, ma_otp, het_han))
    KetNoi.commit()

    try:
        gui_otp(body.sdt, ma_otp)
    except Exception as e:
        raise HTTPException(500, f"Không gửi được SMS: {e}")

    return {"message": "Mã OTP mới đã được gửi", "het_han_sau_giay": OTP_TTL_PHUT * 60}


# ── 4. Đăng nhập ────────────────────────────────────────────────
@router.post("/dang-nhap/")
def dang_nhap(body: DangNhapBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)
    bay_gio = bay_gio_vn().replace(tzinfo=None)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM nguoi_dung WHERE sdt = %s", (body.sdt,))
        nd = cur.fetchone()

    if not nd:
        raise HTTPException(401, "Số điện thoại hoặc mật khẩu không đúng")

    # Kiểm tra khóa tài khoản
    if nd["khoa_den"] and nd["khoa_den"] > bay_gio:
        con_lai = int((nd["khoa_den"] - bay_gio).total_seconds() / 60)
        raise HTTPException(403, f"Tài khoản bị khóa tạm thời. Thử lại sau {con_lai} phút.")

    if not xac_minh_mat_khau(body.mat_khau, nd["mat_khau_hash"]):
        so_lan_moi = nd["so_lan_dang_nhap_sai"] + 1
        if so_lan_moi >= DANG_NHAP_KHOA_SAU:
            khoa_den = bay_gio + timedelta(minutes=DANG_NHAP_KHOA_PHUT)
            with KetNoi.cursor() as cur:
                cur.execute("""
                    UPDATE nguoi_dung
                    SET so_lan_dang_nhap_sai = %s, khoa_den = %s
                    WHERE id = %s
                """, (so_lan_moi, khoa_den, nd["id"]))
            KetNoi.commit()
            raise HTTPException(403, f"Sai mật khẩu quá {DANG_NHAP_KHOA_SAU} lần. Tài khoản bị khóa {DANG_NHAP_KHOA_PHUT} phút.")
        else:
            with KetNoi.cursor() as cur:
                cur.execute("""
                    UPDATE nguoi_dung SET so_lan_dang_nhap_sai = %s WHERE id = %s
                """, (so_lan_moi, nd["id"]))
            KetNoi.commit()
            con_lai = DANG_NHAP_KHOA_SAU - so_lan_moi
            raise HTTPException(401, f"Mật khẩu không đúng. Còn {con_lai} lần thử.")

    # Reset counter khi đăng nhập đúng
    with KetNoi.cursor() as cur:
        cur.execute("""
            UPDATE nguoi_dung SET so_lan_dang_nhap_sai = 0, khoa_den = NULL WHERE id = %s
        """, (nd["id"],))

    bai_xe = _lay_bai_xe(nd["id"], KetNoi)

    raw_refresh, hash_refresh = tao_refresh_token()
    het_han_rt = bay_gio + timedelta(days=30)
    with KetNoi.cursor() as cur:
        cur.execute(
            "INSERT INTO refresh_token (id_nguoi_dung, token_hash, het_han_luc) VALUES (%s, %s, %s)",
            (nd["id"], hash_refresh, het_han_rt)
        )
    KetNoi.commit()

    return {
        "access_token":  tao_access_token(nd["id"], bai_xe["id"]),
        "refresh_token": raw_refresh,
        "ten_bai_xe":    bai_xe["ten"],
        "id_bai_xe":     bai_xe["id"],
    }


# ── 5. Làm mới access token ─────────────────────────────────────
@router.post("/refresh/")
def refresh(body: RefreshBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    bay_gio    = bay_gio_vn().replace(tzinfo=None)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT rt.*, nd.sdt FROM refresh_token rt
            JOIN nguoi_dung nd ON rt.id_nguoi_dung = nd.id
            WHERE rt.token_hash = %s AND rt.het_han_luc > %s
        """, (token_hash, bay_gio))
        rt = cur.fetchone()

    if not rt:
        raise HTTPException(401, "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.")

    bai_xe = _lay_bai_xe(rt["id_nguoi_dung"], KetNoi)

    return {
        "access_token": tao_access_token(rt["id_nguoi_dung"], bai_xe["id"]),
        "ten_bai_xe":   bai_xe["ten"],
        "id_bai_xe":    bai_xe["id"],
    }


# ── 6. Đăng xuất ────────────────────────────────────────────────
@router.post("/dang-xuat/")
def dang_xuat(body: DangXuatBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    token_hash = hashlib.sha256(body.refresh_token.encode()).hexdigest()
    with KetNoi.cursor() as cur:
        cur.execute("DELETE FROM refresh_token WHERE token_hash = %s", (token_hash,))
    KetNoi.commit()
    return {"message": "Đã đăng xuất"}


# ── 7. Quên mật khẩu — gửi OTP ─────────────────────────────────
@router.post("/quen-mat-khau/")
def quen_mat_khau(body: QuenMatKhauBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM nguoi_dung WHERE sdt = %s", (body.sdt,))
        if not cur.fetchone():
            # Không tiết lộ SĐT có tồn tại hay không
            raise HTTPException(404, "Số điện thoại chưa được đăng ký")

    _kiem_tra_cooldown_qmk(body.sdt, KetNoi)

    ma_otp  = tao_otp()
    bay_gio = bay_gio_vn().replace(tzinfo=None)
    het_han = bay_gio + timedelta(minutes=OTP_TTL_PHUT)

    with KetNoi.cursor() as cur:
        cur.execute("""
            UPDATE otp SET da_dung = 1
            WHERE sdt = %s AND muc_dich = 'quen_mat_khau' AND da_dung = 0
        """, (body.sdt,))
        cur.execute("""
            INSERT INTO otp (sdt, ma_otp, muc_dich, het_han_luc)
            VALUES (%s, %s, 'quen_mat_khau', %s)
        """, (body.sdt, ma_otp, het_han))
    KetNoi.commit()

    try:
        gui_otp(body.sdt, ma_otp)
    except Exception as e:
        raise HTTPException(500, f"Không gửi được SMS: {e}")

    import os
    la_sandbox = int(os.getenv("ESMS_SANDBOX", "0")) == 1
    return {
        "message": "Mã OTP đã được gửi",
        "het_han_sau_giay": OTP_TTL_PHUT * 60,
        **({"otp_sandbox": ma_otp} if la_sandbox else {})
    }


# ── 8. Xác nhận OTP quên mật khẩu (chỉ kiểm tra, chưa đổi) ────
@router.post("/xac-nhan-otp-qmk/")
def xac_nhan_otp_qmk(body: XacNhanOTPQMKBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)
    bay_gio = bay_gio_vn().replace(tzinfo=None)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT * FROM otp
            WHERE sdt = %s AND muc_dich = 'quen_mat_khau' AND da_dung = 0
            ORDER BY created_at DESC LIMIT 1
        """, (body.sdt,))
        otp_row = cur.fetchone()

    if not otp_row:
        raise HTTPException(400, "Không tìm thấy mã OTP. Vui lòng gửi lại.")
    if otp_row["so_lan_thu"] >= 5:
        raise HTTPException(400, "OTP đã bị hủy do nhập sai quá 5 lần. Vui lòng gửi lại.")
    if otp_row["het_han_luc"] < bay_gio:
        raise HTTPException(400, "Mã OTP đã hết hạn. Vui lòng gửi lại.")

    if otp_row["ma_otp"] != body.ma_otp:
        with KetNoi.cursor() as cur:
            cur.execute(
                "UPDATE otp SET so_lan_thu = so_lan_thu + 1 WHERE id = %s",
                (otp_row["id"],)
            )
        KetNoi.commit()
        con_lai = 5 - (otp_row["so_lan_thu"] + 1)
        raise HTTPException(400, f"Mã OTP không đúng. Còn {con_lai} lần thử.")

    return {"message": "OTP hợp lệ", "sdt": body.sdt}


# ── 9. Đặt lại mật khẩu mới ────────────────────────────────────
@router.post("/dat-lai-mat-khau/")
def dat_lai_mat_khau(body: DatLaiMatKhauBody, KetNoi=Depends(lay_ket_noi_CSDL)):
    _validate_sdt(body.sdt)
    _validate_mat_khau(body.mat_khau)
    bay_gio = bay_gio_vn().replace(tzinfo=None)

    # Kiểm tra lại OTP lần cuối trước khi đổi mật khẩu
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("""
            SELECT * FROM otp
            WHERE sdt = %s AND muc_dich = 'quen_mat_khau' AND da_dung = 0
            ORDER BY created_at DESC LIMIT 1
        """, (body.sdt,))
        otp_row = cur.fetchone()

    if not otp_row:
        raise HTTPException(400, "Phiên đặt lại mật khẩu không hợp lệ. Vui lòng thử lại.")
    if otp_row["ma_otp"] != body.ma_otp:
        raise HTTPException(400, "Mã OTP không khớp. Vui lòng thử lại.")
    if otp_row["het_han_luc"] < bay_gio:
        raise HTTPException(400, "Mã OTP đã hết hạn. Vui lòng thử lại.")

    try:
        with KetNoi.cursor() as cur:
            # Đánh dấu OTP đã dùng
            cur.execute("UPDATE otp SET da_dung = 1 WHERE id = %s", (otp_row["id"],))
            # Cập nhật mật khẩu mới
            cur.execute("""
                UPDATE nguoi_dung
                SET mat_khau_hash = %s, so_lan_dang_nhap_sai = 0, khoa_den = NULL
                WHERE sdt = %s
            """, (hash_mat_khau(body.mat_khau), body.sdt))
            # Hủy toàn bộ refresh token cũ (bảo mật)
            cur.execute("""
                DELETE rt FROM refresh_token rt
                JOIN nguoi_dung nd ON rt.id_nguoi_dung = nd.id
                WHERE nd.sdt = %s
            """, (body.sdt,))
        KetNoi.commit()
    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(500, f"Lỗi CSDL: {err}")
    except Exception as err:
        KetNoi.rollback()
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"Lỗi không xác định: {err}")

    return {"message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."}


# ── 10. Đổi mật khẩu (khi đang đăng nhập) ──────────────────────
@router.post("/doi-mat-khau/")
def doi_mat_khau(
    body: DoiMatKhauBody,
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    _validate_mat_khau(body.mat_khau_moi)

    if body.mat_khau_hien_tai == body.mat_khau_moi:
        raise HTTPException(422, "Mật khẩu mới phải khác mật khẩu hiện tại")

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id, mat_khau_hash FROM nguoi_dung WHERE id = %s", (id_nguoi_dung,))
        nd = cur.fetchone()

    if not nd:
        raise HTTPException(404, "Không tìm thấy người dùng")

    if not xac_minh_mat_khau(body.mat_khau_hien_tai, nd["mat_khau_hash"]):
        raise HTTPException(401, "Mật khẩu hiện tại không đúng")

    try:
        with KetNoi.cursor() as cur:
            cur.execute(
                "UPDATE nguoi_dung SET mat_khau_hash = %s WHERE id = %s",
                (hash_mat_khau(body.mat_khau_moi), id_nguoi_dung)
            )
            # Thu hồi toàn bộ refresh token — buộc đăng nhập lại trên mọi thiết bị (bảo mật)
            cur.execute("DELETE FROM refresh_token WHERE id_nguoi_dung = %s", (id_nguoi_dung,))
        KetNoi.commit()
    except mysql.connector.Error as err:
        KetNoi.rollback()
        raise HTTPException(500, f"Lỗi CSDL: {err}")

    return {"message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."}