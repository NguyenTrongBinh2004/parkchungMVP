# routers/loai_xe.py
from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Optional
import mysql.connector
import json
from database import lay_ket_noi_CSDL

router = APIRouter(prefix="/loai-xe", tags=["Quản lý Loại Xe"])

@router.get("/")
def lay_danh_sach_loai_xe(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as ConTro:
        # Lấy thêm các trường mới để hiển thị đủ thông tin cấu hình giá
        ConTro.execute("SELECT * FROM loai_xe")
        return ConTro.fetchall()
@router.post("/", status_code=201)
def tao_loai_xe(
    ten: str = Form(...),
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
    # Validate kiểu tính giá
    allowed = ["theo_luot", "theo_gio", "theo_ngay_dem"]
    if kieu_tinh_gia not in allowed:
        raise HTTPException(status_code=422, detail="Kiểu tính giá không hợp lệ.")

    # Kiểm tra dữ liệu bắt buộc cho từng kiểu
    if kieu_tinh_gia == "theo_luot" and gia_luot is None:
        raise HTTPException(status_code=422, detail="Phải nhập giá theo lượt.")
    if kieu_tinh_gia == "theo_ngay_dem":
        if not all([gia_ngay, gia_dem, gia_ngay_dem]):
            raise HTTPException(status_code=422, detail="Phải nhập đầy đủ giá ngày, đêm, ngày-đêm.")
    if kieu_tinh_gia == "theo_gio" and not cau_hinh_theo_gio:
        raise HTTPException(status_code=422, detail="Phải nhập cấu hình giá theo giờ.")

    # Parse cấu hình giờ nếu có
    json_gio = None
    if cau_hinh_theo_gio:
        try:
            json_gio = json.loads(cau_hinh_theo_gio)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="Cấu hình giá theo giờ không đúng định dạng JSON.")

    try:
        with KetNoi.cursor(dictionary=True) as ConTro:
            ConTro.execute("""
                INSERT INTO loai_xe (ten, mau_sac, kieu_tinh_gia, gia_luot,
                                     gia_ngay, gia_dem, gia_ngay_dem,
                                     gia_ve_thang, cau_hinh_theo_gio)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (ten, mau_sac, kieu_tinh_gia, gia_luot,
                  gia_ngay, gia_dem, gia_ngay_dem,
                  gia_ve_thang, json.dumps(json_gio) if json_gio else None))
            KetNoi.commit()
            id_moi = ConTro.lastrowid
        return {
            "id": id_moi,
            "ten": ten,
            "mau_sac": mau_sac,
            "kieu_tinh_gia": kieu_tinh_gia,
            "gia_luot": gia_luot,
            "gia_ve_thang": gia_ve_thang,
            "ghi_chu": "Tạo loại xe thành công."
        }
    except mysql.connector.Error as err:
        if KetNoi: KetNoi.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {err}")
