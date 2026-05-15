import os
import logging

import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Singleton pool ─────────────────────────────────────────────
_pool: pooling.MySQLConnectionPool | None = None


def _khoi_tao_pool() -> pooling.MySQLConnectionPool:
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="parking_pool",
            pool_size=int(os.getenv("DB_POOL_SIZE", 10)),
            pool_reset_session=True,
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", 3306)),        # ← thêm PORT (Aiven: 12268)
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            ssl_ca=os.getenv("DB_SSL_CA", "ca.pem"),     # ← thêm SSL cert
            autocommit=False,          # mọi commit phải tường minh
            connection_timeout=10,
        )
        logger.info("MySQL connection pool đã khởi tạo (size=%s)", _pool.pool_size)
    return _pool


# ── FastAPI dependency ─────────────────────────────────────────
def lay_ket_noi_CSDL():
    """
    Dependency injection cho FastAPI.
    Lấy connection từ pool, tự động trả về pool khi request xong.
    Nếu có exception chưa được bắt, rollback trước khi trả connection.
    """
    conn = None
    try:
        conn = _khoi_tao_pool().get_connection()
        yield conn
    except mysql.connector.Error as err:
        logger.error("Lỗi kết nối CSDL: %s", err)
        raise
    finally:
        if conn and conn.is_connected():
            try:
                # Rollback mọi transaction chưa commit để đảm bảo
                # connection trả về pool ở trạng thái sạch
                conn.rollback()
            except Exception:
                pass
            try:
                conn.close()   # trả connection về pool, không đóng thật sự
            except Exception:
                pass