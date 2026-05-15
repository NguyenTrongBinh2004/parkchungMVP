-- MySQL dump 10.13  Distrib 8.4.8, for Win64 (x86_64)
--
-- Host: localhost    Database: parking_mvp
-- ------------------------------------------------------
-- Server version	8.4.8

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `khach_hang`
--

DROP TABLE IF EXISTS `khach_hang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `khach_hang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sdt` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dia_chi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cho_phep_lay_ho` tinyint DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sdt` (`sdt`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lich_su_ve_thang`
--

DROP TABLE IF EXISTS `lich_su_ve_thang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lich_su_ve_thang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_ve_thang` int NOT NULL,
  `loai` enum('dang_ky_moi','gia_han') COLLATE utf8mb4_unicode_ci DEFAULT 'dang_ky_moi',
  `ngay_thuc_hien` date NOT NULL,
  `ngay_het_han_cu` date DEFAULT NULL,
  `ngay_het_han_moi` date NOT NULL,
  `so_tien` decimal(12,0) DEFAULT NULL,
  `ghi_chu` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_ls_ve_thang` (`id_ve_thang`),
  CONSTRAINT `fk_ls_ve_thang` FOREIGN KEY (`id_ve_thang`) REFERENCES `ve_thang` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `lich_su_ve_thang_ibfk_1` FOREIGN KEY (`id_ve_thang`) REFERENCES `ve_thang` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loai_xe`
--

DROP TABLE IF EXISTS `loai_xe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loai_xe` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ten` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mau_sac` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '#FFD700',
  `kieu_tinh_gia` enum('theo_luot','theo_gio','theo_ngay_dem') COLLATE utf8mb4_unicode_ci DEFAULT 'theo_luot',
  `gia_luot` decimal(12,0) DEFAULT '0',
  `gia_ngay` decimal(12,0) DEFAULT NULL,
  `gia_dem` decimal(12,0) DEFAULT NULL,
  `gia_ngay_dem` decimal(12,0) DEFAULT NULL,
  `gia_ve_thang` decimal(12,0) DEFAULT NULL,
  `cau_hinh_theo_gio` json DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL COMMENT 'NULL = ?ang dùng, non-NULL = ?ã ?n',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `phien_gui_xe`
--

DROP TABLE IF EXISTS `phien_gui_xe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phien_gui_xe` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ma_phien` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bien_so` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duoi_bien_so` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_loai_xe` int NOT NULL,
  `id_khach_hang` int DEFAULT NULL,
  `id_ve_thang` int DEFAULT NULL,
  `ma_qr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duong_dan_anh_bien_so` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duong_dan_anh_nguoi_lai` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gio_vao` datetime NOT NULL,
  `gio_ra` datetime DEFAULT NULL,
  `so_tien` decimal(12,0) DEFAULT NULL,
  `hinh_thuc_thanh_toan` enum('tien_mat','chuyen_khoan') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ghi_chu` text COLLATE utf8mb4_unicode_ci,
  `da_thu_tien` tinyint DEFAULT '0',
  `is_in_bai` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = ?ang trong bãi, 0 = ?ã ra',
  `cho_phep_lay_ho` tinyint(1) DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ma_phien` (`ma_phien`),
  UNIQUE KEY `uq_phien_ma_qr` (`ma_qr`),
  KEY `idx_bien_so` (`bien_so`),
  KEY `idx_ma_qr` (`ma_qr`),
  KEY `idx_gio_ra` (`gio_ra`),
  KEY `idx_duoi_bien_so` (`duoi_bien_so`),
  KEY `idx_phien_bien_so_active` (`bien_so`,`is_in_bai`),
  KEY `fk_phien_loai_xe` (`id_loai_xe`),
  KEY `fk_phien_khach_hang` (`id_khach_hang`),
  KEY `fk_phien_ve_thang` (`id_ve_thang`),
  CONSTRAINT `fk_phien_khach_hang` FOREIGN KEY (`id_khach_hang`) REFERENCES `khach_hang` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_phien_loai_xe` FOREIGN KEY (`id_loai_xe`) REFERENCES `loai_xe` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_phien_ve_thang` FOREIGN KEY (`id_ve_thang`) REFERENCES `ve_thang` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `phien_gui_xe_ibfk_1` FOREIGN KEY (`id_loai_xe`) REFERENCES `loai_xe` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `phien_gui_xe_ibfk_2` FOREIGN KEY (`id_khach_hang`) REFERENCES `khach_hang` (`id`) ON DELETE SET NULL,
  CONSTRAINT `phien_gui_xe_ibfk_3` FOREIGN KEY (`id_ve_thang`) REFERENCES `ve_thang` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ve_thang`
--

DROP TABLE IF EXISTS `ve_thang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ve_thang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `id_khach_hang` int NOT NULL,
  `bien_so` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duoi_bien_so` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_loai_xe` int NOT NULL,
  `ngay_dang_ky` date NOT NULL,
  `ngay_het_han` date NOT NULL,
  `so_tien` decimal(12,0) DEFAULT NULL,
  `ma_qr` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ghi_chu` text COLLATE utf8mb4_unicode_ci,
  `duong_dan_anh_bien_so` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duong_dan_anh_nguoi_dung` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ve_ma_qr` (`ma_qr`),
  KEY `idx_bien_so` (`bien_so`),
  KEY `idx_ngay_het_han` (`ngay_het_han`),
  KEY `idx_ma_qr` (`ma_qr`),
  KEY `idx_ve_duoi_bien_so` (`duoi_bien_so`),
  KEY `idx_ve_bien_so_han` (`bien_so`,`ngay_het_han`),
  KEY `fk_ve_khach_hang` (`id_khach_hang`),
  KEY `fk_ve_loai_xe` (`id_loai_xe`),
  CONSTRAINT `fk_ve_khach_hang` FOREIGN KEY (`id_khach_hang`) REFERENCES `khach_hang` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_ve_loai_xe` FOREIGN KEY (`id_loai_xe`) REFERENCES `loai_xe` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ve_thang_ibfk_1` FOREIGN KEY (`id_khach_hang`) REFERENCES `khach_hang` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ve_thang_ibfk_2` FOREIGN KEY (`id_loai_xe`) REFERENCES `loai_xe` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-15 11:40:26
