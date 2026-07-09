import os, secrets, hashlib, random
import bcrypt
from datetime import timedelta
from jose import jwt, JWTError
from utils import bay_gio_vn
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-please-use-a-long-random-string")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS   = 30
bearer_scheme = HTTPBearer(auto_error=False)

def hash_mat_khau(mat_khau: str) -> str:
    return bcrypt.hashpw(mat_khau.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def xac_minh_mat_khau(mat_khau: str, hash_luu: str) -> bool:
    try:
        return bcrypt.checkpw(mat_khau.encode("utf-8"), hash_luu.encode("utf-8"))
    except Exception:
        return False

def tao_otp() -> str:
    return f"{random.randint(0, 999999):06d}"

def tao_access_token(id_nguoi_dung: int, id_bai_xe: int) -> str:
    expire = bay_gio_vn().replace(tzinfo=None) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(id_nguoi_dung), "bai_xe": id_bai_xe, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def tao_refresh_token() -> tuple[str, str]:
    raw    = secrets.token_urlsafe(48)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed

def giai_ma_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def lay_nguoi_dung_hien_tai(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> int:
    """Dependency dùng cho các endpoint cần đăng nhập. Trả về id_nguoi_dung."""
    if creds is None:
        raise HTTPException(401, "Thiếu access token")
    payload = giai_ma_access_token(creds.credentials)
    if payload is None:
        raise HTTPException(401, "Access token không hợp lệ hoặc đã hết hạn")
    try:
        return int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(401, "Access token không hợp lệ")