"""
billing_service.py — Tính tiền giữ xe (hỗ trợ đồng giá nhóm)
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
import math

logger = logging.getLogger(__name__)

_GIO_NGAY_BAT_DAU = 6
_GIO_NGAY_KET_THUC = 22


def _lam_tron_nghin(so_tien: float) -> int:
    return math.ceil(so_tien / 1000) * 1000


def _co_gia_rieng(loai_xe: Dict[str, Any]) -> bool:
    """Trả về True nếu loại xe có ít nhất một trường giá > 0 hoặc cấu hình giờ không rỗng."""
    if (loai_xe.get("gia_luot") or 0) > 0:
        return True
    if (loai_xe.get("gia_ngay") or 0) > 0:
        return True
    if (loai_xe.get("gia_dem") or 0) > 0:
        return True
    if (loai_xe.get("gia_ngay_dem") or 0) > 0:
        return True
    if (loai_xe.get("gia_ve_thang") or 0) > 0:
        return True
    cau_hinh = loai_xe.get("cau_hinh_theo_gio")
    if cau_hinh:
        if isinstance(cau_hinh, str):
            try:
                cau_hinh = json.loads(cau_hinh)
            except (json.JSONDecodeError, TypeError):
                return False
        if isinstance(cau_hinh, list) and len(cau_hinh) > 0:
            return True
    return False


class BillingService:

    @staticmethod
    def tinh_tien_chi_tiet(
        loai_xe: Dict[str, Any],
        gio_vao: datetime,
        gio_ra: datetime,
        nhom_gia: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Tính tiền theo thứ tự ưu tiên:
        1. Giá riêng trên loai_xe (nếu có)
        2. Giá đồng nhóm từ nhom_xe_gia (nếu được truyền vào)
        3. Báo lỗi nếu không có nguồn giá nào.
        """
        # ── Chọn nguồn dữ liệu giá ─────────────────────────────
        nguon_gia = loai_xe
        if not _co_gia_rieng(loai_xe):
            if nhom_gia:
                nguon_gia = nhom_gia
            else:
                raise ValueError("Loại xe chưa có giá riêng và nhóm không có đồng giá.")

        so_phut = (gio_ra - gio_vao).total_seconds() / 60
        kieu = nguon_gia.get("kieu_tinh_gia")
        minimum = int(nguon_gia.get("gia_luot") or 0)

        # ── Theo lượt ──────────────────────────────────────────
        if kieu == "theo_luot":
            return _lam_tron_nghin(minimum)

        # ── Theo ngày đêm ──────────────────────────────────────
        elif kieu == "theo_ngay_dem":
            same_day = gio_ra.date() == gio_vao.date()
            if same_day:
                vao_ban_ngay = _GIO_NGAY_BAT_DAU <= gio_vao.hour < _GIO_NGAY_KET_THUC
                ra_ban_ngay  = _GIO_NGAY_BAT_DAU <= gio_ra.hour  < _GIO_NGAY_KET_THUC
                if vao_ban_ngay and ra_ban_ngay:
                    fee = int(nguon_gia.get("gia_ngay") or minimum)
                elif not vao_ban_ngay and not ra_ban_ngay:
                    fee = int(nguon_gia.get("gia_dem") or minimum)
                else:
                    fee = int(nguon_gia.get("gia_ngay_dem") or minimum)
            else:
                so_ngay = (gio_ra.date() - gio_vao.date()).days
                fee = so_ngay * int(nguon_gia.get("gia_ngay_dem") or minimum)
            return _lam_tron_nghin(fee)

        # ── Theo giờ ───────────────────────────────────────────
        elif kieu == "theo_gio":
            cau_hinh = nguon_gia.get("cau_hinh_theo_gio")
            if not cau_hinh:
                return _lam_tron_nghin(minimum)
            if isinstance(cau_hinh, str):
                try:
                    cau_hinh = json.loads(cau_hinh)
                except (json.JSONDecodeError, TypeError) as exc:
                    logger.error("Lỗi parse cấu hình giờ: %s", exc)
                    return _lam_tron_nghin(minimum)

            so_gio = math.ceil(so_phut / 60)
            tong_tien = 0
            gio_bat_dau = 0
            for bac in cau_hinh:
                if "den_gio" in bac:
                    gio_ket_thuc = bac["den_gio"]
                    so_gio_trong_bac = max(0, min(so_gio, gio_ket_thuc) - gio_bat_dau)
                    tong_tien += so_gio_trong_bac * bac["gia"]
                    gio_bat_dau = gio_ket_thuc
                    if so_gio <= gio_ket_thuc:
                        break
                elif "moi_gio_tiep" in bac:
                    so_gio_con_lai = so_gio - gio_bat_dau
                    if so_gio_con_lai > 0:
                        tong_tien += so_gio_con_lai * bac["moi_gio_tiep"]
                    break
            fee = int(tong_tien)
            return _lam_tron_nghin(fee)

        # Fallback an toàn
        return _lam_tron_nghin(minimum)