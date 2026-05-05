from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime, date


class KieuTinhGia(str, Enum):
    theo_luot = "theo_luot"
    theo_gio = "theo_gio"
    theo_ngay_dem = "theo_ngay_dem"


class HinhThucThanhToan(str, Enum):
    tien_mat = "tien_mat"
    chuyen_khoan = "chuyen_khoan"


class HinhThucXeRa(str, Enum):
    quet_qr = "quet_qr"
    ma_sms = "ma_sms"
    bien_so = "bien_so"


# --- Xe vào ---
class XeVaoCreate(BaseModel):
    bien_so: str = Field(..., min_length=4, max_length=20)
    id_loai_xe: int
    ten_chu_xe: str
    sdt: Optional[str] = None
    email: Optional[str] = None
    cho_phep_lay_ho: bool = False


class PhanHoiXeVao(BaseModel):
    id: int
    ma_phien: str
    bien_so: str
    id_loai_xe: int
    ten_chu_xe: Optional[str]
    gio_vao: datetime
    ma_qr: Optional[str]
    ghi_chu: Optional[str] = None

# --- Xe ra ---
class XeRaCreate(BaseModel):
    hinh_thuc_thanh_toan: HinhThucThanhToan


class PhanHoiXeRa(BaseModel):
    id: int
    ma_phien: str
    bien_so: str
    ten_chu_xe: Optional[str]
    gio_vao: datetime
    gio_ra: datetime
    thoi_gian_gui_phut: int
    so_tien: int
    hinh_thuc_thanh_toan: HinhThucThanhToan


# --- Danh sách xe trong bãi ---
class PhanHoiXeTrongBai(BaseModel):
    id: int
    ma_phien: str
    bien_so: str
    ten_loai_xe: str
    ten_chu_xe: Optional[str]
    gio_vao: datetime
    so_tien_tam_tinh: int


# --- Vé tháng ---
class VeThangCreate(BaseModel):
    bien_so: str = Field(..., min_length=4, max_length=20)
    id_loai_xe: int
    ten_chu_xe: str
    sdt: Optional[str] = None
    email: Optional[str] = None
    dia_chi: Optional[str] = None
    cho_phep_lay_ho: bool = False
    ghi_chu: Optional[str] = None


class PhanHoiVeThang(BaseModel):
    id: int
    bien_so: str
    ten_chu_xe: str
    ngay_dang_ky: date
    ngay_het_han: date
    so_tien: int
    ma_qr: Optional[str]
    trang_thai: str
    ghi_chu: Optional[str] = None