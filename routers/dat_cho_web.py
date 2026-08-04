# routers/dat_cho_web.py
import os
import hmac
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from database import lay_ket_noi_CSDL
from services.auth_service import lay_nguoi_dung_hien_tai

router = APIRouter(prefix="/dat-cho-web", tags=["Đặt chỗ từ Web"])

WEBHOOK_SECRET = os.environ.get("PARKCHUNG_WEBHOOK_SECRET", "")


# ── Payload webhook — HỢP ĐỒNG dữ liệu với website ──────────────
# Bên website (parkchung.com) cần POST đúng các field này (snake_case)
# khi có đơn đặt chỗ mới hoặc khi trạng thái đơn thay đổi.
class DatChoWebPayload(BaseModel):
    booking_id: str                                  # bookingId trên URL — dùng để chống trùng
    ten_khach: Optional[str] = None
    sdt: Optional[str] = None
    email: Optional[str] = None
    thoi_gian_nhan_xe: Optional[datetime] = None      # ISO 8601, VD "2026-07-30T11:30:00"
    thoi_gian_tra_xe: Optional[datetime] = None
    phuong_thuc_thanh_toan: Optional[str] = None      # VD "PAY_LATER"
    trang_thai_dat_cho: Optional[str] = None          # VD "da_xac_nhan"
    trang_thai_thanh_toan: Optional[str] = None       # VD "chua_thanh_toan"
    tong_tien: Optional[float] = None


def _xac_thuc_webhook(x_webhook_secret: Optional[str]):
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Chưa cấu hình PARKCHUNG_WEBHOOK_SECRET trên server.")
    if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Sai mã xác thực webhook.")


# ── 1. Webhook nhận đơn đặt chỗ từ website (không cần đăng nhập, xác thực bằng secret) ──
@router.post("/webhook")
def nhan_don_dat_cho(
    payload: DatChoWebPayload,
    x_webhook_secret: Optional[str] = Header(None),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    _xac_thuc_webhook(x_webhook_secret)

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM dat_cho_web WHERE ma_dat_cho = %s", (payload.booking_id,))
        existing = cur.fetchone()

        if existing:
            # Cập nhật nếu website gửi lại (VD: đổi trạng thái thanh toán)
            cur.execute("""
                UPDATE dat_cho_web SET
                    ten_khach=%s, sdt=%s, email=%s,
                    thoi_gian_nhan_xe=%s, thoi_gian_tra_xe=%s,
                    phuong_thuc_thanh_toan=%s, trang_thai_dat_cho=%s,
                    trang_thai_thanh_toan=%s, tong_tien=%s
                WHERE id=%s
            """, (
                payload.ten_khach, payload.sdt, payload.email,
                payload.thoi_gian_nhan_xe, payload.thoi_gian_tra_xe,
                payload.phuong_thuc_thanh_toan, payload.trang_thai_dat_cho,
                payload.trang_thai_thanh_toan, payload.tong_tien,
                existing["id"],
            ))
            KetNoi.commit()
            return {"id": existing["id"], "ghi_chu": "Đã cập nhật đơn đặt chỗ."}

        cur.execute("""
            INSERT INTO dat_cho_web
            (ma_dat_cho, ten_khach, sdt, email, thoi_gian_nhan_xe, thoi_gian_tra_xe,
             phuong_thuc_thanh_toan, trang_thai_dat_cho, trang_thai_thanh_toan, tong_tien)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            payload.booking_id, payload.ten_khach, payload.sdt, payload.email,
            payload.thoi_gian_nhan_xe, payload.thoi_gian_tra_xe,
            payload.phuong_thuc_thanh_toan, payload.trang_thai_dat_cho,
            payload.trang_thai_thanh_toan, payload.tong_tien,
        ))
        KetNoi.commit()
        return {"id": cur.lastrowid, "ghi_chu": "Đã ghi nhận đơn đặt chỗ mới."}


# ── 2. Danh sách đơn (cho nhân viên xem trong app, cần đăng nhập) ──
@router.get("/")
def danh_sach_dat_cho(
    trang_thai_xu_ly: Optional[str] = None,
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    query = "SELECT * FROM dat_cho_web WHERE 1=1"
    params = []
    if trang_thai_xu_ly:
        query += " AND trang_thai_xu_ly = %s"
        params.append(trang_thai_xu_ly)
    query += " ORDER BY thoi_gian_nhan_xe ASC"

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(query, params)
        return cur.fetchall()


# ── 3. Đánh dấu đã xử lý (khách đã tới, nhân viên tự cho xe vào bằng tay) ──
@router.put("/{id_don}/xac-nhan")
def xac_nhan_don(
    id_don: int,
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM dat_cho_web WHERE id=%s", (id_don,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt chỗ.")
        cur.execute("UPDATE dat_cho_web SET trang_thai_xu_ly='da_xu_ly' WHERE id=%s", (id_don,))
        KetNoi.commit()
    return {"message": "Đã đánh dấu xử lý."}


# ── 4. Hủy đơn ──────────────────────────────────────────────────
@router.put("/{id_don}/huy")
def huy_don(
    id_don: int,
    id_nguoi_dung: int = Depends(lay_nguoi_dung_hien_tai),
    KetNoi=Depends(lay_ket_noi_CSDL),
):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM dat_cho_web WHERE id=%s", (id_don,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt chỗ.")
        cur.execute("UPDATE dat_cho_web SET trang_thai_xu_ly='da_huy' WHERE id=%s", (id_don,))
        KetNoi.commit()
    return {"message": "Đã hủy đơn."}