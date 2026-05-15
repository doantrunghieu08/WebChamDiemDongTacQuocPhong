-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Máy chủ: localhost:3306
-- Thời gian đã tạo: Th5 15, 2026 lúc 11:18 AM
-- Phiên bản máy phục vụ: 10.11.16-MariaDB-cll-lve
-- Phiên bản PHP: 8.4.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `kbvaamfl_DoAnTotNghiep`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `classes`
--

CREATE TABLE `classes` (
  `id` varchar(20) NOT NULL COMMENT 'Mã lớp (VD: QS2024A)',
  `class_name` varchar(100) NOT NULL COMMENT 'Tên lớp',
  `semester` varchar(20) DEFAULT NULL COMMENT 'Học kỳ (VD: HK1, HK2)',
  `academic_year` varchar(20) DEFAULT NULL COMMENT 'Năm học (VD: 2024-2025)',
  `room_number` varchar(20) DEFAULT NULL COMMENT 'Phòng / sân tập',
  `teacher_id` varchar(20) DEFAULT NULL COMMENT 'Giảng viên phụ trách (1 GV dạy nhiều lớp)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lớp học';

--
-- Đang đổ dữ liệu cho bảng `classes`
--

INSERT INTO `classes` (`id`, `class_name`, `semester`, `academic_year`, `room_number`, `teacher_id`, `created_at`, `updated_at`) VALUES
('ATTT_K14_A', 'Lớp An toàn thông tin - K14A', 'Kỳ 2', '2025-2026', 'P.201', NULL, '2026-05-13 07:52:38', '2026-05-13 07:52:38'),
('CNTT_K14_NET', 'Lớp ASP.NET Core - K14', 'Kỳ 2', '2025-2026', 'P.402', NULL, '2026-05-13 07:52:38', '2026-05-13 07:52:38'),
('CNTT_K15_JAVA', 'Lớp Java Spring Boot - K15', 'Kỳ 2', '2025-2026', 'P.403', 'GV_HT_10', '2026-05-13 07:52:38', '2026-05-13 07:52:38'),
('CNTT_K15_REACT', 'Lớp ReactJS & Frontend - K15', 'Kỳ 1', '2025-2026', 'P.202', NULL, '2026-05-13 07:52:38', '2026-05-13 07:52:38'),
('KHMT_K16_AI', 'Lớp Trí tuệ nhân tạo - K16', 'Kỳ 1', '2026-2027', 'P.601', NULL, '2026-05-13 07:52:38', '2026-05-13 07:52:38'),
('QS_D06', 'Đại đội 6 - Công sự & Ngụy trang', '1', '2025-2026', 'Bãi tập kỹ thuật', 'GV_HT_10', '2026-04-24 14:34:21', '2026-04-24 14:34:21'),
('QS_D07', 'Đại đội 7 - Thuốc nổ & Vật cản', '2', '2025-2026', 'Sân bãi quân sự H1', 'GV_HT_10', '2026-04-24 14:34:21', '2026-04-24 14:34:21');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `class_exams`
--

CREATE TABLE `class_exams` (
  `id` int(10) UNSIGNED NOT NULL,
  `class_id` varchar(20) NOT NULL COMMENT 'Mã lớp',
  `exam_type_id` int(10) UNSIGNED NOT NULL COMMENT 'Loại bài thi',
  `submission_deadline` datetime DEFAULT NULL COMMENT 'Hạn sinh viên nộp bài',
  `grading_deadline` datetime DEFAULT NULL COMMENT 'Hạn giảng viên chấm điểm',
  `is_deleted` tinyint(1) DEFAULT 0 COMMENT '0 = chua xoa, 1 = da xoa',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bài thi được giao cho lớp (kèm hạn nộp & hạn chấm)';

--
-- Đang đổ dữ liệu cho bảng `class_exams`
--

INSERT INTO `class_exams` (`id`, `class_id`, `exam_type_id`, `submission_deadline`, `grading_deadline`, `is_deleted`, `created_at`) VALUES
(4, 'QS_D07', 6, '2026-05-12 12:00:00', '2026-05-17 12:00:00', 0, '2026-04-28 08:31:40'),
(6, 'QS_D07', 7, '2026-05-20 12:00:00', '2026-05-25 12:00:00', 0, '2026-04-28 09:35:06'),
(7, 'QS_D06', 8, '2026-05-20 12:00:00', '2026-05-23 12:00:00', 0, '2026-04-28 13:50:44'),
(11, 'QS_D06', 7, '2026-05-11 12:00:00', '2026-05-19 12:00:00', 0, '2026-05-02 12:11:20'),
(12, 'QS_D06', 10, '2026-05-10 12:00:00', '2026-05-31 12:00:00', 0, '2026-05-08 12:52:50'),
(14, 'QS_D06', 6, '2026-05-20 12:00:00', '2026-05-22 12:00:00', 0, '2026-05-11 09:19:55'),
(15, 'CNTT_K15_JAVA', 10, '2026-05-15 12:00:00', '2026-05-20 12:00:00', 0, '2026-05-13 10:00:52');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `error_types`
--

CREATE TABLE `error_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `teacher_id` varchar(20) NOT NULL COMMENT 'Giảng viên tạo danh mục lỗi',
  `name` varchar(100) NOT NULL COMMENT 'Tên lỗi',
  `description` text DEFAULT NULL COMMENT 'Mô tả chi tiết',
  `severity` enum('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM' COMMENT 'Mức độ nghiêm trọng',
  `deduction` decimal(4,2) NOT NULL DEFAULT 0.00 COMMENT 'Điểm trừ',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = đang dùng, 0 = ẩn',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục loại lỗi do giảng viên định nghĩa';

--
-- Đang đổ dữ liệu cho bảng `error_types`
--

INSERT INTO `error_types` (`id`, `teacher_id`, `name`, `description`, `severity`, `deduction`, `is_active`, `created_at`) VALUES
(1, 'GV001', 'Tay không đánh', 'Tay không đánh theo nhịp bước chân', 'MEDIUM', 0.50, 1, '2026-04-20 02:43:40'),
(2, 'GV001', 'Đầu không thẳng', 'Đầu nghiêng hoặc cúi xuống khi đi', 'LOW', 0.25, 1, '2026-04-20 02:43:40'),
(3, 'GV001', 'Chân bước sai nhịp', 'Bước chân không đúng với hô nhịp', 'HIGH', 1.00, 1, '2026-04-20 02:43:40'),
(4, 'GV001', 'Lưng không thẳng', 'Lưng cong, không đứng thẳng người', 'MEDIUM', 0.50, 1, '2026-04-20 02:43:40'),
(5, 'GV001', 'Sai tư thế tay', 'Tay không đưa lên đúng góc quy định', 'LOW', 0.25, 1, '2026-04-20 02:43:40'),
(6, 'GV001', 'Không nhìn thẳng', 'Mắt không nhìn thẳng về phía trước', 'LOW', 0.25, 1, '2026-04-20 02:43:40'),
(7, 'GV001', 'Bước quá dài / ngắn', 'Bước chân quá dài hoặc quá ngắn', 'MEDIUM', 0.50, 1, '2026-04-20 02:43:40'),
(8, 'GV_HT_10', 'Sai lễ tiết tác phong', 'Quần áo chưa chỉnh tề, đầu tóc chưa đúng quy định hoặc chưa chào hỏi cấp trên.', 'LOW', 2.00, 1, '2026-04-29 08:09:11'),
(9, 'GV_HT_10', 'Sai động tác nghiêm, nghỉ', 'Học sinh đứng không đúng tư thế, mắt không nhìn thẳng, chân không mở đúng góc 45 độ.', 'HIGH', 10.00, 1, '2026-04-29 08:19:39'),
(10, 'GV_HT_10', 'Chân bước sai nhịp', 'Bước chân không đúng với hô nhịp', 'HIGH', 1.00, 1, '2026-04-29 08:41:02'),
(12, 'GV_HT_10', 'Không nhìn thẳng', 'Mắt không nhìn thẳng về phía trước', 'LOW', 0.50, 1, '2026-04-29 08:45:23'),
(13, 'GV_HT_10', 'rweet', 'ewerte', 'MEDIUM', 0.50, 0, '2026-05-02 01:14:51'),
(14, 'GV_HT_10', 'tery', 'wretew', 'MEDIUM', 1.00, 0, '2026-05-02 01:15:10'),
(15, 'GV_HT_10', 'Sai động tác ngắm bắn', 'Đầu ngắm cao hơn mép trên khe ngắm', 'MEDIUM', 1.00, 1, '2026-05-08 12:55:19'),
(16, 'GV_HT_10', 'Không khám súng/không kiểm tra buồng đạn', 'Tháo súng khi chưa tháo hộp tiếp đạn và chưa kiểm tra buồng đạn. Nếu còn đạn trong buồng, việc bóp cò hoặc tháo các bộ phận chuyển động có thể làm súng nổ ngoài ý muốn', 'HIGH', 2.00, 1, '2026-05-08 12:59:22');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `exam_types`
--

CREATE TABLE `exam_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Tên bài thi',
  `description` text DEFAULT NULL COMMENT 'Mô tả',
  `sample_video_url` varchar(500) DEFAULT NULL COMMENT 'URL video mẫu',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `teacher_id` varchar(20) DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT 1 COMMENT '1 = chưa xóa, 0 = đã xóa'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Danh mục loại bài thi';

--
-- Đang đổ dữ liệu cho bảng `exam_types`
--

INSERT INTO `exam_types` (`id`, `name`, `description`, `sample_video_url`, `created_at`, `teacher_id`, `is_deleted`) VALUES
(6, 'Bài tập đi đều', 'Đi đều theo nhạc', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777295883/MilitaryProject/Sample_Videos/bai_tap_mau_2.mp4', '2026-04-27 13:29:33', 'GV_HT_10', 0),
(7, 'Bắn súng', 'Bài tập bắn súng 100m với bia đứng im', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777297770/MilitaryProject/Sample_Videos/stock_footage_rear_medium_closeup_of_african_american_trainee_security_officer_in_black_uniform_learning_to_shoot.mp4', '2026-04-27 13:49:30', 'GV_HT_10', 0),
(8, 'Ném lựu đạn', 'Ném lựu đạn 100m', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777297770/MilitaryProject/Sample_Videos/stock_footage_rear_medium_closeup_of_african_american_trainee_security_officer_in_black_uniform_learning_to_shoot.mp4', '2026-04-28 13:49:11', 'GV004', 0),
(10, 'Lắp ráp súng trường AK47', 'Lắp ráp súng trường AK-47', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1778244690/MilitaryProject/Sample_Videos/download.mp4', '2026-05-08 12:52:07', 'GV_HT_10', 0);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `grading_errors`
--

CREATE TABLE `grading_errors` (
  `id` int(10) UNSIGNED NOT NULL,
  `session_id` int(10) UNSIGNED NOT NULL COMMENT 'Phiên chấm điểm',
  `error_type_id` int(10) UNSIGNED NOT NULL COMMENT 'Loại lỗi',
  `frame_time_seconds` decimal(10,3) DEFAULT NULL COMMENT 'Thời điểm trong video (giây)',
  `frame_image_url` varchar(500) DEFAULT NULL COMMENT 'URL ảnh chụp frame',
  `deduction_applied` decimal(4,2) NOT NULL DEFAULT 0.00 COMMENT 'Điểm trừ áp dụng tại frame',
  `notes` text DEFAULT NULL COMMENT 'Ghi chú của giảng viên',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lỗi ghi nhận theo từng frame trong video';

--
-- Đang đổ dữ liệu cho bảng `grading_errors`
--

INSERT INTO `grading_errors` (`id`, `session_id`, `error_type_id`, `frame_time_seconds`, `frame_image_url`, `deduction_applied`, `notes`, `created_at`) VALUES
(1, 17, 5, 7.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778035316/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_4_1778035314081.png', 0.25, 'Sinh viên thực hiện động tác bắn súng chưa đúng góc độ.', '2026-05-06 02:53:38'),
(2, 15, 10, 2.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778036254/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_10_1778036252563.png', 1.00, 'Bước chân không đúng với hô nhịp', '2026-05-06 02:57:52'),
(3, 15, 12, 2.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778036254/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_10_1778036252563.png', 0.50, 'Mắt không nhìn thẳng về phía trước', '2026-05-06 02:57:52'),
(4, 14, 10, 5.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778053623/MilitaryProject/Error_Frames/tr%E1%BA%A7n_thu_h%C3%A0_evidence_5_1778053620432.png', 1.00, 'Bước chân không đúng với hô nhịp', '2026-05-06 07:47:15'),
(5, 15, 12, 5.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778056871/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_10_1778056868823.png', 0.50, 'Mắt không nhìn thẳng về phía trước', '2026-05-06 08:41:15'),
(6, 18, 12, 2.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778057860/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_10_1778057857701.png', 0.50, 'Mắt không nhìn thẳng về phía trước', '2026-05-06 08:57:43'),
(7, 19, 12, 8.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778124137/MilitaryProject/Error_Frames/tr%E1%BA%A7n_thu_h%C3%A0_evidence_9_1778124132708.png', 0.50, 'Mắt không nhìn thẳng về phía trước', '2026-05-07 03:22:25'),
(8, 19, 10, 11.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778124162/MilitaryProject/Error_Frames/tr%E1%BA%A7n_thu_h%C3%A0_evidence_9_1778124157868.png', 1.00, 'Bước chân không đúng với hô nhịp', '2026-05-07 03:22:55'),
(9, 25, 10, 3.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778237045/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_4_1778237037391.png', 1.00, 'Bước chân không đúng với hô nhịp', '2026-05-08 10:44:09'),
(10, 26, 12, 4.000, NULL, 0.50, 'Mắt không nhìn thẳng về phía trước', '2026-05-08 10:46:54'),
(11, 28, 16, 2.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778245094/MilitaryProject/Error_Frames/%C4%91o%C3%A0n_v%C4%83n_c%C6%B0%C6%A1ng_evidence_16_1778245091689.png', 2.00, 'Tháo súng khi chưa tháo hộp tiếp đạn và chưa kiểm tra buồng đạn. Nếu còn đạn trong buồng, việc bóp cò hoặc tháo các bộ phận chuyển động có thể làm súng nổ ngoài ý muốn', '2026-05-08 12:59:29'),
(12, 29, 10, 6.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778314769/MilitaryProject/Error_Frames/l%C3%AA_v%C4%83n_nam_evidence_17_1778314764893.png', 1.00, 'Bước chân không đúng với hô nhịp', '2026-05-09 08:19:39'),
(13, 31, 16, 4.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778573968/MilitaryProject/Error_Frames/%C4%91o%C3%A0n_v%C4%83n_c%C6%B0%C6%A1ng_evidence_16_1778573957736.png', 2.00, 'Tháo súng khi chưa tháo hộp tiếp đạn và chưa kiểm tra buồng đạn. Nếu còn đạn trong buồng, việc bóp cò hoặc tháo các bộ phận chuyển động có thể làm súng nổ ngoài ý muốn', '2026-05-12 08:20:51'),
(14, 32, 10, 4.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778575044/MilitaryProject/Error_Frames/tr%E1%BA%A7n_thu_h%C3%A0_evidence_5_1778575024417.png', 1.00, 'Bước chân không đúng với hô nhịp', '2026-05-12 08:38:09'),
(15, 33, 12, 3.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778575248/MilitaryProject/Error_Frames/tr%E1%BA%A7n_thu_h%C3%A0_evidence_9_1778575210244.png', 0.50, 'Mắt không nhìn thẳng về phía trước', '2026-05-12 08:43:15'),
(16, 33, 15, 3.000, 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778575248/MilitaryProject/Error_Frames/tr%E1%BA%A7n_thu_h%C3%A0_evidence_9_1778575210244.png', 1.00, 'Đầu ngắm cao hơn mép trên khe ngắm', '2026-05-12 08:43:15');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `grading_sessions`
--

CREATE TABLE `grading_sessions` (
  `id` int(10) UNSIGNED NOT NULL,
  `submission_id` int(10) UNSIGNED NOT NULL COMMENT 'Bài nộp được chấm',
  `teacher_id` varchar(20) NOT NULL COMMENT 'Giảng viên thực hiện chấm',
  `grading_mode` enum('PRACTICE','OFFICIAL') NOT NULL COMMENT 'Chế độ chấm',
  `total_deduction` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng điểm trừ',
  `final_score` decimal(5,2) DEFAULT NULL COMMENT 'Điểm cuối = tổng - tổng điểm trừ',
  `status` enum('IN_PROGRESS','COMPLETED','FINALIZED') NOT NULL DEFAULT 'IN_PROGRESS',
  `graded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên chấm điểm';

--
-- Đang đổ dữ liệu cho bảng `grading_sessions`
--

INSERT INTO `grading_sessions` (`id`, `submission_id`, `teacher_id`, `grading_mode`, `total_deduction`, `final_score`, `status`, `graded_at`) VALUES
(14, 5, 'GV_HT_10', 'PRACTICE', 1.00, 9.00, 'COMPLETED', '2026-05-05 09:51:23'),
(15, 10, 'GV_HT_10', 'PRACTICE', 2.00, 8.00, 'COMPLETED', '2026-05-05 10:12:43'),
(16, 10, 'GV_HT_10', 'PRACTICE', 0.00, 10.00, 'COMPLETED', '2026-05-05 10:23:13'),
(17, 4, 'GV_HT_10', 'PRACTICE', 0.25, 9.75, 'COMPLETED', '2026-05-06 02:07:30'),
(18, 10, 'GV_HT_10', 'OFFICIAL', 0.50, 9.50, 'COMPLETED', '2026-05-06 08:57:24'),
(19, 9, 'GV_HT_10', 'OFFICIAL', 1.50, 8.50, 'COMPLETED', '2026-05-07 03:21:51'),
(22, 10, 'GV_HT_10', 'PRACTICE', 0.00, 10.00, 'COMPLETED', '2026-05-08 07:25:47'),
(23, 10, 'GV_HT_10', 'OFFICIAL', 0.00, 10.00, 'COMPLETED', '2026-05-08 07:26:49'),
(24, 15, 'GV_HT_10', 'OFFICIAL', 0.00, 10.00, 'COMPLETED', '2026-05-08 09:42:43'),
(25, 4, 'GV_HT_10', 'OFFICIAL', 1.00, 9.00, 'COMPLETED', '2026-05-08 10:43:51'),
(26, 15, 'GV_HT_10', 'OFFICIAL', 0.50, 9.50, 'COMPLETED', '2026-05-08 10:46:49'),
(27, 15, 'GV_HT_10', 'PRACTICE', 0.00, 10.00, 'COMPLETED', '2026-05-08 11:14:25'),
(28, 16, 'GV_HT_10', 'PRACTICE', 2.00, 8.00, 'COMPLETED', '2026-05-08 12:57:54'),
(29, 17, 'GV_HT_10', 'OFFICIAL', 1.00, 9.00, 'FINALIZED', '2026-05-09 08:17:35'),
(30, 17, 'GV_HT_10', 'PRACTICE', 0.00, 10.00, 'COMPLETED', '2026-05-11 08:23:37'),
(31, 16, 'GV_HT_10', 'OFFICIAL', 2.00, 8.00, 'COMPLETED', '2026-05-12 08:19:07'),
(32, 5, 'GV_HT_10', 'OFFICIAL', 1.00, 9.00, 'COMPLETED', '2026-05-12 08:37:06'),
(33, 9, 'GV_HT_10', 'PRACTICE', 1.50, 8.50, 'COMPLETED', '2026-05-12 08:38:17');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` varchar(20) NOT NULL COMMENT 'Người dùng sở hữu token',
  `token` varchar(512) NOT NULL COMMENT 'Refresh token',
  `expires_at` timestamp NOT NULL COMMENT 'Thời điểm hết hạn',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `revoked` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = đã thu hồi'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='JWT Refresh Token lưu phía server';

--
-- Đang đổ dữ liệu cho bảng `refresh_tokens`
--

INSERT INTO `refresh_tokens` (`id`, `user_id`, `token`, `expires_at`, `created_at`, `revoked`) VALUES
(626, 'AD005', '6f35e0b3-14fa-4b8c-9133-1b8e01698dce', '2026-05-21 01:31:53', '2026-05-14 08:31:55', 0),
(54859, 'SVG9ECSR', 'f1d5f588-6f37-4bdf-8d34-0c02151322ba', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54860, 'SVUWHP0J', 'a41c38a8-835c-4718-857f-33838e7e8736', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54861, 'SVYPDTQP', '3bc74e83-3cf9-4b89-884d-3cb0fbd3ce8c', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54862, 'SV4SD4KJ', 'fbb8c57a-04b9-49a5-9ef6-d7587d5c967c', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54863, 'SV5Q3TVG', 'ea17cb1e-7a14-464f-b4e0-55909f71dbb2', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54864, 'SVSSKVIY', '6fc4a660-35cb-4be7-ae00-cc8b200103fd', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54865, 'SV5P0S4F', 'd4e3c6e1-a8ed-4a06-ab92-ec766cb5df72', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54866, 'SVZWW9UD', '21586588-21b5-4c2e-af96-d3868b649f95', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54867, 'SVLSQGTH', '8dcb7372-4cb2-4f2e-b925-181902f404aa', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54868, 'SVN6QD93', '055c8284-bb3e-4851-9522-a9420c449932', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54869, 'SV26XY48', '458f9e58-30eb-4f0b-9aae-d70c426fbea6', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54870, 'SVE2TVN4', 'a3422c6d-d616-4eaa-b314-6b919267ed0a', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54871, 'SVR9FRX9', '2a7fa93a-b83b-4ae5-a783-c41fc0be7e53', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54872, 'SVF9G2L2', '99a74404-4cad-4fb7-8c73-94b3382add98', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54873, 'SVUSHMGW', '4beee558-8604-4ca4-bc39-b5f4806d7fa2', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54874, 'SVALG41U', 'c5fdf772-c4ce-4b30-b26e-c1ddfca05146', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54875, 'SVINEJUD', 'f8990064-f5f4-428f-9c95-d5c6fed990e9', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54876, 'SVE5UPHB', 'ff2b9808-306d-4f07-b467-d6ac406d8403', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54877, 'SVZB395B', 'dc714f57-0066-420a-a91a-dc5de9975fe0', '2026-05-21 02:26:35', '2026-05-14 09:26:38', 0),
(54878, 'SVV58BEK', '85965a68-2aca-46dd-a4d8-302086fd1739', '2026-05-21 02:26:36', '2026-05-14 09:26:38', 0),
(54879, 'SVGS5VIQ', '4cb79324-5e99-48af-9e12-61f3102d3529', '2026-05-21 02:26:36', '2026-05-14 09:26:38', 0),
(54880, 'SVJWL0WH', 'f164f11f-af64-481c-bea7-49fa5117b877', '2026-05-21 02:26:36', '2026-05-14 09:26:38', 0),
(54881, 'SVD48L9Y', '8a050488-9aa6-4a00-a26c-392ce78496a6', '2026-05-21 02:26:36', '2026-05-14 09:26:38', 0),
(54882, 'SVIAXOA2', '7ffacf0d-e747-4f40-be8e-0f49ef4cf298', '2026-05-21 02:26:36', '2026-05-14 09:26:39', 0),
(54883, 'SV9FAGD5', '81ded092-b66e-4235-b314-687e6cf97032', '2026-05-21 02:26:36', '2026-05-14 09:26:39', 0),
(54884, 'SVD1HOK1', '67a78e9f-7dfd-45d4-a521-d878610bb98d', '2026-05-21 02:26:36', '2026-05-14 09:26:39', 0),
(54885, 'SVQS9L4I', '96355c6d-e5d7-41c9-b3af-c891fea3d027', '2026-05-21 02:26:36', '2026-05-14 09:26:39', 0),
(54886, 'SV5ZX2HL', '7757d92d-a54c-4da3-a66f-ea774e885f1b', '2026-05-21 02:26:36', '2026-05-14 09:26:39', 0),
(54887, 'SVWAQ38J', 'e12e3b96-62e4-4c45-89b0-907adbc68d32', '2026-05-21 02:26:37', '2026-05-14 09:26:39', 0),
(54888, 'SVP8ELB3', '60a0c1ae-95d3-4b1d-a197-be1c6e93c081', '2026-05-21 02:26:37', '2026-05-14 09:26:39', 0),
(54908, 'AD006', '90a5576c-21f5-4cc3-b88d-fa5b75ec14b1', '2026-05-21 21:12:44', '2026-05-15 04:12:44', 0),
(54910, 'GV_HT_10', '6d6ea243-bab9-417c-80e3-cc8a9c4ed3be', '2026-05-21 21:14:08', '2026-05-15 04:14:08', 0);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `student_submissions`
--

CREATE TABLE `student_submissions` (
  `id` int(10) UNSIGNED NOT NULL,
  `class_exam_id` int(10) UNSIGNED NOT NULL COMMENT 'Bài thi lớp',
  `student_id` varchar(20) NOT NULL COMMENT 'Mã sinh viên',
  `video_url_1` varchar(500) DEFAULT NULL COMMENT 'URL video đã nộp',
  `file_size_bytes_1` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Kích thước file (bytes)',
  `video_url_2` varchar(500) DEFAULT NULL,
  `file_size_bytes_2` bigint(20) UNSIGNED DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL COMMENT 'Thời điểm nộp bài',
  `status` enum('DRAFT','SUBMITTED') NOT NULL DEFAULT 'DRAFT' COMMENT 'Trạng thái nộp bài',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bài nộp video của sinh viên';

--
-- Đang đổ dữ liệu cho bảng `student_submissions`
--

INSERT INTO `student_submissions` (`id`, `class_exam_id`, `student_id`, `video_url_1`, `file_size_bytes_1`, `video_url_2`, `file_size_bytes_2`, `submitted_at`, `status`, `created_at`, `updated_at`) VALUES
(4, 7, '233730', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777713779/MilitaryProject/Student_Submissions/l%C3%AA_v%C4%83n_nam_n%C3%A9m_l%E1%BB%B1u_%C4%91%E1%BA%A1n_1777713760374.mp4', 763841, 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777713796/MilitaryProject/Student_Submissions/l%C3%AA_v%C4%83n_nam_n%C3%A9m_l%E1%BB%B1u_%C4%91%E1%BA%A1n_1777713775360.mp4', 2413568, '2026-05-02 09:43:40', 'SUBMITTED', '2026-05-02 09:43:47', '2026-05-02 09:43:47'),
(5, 4, '233731', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777713351/MilitaryProject/Student_Submissions/tr%E1%BA%A7n_thu_h%C3%A0_b%C3%A0i_t%E1%BA%ADp_%C4%91i_%C4%91%E1%BB%81u_1777713339955.mp4', 2413568, NULL, 0, '2026-05-02 09:47:46', 'SUBMITTED', '2026-05-02 09:47:53', '2026-05-02 09:47:53'),
(9, 6, '233731', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777715312/MilitaryProject/Student_Submissions/tr%E1%BA%A7n_thu_h%C3%A0_b%E1%BA%AFn_s%C3%BAng_1777715301317.mp4', 763841, NULL, 0, '2026-05-02 09:53:50', 'SUBMITTED', '2026-05-02 09:53:57', '2026-05-02 09:53:57'),
(10, 11, '233730', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1777723990/MilitaryProject/Student_Submissions/l%C3%AA_v%C4%83n_nam_b%E1%BA%AFn_s%C3%BAng_1777723988460.mp4', 763841, NULL, 0, '2026-05-04 02:00:18', 'SUBMITTED', '2026-05-02 12:13:11', '2026-05-04 02:00:20'),
(15, 11, 'SV006', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1778232779/MilitaryProject/Student_Submissions/%C4%91o%C3%A0n_v%C4%83n_c%C6%B0%C6%A1ng_b%E1%BA%AFn_s%C3%BAng_1778232766669.mp4', 763841, NULL, 0, '2026-05-08 09:33:01', 'SUBMITTED', '2026-05-08 09:32:59', '2026-05-08 09:33:04'),
(16, 12, 'SV006', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1778245050/MilitaryProject/Student_Submissions/%C4%91o%C3%A0n_v%C4%83n_c%C6%B0%C6%A1ng_l%E1%BA%AFp_r%C3%A1p_s%C3%BAng_tr%C6%B0%E1%BB%9Dng_ak47_1778245033678.mp4', 11688049, NULL, 0, '2026-05-08 12:57:36', 'SUBMITTED', '2026-05-08 12:57:30', '2026-05-08 12:57:35'),
(17, 12, '233730', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1778314596/MilitaryProject/Student_Submissions/l%C3%AA_v%C4%83n_nam_l%E1%BA%AFp_r%C3%A1p_s%C3%BAng_tr%C6%B0%E1%BB%9Dng_ak47_1778314588892.mp4', 11688049, NULL, 0, '2026-05-09 08:16:50', 'SUBMITTED', '2026-05-09 08:16:36', '2026-05-09 08:16:50'),
(20, 14, 'SV006', 'https://res.cloudinary.com/dzmepj5y8/video/upload/v1778753854/MilitaryProject/Student_Submissions/%C4%91o%C3%A0n_v%C4%83n_c%C6%B0%C6%A1ng_b%C3%A0i_t%E1%BA%ADp_%C4%91i_%C4%91%E1%BB%81u_1778753838472.mp4', 2413568, NULL, 0, '2026-05-14 10:17:43', 'SUBMITTED', '2026-05-14 10:17:34', '2026-05-14 10:17:46');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `users`
--

CREATE TABLE `users` (
  `id` varchar(20) NOT NULL COMMENT 'Mã người dùng (GV001, SV001, AD001)',
  `full_name` varchar(100) NOT NULL COMMENT 'Họ và tên',
  `username` varchar(50) NOT NULL COMMENT 'Tên đăng nhập',
  `password_hash` varchar(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa (bcrypt)',
  `role` enum('ADMIN','TEACHER','STUDENT') NOT NULL COMMENT 'Vai trò',
  `class_id` varchar(20) DEFAULT NULL COMMENT 'Mã lớp – chỉ dành cho STUDENT, NULL với TEACHER/ADMIN',
  `birthday` date DEFAULT NULL COMMENT 'Ngày sinh',
  `email` varchar(100) DEFAULT NULL COMMENT 'Email',
  `gender` enum('MALE','FEMALE','OTHER') DEFAULT NULL COMMENT 'Giới tính',
  `avatar_image` varchar(1000) DEFAULT NULL,
  `status` enum('ACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'Trạng thái tài khoản',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_require_password_change` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tài khoản người dùng (Admin / Giảng viên / Sinh viên)';

--
-- Đang đổ dữ liệu cho bảng `users`
--

INSERT INTO `users` (`id`, `full_name`, `username`, `password_hash`, `role`, `class_id`, `birthday`, `email`, `gender`, `avatar_image`, `status`, `created_at`, `updated_at`, `is_require_password_change`) VALUES
('233729', 'Nguyễn Thị Mai', 'mainh_gv', '$2a$10$rTrTpagHZkJElrbCOQrZk.HXRejeAEqy3g77k2LT8u9pgI1GUPNnq', 'TEACHER', NULL, '1980-08-15', 'mai.nt@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-04-24 13:17:57', '2026-04-24 14:40:25', 0),
('233730', 'Lê Văn Nam', 'namlv', '$2a$10$msXHMxav4YCpcorr0fQ90eK6WsqCQA/N.LrdHFVPsxGBBZveCPtPm', 'STUDENT', 'QS_D06', '2004-08-16', 'nam.233726@student.hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-24 13:17:57', '2026-04-24 14:40:25', 0),
('233731', 'Trần Thu Hà', 'thuha', '$2a$10$gSFGfVrl5XxutjbGfVXNKOTL4pj2bKDtEa02dWEWacFjvNOJ4quca', 'STUDENT', 'QS_D07', '2005-01-17', 'ha.233727@student.hactech.edu.vn', 'FEMALE', 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778656647/MilitaryProject/Avatar_Image/avatar_233731.jpg', 'ACTIVE', '2026-04-24 13:17:57', '2026-04-24 14:40:25', 0),
('233732', 'Phạm Quốc Anh', 'anhpq_233728', '$2a$10$P5Y0Uh6bmkHJCg81./3Xde0hDOnP6hcykcIPAOIJRkjvwJTu0mRfK', 'STUDENT', 'QS_D06', '2005-08-18', 'anh.233728@student.hactech.edu.vn', 'MALE', NULL, 'LOCKED', '2026-04-24 13:17:57', '2026-04-24 14:40:25', 0),
('233801', 'Lý Gia Kiệt', 'kietlg', '$2a$10$UCzSprvM8S0mryBHdmXANenCD9rtSERplWv2ihputP/tChuDsarWe', 'STUDENT', NULL, '2005-04-12', 'kiet.233801@student.hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-24 13:32:12', '2026-04-24 14:40:25', 0),
('233802', 'Võ Minh Anh', 'anhvm', '$2a$10$dybH0jLDEHGkiORduigXS.pZD11jcATtHIU2rsQy44iw5RoNl4qbO', 'STUDENT', NULL, '2005-09-25', 'anh.233802@student.hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-04-24 13:32:12', '2026-04-24 14:40:25', 0),
('233803', 'Ngô Bảo Châu', 'chaunb_233803', '$2a$10$cemoaEqdpogbBuxDo4NsMONuKExVv6VU0kuogg01UkgfLF5K8jiNK', 'STUDENT', NULL, '2005-07-14', 'chau.233803@student.hactech.edu.vn', 'FEMALE', NULL, 'LOCKED', '2026-04-24 13:32:12', '2026-04-24 14:40:25', 0),
('233901', 'Sơn Tùng M-TP', 'tungmtp', '$2a$10$YNr3YKDK8oMm.84uT5EtUeKPcBVb7mNc9rupeJCgpS3.tT01GpNLa', 'STUDENT', NULL, '1994-07-05', 'tung.233901@student.hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-24 13:55:01', '2026-04-24 14:40:25', 0),
('233902', 'Phương Ly', 'lyp_233902', '$2a$10$T.1BqgKZBjGh676ylXIuCeh4g0nosIKdrh/8wEY8gBQ/K6fPYp5iu', 'STUDENT', NULL, '1990-10-28', 'ly.233902@student.hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-04-24 13:55:01', '2026-04-24 14:40:25', 0),
('233903', 'HIEUTHUHAI', 'hieu22_233903', '$2a$10$4ow3i9uLzal6iHypEsdBseZNv6UJffy6SqfRTcYrqpS2X8/RMWUgG', 'STUDENT', NULL, '1999-09-28', 'hieu.233903@student.hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-24 13:55:01', '2026-04-24 14:40:25', 0),
('AD001', 'Nguyễn Văn Long', 'admin', '$2a$10$tWQBqw2iOTxmwgUNCcvsJeiwhWZp.jG7kCtFbysvbUjijth/sk.Wq', 'ADMIN', NULL, '1980-01-01', 'longnv@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-20 02:43:40', '2026-04-24 14:40:25', 0),
('AD002', 'Đoàn Trung Hiếu', 'hieudt08', '$2a$10$ELDauLa3HpTGhbCwk7cG6uIPVmsqIEfGi1aUTLa85UDvR6JFwtVhW', 'ADMIN', NULL, '2005-03-11', 'hieudt@hactech.edu.vn', 'MALE', NULL, 'LOCKED', '2026-04-20 04:34:34', '2026-04-21 04:34:14', 0),
('AD005', 'Đoàn Trung Hiếu', 'trunghieudoan', '$2a$10$4HCkoliq.DJBp6va0HJHuOeEFjZ5SgDnrA42So8LECkCvCRuLgODe', 'ADMIN', NULL, '2005-03-11', 'trunghieudoan088@gmail.com', 'MALE', NULL, 'ACTIVE', '2026-04-20 06:52:53', '2026-04-20 06:52:53', 0),
('AD006', 'Đoàn Trung Hiếu', 'trunghieudoan088', '$2a$10$9E5td7LnTs4d9TtAbUfcI.Wy8wd1.l8LPxAwB7vyL2mmrtrmcpgc6', 'ADMIN', NULL, '2005-03-11', 'hieu.233725@student.hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-24 03:37:38', '2026-04-24 03:37:38', 0),
('GV_HT_05', 'Trương Vĩnh Ký', 'kytv_teacher', '$2a$10$ZHrjf9B7Z7Oz0pBXTFOa6euqwgO8ffi5ceWOk/F1arPLqxxPRquze', 'TEACHER', NULL, '1982-12-05', 'ky.tv@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-24 13:32:12', '2026-04-24 14:40:25', 0),
('GV_HT_10', 'Phùng Thanh Độ', 'domixi', '$2a$10$wN7LGwswCSP44imuUcEbEezh1Op42IN1SzQ5vDWeexOPRm9zz4vg.', 'TEACHER', NULL, '1989-09-12', 'do.phung@hactech.edu.vn', 'MALE', 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778595613/MilitaryProject/Avatar_Image/avatar_gv_ht_10.png', 'ACTIVE', '2026-04-24 13:55:01', '2026-04-24 14:40:25', 0),
('GV001', 'Trần Thị Hương', 'huongth', '$2a$10$2XZoYjoxKnfoXXlHJ9vg0e2ZVRztw9lUn60F9mCQ5dXXYzcHv5bE.', 'TEACHER', NULL, '1985-03-15', 'huong.tran@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-04-20 02:43:40', '2026-04-21 04:34:14', 0),
('GV002', 'Lê Văn Minh', 'gv002', '$2b$12$demoHashTeach2Placeholder00', 'TEACHER', NULL, '1987-07-22', 'minh.le@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-20 02:43:40', '2026-04-21 04:34:14', 0),
('GV003', 'Nguyễn Thành Trung', 'trungnt', '$2a$10$jMkweScU.mFYckUeC765Qel5Ntobt65RiWCMyo5hDIMmP.qM/i9su', 'TEACHER', NULL, '1999-01-01', 'trungnt@gmail.com', 'MALE', NULL, 'ACTIVE', '2026-04-21 04:24:20', '2026-04-21 04:34:14', 0),
('GV004', 'Nguyễn Ngọc Anh', 'ngocnn', '$2a$10$2xPSSkvPbTeuDsv97AE5uOoUrsQ55yFuUYCaRTRDHTXTcPlJqo112', 'TEACHER', NULL, '2000-02-11', 'ngocnn@gmail.com', 'FEMALE', NULL, 'ACTIVE', '2026-04-21 04:26:58', '2026-04-21 04:34:14', 0),
('GV088', 'Lê Thanh Tùng', 'tunglt88', '$2a$10$zbLYHfBVcNDuRRKanL/HZux8tDc9unCjVLeA6OdfrpEDZKCgpWMk2', 'TEACHER', NULL, '1988-04-12', 'tunglt@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-21 02:21:11', '2026-04-21 04:34:14', 0),
('GV089', 'Nguyễn Hải Anh', 'anhhn', '$2a$10$cnPblvcYQS2mOx2f6xEyYub8JXlUz06K41pmsg481ZIlyxzlHX5.G', 'TEACHER', NULL, '2001-11-02', 'nguyenhaianh@gmail.com', 'FEMALE', NULL, 'ACTIVE', '2026-04-21 02:35:13', '2026-04-21 04:34:14', 0),
('GV2026002', 'Lê Văn Tám', 'tamlv26', '$2a$10$A7JcHyCCHLJg/7vQedSPa.N4H3aIIsSG7OCg/gt46w55awoal29Bq', 'TEACHER', NULL, '2001-05-19', 'tamlv.gv@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-21 02:13:01', '2026-04-21 04:34:14', 0),
('SV0001', 'Lê Thanh Tùng', 'tunglt90', '$2a$10$67pNNbztdkpYZpxB12ELW.4kVp7W8PcgDXrElqiQjTsp/PsAq5SCy', 'STUDENT', NULL, '2005-04-12', 'tung@hactech.edu.vn', 'MALE', NULL, 'LOCKED', '2026-04-22 09:36:33', '2026-04-22 09:36:33', 0),
('SV001', 'Phạm Quốc Bảo', 'sv001', '$2b$12$demoHashStud1Placeholder000', 'STUDENT', NULL, '2004-05-10', 'bao.pham@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-20 02:43:40', '2026-04-24 09:28:43', 0),
('SV002', 'Nguyễn Thị Lan', 'sv002', '$2b$12$demoHashStud2Placeholder000', 'STUDENT', NULL, '2004-09-20', 'lan.nguyen@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-04-20 02:43:40', '2026-04-24 09:28:43', 0),
('SV003', 'Vũ Đình Tùng', 'sv003', '$2b$12$demoHashStud3Placeholder000', 'STUDENT', NULL, '2003-12-01', 'tung.vu@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-04-20 02:43:40', '2026-04-21 04:34:14', 0),
('SV004', 'Lý Thần An', 'thanan', '$2a$10$NSbbg0v9x7dzRxlRyCPBsO8UcFXwRUeOaVnG996sSVHPLZmKvHg3C', 'STUDENT', NULL, '2006-11-03', 'thanan@gmail.com', 'MALE', NULL, 'ACTIVE', '2026-04-23 03:54:17', '2026-04-23 03:54:17', 0),
('SV005', 'Lý Trường Lạc', 'truonglac', '$2a$10$CqCg40hHvkFGaTpnR62JN.BUpP/FwhZX9nauPKLgIxh4rTMvjiYBS', 'STUDENT', NULL, '2005-03-11', 'truonglac@gmail.com', 'FEMALE', NULL, 'ACTIVE', '2026-04-23 03:59:39', '2026-04-23 03:59:39', 0),
('SV006', 'Đoàn Văn Cương', 'cuongdv', '$2a$10$XByVS1SRxhCCPLl006OssebbE2y1CD.L9JfQ5Au7ccEJHN5gQ8SSK', 'STUDENT', 'QS_D06', '2005-03-11', 'cuongdv@gmail.com', 'MALE', 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778593072/MilitaryProject/Avatar_Image/avatar_sv006.jpg', 'ACTIVE', '2026-04-24 08:16:47', '2026-04-24 09:44:01', 0),
('SV007', 'Nguyễn Quang Huy', 'huynq', '$2a$10$erb2DyESeZRA7KtVtPyzlehDpNuJp.PRorgYPy8HzSUby0Pn7RhOe', 'STUDENT', 'QS_D06', '2005-11-05', 'quanghuy@gmail.com', 'MALE', 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778597790/MilitaryProject/Avatar_Image/avatar_sv007.jpg', 'ACTIVE', '2026-05-12 14:59:14', '2026-05-12 14:59:14', 0),
('SV26XY48', 'Hoàng Quỳnh Hương', 'huonghq', '$2a$10$TMu95jpLZUkkcQoz7E77lOfMrpvXVfHJoA1u2iCoIqBDfzYmSEmPq', 'STUDENT', 'CNTT_K15_JAVA', '2005-08-27', 'huonghq@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SV4SD4KJ', 'Phạm Minh Hùng', 'hungpm', '$2a$10$cXpe8VEd4GTE8fPVNwrovOP79w21W3/xhagqIzu9vL7QhsPFtXNBa', 'STUDENT', 'CNTT_K15_JAVA', '2004-09-16', 'hungpm@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SV5P0S4F', 'Hoàng Minh Việt', 'viethm', '$2a$10$IMaLWpUcRNBwcPgTYiwf0uIOdQUbdW0TyhJ9XcbgByJZ8P0qS5lMK', 'STUDENT', 'CNTT_K15_JAVA', '2004-01-23', 'viethm@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SV5Q3TVG', 'Hoàng Huyền Vy', 'vyhh', '$2a$10$OatS9jvHBW0eTgXzsmLeuug8tm21rebEtnCJKRZ2y3RCHKBkfloG6', 'STUDENT', 'CNTT_K15_JAVA', '2004-12-16', 'vyhh@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SV5ZX2HL', 'Bùi Văn Huy', 'huybv', '$2a$10$gQRSQgcLob4nsDF9Br5qvuzmZIMeL/WvF2MLNdvjGfgmGNG5npEyO', 'STUDENT', 'CNTT_K15_JAVA', '2003-12-13', 'huybv@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SV9FAGD5', 'Vũ Thị Dung', 'dungvt', '$2a$10$nDgyqA30HuJHcIVF53NJde8.Nk4oQt.mQl6YDM/yJuyh3YD7E.lKq', 'STUDENT', 'CNTT_K15_JAVA', '2005-06-28', 'dungvt@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVALG41U', 'Đặng Quang Kiên', 'kiendq', '$2a$10$ZjQ1bE99zUcuTb8p6E.kxud6MIojdiy.yLSgTxMNn2elcFKPz98RO', 'STUDENT', 'CNTT_K15_JAVA', '2003-02-13', 'kiendq@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVD1HOK1', 'Phạm Quỳnh Hà', 'hapq', '$2a$10$Qd9MDLbxnZS5j29NYBs8Y.TLATcPXNZ0bsaLzDB99eIMQgCXngX9u', 'STUDENT', 'CNTT_K15_JAVA', '2005-09-12', 'hapq@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVD48L9Y', 'Trần Ngọc Trang', 'trangtn', '$2a$10$81AsVx8dSgFAVgRlXRDfvuks8E8W9kc5omSAl3FUfkdenLY/TwQyu', 'STUDENT', 'CNTT_K15_JAVA', '2006-05-27', 'trangtn@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVE2TVN4', 'Đỗ Quang Việt', 'vietdq', '$2a$10$vJYsGp1DAvgP8X0cREwgduOdkdJCNWa9XcdzVj/t/6JzAkwN3lBjG', 'STUDENT', 'CNTT_K15_JAVA', '2003-10-20', 'vietdq@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVE5UPHB', 'Bùi Diệu Nhi', 'nhibd', '$2a$10$wIFoDbclsr73V9DATgP2eeE6.FvmVBVpR8DUFSb80ExvVI3VfXZHS', 'STUDENT', 'CNTT_K15_JAVA', '2003-01-25', 'nhibd@hactech.edu.vn', 'FEMALE', 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778665644/MilitaryProject/Avatar_Image/avatar_sve5uphb.png', 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 09:54:33', 0),
('SVF9G2L2', 'Phạm Đình Sơn', 'sonpd', '$2a$10$srHnZvzSO/t/rfaidpJGWuznOvqRcAi9ITHo1iSDBz3Fa0fuJJVLW', 'STUDENT', 'CNTT_K15_JAVA', '2005-02-05', 'sonpd@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVG9ECSR', 'Đặng Quỳnh Hoa', 'hoadq', '$2a$10$nTTNW3fbgM6tULxBUipbzuAzk.x1V29MChuw.V5o2gfXyBwt9fzD2', 'STUDENT', 'CNTT_K15_JAVA', '2003-11-19', 'hoadq@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVGS5VIQ', 'Phan Thu Mai', 'maipt', '$2a$10$awq1c3wReCmywBqW7kibmuEZ1JqPntrXm93wE8hlhCfRvej04.W8.', 'STUDENT', 'CNTT_K15_JAVA', '2004-02-02', 'maipt@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVIAXOA2', 'Hoàng Minh Yến', 'yenhm', '$2a$10$n43Kll29lzU/E96X5w8kfuTb3BExrB4Sjt9DEzwt8wv17H9Qi0k5y', 'STUDENT', 'CNTT_K15_JAVA', '2004-01-20', 'yenhm@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVINEJUD', 'Vũ Văn Anh', 'anhvv', '$2a$10$7tbT3PwKidwIlcU6h8BxQeOsJvJXQlViayXl0CGzk19s7iE6Hkd3W', 'STUDENT', 'CNTT_K15_JAVA', '2005-07-16', 'anhvv@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVJWL0WH', 'Phạm Thị Vy', 'vypt', '$2a$10$kHXrU39oiqiIB83nh3DCSu1KuLIfyCmyMgpP2pc6SUs/iH5w.vQMO', 'STUDENT', 'CNTT_K15_JAVA', '2003-02-20', 'vypt@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVLSQGTH', 'Hoàng Diệu Hà', 'hahd', '$2a$10$SkGt7KoQiHVRpcVyS4n9gejF0OZiJNSrG0G/jfxJkn7dD/Ya/gm5K', 'STUDENT', 'CNTT_K15_JAVA', '2004-11-06', 'hahd@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVN6QD93', 'Đặng Ngọc Anh', 'anhdn', '$2a$10$su1OJ1G0a3vvWvBFoO6CzeaCJz5s98OrRoQzQCnkMz2Quy0ywBMwK', 'STUDENT', 'CNTT_K15_JAVA', '2005-03-13', 'anhdn@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVP8ELB3', 'Lê Minh Tâm', 'tamlm', '$2a$10$TBa3v1dJWrFdnUPZ.lJ7w.NORjTYM4RAfWngkLFjCq3fED3irwwn6', 'STUDENT', 'CNTT_K15_JAVA', '2005-02-05', 'tamlm@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVQS9L4I', 'Lê Huyền Mai', 'mailh', '$2a$10$WH2XQXIluLH/gaHWl8b24e1aEWvMlzQuEWV7uNBKJ4lobqW0oydRK', 'STUDENT', 'CNTT_K15_JAVA', '2004-08-23', 'mailh@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVR9FRX9', 'Nguyễn Minh Cường', 'cuongnm', '$2a$10$IS59InHpIHgbjdkaO3k0reVf3cacRJWA/93Z9x6np.y0ZY0D8/UY2', 'STUDENT', 'CNTT_K15_JAVA', '2006-09-27', 'cuongnm@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVSSKVIY', 'Đặng Hữu Tâm', 'tamdh', '$2a$10$zdGZNiGcTy1WvwF8Y1kdheg1XESVcSrOVoPUms9x8qHWlUOgo3X9C', 'STUDENT', 'CNTT_K15_JAVA', '2004-09-04', 'tamdh@hactech.edu.vn', 'MALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVUSHMGW', 'Nguyễn Thu Yến', 'yennt', '$2a$10$J7q7PUQ2lvJqPilgjzqOjOK1CsMUecWyYGd..qe4Ec2zq3XunUD2C', 'STUDENT', 'CNTT_K15_JAVA', '2006-08-01', 'yennt@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVUWHP0J', 'Đỗ Diệu Dung', 'dungdd', '$2a$10$Tmb8U8P2qGNfs0y2a2uiYePuNRHyCHhX2cKrAmhBaa5yv1WXLqWqu', 'STUDENT', 'CNTT_K15_JAVA', '2004-04-12', 'dungdd@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVV58BEK', 'Trần Minh Linh', 'linhtm', '$2a$10$Kz5B5As1RQjLRp.rsXS5Pudrlubn0zTJDZhWuEy.rAwms6hE.pPkC', 'STUDENT', 'CNTT_K15_JAVA', '2006-01-16', 'linhtm@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVWAQ38J', 'Vũ Huyền Trang', 'trangvh', '$2a$10$eBkU64q3B3V9a7Ejk93v9OF4w8bGxu2gBC/8f4ocSa7E6dk3n0cIC', 'STUDENT', 'CNTT_K15_JAVA', '2005-08-01', 'trangvh@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVYPDTQP', 'Hoàng Diệu Trang', 'tranghd', '$2a$10$nEoLp0USzSy0fSrSVbojG.ku6Uslrim7qa/Udi80w1MQ5rV3iRuXa', 'STUDENT', 'CNTT_K15_JAVA', '2005-08-06', 'tranghd@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVZB395B', 'Bùi Thu Nhi', 'nhibt', '$2a$10$RzXejkb7/aR9tHBo4B1.n.i6h24kTDxWgPUX7HXp5rOHi2ViwdPt2', 'STUDENT', 'CNTT_K15_JAVA', '2005-12-06', 'nhibt@hactech.edu.vn', 'FEMALE', 'https://res.cloudinary.com/dzmepj5y8/image/upload/v1778666371/MilitaryProject/Avatar_Image/avatar_svzb395b.png', 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0),
('SVZWW9UD', 'Nguyễn Huyền Dung', 'dungnh', '$2a$10$aVko8ftK5DNLzlL/cg1VbuIMHYqWFCSKKS1rmM8wfMgBTH4z16qcG', 'STUDENT', 'CNTT_K15_JAVA', '2005-05-07', 'dungnh@hactech.edu.vn', 'FEMALE', NULL, 'ACTIVE', '2026-05-13 08:33:26', '2026-05-13 08:33:26', 0);

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `classes`
--
ALTER TABLE `classes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_classes_teacher` (`teacher_id`);

--
-- Chỉ mục cho bảng `class_exams`
--
ALTER TABLE `class_exams`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_class_exam` (`class_id`,`exam_type_id`),
  ADD KEY `fk_ce_exam_type` (`exam_type_id`),
  ADD KEY `idx_class_exams_deadline` (`grading_deadline`);

--
-- Chỉ mục cho bảng `error_types`
--
ALTER TABLE `error_types`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_error_types_teacher` (`teacher_id`);

--
-- Chỉ mục cho bảng `exam_types`
--
ALTER TABLE `exam_types`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_teacher_exam_idx` (`teacher_id`);

--
-- Chỉ mục cho bảng `grading_errors`
--
ALTER TABLE `grading_errors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ge_error_type` (`error_type_id`),
  ADD KEY `idx_grading_errors_session` (`session_id`);

--
-- Chỉ mục cho bảng `grading_sessions`
--
ALTER TABLE `grading_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_gs_submission` (`submission_id`),
  ADD KEY `fk_gs_teacher` (`teacher_id`),
  ADD KEY `idx_sessions_mode_status` (`grading_mode`,`status`);

--
-- Chỉ mục cho bảng `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_token` (`token`),
  ADD KEY `idx_refresh_tokens_user` (`user_id`,`revoked`);

--
-- Chỉ mục cho bảng `student_submissions`
--
ALTER TABLE `student_submissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_submission` (`class_exam_id`,`student_id`),
  ADD KEY `idx_submissions_student` (`student_id`),
  ADD KEY `idx_submissions_status` (`status`);

--
-- Chỉ mục cho bảng `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_username` (`username`),
  ADD KEY `idx_users_class` (`class_id`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `class_exams`
--
ALTER TABLE `class_exams`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT cho bảng `error_types`
--
ALTER TABLE `error_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT cho bảng `exam_types`
--
ALTER TABLE `exam_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT cho bảng `grading_errors`
--
ALTER TABLE `grading_errors`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT cho bảng `grading_sessions`
--
ALTER TABLE `grading_sessions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT cho bảng `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54911;

--
-- AUTO_INCREMENT cho bảng `student_submissions`
--
ALTER TABLE `student_submissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- Ràng buộc đối với các bảng kết xuất
--

--
-- Ràng buộc cho bảng `classes`
--
ALTER TABLE `classes`
  ADD CONSTRAINT `fk_classes_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `class_exams`
--
ALTER TABLE `class_exams`
  ADD CONSTRAINT `fk_ce_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ce_exam_type` FOREIGN KEY (`exam_type_id`) REFERENCES `exam_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `error_types`
--
ALTER TABLE `error_types`
  ADD CONSTRAINT `fk_et_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `exam_types`
--
ALTER TABLE `exam_types`
  ADD CONSTRAINT `fk_teacher_exam` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

--
-- Ràng buộc cho bảng `grading_errors`
--
ALTER TABLE `grading_errors`
  ADD CONSTRAINT `fk_ge_error_type` FOREIGN KEY (`error_type_id`) REFERENCES `error_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_ge_session` FOREIGN KEY (`session_id`) REFERENCES `grading_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `grading_sessions`
--
ALTER TABLE `grading_sessions`
  ADD CONSTRAINT `fk_gs_submission` FOREIGN KEY (`submission_id`) REFERENCES `student_submissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_gs_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `fk_rt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `student_submissions`
--
ALTER TABLE `student_submissions`
  ADD CONSTRAINT `fk_sub_class_exam` FOREIGN KEY (`class_exam_id`) REFERENCES `class_exams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sub_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Ràng buộc cho bảng `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
