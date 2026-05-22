import qrcode
import json
import uuid
import os
import cv2
import numpy as np

QR_DIR = "uploads/qr"
os.makedirs(QR_DIR, exist_ok=True)

def tao_ma_qr(du_lieu: dict) -> tuple[str, str]:
    """
    Tạo QR code, nội dung tối giản chỉ gồm ma_qr và loai.
    """
    ma_qr = uuid.uuid4().hex[:12].upper()
    # Chỉ lưu 2 trường cần thiết
    noi_dung_qr = {"ma_qr": ma_qr, "loai": du_lieu.get("loai", "phien_gui_xe")}
    noi_dung = json.dumps(noi_dung_qr, ensure_ascii=False)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # M (15%) đủ dùng, QR nhẹ
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


def _tien_xu_ly(img: np.ndarray) -> list:
    """Trả về danh sách ảnh đã xử lý để thử lần lượt."""
    results = [img]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    results.append(gray)
    h, w = img.shape[:2]
    if max(h, w) < 800:
        big = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        results.append(big)
        results.append(cv2.cvtColor(big, cv2.COLOR_BGR2GRAY))
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    results.append(clahe.apply(gray))
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(otsu)
    adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    results.append(adaptive)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    results.append(cv2.filter2D(gray, -1, kernel))
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    _, denoised_bin = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    results.append(denoised_bin)
    return results

def _thu_doc_qr(img: np.ndarray):
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
    Đọc QR từ ảnh, chỉ dùng OpenCV.
    Trả về dict có 'ma_qr' và 'loai'.
    """
    nparr = np.frombuffer(du_lieu_anh, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không thể giải mã ảnh đầu vào.")

    h, w = img.shape[:2]
    if h > w * 1.5:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    for anh_xu_ly in _tien_xu_ly(img):
        data = _thu_doc_qr(anh_xu_ly)
        if data:
            try:
                obj = json.loads(data)
                if "ma_qr" in obj:
                    return obj
            except json.JSONDecodeError:
                continue

    raise ValueError("Không tìm thấy mã QR trong ảnh.")