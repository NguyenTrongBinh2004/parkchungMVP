# main.py
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from database import lay_ket_noi_CSDL
from models import PhanHoiXeVao, PhanHoiXeRa, PhanHoiVeThang, HinhThucThanhToan
from services.ocr import nhan_dien_bien_so
from services.qr_service import tao_ma_qr, doc_ma_qr
from services.email_service import gui_email_qr
from services.sms_service import gui_thong_bao_ve_thang
from services.billing_service import BillingService, _co_gia_rieng
from routers import loai_xe, xe_ra, thanh_toan, xe_vao, ve_thang, bao_cao, tim_xe, danh_sach_xe, auth
from utils import bay_gio_vn, build_url, chuan_hoa_bien_so, tinh_trang_thai, luu_anh, is_valid_bien_so
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
import re
from typing import Optional
from datetime import datetime, date, timedelta
import os, uuid, asyncio

load_dotenv()

app = FastAPI(title="Parking MVP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(loai_xe.router)
app.include_router(xe_ra.router)
app.include_router(thanh_toan.router)
app.include_router(xe_vao.router)
app.include_router(ve_thang.router)
app.include_router(bao_cao.router)
app.include_router(tim_xe.router)
app.include_router(danh_sach_xe.router)
app.include_router(auth.router)


os.makedirs("uploads", exist_ok=True)


# ── General ────────────────────────────────────────────────────
@app.get("/api/")
def chao_mung():
    return {"message": "Parking MVP API v1.0"}


# ── Khách hàng ─────────────────────────────────────────────────
@app.get("/khach-hang/")
def danh_sach_khach_hang(KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM khach_hang ORDER BY created_at DESC")
        return cur.fetchall()


@app.get("/khach-hang/{id_khach}/")
def chi_tiet_khach_hang(id_khach: int, KetNoi=Depends(lay_ket_noi_CSDL)):
    with KetNoi.cursor(dictionary=True) as cur:
        cur.execute("SELECT * FROM khach_hang WHERE id = %s", (id_khach,))
        kh = cur.fetchone()
        if not kh:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng.")
        cur.execute(
            """
            SELECT v.id, v.bien_so, v.ngay_dang_ky, v.ngay_het_han, v.so_tien, v.ma_qr,
                   l.ten AS ten_loai_xe
              FROM ve_thang v JOIN loai_xe l ON v.id_loai_xe = l.id
             WHERE v.id_khach_hang = %s ORDER BY v.created_at DESC
            """,
            (id_khach,),
        )
        kh["lich_su_ve_thang"] = cur.fetchall()
    return kh