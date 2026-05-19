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


# ── Tiền xử lý ảnh ─────────────────────────────────────────────
def _tien_xu_ly(img: np.ndarray) -> list:
    """Trả về danh sách ảnh đã xử lý để thử lần lượt."""
    results = []

    # 1. Ảnh gốc
    results.append(img)

    # 2. Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    results.append(gray)

    # 3. Phóng to 2x nếu ảnh nhỏ
    h, w = img.shape[:2]
    if max(h, w) < 800:
        big = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        results.append(big)
        results.append(cv2.cvtColor(big, cv2.COLOR_BGR2GRAY))

    # 4. Tăng độ tương phản CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    results.append(clahe.apply(gray))

    # 5. Nhị phân Otsu (xử lý lóa/tối)
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(otsu)

    # 6. Adaptive threshold (ánh sáng không đều)
    adaptive = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )
    results.append(adaptive)

    # 7. Làm sắc nét
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    results.append(cv2.filter2D(gray, -1, kernel))

    # 8. Khử nhiễu + nhị phân
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    _, denoised_bin = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(denoised_bin)

    return results


def _thu_doc_qr(img: np.ndarray):
    """Thử đọc QR, trả về chuỗi data hoặc None."""
    detector = cv2.QRCodeDetector()
    try:
        data, bbox, _ = detector.detectAndDecode(img)
        if data:
            return data
    except Exception:
        pass
    return None


def doc_ma_qr(du_lieu_anh: bytes) -> dict:
    """
    Đọc mã QR từ ảnh với nhiều bước tiền xử lý.
    Tự động thử nhiều phương pháp đến khi đọc được.
    """
    nparr = np.frombuffer(du_lieu_anh, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Không thể giải mã ảnh đầu vào.")

    # Xoay nếu ảnh chụp dọc điện thoại
    h, w = img.shape[:2]
    if h > w * 1.5:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    # Thử từng phiên bản ảnh
    for anh_xu_ly in _tien_xu_ly(img):
        data = _thu_doc_qr(anh_xu_ly)
        if data:
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                raise ValueError("Mã QR không chứa JSON hợp lệ.")

    raise ValueError("Không tìm thấy mã QR. Hãy chụp rõ hơn và đảm bảo đủ ánh sáng.")