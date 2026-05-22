import asyncio
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))  # ← port 587
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

async def gui_email_qr(
    den: str,
    ten_chu_xe: str,
    bien_so: str,
    gio_vao: str,
    duong_dan_qr: str
):
    if not SMTP_USER or not SMTP_PASS:
        print("Chưa cấu hình SMTP, bỏ qua gửi email")
        return

    msg = MIMEMultipart("related")
    msg["Subject"] = f"Vé gửi xe - Biển số {bien_so}"
    msg["From"] = SMTP_USER
    msg["To"] = den

    noi_dung_html = f"""
    <html><body>
        <h2>Thông tin gửi xe</h2>
        <p><b>Họ tên:</b> {ten_chu_xe}</p>
        <p><b>Biển số:</b> {bien_so}</p>
        <p><b>Giờ vào:</b> {gio_vao}</p>
        <p>Vui lòng xuất trình mã QR bên dưới khi lấy xe:</p>
        <img src="cid:ma_qr" width="200"/>
    </body></html>
    """
    msg.attach(MIMEText(noi_dung_html, "html"))

    try:
        with open(duong_dan_qr, "rb") as f:
            anh = MIMEImage(f.read())
            anh.add_header("Content-ID", "<ma_qr>")
            msg.attach(anh)
    except Exception as e:
        print(f"Không thể đọc file QR: {e}")

    for attempt in range(2):
        try:
            print(f"Thử gửi email lần {attempt+1}/2...")
            await aiosmtplib.send(
                msg,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                username=SMTP_USER,
                password=SMTP_PASS,
                start_tls=True,          # ← STARTTLS cho port 587
                timeout=10
            )
            print(f"Đã gửi email đến {den}")
            return
        except Exception as e:
            print(f"Lỗi gửi email lần {attempt+1}: {type(e).__name__} - {e}")
            if attempt == 0:
                await asyncio.sleep(2)
    print(f"Gửi email thất bại sau 2 lần thử.")