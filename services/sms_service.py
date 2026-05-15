"""
Gửi tin đa kênh: Zalo ZNS → SMS CSKH (fallback)
Tài liệu: https://developers.esms.vn/esms-api/ham-gui-tin/tin-mutichanel-zalo-greater-than-sms-otp-cskh

Đã sửa triệt để:
- Sandbox kiểu int
- Retry với RequestId mới mỗi lần thử (tránh dedup)
- RequestId dạng hex (không dấu gạch)
- SMS content không nhồi URL dài
- Validate SĐT đầu vào
- Che (mask) SĐT trong log
"""
import requests
import uuid
import os
import time
import logging
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Cấu hình từ .env ──────────────────────────────────────────
ESMS_API_KEY    = os.getenv("ESMS_API_KEY")
ESMS_SECRET_KEY = os.getenv("ESMS_SECRET_KEY")
ESMS_OAID       = os.getenv("ESMS_OAID")                      # Zalo OA ID
ESMS_TEMP_VE_THANG = os.getenv("ESMS_TEMP_ID_VE_THANG", "540610")  # Template vé tháng
ESMS_TEMP_XE_VAO   = os.getenv("ESMS_TEMP_ID_XE_VAO", "540646")    # Template xe vào thường
ESMS_BRANDNAME  = os.getenv("ESMS_BRANDNAME", "ParkingMVP")  # Brandname SMS
ESMS_SANDBOX    = int(os.getenv("ESMS_SANDBOX", "1"))         # 1 = test, 0 = thật

ENDPOINT = "https://rest.esms.vn/MainService.svc/json/MultiChannelMessage/"
MAX_RETRY = 3


def _chuan_hoa_sdt(sdt: str) -> str:
    """Chuyển 0912... → 84912... (không có dấu +)"""
    sdt = sdt.strip()
    if sdt.startswith("+84"):
        return sdt[1:]          # bỏ dấu +
    if sdt.startswith("0"):
        return "84" + sdt[1:]
    return sdt


def _validate_sdt(sdt: str) -> bool:
    """Kiểm tra SĐT hợp lệ (sau chuẩn hóa có dạng 84xxxxxxxxx)."""
    return bool(re.match(r'^84\d{8,10}$', sdt))


def _mask_sdt(sdt: str) -> str:
    """Che SĐT để log: 84912****89"""
    if len(sdt) >= 7:
        return sdt[:4] + "****" + sdt[-3:]
    return sdt[:3] + "****"


def _gui_zalo_kem_sms(sdt_chuan: str, temp_id: str, params: list, sms_content: str, campaign: str):
    """
    Gửi Zalo ZNS + SMS fallback với retry.
    Mỗi lần thử tạo RequestId mới để tránh dedup từ eSMS.
    """
    for attempt in range(1, MAX_RETRY + 1):
        # Tạo payload mới hoàn toàn, với RequestId mới mỗi lần
        payload = {
            "ApiKey":    ESMS_API_KEY,
            "SecretKey": ESMS_SECRET_KEY,
            "Phone":     sdt_chuan,
            "Channels":  ["zalo", "sms"],
            "Data": [
                {
                    "TempID":      temp_id,
                    "Params":      params,
                    "OAID":        ESMS_OAID,
                    "campaignid":  campaign,
                    "RequestId":   uuid.uuid4().hex,   # mới mỗi lần
                    "Sandbox":     ESMS_SANDBOX,
                    "SendingMode": "1",
                },
                {
                    "Content":    sms_content,
                    "IsUnicode":  "0",
                    "SmsType":    "2",
                    "Brandname":  ESMS_BRANDNAME,
                    "RequestId":  uuid.uuid4().hex,   # mới mỗi lần
                    "Sandbox":    ESMS_SANDBOX,
                },
            ],
        }

        try:
            res = requests.post(ENDPOINT, json=payload, timeout=15)
            data = res.json()
            if data.get("CodeResult") == "100":
                logger.info(f"Gửi tin thành công đến {_mask_sdt(sdt_chuan)} | Campaign: {campaign} | SMSID: {data.get('SMSID')}")
                return True
            else:
                logger.error(f"Gửi tin thất bại (lần {attempt}): {data.get('ErrorMessage')}")
                if attempt < MAX_RETRY:
                    time.sleep(2 ** (attempt - 1))   # backoff 1s, 2s, 4s
        except requests.Timeout:
            logger.warning(f"Timeout gửi eSMS (lần {attempt})")
            if attempt < MAX_RETRY:
                time.sleep(2 ** (attempt - 1))
        except Exception as e:
            logger.error(f"Lỗi gửi eSMS: {e}")
            break   # không retry nếu lỗi khác

    logger.error(f"Không gửi được tin sau {MAX_RETRY} lần thử đến {_mask_sdt(sdt_chuan)}")
    return False


def gui_thong_bao_ve_thang(sdt: str, bien_so: str, ngay_het_han: str, qr_url: str = None):
    """
    Gửi thông báo vé tháng (đăng ký mới hoặc gia hạn).
    Zalo: template 540610, params = [bien_so, ngay_het_han]
    """
    if not all([ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_OAID, ESMS_TEMP_VE_THANG]):
        logger.warning("Chưa cấu hình đủ eSMS — bỏ qua gửi tin vé tháng.")
        return

    if not sdt or len(sdt) < 9:
        logger.warning("SĐT không hợp lệ, bỏ qua gửi tin vé tháng.")
        return

    sdt_chuan = _chuan_hoa_sdt(sdt)
    if not _validate_sdt(sdt_chuan):
        logger.warning(f"SĐT sau chuẩn hóa không hợp lệ: {_mask_sdt(sdt_chuan)}")
        return

    params = [bien_so, ngay_het_han]

    # SMS fallback ngắn gọn, không nhồi URL dài
    sms_content = (f"[Parking MVP] Bien so {bien_so} da duoc dang ky/gia han ve thang. "
                   f"Han su dung: {ngay_het_han}.")

    _gui_zalo_kem_sms(sdt_chuan, ESMS_TEMP_VE_THANG, params, sms_content, "ParkingMVP - Ve thang")


def gui_thong_bao_xe_vao(sdt: str, bien_so: str, ma_phien: str):
    """
    Gửi thông báo xe vào bãi (xe thường).
    Zalo: template 540646, params = [bien_so, ma_phien]
    """
    if not all([ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_OAID, ESMS_TEMP_XE_VAO]):
        logger.warning("Chưa cấu hình đủ eSMS — bỏ qua gửi tin xe vào.")
        return

    if not sdt or len(sdt) < 9:
        logger.warning("SĐT không hợp lệ, bỏ qua gửi tin xe vào.")
        return

    sdt_chuan = _chuan_hoa_sdt(sdt)
    if not _validate_sdt(sdt_chuan):
        logger.warning(f"SĐT sau chuẩn hóa không hợp lệ: {_mask_sdt(sdt_chuan)}")
        return

    params = [bien_so, ma_phien]

    sms_content = (f"[Parking MVP] Xe {bien_so} da vao bai. "
                   f"Ma phien: {ma_phien}. "
                   f"Xuat trinh ma nay khi lay xe.")

    _gui_zalo_kem_sms(sdt_chuan, ESMS_TEMP_XE_VAO, params, sms_content, "ParkingMVP - Xe vao")