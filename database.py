import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def lay_ket_noi_CSDL():
    KetNoi = None
    try:
        KetNoi = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME")
        )
        if KetNoi.is_connected():
            yield KetNoi
    except mysql.connector.Error as err:
        print(f"Lỗi kết nối CSDL: {err}")
        raise err
    finally:
        if KetNoi:
            try:
                KetNoi.close()
            except Exception:
                pass