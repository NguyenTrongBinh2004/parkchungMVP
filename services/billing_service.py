"""
billing_service.py — Tính tiền giữ xe
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict
import math
logger = logging.getLogger(__name__)

# Khung giờ BAN NGÀY: 06:00 → 22:00
_GIO_NGAY_BAT_DAU = 6
_GIO_NGAY_KET_THUC = 22

def _lam_tron_nghin(so_tien: float) -> int:
    """Làm tròn lên hàng nghìn: 325.531 → 326.000"""
    return math.ceil(so_tien / 1000) * 1000

class BillingService:

    @staticmethod
    def tinh_tien_chi_tiet(
        loai_xe: Dict[str, Any],
        gio_vao: datetime,
        gio_ra: datetime,
    ) -> int:
        so_phut = (gio_ra - gio_vao).total_seconds() / 60
        kieu = loai_xe.get("kieu_tinh_gia")
        minimum = int(loai_xe.get("gia_luot") or 0)

        # ── Theo lượt ──────────────────────────────────────────
        if kieu == "theo_luot":
            return _lam_tron_nghin(minimum)

        # ── Theo ngày đêm ──────────────────────────────────────
        elif kieu == "theo_ngay_dem":
            same_day = gio_ra.date() == gio_vao.date()

            if same_day:
                # BAN NGÀY: cả giờ vào lẫn giờ ra đều trong 06:00–22:00
                vao_ban_ngay = _GIO_NGAY_BAT_DAU <= gio_vao.hour < _GIO_NGAY_KET_THUC
                ra_ban_ngay  = _GIO_NGAY_BAT_DAU <= gio_ra.hour  < _GIO_NGAY_KET_THUC

                if vao_ban_ngay and ra_ban_ngay:
                    # Toàn bộ phiên nằm trong khung giờ ngày
                    fee = int(loai_xe.get("gia_ngay") or minimum)
                elif not vao_ban_ngay and not ra_ban_ngay:
                    # Toàn bộ phiên nằm trong khung giờ đêm
                    fee = int(loai_xe.get("gia_dem") or minimum)
                else:
                    # Vắt qua ranh giới ngày/đêm (ví dụ: vào 20h, ra 23h)
                    # Áp dụng giá ngày-đêm (qua đêm trong cùng 1 ngày lịch)
                    fee = int(loai_xe.get("gia_ngay_dem") or minimum)
            else:
                # Khác ngày lịch — đếm số đêm
                so_ngay = (gio_ra.date() - gio_vao.date()).days
                fee = so_ngay * int(loai_xe.get("gia_ngay_dem") or minimum)

            return _lam_tron_nghin(max(fee, minimum) if minimum else fee)
        # ── Theo giờ ───────────────────────────────────────────
        elif kieu == "theo_gio":
            cau_hinh = loai_xe.get("cau_hinh_theo_gio")
            if not cau_hinh:
                return _lam_tron_nghin(minimum)

            if isinstance(cau_hinh, str):
                try:
                    cau_hinh = json.loads(cau_hinh)
                except (json.JSONDecodeError, TypeError) as exc:
                    logger.error("Lỗi parse cấu hình giờ: %s", exc)
                    return _lam_tron_nghin(minimum)

            so_gio = so_phut / 60
            tong_tien = 0.0
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
            # Áp dụng mức tối thiểu
            return _lam_tron_nghin(max(fee, minimum) if minimum else fee)

        # ── Fallback ───────────────────────────────────────────
        return  _lam_tron_nghin(minimum)