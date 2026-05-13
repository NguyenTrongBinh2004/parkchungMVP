import qrcode
import json
import uuid
import os
from PIL import Image
import io
from pyzbar.pyzbar import decode

QR_DIR = "uploads/qr"
os.makedirs(QR_DIR, exist_ok=True)

def tao_ma_qr(du_lieu: dict) -> tuple[str, str]:
    ma_qr = uuid.uuid4().hex[:12].upper()   # tăng lên 12 ký tự hex
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
    anh = Image.open(io.BytesIO(du_lieu_anh))
    ket_qua = decode(anh)
    if not ket_qua:
        raise ValueError("Không tìm thấy mã QR trong ảnh.")
    noi_dung = ket_qua[0].data.decode("utf-8")
    return json.loads(noi_dung)