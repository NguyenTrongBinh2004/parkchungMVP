from twilio.rest import Client
import os
from dotenv import load_dotenv

load_dotenv()

TWILIO_SID   = os.getenv("TWILIO_SID")
TWILIO_TOKEN = os.getenv("TWILIO_TOKEN")
TWILIO_FROM  = os.getenv("TWILIO_FROM")

def gui_sms_ma_phien(sdt: str, ma_phien: str, bien_so: str):
    if not all([TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM]):
        print("Chưa cấu hình Twilio, bỏ qua gửi SMS")
        return
    try:
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        client.messages.create(
            to=f"+84{sdt.lstrip('0')}",
            from_=TWILIO_FROM,
            body=f"[Parking MVP] Xe {bien_so} đã vào bãi.\nMã phiên: {ma_phien}\nXuất trình mã này khi lấy xe."
        )
        print(f"Đã gửi SMS đến {sdt}")
    except Exception as e:
        print(f"Lỗi gửi SMS: {e}")