# routers/loai_xe.py
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Optional
import mysql.connector
import json
import time
import threading
import copy
from database import lay_ket_noi_CSDL
from services.auth_service import yeu_cau_admin   # <-- thêm import
import logging

logger = logging.getLogger("uvicorn")
router = APIRouter(prefix="/loai-xe", tags=["Quản lý Loại Xe"])

# ── Cache đơn giản ─────────────────────────────────────────────
_cache_lock = threading.Lock()
_cache_data = None
_cache_expire = 0
CACHE_TTL = 5  # giây


def _clear_cache():
    global _cache_data, _cache_expire
    with _cache_lock:
        _cache_data = None
        _cache_expire = 0


def _set_cache_data(data):
    global _cache_data, _cache_expire
    with _cache_lock:
        _cache_data = copy.deepcopy(data)
        _cache_expire = time.monotonic() + CACHE_TTL


def _get_cached_data():
    global _cache_data, _cache_expire
    with _cache_lock:
        if _cache_data and time.monotonic() < _cache_expire:
            return copy.deepcopy(_cache_data)
    return None


# ── 1. Endpoint tổng hợp ────────────────────────────────────────
@router.get("/toan-bo")
def lay_toan_bo_du_lieu(KetNoi=Depends(lay_ket_noi_CSDL)):
    cached = _get_cached_data()
    if cached:
        return cached

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM nhom_xe ORDER BY thu_tu")
        nhom = cur.fetchall()

        cur.execute("""
            SELECT 
                lx.*,
                n.ten AS ten_nhom,
                n.thu_tu AS thu_tu_nhom,
                CASE 
                    WHEN (lx.gia_luot > 0 OR lx.gia_ngay > 0 OR lx.gia_dem > 0 
                          OR lx.gia_ngay_dem > 0 OR lx.gia_ve_thang > 0 
                          OR (lx.cau_hinh_theo_gio IS NOT NULL AND JSON_LENGTH(lx.cau_hinh_theo_gio) > 0))
                          OR ng.nhom_xe_id IS NOT NULL
                    THEN 1 
                    ELSE 0 
                END AS co_gia
            FROM loai_xe lx
            JOIN nhom_xe n ON lx.nhom_xe_id = n.id
            LEFT JOIN nhom_xe_gia ng ON lx.nhom_xe_id = ng.nhom_xe_id
            WHERE lx.deleted_at IS NULL
            ORDER BY n.thu_tu, lx.is_default DESC, lx.ten
        """)
        loai_xe = cur.fetchall()

        cur.execute("""
            SELECT ng.*, n.ten AS ten_nhom
            FROM nhom_xe_gia ng
            JOIN nhom_xe n ON ng.nhom_xe_id = n.id
            ORDER BY n.thu_tu
        """)
        nhom_gia = cur.fetchall()

    data = {
        "nhom": nhom,
        "loai_xe": loai_xe,
        "nhom_gia": nhom_gia
    }
    _set_cache_data(data)
    return _get_cached_data()


# ── 2. Danh sách nhóm xe ────────────────────────────────────────
@router.get("/nhom")
def lay_danh_sach_nhom(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM nhom_xe ORDER BY thu_tu")
        return cur.fetchall()


# ── 2b. Cập nhật số chỗ cho 1 nhóm xe ──────────────────────────
@router.put("/nhom/{nhom_xe_id}/so-cho", status_code=200)
def cap_nhat_so_cho_nhom(
    nhom_xe_id: int,
    so_cho: Optional[int] = Form(None),
    _: str = Depends(yeu_cau_admin),   # <-- chỉ admin
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    if so_cho is not None and so_cho < 0:
        raise HTTPException(status_code=422, detail="Số chỗ phải >= 0.")

    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id FROM nhom_xe WHERE id = %s", (nhom_xe_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy nhóm xe.")

        cur.execute(
            "UPDATE nhom_xe SET so_cho = %s WHERE id = %s",
            (so_cho, nhom_xe_id)
        )
        KetNoi.commit()

    return {"nhom_xe_id": nhom_xe_id, "so_cho": so_cho, "ghi_chu": "Đã cập nhật số chỗ."}


# ── 2c. Sức chứa hiện tại theo từng nhóm ───────────────────────
@router.get("/nhom/suc-chua")
def lay_suc_chua_theo_nhom(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT id, ten, so_cho FROM nhom_xe ORDER BY thu_tu")
        nhom_list = cur.fetchall()

        cur.execute("""
            SELECT l.nhom_xe_id, COUNT(*) AS da_dung
            FROM phien_gui_xe p
            JOIN loai_xe l ON p.id_loai_xe = l.id
            WHERE p.is_in_bai = 1
            GROUP BY l.nhom_xe_id
        """)
        da_dung_map = {row["nhom_xe_id"]: row["da_dung"] for row in cur.fetchall()}

    ket_qua = []
    for nhom in nhom_list:
        da_dung = da_dung_map.get(nhom["id"], 0)
        so_cho = nhom["so_cho"]
        ket_qua.append({
            "nhom_xe_id": nhom["id"],
            "ten": nhom["ten"],
            "so_cho": so_cho,
            "da_dung": da_dung,
            "con_trong": (so_cho - da_dung) if so_cho is not None else None,
        })
    return ket_qua


# ── 3. Danh sách loại xe (có bộ lọc) ────────────────────────────
@router.get("/")
def lay_danh_sach_loai_xe(
    is_default: Optional[int] = None,
    nhom_xe_id: Optional[int] = None,
    da_cau_hinh: Optional[bool] = None,
    include_deleted: bool = False,
    has_ve_thang: bool = False,
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    with KetNoi.cursor(dictionary=True) as cur:
        query = """
            SELECT 
                lx.*,
                n.ten AS ten_nhom,
                n.thu_tu AS thu_tu_nhom,
                CASE 
                    WHEN (lx.gia_luot > 0 OR lx.gia_ngay > 0 OR lx.gia_dem > 0 
                          OR lx.gia_ngay_dem > 0 OR lx.gia_ve_thang > 0 
                          OR (lx.cau_hinh_theo_gio IS NOT NULL AND JSON_LENGTH(lx.cau_hinh_theo_gio) > 0))
                          OR ng.nhom_xe_id IS NOT NULL
                    THEN 1 
                    ELSE 0 
                END AS co_gia
            FROM loai_xe lx
            JOIN nhom_xe n ON lx.nhom_xe_id = n.id
            LEFT JOIN nhom_xe_gia ng ON lx.nhom_xe_id = ng.nhom_xe_id
            WHERE 1=1
        """
        conditions = []
        params = []

        if not include_deleted:
            conditions.append("lx.deleted_at IS NULL")
        if is_default is not None:
            conditions.append("lx.is_default = %s")
            params.append(is_default)
        if nhom_xe_id is not None:
            conditions.append("lx.nhom_xe_id = %s")
            params.append(nhom_xe_id)
        if has_ve_thang is True:
            conditions.append("lx.gia_ve_thang > 0")

        if conditions:
            query += " AND " + " AND ".join(conditions)

        if da_cau_hinh is True:
            query += " HAVING co_gia = 1"

        query += " ORDER BY n.thu_tu, lx.is_default DESC, lx.ten"
        cur.execute(query, params)
        return cur.fetchall()


# ── 4. Tạo loại xe tùy chỉnh ────────────────────────────────────
@router.post("/", status_code=200)
def tao_loai_xe(
    ten: str = Form(...),
    nhom_xe_id: int = Form(...),
    mau_sac: str = Form("#FFD700"),
    co_gia_luot: bool = Form(False),
    co_gia_gio: bool = Form(False),
    co_gia_ngay_dem: bool = Form(False),
    gia_luot: Optional[float] = Form(None),
    gia_ngay: Optional[float] = Form(None),
    gia_dem: Optional[float] = Form(None),
    gia_ngay_dem: Optional[float] = Form(None),
    gia_ve_thang: Optional[float] = Form(None),
    cau_hinh_theo_gio: Optional[str] = Form(None),
    _: str = Depends(yeu_cau_admin),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    # ── Validate chung ──
    if not (co_gia_luot or co_gia_gio or co_gia_ngay_dem):
        raise HTTPException(status_code=422, detail="Phải chọn ít nhất 1 kiểu tính giá.")
    if co_gia_luot and gia_luot is None:
        raise HTTPException(status_code=422, detail="Phải nhập giá theo lượt.")
    if co_gia_ngay_dem and not all([gia_ngay, gia_dem, gia_ngay_dem]):
        raise HTTPException(status_code=422, detail="Phải nhập đầy đủ giá ngày, đêm, ngày-đêm.")
    if co_gia_gio and not cau_hinh_theo_gio:
        raise HTTPException(status_code=422, detail="Phải nhập cấu hình giá theo giờ.")

    # ── Không cho phép tên chứa "(đồng giá)" ──
    if ten and "(đồng giá)" in ten:
        raise HTTPException(status_code=422, detail="Tên loại xe không được chứa '(đồng giá)'. Đây là tên dành riêng cho hệ thống.")

    # ── Validate giá vé tháng nếu có ──
    if gia_ve_thang is not None and float(gia_ve_thang) <= 0:
        raise HTTPException(status_code=422, detail="Giá vé tháng phải lớn hơn 0.")

    json_gio = None
    if cau_hinh_theo_gio:
        try:
            json_gio = json.loads(cau_hinh_theo_gio)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Cấu hình giá theo giờ không đúng định dạng JSON.")

    # kieu_tinh_gia (legacy) giữ để tương thích ngược — set theo ưu tiên lượt > giờ > ngày/đêm
    kieu_tinh_gia_legacy = "theo_luot" if co_gia_luot else ("theo_gio" if co_gia_gio else "theo_ngay_dem")

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute("SELECT id FROM nhom_xe WHERE id = %s", (nhom_xe_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy nhóm xe.")

            cur.execute("""
                (SELECT id, is_default FROM loai_xe WHERE ten = %s AND nhom_xe_id = %s AND deleted_at IS NULL LIMIT 1)
                UNION ALL
                (SELECT id, is_default FROM loai_xe WHERE ten = %s AND nhom_xe_id = %s AND deleted_at IS NOT NULL ORDER BY deleted_at ASC LIMIT 1)
                LIMIT 1
            """, (ten, nhom_xe_id, ten, nhom_xe_id))
            existing = cur.fetchone()

            if existing:
                cur.execute("""
                    UPDATE loai_xe
                    SET mau_sac = %s, kieu_tinh_gia = %s,
                        co_gia_luot = %s, co_gia_gio = %s, co_gia_ngay_dem = %s,
                        gia_luot = %s, gia_ngay = %s, gia_dem = %s, gia_ngay_dem = %s,
                        gia_ve_thang = %s, cau_hinh_theo_gio = %s, deleted_at = NULL
                    WHERE id = %s
                """, (mau_sac, kieu_tinh_gia_legacy, co_gia_luot, co_gia_gio, co_gia_ngay_dem,
                      gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                      gia_ve_thang, json.dumps(json_gio) if json_gio else None, existing["id"]))
                KetNoi.commit()
                _clear_cache()
                return {"id": existing["id"], "ten": ten, "nhom_xe_id": nhom_xe_id,
                        "ghi_chu": "Cập nhật loại xe thành công."}
            else:
                cur.execute("""
                    INSERT INTO loai_xe (ten, nhom_xe_id, is_default, mau_sac, kieu_tinh_gia,
                     co_gia_luot, co_gia_gio, co_gia_ngay_dem,
                     gia_luot, gia_ngay, gia_dem, gia_ngay_dem, gia_ve_thang, cau_hinh_theo_gio)
                    VALUES (%s,%s,0,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (ten, nhom_xe_id, mau_sac, kieu_tinh_gia_legacy,
                      co_gia_luot, co_gia_gio, co_gia_ngay_dem,
                      gia_luot, gia_ngay, gia_dem, gia_ngay_dem, gia_ve_thang,
                      json.dumps(json_gio) if json_gio else None))
                KetNoi.commit()
                _clear_cache()
                return {"id": cur.lastrowid, "ten": ten, "nhom_xe_id": nhom_xe_id,
                        "ghi_chu": "Tạo loại xe thành công."}
    except mysql.connector.Error as err:
        KetNoi.rollback()
        logger.error(f"Lỗi MySQL: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lỗi không xác định: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 5. Đồng giá nhóm ────────────────────────────────────────────
@router.post("/dong-gia", status_code=200)
def tao_dong_gia(
    nhom_xe_id: int = Form(...),
    kieu_tinh_gia: str = Form("theo_luot"),
    gia_luot: Optional[float] = Form(None),
    gia_ngay: Optional[float] = Form(None),
    gia_dem: Optional[float] = Form(None),
    gia_ngay_dem: Optional[float] = Form(None),
    gia_ve_thang: Optional[float] = Form(None),
    cau_hinh_theo_gio: Optional[str] = Form(None),
    _: str = Depends(yeu_cau_admin),   # <-- chỉ admin
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    allowed = ["theo_luot", "theo_gio", "theo_ngay_dem"]
    if kieu_tinh_gia not in allowed:
        raise HTTPException(status_code=422, detail="Kiểu tính giá không hợp lệ.")

    json_gio = None
    if cau_hinh_theo_gio:
        try:
            json_gio = json.loads(cau_hinh_theo_gio)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Cấu hình giá theo giờ không đúng định dạng JSON.")

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute("SELECT id FROM nhom_xe WHERE id = %s", (nhom_xe_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy nhóm xe.")

            cur.execute("""
                INSERT INTO nhom_xe_gia (nhom_xe_id, kieu_tinh_gia, gia_luot, gia_ngay, gia_dem,
                 gia_ngay_dem, gia_ve_thang, cau_hinh_theo_gio)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                    kieu_tinh_gia=VALUES(kieu_tinh_gia), gia_luot=VALUES(gia_luot),
                    gia_ngay=VALUES(gia_ngay), gia_dem=VALUES(gia_dem),
                    gia_ngay_dem=VALUES(gia_ngay_dem), gia_ve_thang=VALUES(gia_ve_thang),
                    cau_hinh_theo_gio=VALUES(cau_hinh_theo_gio), updated_at=NOW()
            """, (nhom_xe_id, kieu_tinh_gia, gia_luot, gia_ngay, gia_dem,
                  gia_ngay_dem, gia_ve_thang, json.dumps(json_gio) if json_gio else None))
            KetNoi.commit()
            _clear_cache()
            return {"ghi_chu": f"Đã áp đồng giá cho nhóm {nhom_xe_id}."}
    except HTTPException:
        raise
    except Exception as e:
        KetNoi.rollback()
        logger.error(f"Lỗi đồng giá: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 6. Xóa đồng giá nhóm (có cảnh báo xe chưa có giá riêng) ────
@router.delete("/dong-gia/{nhom_xe_id}", status_code=200)
def xoa_dong_gia(
    nhom_xe_id: int,
    _: str = Depends(yeu_cau_admin),   # <-- chỉ admin
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            # Kiểm tra xe đang trong bãi không có giá riêng
            cur.execute(
                """
                SELECT COUNT(*) AS cnt FROM phien_gui_xe p
                JOIN loai_xe l ON p.id_loai_xe = l.id
                WHERE l.nhom_xe_id = %s AND p.is_in_bai = 1
                  AND l.gia_luot = 0 AND l.gia_ngay IS NULL AND l.gia_dem IS NULL
                  AND l.gia_ngay_dem IS NULL AND (l.cau_hinh_theo_gio IS NULL OR JSON_LENGTH(l.cau_hinh_theo_gio) = 0)
                """,
                (nhom_xe_id,)
            )
            xe_khong_gia = cur.fetchone()["cnt"]

            cur.execute("DELETE FROM nhom_xe_gia WHERE nhom_xe_id = %s", (nhom_xe_id,))
            KetNoi.commit()
            _clear_cache()

            msg = f"Đã xóa đồng giá cho nhóm {nhom_xe_id}."
            if xe_khong_gia > 0:
                msg += f" Cảnh báo: có {xe_khong_gia} xe đang trong bãi sẽ không có giá sau thao tác này."
            return {"ghi_chu": msg}
    except Exception as e:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 7. Lấy danh sách đồng giá ───────────────────────────────────
@router.get("/nhom-gia")
def lay_nhom_xe_gia(KetNoi=Depends(lay_ket_noi_CSDL)):
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute("""
                SELECT ng.*, n.ten AS ten_nhom
                FROM nhom_xe_gia ng JOIN nhom_xe n ON ng.nhom_xe_id = n.id
                ORDER BY n.thu_tu
            """)
            return cur.fetchall()
    except Exception as e:
        logger.error(f"Lỗi nhom-gia: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── 8. Xóa loại xe (soft-delete) ─────────────────────────────────
@router.delete("/{loai_xe_id}")
def xoa_loai_xe(
    loai_xe_id: int,
    _: str = Depends(yeu_cau_admin),   # <-- chỉ admin
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    with KetNoi.cursor(dictionary=True) as cur:
        # Lấy thêm tên để kiểm tra xe mồi
        cur.execute("SELECT id, is_default, ten FROM loai_xe WHERE id=%s AND deleted_at IS NULL", (loai_xe_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

        # Không cho ẩn xe mồi
        if row["ten"] and "(đồng giá)" in row["ten"]:
            raise HTTPException(
                status_code=400,
                detail="Không thể ẩn xe đại diện đồng giá của hệ thống. Vui lòng sử dụng chức năng Đồng giá nhóm."
            )

        cur.execute("SELECT COUNT(*) AS cnt FROM ve_thang WHERE id_loai_xe=%s AND ngay_het_han >= CURDATE()", (loai_xe_id,))
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(status_code=400, detail="Không thể ẩn vì đang có vé tháng.")

        cur.execute("SELECT COUNT(*) AS cnt FROM phien_gui_xe WHERE id_loai_xe=%s AND is_in_bai=1", (loai_xe_id,))
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(status_code=400, detail="Không thể ẩn vì đang có xe trong bãi.")

        cur.execute("UPDATE loai_xe SET deleted_at=NOW() WHERE id=%s", (loai_xe_id,))
        KetNoi.commit()
        _clear_cache()
    return {"message": f"Đã ẩn loại xe ID {loai_xe_id}."}


# ── 9. Cập nhật giá riêng cho 1 loại xe ─────────────────────────
@router.put("/{loai_xe_id}", status_code=200)
def cap_nhat_loai_xe(
    loai_xe_id: int,
    co_gia_luot: bool = Form(False),
    co_gia_gio: bool = Form(False),
    co_gia_ngay_dem: bool = Form(False),
    gia_luot: Optional[float] = Form(None),
    gia_ngay: Optional[float] = Form(None),
    gia_dem: Optional[float] = Form(None),
    gia_ngay_dem: Optional[float] = Form(None),
    gia_ve_thang: Optional[float] = Form(None),
    cau_hinh_theo_gio: Optional[str] = Form(None),
    _: str = Depends(yeu_cau_admin),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    if not (co_gia_luot or co_gia_gio or co_gia_ngay_dem):
        raise HTTPException(status_code=422, detail="Phải chọn ít nhất 1 kiểu tính giá.")
    if co_gia_luot and gia_luot is None:
        raise HTTPException(status_code=422, detail="Phải nhập giá theo lượt.")
    if co_gia_ngay_dem and not all([gia_ngay, gia_dem, gia_ngay_dem]):
        raise HTTPException(status_code=422, detail="Phải nhập đầy đủ giá ngày, đêm, ngày-đêm.")
    if co_gia_gio and not cau_hinh_theo_gio:
        raise HTTPException(status_code=422, detail="Phải nhập cấu hình giá theo giờ.")

    json_gio = None
    if cau_hinh_theo_gio:
        try:
            json_gio = json.loads(cau_hinh_theo_gio)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="JSON không hợp lệ.")

    kieu_tinh_gia_legacy = "theo_luot" if co_gia_luot else ("theo_gio" if co_gia_gio else "theo_ngay_dem")

    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute("SELECT id, ten FROM loai_xe WHERE id=%s AND deleted_at IS NULL", (loai_xe_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

            if row["ten"] and "(đồng giá)" in row["ten"]:
                raise HTTPException(
                    status_code=400,
                    detail="Không thể sửa giá riêng của xe đại diện đồng giá. Vui lòng sử dụng chức năng Đồng giá nhóm."
                )

            cur.execute("""
                UPDATE loai_xe SET kieu_tinh_gia=%s,
                    co_gia_luot=%s, co_gia_gio=%s, co_gia_ngay_dem=%s,
                    gia_luot=%s, gia_ngay=%s, gia_dem=%s,
                    gia_ngay_dem=%s, gia_ve_thang=%s, cau_hinh_theo_gio=%s
                WHERE id=%s
            """, (kieu_tinh_gia_legacy, co_gia_luot, co_gia_gio, co_gia_ngay_dem,
                  gia_luot, gia_ngay, gia_dem, gia_ngay_dem, gia_ve_thang,
                  json.dumps(json_gio) if json_gio else None, loai_xe_id))
            KetNoi.commit()
            _clear_cache()
            return {"id": loai_xe_id, "ghi_chu": "Đã cập nhật giá riêng."}
    except HTTPException:
        raise
    except Exception as e:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")