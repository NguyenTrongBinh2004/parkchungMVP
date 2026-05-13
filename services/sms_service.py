"""
Gửi tin đa kênh: Zalo ZNS → SMS CSKH (fallback)
Tài liệu: https://developers.esms.vn/esms-api/ham-gui-tin/tin-mutichanel-zalo-greater-than-sms-otp-cskh
"""
import requests
import uuid
import os
import logging 
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Cấu hình từ .env ──────────────────────────────────────────
ESMS_API_KEY    = os.getenv("ESMS_API_KEY")
ESMS_SECRET_KEY = os.getenv("ESMS_SECRET_KEY")
ESMS_OAID       = os.getenv("ESMS_OAID")          # Zalo OA ID
ESMS_TEMP_ID    = os.getenv("ESMS_TEMP_ID")        # Template ID đã đăng ký với eSMS
ESMS_BRANDNAME  = os.getenv("ESMS_BRANDNAME", "ParkingMVP")  # Brandname SMS
ESMS_SANDBOX    = os.getenv("ESMS_SANDBOX", "1")   # "1" = test, "0" = thật

ENDPOINT = "https://rest.esms.vn/MainService.svc/json/MultiChannelMessage/"


def _chuan_hoa_sdt(sdt: str) -> str:
    """Chuyển 0912... → 84912... (không có dấu +)"""
    sdt = sdt.strip()
    if sdt.startswith("+84"):
        return sdt[1:]          # bỏ dấu +
    if sdt.startswith("0"):
        return "84" + sdt[1:]
    return sdt


def gui_thong_bao_ve_thang(sdt: str, bien_so: str, ngay_het_han: str, qr_url: str = None):
    print(f"====> [TEST] gui_thong_bao_ve_thang ĐÃ ĐƯỢC GỌI. SĐT: {sdt}, Biển: {bien_so}")
    """
    Gửi thông báo vé tháng (đăng ký mới hoặc gia hạn) qua Zalo → SMS.

    Params ZNS truyền vào template (thứ tự phải khớp template đã đăng ký):
      [bien_so, ngay_het_han]
    Nếu template của bạn có thêm params, bổ sung vào list bên dưới.
    """
    if not all([ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_OAID, ESMS_TEMP_ID]):
        logger.warning("Chưa cấu hình đủ ESMS_API_KEY / ESMS_SECRET_KEY / ESMS_OAID / ESMS_TEMP_ID — bỏ qua gửi tin.")
        return

    sdt_chuan = _chuan_hoa_sdt(sdt)
    request_id_zalo = str(uuid.uuid4())[:50]
    request_id_sms  = str(uuid.uuid4())[:50]

    # Nội dung SMS fallback (không dấu để tiết kiệm ký tự)
    sms_content = (
        f"[Parking MVP] Bien so {bien_so} da duoc dang ky/gia han ve thang. "
        f"Han su dung: {ngay_het_han}."
    )
    if qr_url:
        sms_content += f" Ma QR: {qr_url}"

    payload = {
        "ApiKey":    ESMS_API_KEY,
        "SecretKey": ESMS_SECRET_KEY,
        "Phone":     sdt_chuan,
        "Channels":  ["zalo", "sms"],   # thứ tự cố định, không đổi
        "Data": [
            # ── Data[0]: Zalo ZNS ──
            {
                "TempID":      ESMS_TEMP_ID,
                "Params":      [bien_so, ngay_het_han],   # khớp template
                "OAID":        ESMS_OAID,
                "campaignid":  "ParkingMVP - Ve thang",
                "RequestId":   request_id_zalo,
                "Sandbox":     ESMS_SANDBOX,
                "SendingMode": "1",
            },
            # ── Data[1]: SMS CSKH fallback ──
            {
                "Content":    sms_content,
                "IsUnicode":  "0",
                "SmsType":    "2",          # CSKH
                "Brandname":  ESMS_BRANDNAME,
                "RequestId":  request_id_sms,
                "Sandbox":    ESMS_SANDBOX,
            },
        ],
    }

    try:
        res = requests.post(ENDPOINT, json=payload, timeout=15)
        data = res.json()
        if data.get("CodeResult") == "100":
            logger.info(f"Gửi tin thành công đến {sdt_chuan} | SMSID: {data.get('SMSID')}")
        else:
            logger.error(f"Gửi tin thất bại: {data}")
    except Exception as e:
        logger.error(f"Lỗi gửi tin eSMS MultiChannel: {e}")


def gui_thong_bao_xe_vao(sdt: str, bien_so: str, ma_phien: str):
    """
    Gửi thông báo xe vào bãi qua Zalo → SMS.
    Params ZNS: [bien_so, ma_phien] — khớp template đã đăng ký.
    """
    if not all([ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_OAID, ESMS_TEMP_ID]):
        logger.warning("Chưa cấu hình đủ eSMS — bỏ qua gửi tin xe vào.")
        return

    sdt_chuan = _chuan_hoa_sdt(sdt)

    sms_content = (
        f"[Parking MVP] Xe {bien_so} da vao bai. "
        f"Ma phien: {ma_phien}. "
        f"Xuat trinh ma nay khi lay xe."
    )

    payload = {
        "ApiKey":    ESMS_API_KEY,
        "SecretKey": ESMS_SECRET_KEY,
        "Phone":     sdt_chuan,
        "Channels":  ["zalo", "sms"],
        "Data": [
            {
                "TempID":      ESMS_TEMP_ID,
                "Params":      [bien_so, ma_phien],
                "OAID":        ESMS_OAID,
                "campaignid":  "ParkingMVP - Xe vao",
                "RequestId":   str(uuid.uuid4())[:50],
                "Sandbox":     ESMS_SANDBOX,
                "SendingMode": "1",
            },
            {
                "Content":   sms_content,
                "IsUnicode": "0",
                "SmsType":   "2",
                "Brandname": ESMS_BRANDNAME,
                "RequestId": str(uuid.uuid4())[:50],
                "Sandbox":   ESMS_SANDBOX,
            },
        ],
    }

    try:
        res = requests.post(ENDPOINT, json=payload, timeout=15)
        data = res.json()
        if data.get("CodeResult") == "100":
            logger.info(f"Gửi tin xe vào thành công đến {sdt_chuan}")
        else:
            logger.error(f"Gửi tin xe vào thất bại: {data}")
    except Exception as e:
        logger.error(f"Lỗi gửi tin eSMS xe vào: {e}")