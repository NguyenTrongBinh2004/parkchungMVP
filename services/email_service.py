import os
import resend
from dotenv import load_dotenv

load_dotenv()

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("SMTP_USER", "binhx19123@gmail.com")  # giữ biến cũ cho đồng bộ

async def gui_email_qr(den, ten_chu_xe, bien_so, gio_vao, duong_dan_qr):
    if not RESEND_API_KEY:
        print("Chưa cấu hình RESEND_API_KEY, bỏ qua gửi email")
        return

    # Resend yêu cầu domain đã verify, tạm thời dùng domain mặc định của Resend
    from_domain = "onboarding@resend.dev"  # Thay bằng domain của bạn sau khi verify
    # Nếu bạn đã verify domain, hãy dùng: from_domain = "parking@yourdomain.com"

    try:
        params = {
            "from": f"Parking MVP <{from_domain}>",
            "to": [den],
            "subject": f"Vé gửi xe - Biển số {bien_so}",
            "html": f"""
                <h2>Thông tin gửi xe</h2>
                <p><b>Họ tên:</b> {ten_chu_xe}</p>
                <p><b>Biển số:</b> {bien_so}</p>
                <p><b>Giờ vào:</b> {gio_vao}</p>
                <p>Vui lòng xuất trình mã QR bên dưới khi lấy xe:</p>
                <img src="cid:ma_qr" width="200"/>
            """,
        }
        # Nếu có file QR, đính kèm
        if duong_dan_qr and os.path.exists(duong_dan_qr):
            with open(duong_dan_qr, "rb") as f:
                params["attachments"] = [{
                    "filename": "qr.png",
                    "content": f.read(),
                    "content_id": "ma_qr",
                }]

        resend.api_key = RESEND_API_KEY
        resend.Emails.send(params)
        print(f"Đã gửi email đến {den}")
    except Exception as e:
        print(f"Lỗi gửi email: {e}")