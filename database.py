import os
import logging

import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_pool: pooling.MySQLConnectionPool | None = None


def _khoi_tao_pool() -> pooling.MySQLConnectionPool:
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="parking_pool",
            pool_size=int(os.getenv("DB_POOL_SIZE", 10)),  # ← tăng lại 10
            pool_reset_session=True,
            host=os.getenv("DB_HOST"),
            port=int(os.getenv("DB_PORT", 3306)),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            ssl_ca=os.getenv("DB_SSL_CA", "ca.pem"),
            autocommit=False,
            connection_timeout=30,  
            connect_timeout=10,
            consume_results=True,
            raise_on_warnings=False,
        )
        logger.info("MySQL connection pool đã khởi tạo (size=%s)", _pool.pool_size)
    return _pool


def lay_ket_noi_CSDL():
    conn = None
    try:
        conn = _khoi_tao_pool().get_connection()
        conn.ping(reconnect=True, attempts=3, delay=1)
        yield conn
    except mysql.connector.Error as err:
        logger.error("Lỗi kết nối CSDL: %s", err)
        raise
    finally:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass