from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime, date

class KieuTinhGia(str, Enum):
    theo_luot = "theo_luot"
    theo_gio = "theo_gio"
    theo_ngay_dem = "theo_ngay_dem"

class HinhThucThanhToan(str, Enum):
    tien_mat = "tien_mat"
    chuyen_khoan = "chuyen_khoan"

class LoaiLichSu(str, Enum):
    dang_ky_moi = "dang_ky_moi"
    gia_han = "gia_han"

class PhanHoiLoaiXe(BaseModel):
    id: int
    ten: str
    mau_sac: Optional[str]
    kieu_tinh_gia: str
    gia_luot: float
    gia_ve_thang: Optional[float]

class KhachHangCreate(BaseModel):
    ten: str = Field(..., min_length=1, max_length=100)
    sdt: Optional[str] = None
    email: Optional[str] = None
    dia_chi: Optional[str] = None
    cho_phep_lay_ho: bool = False

class PhanHoiKhachHang(BaseModel):
    id: int
    ten: str
    sdt: Optional[str]
    email: Optional[str]
    dia_chi: Optional[str]
    cho_phep_lay_ho: bool
    created_at: datetime

class VeThangCreate(BaseModel):
    ten_chu_xe: str = Field(..., min_length=1, max_length=100)
    sdt: Optional[str] = None
    email: Optional[str] = None
    dia_chi: Optional[str] = None
    cho_phep_lay_ho: bool = False
    bien_so: str = Field(..., min_length=4, max_length=20)
    id_loai_xe: int
    ghi_chu: Optional[str] = None

class VeThangGiaHan(BaseModel):
    ghi_chu: Optional[str] = None

class PhanHoiVeThang(BaseModel):
    id: int
    id_khach_hang: int
    ten_chu_xe: str
    sdt: Optional[str] = None
    email: Optional[str] = None
    ten_loai_xe: Optional[str] = None
    bien_so: str
    id_loai_xe: int
    ngay_dang_ky: date
    ngay_het_han: date
    so_tien: Optional[float]
    ma_qr: Optional[str]
    ghi_chu: Optional[str]
    trang_thai: str
    so_ngay_con: int
    anh_bien_so: Optional[str] = None
    anh_nguoi_dung: Optional[str] = None
    anh_qr: Optional[str] = None

class PhanHoiLichSuVeThang(BaseModel):
    id: int
    id_ve_thang: int
    loai: str
    ngay_thuc_hien: date
    ngay_het_han_cu: Optional[date]
    ngay_het_han_moi: date
    so_tien: Optional[float]
    ghi_chu: Optional[str]

class PhanHoiXeVao(BaseModel):
    id: int
    ma_phien: str
    bien_so: str
    id_loai_xe: int
    ten_chu_xe: Optional[str]
    gio_vao: datetime
    ma_qr: Optional[str]
    ghi_chu: Optional[str] = None
    qr_image_url: Optional[str] = None

class PhanHoiXeRa(BaseModel):
    id: int
    ma_phien: str
    bien_so: str
    ten_chu_xe: Optional[str]
    gio_vao: datetime
    gio_ra: datetime
    thoi_gian_gui_phut: int
    so_tien: int
    hinh_thuc_thanh_toan: Optional[HinhThucThanhToan]

class PhanHoiXeTrongBai(BaseModel):
    id: int
    ma_phien: str
    bien_so: str
    ten_loai_xe: str
    ten_chu_xe: Optional[str]
    gio_vao: datetime
    so_tien_tam_tinh: int
    anh_bien_so: Optional[str]
    anh_nguoi_lai: Optional[str]
    la_xe_ve_thang: bool