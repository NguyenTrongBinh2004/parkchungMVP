# routers/loai_xe.py
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Optional
import mysql.connector
import json
from database import lay_ket_noi_CSDL
import logging

logger = logging.getLogger("uvicorn")
router = APIRouter(prefix="/loai-xe", tags=["Quản lý Loại Xe"])


# ── 1. Endpoint tổng hợp – trả về tất cả dữ liệu cần cho trang Loại xe ──
@router.get("/toan-bo")
def lay_toan_bo_du_lieu(KetNoi=Depends(lay_ket_noi_CSDL)):
    """
    Trả về một lần:
      - Danh sách nhóm xe
      - Danh sách loại xe (đang hoạt động) kèm cờ co_gia, co_dong_gia_nhom
      - Danh sách đồng giá nhóm (nhom_xe_gia)
    """
    with KetNoi.cursor(dictionary=True) as cur:
        # Nhóm xe
        cur.execute("SELECT * FROM nhom_xe ORDER BY thu_tu")
        nhom = cur.fetchall()

        # Loại xe (chỉ xe chưa bị xoá, có kèm computed co_gia)
        cur.execute("""
            SELECT 
                lx.*,
                n.ten AS ten_nhom,
                n.thu_tu AS thu_tu_nhom,
                CASE WHEN ng.nhom_xe_id IS NOT NULL THEN 1 ELSE 0 END AS co_dong_gia_nhom,
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

        # Đồng giá nhóm
        cur.execute("""
            SELECT ng.*, n.ten AS ten_nhom
            FROM nhom_xe_gia ng
            JOIN nhom_xe n ON ng.nhom_xe_id = n.id
            ORDER BY n.thu_tu
        """)
        nhom_gia = cur.fetchall()

    return {
        "nhom": nhom,
        "loai_xe": loai_xe,
        "nhom_gia": nhom_gia
    }


# ── 2. Danh sách nhóm xe (giữ lại cho các trang khác nếu cần) ─────────────
@router.get("/nhom")
def lay_danh_sach_nhom(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM nhom_xe ORDER BY thu_tu")
        return cur.fetchall()


# ── 3. Danh sách loại xe (có bộ lọc, dùng chung truy vấn có computed) ────
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
                CASE WHEN ng.nhom_xe_id IS NOT NULL THEN 1 ELSE 0 END AS co_dong_gia_nhom,
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


# ── 4. Tạo loại xe tùy chỉnh (is_default=0, tự động khôi phục nếu đã ẩn) ──
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

            # Tìm xe cùng tên trong nhóm (có thể đã ẩn)
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
                    "ghi_chu": "Cập nhật loại xe thành công (đã khôi phục nếu trước đó bị ẩn)."
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


# ── 5. Đồng giá nhóm (chỉ upsert nhom_xe_gia) ─────────────────────────────
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
                INSERT INTO nhom_xe_gia
                    (nhom_xe_id, kieu_tinh_gia, gia_luot, gia_ngay, gia_dem,
                     gia_ngay_dem, gia_ve_thang, cau_hinh_theo_gio)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    kieu_tinh_gia     = VALUES(kieu_tinh_gia),
                    gia_luot          = VALUES(gia_luot),
                    gia_ngay          = VALUES(gia_ngay),
                    gia_dem           = VALUES(gia_dem),
                    gia_ngay_dem      = VALUES(gia_ngay_dem),
                    gia_ve_thang      = VALUES(gia_ve_thang),
                    cau_hinh_theo_gio = VALUES(cau_hinh_theo_gio),
                    updated_at        = NOW()
            """, (
                nhom_xe_id, kieu_tinh_gia,
                gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                gia_ve_thang,
                json.dumps(json_gio) if json_gio else None
            ))

            KetNoi.commit()
            return {"ghi_chu": f"Đã áp đồng giá cho nhóm {nhom_xe_id}."}
    except HTTPException:
        raise
    except Exception as e:
        KetNoi.rollback()
        logger.error(f"Lỗi đồng giá: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 6. Xóa đồng giá nhóm ──────────────────────────────────────────────────
@router.delete("/dong-gia/{nhom_xe_id}", status_code=200)
def xoa_dong_gia(nhom_xe_id: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    try:
        with KetNoi.cursor() as cur:
            cur.execute("DELETE FROM nhom_xe_gia WHERE nhom_xe_id = %s", (nhom_xe_id,))
            KetNoi.commit()
            return {"ghi_chu": f"Đã xóa đồng giá cho nhóm {nhom_xe_id}."}
    except Exception as e:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")


# ── 7. Lấy danh sách đồng giá (có tên nhóm, sắp xếp) ──────────────────────
@router.get("/nhom-gia")
def lay_nhom_xe_gia(KetNoi=Depends(lay_ket_noi_CSDL)):
    try:
        with KetNoi.cursor(dictionary=True) as cur:
            cur.execute("""
                SELECT ng.*, n.ten AS ten_nhom
                FROM nhom_xe_gia ng
                JOIN nhom_xe n ON ng.nhom_xe_id = n.id
                ORDER BY n.thu_tu
            """)
            return cur.fetchall()
    except Exception as e:
        logger.error(f"Lỗi nhom-gia: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── 8. Xóa loại xe (soft-delete) ───────────────────────────────────────────
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

        # Kiểm tra vé tháng còn hiệu lực
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM ve_thang WHERE id_loai_xe = %s AND ngay_het_han >= CURDATE()",
            (loai_xe_id,)
        )
        if cur.fetchone()["cnt"] > 0:
            raise HTTPException(
                status_code=400,
                detail="Không thể ẩn vì đang có vé tháng còn hiệu lực sử dụng loại xe này."
            )

        # Kiểm tra xe đang trong bãi
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


# ── 9. Cập nhật giá riêng cho 1 loại xe (không ảnh hưởng đồng giá) ────────
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
                    cau_hinh_theo_gio = %s
                WHERE id = %s
            """, (
                kieu_tinh_gia, gia_luot, gia_ngay, gia_dem, gia_ngay_dem,
                gia_ve_thang,
                json.dumps(json_gio) if json_gio else None,
                loai_xe_id
            ))

            KetNoi.commit()
            return {"id": loai_xe_id, "ghi_chu": "Đã cập nhật giá riêng cho loại xe."}
    except HTTPException:
        raise
    except Exception as e:
        KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi server: {e}")