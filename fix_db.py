import mysql.connector

config = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '111104',
    'database': 'parking_mvp',
    'charset': 'utf8mb4'
}

nhom_data = {
    1: ("Xe máy", "Xe máy các loại, xe điện 2 bánh"),
    2: ("Ô tô con", "Ô tô dưới 16 chỗ, xe bán tải, SUV"),
    3: ("Xe tải & Xe khách lớn", "Xe trên 16 chỗ, xe tải hạng nặng"),
    4: ("Xe thô sơ", "Xe đạp, xe lăn, xe không động cơ")
}

loai_xe_data = {
    1: "Xe máy phổ thông (Số, ga)",
    2: "Xe mô tô PKL / Xe tay côn",
    3: "Xe máy điện",
    4: "Ô tô 4 - 7 chỗ",
    5: "Xe bán tải (Pick-up)",
    6: "Ô tô 9 - 16 chỗ",
    7: "Ô tô điện",
    8: "Xe tải / Xe khách lớn (>16 chỗ)",
    9: "Xe đạp / Xe đạp điện",
    10: "Xe dành cho người khuyết tật"
}

try:
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor()

    for id_val, (ten, mo_ta) in nhom_data.items():
        cursor.execute("UPDATE nhom_xe SET ten = %s, mo_ta = %s WHERE id = %s", (ten, mo_ta, id_val))

    for id_val, ten in loai_xe_data.items():
        cursor.execute("UPDATE loai_xe SET ten = %s WHERE id = %s", (ten, id_val))

    conn.commit()
    print("Đã cập nhật tiếng Việt thành công!")
except mysql.connector.Error as err:
    print(f"Lỗi: {err}")
    if conn:
        conn.rollback()
finally:
    if conn.is_connected():
        cursor.close()
        conn.close()