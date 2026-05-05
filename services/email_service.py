import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
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

    with open(duong_dan_qr, "rb") as f:
        anh = MIMEImage(f.read())
        anh.add_header("Content-ID", "<ma_qr>")
        msg.attach(anh)

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASS,
            start_tls=True
        )
        print(f"Đã gửi email đến {den}")
    except Exception as e:
        print(f"Lỗi gửi email: {e}")