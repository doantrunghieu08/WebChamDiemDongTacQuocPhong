// ============================================
//  Exams & Scores API Service — HACTECH Grading System
// ============================================

const ExamsService = {
    /**
     * Lấy danh sách loại bài thi (Đi đều, Bắn súng, Võ thuật, ...)
     * @returns {Promise<Array>} Mảng exam type objects
     */
    async getExamTypes() {
        return ApiClient.get(API_CONFIG.ENDPOINTS.EXAM_TYPES);
    },

    /**
     * Lấy danh sách bài thi đã gán cho sinh viên
     * @param {string} classId
     * @param {string} studentCode
     * @returns {Promise<Array>} Mảng exam IDs
     */
    async getStudentExams(classId, studentCode) {
        return ApiClient.get(API_CONFIG.ENDPOINTS.STUDENT_EXAMS(classId, studentCode));
    },

    /**
     * Gán bài thi cho sinh viên
     * @param {string} classId
     * @param {string} studentCode
     * @param {Array<string>} examIds - Danh sách exam ID cần gán
     * @returns {Promise<void>}
     */
    async assignExams(classId, studentCode, examIds) {
        return ApiClient.post(API_CONFIG.ENDPOINTS.ASSIGN_EXAMS(classId, studentCode), {
            examIds,
        });
    },

    /**
     * Lấy tất cả điểm của sinh viên
     * @param {string} classId
     * @param {string} studentCode
     * @returns {Promise<object>} Map { examId_mode: score }
     */
    async getScores(classId, studentCode) {
        return ApiClient.get(API_CONFIG.ENDPOINTS.SCORES(classId, studentCode));
    },

    /**
     * Nộp điểm chấm thi
     * @param {string} classId
     * @param {string} studentCode
     * @param {string} examId
     * @param {object} scoreData - { mode, finalScore, totalFrames, history, totalDeductions }
     * @returns {Promise<object>} Saved score
     */
    async submitScore(classId, studentCode, examId, scoreData) {
        return ApiClient.post(
            API_CONFIG.ENDPOINTS.SUBMIT_SCORE(classId, studentCode, examId),
            scoreData
        );
    },
};

// ============================================
//  Errors API Service
// ============================================

const ErrorsService = {
    /**
     * Lấy danh sách lỗi (với sinh viên mắc lỗi)
     * @returns {Promise<Array>} Mảng error objects
     */
    async getErrors() {
        return ApiClient.get(API_CONFIG.ENDPOINTS.ERRORS);
    },
};

// ============================================
//  Report API Service
// ============================================

const ReportService = {
    /**
     * Lấy dữ liệu tổng hợp cho báo cáo (4 summary cards)
     * @returns {Promise<object>} { totalStudents, totalClasses, averageScore, completionRate }
     */
    async getSummary() {
        return ApiClient.get(API_CONFIG.ENDPOINTS.REPORT_SUMMARY);
    },

    /**
     * Lấy dữ liệu biểu đồ
     * @returns {Promise<object>} Chart data
     */
    async getChartData() {
        return ApiClient.get(API_CONFIG.ENDPOINTS.REPORT_CHARTS);
    },
};
