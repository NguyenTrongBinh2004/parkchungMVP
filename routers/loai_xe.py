# routers/loai_xe.py
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Optional
import mysql.connector
import json
from database import lay_ket_noi_CSDL
import logging
logger = logging.getLogger("uvicorn")
router = APIRouter(prefix="/loai-xe", tags=["Quản lý Loại Xe"])


# ── 1. Danh sách nhóm xe ─────────────────────────────────────────────────────
@router.get("/nhom")
def lay_danh_sach_nhom(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM nhom_xe ORDER BY thu_tu")
        return cur.fetchall()


# ── 2. Danh sách loại xe (kèm thông tin nhóm) ───────────────────────────────
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
            SELECT lx.*, n.ten AS ten_nhom, n.thu_tu AS thu_tu_nhom
              FROM loai_xe lx
              JOIN nhom_xe n ON lx.nhom_xe_id = n.id
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
        if da_cau_hinh is True:
            conditions.append(
                "(lx.gia_luot > 0 OR lx.gia_ngay > 0 OR lx.gia_dem > 0 "
                "OR lx.gia_ngay_dem > 0 OR lx.gia_ve_thang > 0 OR "
                "(lx.cau_hinh_theo_gio IS NOT NULL AND JSON_LENGTH(lx.cau_hinh_theo_gio) > 0))"
            )
        if has_ve_thang is True:
            conditions.append("lx.gia_ve_thang > 0")

        if conditions:
            query += " AND " + " AND ".join(conditions)
        query += " ORDER BY n.thu_tu, lx.is_default DESC, lx.ten"
        cur.execute(query, params)
        return cur.fetchall()


# ── 3. Tạo loại xe tùy chỉnh (is_default = 0) ────────────────────────────────
@router.post("/", status_code=200)
def tao_loai_xe(
    ten: str = Form(...),
    nhom_xe_id: int = Form(...),
    mau_sac: str = Form("#FFD700"),
    kieu_tinh_gia: str = Form("theo_luot"),
    gia_luot: Optional[float] = Form(None),
    gia_ngay: Optional[float] = Form(None),
    gia_dem: Optional[float] = Form(None),
    gia_ngay_dem: Optional[float] = Form(None),
    gia_ve_thang: Optional[float] = Form(None),
    cau_hinh_theo_gio: Optional[str] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    # ---------- Validate dữ liệu ----------
    allowed = ["theo_luot", "theo_gio", "theo_ngay_dem"]
    if kieu_tinh_gia not in allowed:
        raise HTTPException(status_code=422, detail="Kiểu tính giá không hợp lệ.")
    if kieu_tinh_gia == "theo_luot" and gia_luot is None:
        raise HTTPException(status_code=422, detail="Phải nhập giá theo lượt.")
    if kieu_tinh_gia == "theo_ngay_dem" and not all([gia_ngay, gia_dem, gia_ngay_dem]):
        raise HTTPException(status_code=422, detail="Phải nhập đầy đủ giá ngày, đêm, ngày-đêm.")
    if kieu_tinh_gia == "theo_gio" and not cau_hinh_theo_gio:
        raise HTTPException(status_code=422, detail="Phải nhập cấu hình giá theo giờ.")

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
                (SELECT id, is_default FROM loai_xe WHERE ten = %s AND nhom_xe_id = %s AND deleted_at IS NULL LIMIT 1)
                UNION ALL
                (SELECT id, is_default FROM loai_xe WHERE ten = %s AND nhom_xe_id = %s AND deleted_at IS NOT NULL ORDER BY deleted_at ASC LIMIT 1)
                LIMIT 1
            """, (ten, nhom_xe_id, ten, nhom_xe_id))
            existing = cur.fetchone()
            if existing:
                cur.execute("""
                    UPDATE loai_xe
                    SET mau_sac = %s,
                        kieu_tinh_gia = %s,
                        gia_luot = %s,
                        gia_ngay = %s,
                        gia_dem = %s,
                        gia_ngay_dem = %s,
                        gia_ve_thang = %s,
                        cau_hinh_theo_gio = %s,
                        deleted_at = NULL
                    WHERE id = %s
                """, (
                    mau_sac, kieu_tinh_gia,
                    gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                    gia_ve_thang,
                    json.dumps(json_gio) if json_gio else None,
                    existing["id"]
                ))
                KetNoi.commit()
                return {
                    "id": existing["id"],
                    "ten": ten,
                    "nhom_xe_id": nhom_xe_id,
                    "ghi_chu": "Cập nhật loại xe thành công."
                }
            else:
                cur.execute("""
                    INSERT INTO loai_xe
                        (ten, nhom_xe_id, is_default, mau_sac, kieu_tinh_gia,
                         gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                         gia_ve_thang, cau_hinh_theo_gio)
                    VALUES (%s, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    ten, nhom_xe_id, mau_sac, kieu_tinh_gia,
                    gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                    gia_ve_thang,
                    json.dumps(json_gio) if json_gio else None
                ))
                KetNoi.commit()
                return {
                    "id": cur.lastrowid,
                    "ten": ten,
                    "nhom_xe_id": nhom_xe_id,
                    "ghi_chu": "Tạo loại xe thành công."
                }
    except mysql.connector.Error as err:
        KetNoi.rollback()
        logger.error(f"Lỗi MySQL: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lỗi không xác định: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 3b. Tạo đồng giá cho nhiều loại xe cùng lúc ─────────────────────────────
@router.post("/dong-gia", status_code=200)
def tao_dong_gia(
    loai_xe_ids: str = Form(...),  # JSON array: "[1, 2, 3]"
    kieu_tinh_gia: str = Form("theo_luot"),
    gia_luot: Optional[float] = Form(None),
    gia_ngay: Optional[float] = Form(None),
    gia_dem: Optional[float] = Form(None),
    gia_ngay_dem: Optional[float] = Form(None),
    gia_ve_thang: Optional[float] = Form(None),
    cau_hinh_theo_gio: Optional[str] = Form(None),
    KetNoi=Depends(lay_ket_noi_CSDL)
):
    try:
        ids = json.loads(loai_xe_ids)
        if not isinstance(ids, list) or len(ids) < 1:
            raise HTTPException(status_code=422, detail="Cần chọn ít nhất 2 loại xe.")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=422, detail="Danh sách loại xe không hợp lệ.")

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
            updated = []
            for loai_xe_id in ids:
                cur.execute(
                    "SELECT id FROM loai_xe WHERE id = %s AND deleted_at IS NULL",
                    (loai_xe_id,)
                )
                if not cur.fetchone():
                    continue
                # ── THAY ĐỔI: thêm is_dong_gia = 1 ──
                cur.execute("""
                    UPDATE loai_xe SET
                        kieu_tinh_gia = %s,
                        gia_luot = %s,
                        gia_ngay = %s,
                        gia_dem = %s,
                        gia_ngay_dem = %s,
                        gia_ve_thang = %s,
                        cau_hinh_theo_gio = %s,
                        is_dong_gia = 1
                    WHERE id = %s
                """, (
                    kieu_tinh_gia,
                    gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                    gia_ve_thang,
                    json.dumps(json_gio) if json_gio else None,
                    loai_xe_id
                ))
                updated.append(loai_xe_id)
            KetNoi.commit()
            return {"updated": updated, "ghi_chu": f"Đã áp đồng giá cho {len(updated)} loại xe."}
    except HTTPException:
        raise
    except Exception as e:
        KetNoi.rollback()
        logger.error(f"Lỗi đồng giá: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 4. Xóa loại xe (chỉ loại tùy chỉnh, soft-delete) ────────────────────────
@router.delete("/{loai_xe_id}")
def xoa_loai_xe(loai_xe_id: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute(
            "SELECT id, is_default FROM loai_xe WHERE id = %s AND deleted_at IS NULL",
            (loai_xe_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

        cur.execute(
            "SELECT COUNT(*) AS cnt FROM ve_thang WHERE id_loai_xe = %s AND ngay_het_han >= CURDATE()",
            (loai_xe_id,)
        )
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(
                status_code=400,
                detail="Không thể ẩn vì đang có vé tháng còn hiệu lực sử dụng loại xe này."
            )

        cur.execute(
            "SELECT COUNT(*) AS cnt FROM phien_gui_xe WHERE id_loai_xe = %s AND is_in_bai = 1",
            (loai_xe_id,)
        )
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(
                status_code=400,
                detail="Không thể ẩn vì đang có xe trong bãi thuộc loại này."
            )

        cur.execute(
            "UPDATE loai_xe SET deleted_at = NOW() WHERE id = %s",
            (loai_xe_id,)
        )
        KetNoi.commit()

    return {"message": f"Đã ẩn loại xe ID {loai_xe_id} thành công."}


# ── 5. Cập nhật giá 1 loại xe (phá vỡ đồng giá nếu có) ──────────────────────
@router.put("/{loai_xe_id}", status_code=200)
def cap_nhat_loai_xe(
    loai_xe_id: int,
    kieu_tinh_gia: str = Form("theo_luot"),
    gia_luot: Optional[float] = Form(None),
    gia_ngay: Optional[float] = Form(None),
    gia_dem: Optional[float] = Form(None),
    gia_ngay_dem: Optional[float] = Form(None),
    gia_ve_thang: Optional[float] = Form(None),
    cau_hinh_theo_gio: Optional[str] = Form(None),
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
            cur.execute(
                "SELECT id FROM loai_xe WHERE id = %s AND deleted_at IS NULL",
                (loai_xe_id,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Không tìm thấy loại xe.")

            cur.execute("""
                UPDATE loai_xe SET
                    kieu_tinh_gia = %s,
                    gia_luot = %s,
                    gia_ngay = %s,
                    gia_dem = %s,
                    gia_ngay_dem = %s,
                    gia_ve_thang = %s,
                    cau_hinh_theo_gio = %s,
                    is_dong_gia = 0
                WHERE id = %s
            """, (
                kieu_tinh_gia,
                gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                gia_ve_thang,
                json.dumps(json_gio) if json_gio else None,
                loai_xe_id
            ))
            KetNoi.commit()
            return {"id": loai_xe_id, "ghi_chu": "Đã cập nhật giá loại xe."}
    except HTTPException:
        raise
    except Exception as e:
        KetNoi.rollback()
        logger.error(f"Lỗi cập nhật loại xe: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")