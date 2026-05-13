import json
import logging
from datetime import datetime, date
from typing import Dict, Any

logger = logging.getLogger(__name__)

class BillingService:
    @staticmethod
    def tinh_tien_chi_tiet(loai_xe: Dict[str, Any], gio_vao: datetime, gio_ra: datetime) -> int:
        so_phut = (gio_ra - gio_vao).total_seconds() / 60
        kieu = loai_xe.get("kieu_tinh_gia")
        minimum = loai_xe.get("gia_luot") or 0

        if kieu == "theo_luot":
            return int(loai_xe.get("gia_luot") or 0)

        elif kieu == "theo_ngay_dem":
            same_day = (gio_ra.date() == gio_vao.date())
            if same_day:
                # Trong cùng 1 ngày, kiểm tra khung giờ
                if 6 <= gio_vao.hour and gio_ra.hour < 22:
                    fee = int(loai_xe.get("gia_ngay") or minimum)
                else:
                    fee = int(loai_xe.get("gia_dem") or minimum)
            else:
                # Khác ngày: tính số đêm (số ngày vượt qua)
                num_nights = (gio_ra.date() - gio_vao.date()).days
                fee = num_nights * int(loai_xe.get("gia_ngay_dem") or minimum)
            return max(fee, minimum) if minimum else fee

        elif kieu == "theo_gio":
            cau_hinh = loai_xe.get("cau_hinh_theo_gio")
            if not cau_hinh:
                return int(minimum)
            if isinstance(cau_hinh, str):
                try:
                    cau_hinh = json.loads(cau_hinh)
                except (json.JSONDecodeError, TypeError) as e:
                    logger.error(f"Lỗi parse cấu hình giờ: {e}")
                    return int(minimum)

            so_gio = so_phut / 60
            tong_tien = 0
            con_lai = so_gio
            for bac in cau_hinh:
                if "den_gio" in bac:
                    gio_trong_bac = min(con_lai, bac["den_gio"])
                    tong_tien += gio_trong_bac * bac["gia"]
                    con_lai -= gio_trong_bac
                    if con_lai <= 0:
                        break
                elif "moi_gio_tiep" in bac:
                    tong_tien += con_lai * bac["moi_gio_tiep"]
                    break
            fee = round(tong_tien)
            # Áp dụng giá tối thiểu bằng giá lượt nếu có
            if minimum and fee < minimum:
                fee = int(minimum)
            return fee

        return int(minimum)