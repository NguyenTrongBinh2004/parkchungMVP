import qrcode
import json
import uuid
import os
import cv2
import numpy as np
from PIL import Image
import io

QR_DIR = "uploads/qr"
os.makedirs(QR_DIR, exist_ok=True)

def tao_ma_qr(du_lieu: dict) -> tuple[str, str]:
    ma_qr = uuid.uuid4().hex[:12].upper()
    du_lieu["ma_qr"] = ma_qr
    noi_dung = json.dumps(du_lieu, ensure_ascii=False)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(noi_dung)
    qr.make(fit=True)

    anh_qr = qr.make_image(fill_color="black", back_color="white")
    ten_file = f"{ma_qr}.png"
    duong_dan = os.path.join(QR_DIR, ten_file)
    anh_qr.save(duong_dan)
    return ma_qr, duong_dan

def doc_ma_qr(du_lieu_anh: bytes) -> dict:
    """
    Đọc mã QR từ ảnh (bytes) sử dụng OpenCV.
    Trả về dict chứa dữ liệu JSON đã giải mã.
    """
    # Chuyển bytes thành numpy array
    nparr = np.frombuffer(du_lieu_anh, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không thể giải mã ảnh đầu vào.")

    # Sử dụng OpenCV QRCodeDetector
    detector = cv2.QRCodeDetector()
    data, bbox, straight_qrcode = detector.detectAndDecode(img)

    if not data:
        raise ValueError("Không tìm thấy mã QR trong ảnh.")

    # Dữ liệu QR là JSON
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        raise ValueError("Mã QR không chứa dữ liệu JSON hợp lệ.")