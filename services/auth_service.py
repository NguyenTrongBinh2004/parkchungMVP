import os, secrets, hashlib, random
from datetime import timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from utils import bay_gio_vn

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-please-use-a-long-random-string")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS   = 30


def hash_mat_khau(mat_khau: str) -> str:
    return pwd_context.hash(mat_khau)

def xac_minh_mat_khau(mat_khau: str, hash_luu: str) -> bool:
    return pwd_context.verify(mat_khau, hash_luu)

def tao_otp() -> str:
    return f"{random.randint(0, 999999):06d}"

def tao_access_token(id_nguoi_dung: int, id_bai_xe: int) -> str:
    expire = bay_gio_vn().replace(tzinfo=None) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(id_nguoi_dung), "bai_xe": id_bai_xe, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def tao_refresh_token() -> tuple[str, str]:
    """Trả về (token_goc, token_hash). Chỉ lưu hash vào DB."""
    raw    = secrets.token_urlsafe(48)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed

def giai_ma_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None