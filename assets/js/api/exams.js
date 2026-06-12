// ============================================
//  Exams & Scores API Service — HACTECH Grading System
// ============================================

const ExamsService = {
    /**
     * Lấy danh sách loại bài thi (Đi đều, Bắn súng, Võ thuật, ...)
     * @returns {Promise<Array>} Mảng exam type objects
     */
    async getExamTypes() {
        const url = API_CONFIG.ENDPOINTS.TEACHER_EXAM_TYPES;
        const response = await ApiClient.fetchWithAuth(url, { method: 'GET' });
        if (!response.ok) throw new Error(`Lấy danh sách loại bài thi thất bại: HTTP ${response.status}`);
        const json = await response.json().catch(() => null);
        const data = json?.data ?? [];
        return Array.isArray(data) ? data : [];
    },

    /**
     * Tạo loại bài thi mới (Admin)
     * @param {string} examCode - Tên tag bài thi (VD: DI_DEU)
     */
    async createAdminExamType(examCode) {
        const url = API_CONFIG.ENDPOINTS.ADMIN_CREATE_EXAM_TYPE;
        const response = await ApiClient.fetchWithAuth(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examCode })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.message || `Thêm tag thất bại: HTTP ${response.status}`);
        }
        const data = await response.json().catch(() => null);
        return data?.data || data;
    },

    /**
     * Lấy danh sách loại bài thi đã xóa mềm (Admin)
     * @returns {Promise<Array>} Mảng các tag đã xóa
     */
    async getDeletedAdminExamTypes() {
        const url = API_CONFIG.ENDPOINTS.ADMIN_EXAM_TYPES_DELETED;
        const response = await ApiClient.fetchWithAuth(url, { method: 'GET' });
        if (!response.ok) throw new Error(`Lấy danh sách đã xóa thất bại: HTTP ${response.status}`);
        const json = await response.json().catch(() => null);
        const data = json?.data ?? [];
        return Array.isArray(data) ? data : [];
    },

    /**
     * Cập nhật Tên tag (Admin)
     */
    async updateAdminExamType(id, examCode) {
        const url = API_CONFIG.ENDPOINTS.ADMIN_UPDATE_EXAM_TYPE(id);
        const response = await ApiClient.fetchWithAuth(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examCode })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.message || `Cập nhật tag thất bại: HTTP ${response.status}`);
        }
        const data = await response.json().catch(() => null);
        return data?.data || data;
    },

    /**
     * Khôi phục tag đã xóa (Admin)
     */
    async restoreAdminExamType(id) {
        const url = API_CONFIG.ENDPOINTS.ADMIN_RESTORE_EXAM_TYPE(id);
        const response = await ApiClient.fetchWithAuth(url, { method: 'PUT' });
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.message || `Khôi phục tag thất bại: HTTP ${response.status}`);
        }
        const data = await response.json().catch(() => null);
        return data?.data || data;
    },

    /**
     * Xóa tag (Admin)
     */
    async deleteAdminExamType(id) {
        const url = API_CONFIG.ENDPOINTS.ADMIN_DELETE_EXAM_TYPE(id);
        const response = await ApiClient.fetchWithAuth(url, { method: 'DELETE' });
        if (!response.ok) {
            const err = await response.json().catch(() => null);
            throw new Error(err?.message || `Xóa tag thất bại: HTTP ${response.status}`);
        }
        const data = await response.json().catch(() => null);
        return data?.data || data;
    },

    /**
     * Lấy số lượng bài thi cho từng tag (Admin)
     * @returns {Promise<object>} Map { "DI_DEU": 2, "VO_THUAT": 1, ... }
     */
    async getAdminExamUsageCounts() {
        const url = API_CONFIG.ENDPOINTS.ADMIN_EXAM_USAGE_COUNTS;
        const response = await ApiClient.fetchWithAuth(url, { method: 'GET' });
        if (!response.ok) throw new Error(`Lấy số lượng bài thi thất bại: HTTP ${response.status}`);
        const json = await response.json().catch(() => null);
        return json?.data || {};
    },

    /**
     * Lấy danh sách bài thi của một lớp học
     * @param {string} classId - Mã lớp (ví dụ: QS_D07)
     * @returns {Promise<Array>} Mảng exam objects đã được chuẩn hoá
     */
    async getExamsByClass(classId, page = 0, size = 3) {
        const url = API_CONFIG.ENDPOINTS.CLASS_EXAMS(classId, page, size);
        const response = await ApiClient.fetchWithAuth(url, { method: 'GET' });
        if (!response.ok) throw new Error(`Lấy danh sách bài thi thất bại: HTTP ${response.status}`);
        const json = await response.json().catch(() => null);

        // Spring Page<> format: { data: { content, totalPages, totalElements, number } }
        if (json?.data?.content != null && json?.data?.totalPages != null) {
            return {
                exams: this._normalizeClassExams(json.data.content),
                totalPages: json.data.totalPages,
                totalElements: json.data.totalElements,
                page: json.data.number ?? page,
                allLoaded: false,
            };
        }

        // Flat array format — backend không hỗ trợ phân trang
        const flatData = json?.data ?? json ?? [];
        const exams = this._normalizeClassExams(Array.isArray(flatData) ? flatData : []);
        return {
            exams,
            totalPages: Math.ceil(exams.length / size) || 1,
            totalElements: exams.length,
            page: 0,
            allLoaded: true,
        };
    },

    /**
     * Chuẩn hoá mảng bài thi từ API /public/exam/class/{classId}
     */
    _normalizeClassExams(data) {
        if (!Array.isArray(data)) return [];
        return data.map(item => {
            const et = item.examTypeResponse || {};
            return {
                id: String(et.id ?? ''),
                classExamId: item.id ?? null,
                name: et.name || 'Bài thi',
                description: et.description || '',
                icon: '📝',
                iconClass: 'custom-exam',
                sampleVideoUrl: et.sampleVideoUrl || null,
                videos: et.sampleVideoUrl ? [{ name: et.name || 'Video mẫu', url: et.sampleVideoUrl }] : [],
                submissionDeadline: item.submissionDeadline || '',
                gradingDeadline: item.gradingDeadline || '',
            };
        });
    },

    /**
     * Lấy danh sách bài thi của giáo viên
     * @param {string} teacherId - Mã giáo viên (ví dụ: GV_HT_10)
     * @returns {Promise<Array>} Mảng exam objects
     */
    async getTeacherExams(teacherId, page = 0, size = 9) {
        const url = API_CONFIG.ENDPOINTS.TEACHER_EXAMS(teacherId, page, size);
        const response = await ApiClient.fetchWithAuth(url);
        if (!response.ok) {
            throw new Error(`Lấy danh sách bài thi thất bại: HTTP ${response.status}`);
        }
        const json = await response.json().catch(() => null);
        // Hỗ trợ dạng Page<> { data: { content, totalPages, totalElements } }
        const pageData = json?.data;
        if (pageData && Array.isArray(pageData.content)) {
            return {
                exams: pageData.content,
                totalPages: pageData.totalPages ?? 1,
                totalElements: pageData.totalElements ?? pageData.content.length,
                page: pageData.number ?? page,
            };
        }
        // Fallback: mảng trực tiếp
        const list = Array.isArray(json) ? json : (Array.isArray(pageData) ? pageData : []);
        return { exams: list, totalPages: 1, totalElements: list.length, page: 0 };
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

    /**
     * Upload video mẫu bài thi lên Cloudinary qua server
     * @param {File} file - File video cần upload
     * @param {string} title - Tiêu đề video mẫu
     * @returns {Promise<string>} URL Cloudinary của video đã upload
     */
    async uploadSampleVideo(file, title) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);

        const headers = {};
        const csrfToken = _getCsrfToken();
        if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

        const response = await fetch(API_CONFIG.ENDPOINTS.UPLOAD_SAMPLE_VIDEO, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Upload video mẫu thất bại: HTTP ${response.status}`);
        }

        const data = await response.json().catch(() => null);
        if (data?.code === 200 && data?.data) {
            return data.data;
        }
        throw new Error(data?.message || 'Upload video mẫu thất bại');
    },

    /**
     * Tạo bài thi mới cho giáo viên
     * @param {string} name - Tên bài thi
     * @param {string} description - Mô tả
     * @param {string} sampleVideoUrl - URL Cloudinary của video mẫu
     * @param {string} teacherId - Mã giáo viên
     * @returns {Promise<object>} Bài thi vừa tạo từ server
     */
    /**
     * Cập nhật bài thi
     * PUT http://103.75.182.246:8080/api/teacher/update-exam/{examId}
     * @param {string|number} examId - ID bài thi cần cập nhật
     * @param {object} payload - { idExamType, name, description, sampleVideoUrl }
     * @returns {Promise<object>} Bài thi sau khi cập nhật
     */
    async updateTeacherExam(examId, { idExamType, name, description, sampleVideoUrl }) {
        const url = API_CONFIG.ENDPOINTS.UPDATE_TEACHER_EXAM(examId);
        const response = await ApiClient.fetchWithAuth(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idExamType: idExamType || null, name, description, sampleVideoUrl: sampleVideoUrl || null }),
        });
        if (!response.ok) {
            const errJson = await response.json().catch(() => null);
            throw new Error(errJson?.message || `Cập nhật bài thi thất bại: HTTP ${response.status}`);
        }
        const json = await response.json().catch(() => null);
        return json?.data || json || null;
    },

    /**
     * Trích xuất standardData từ video mẫu qua AI
     * @param {string} videoUrl - URL Cloudinary của video mẫu
     * @returns {Promise<string>} JSON string của standardData
     */
    async extractTemplate(videoUrl) {
        const response = await fetch('http://103.75.182.246/runpod-ai/api/ai/extract-template', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
            body: JSON.stringify({ videoUrl }),
        });

        if (!response.ok) {
            throw new Error(`Trích xuất dữ liệu chuẩn thất bại: HTTP ${response.status}`);
        }

        const data = await response.json().catch(() => null);
        if (data?.status !== 'success' || !data?.standardData) {
            throw new Error(data?.message || 'Trích xuất dữ liệu chuẩn thất bại');
        }

        // Chỉ lấy trường frames, bỏ qua fps và các trường thừa khác
        const frames = data.standardData.frames;
        if (!frames) {
            throw new Error('Dữ liệu chuẩn không có trường frames');
        }
        return JSON.stringify({ frames });
    },

    async createTeacherExam(name, description, sampleVideoUrl, teacherId, idExamCode, standardData) {
        const headers = { 'Content-Type': 'application/json' };
        const csrfToken = _getCsrfToken();
        if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

        const response = await fetch(API_CONFIG.ENDPOINTS.CREATE_TEACHER_EXAM, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ name, description, sampleVideoUrl, teacherId, idExamCode: idExamCode || 0, standardData: standardData || null }),
        });

        if (!response.ok) {
            throw new Error(`Tạo bài thi thất bại: HTTP ${response.status}`);
        }

        const data = await response.json().catch(() => null);
        return data?.data || data || null;
    },

    /**
     * Khởi tạo phiên chấm điểm
     * POST http://localhost:8080/teacher/grading-session/start
     * @param {string} idSubmission - ID bài nộp của sinh viên
     * @param {string} idTeacher - ID giáo viên chấm
     * @param {string} gradingMode - "OFFICIAL" hoặc "PRACTICE"
     * @returns {Promise<object>} Thông tin phiên chấm (id, studentSubmissionResponse, userResponse, gradingMode, totalDeduction, totalScore, status)
     */
    async startGradingSession(idSubmission, idTeacher, gradingMode) {
        const headers = { 'Content-Type': 'application/json' };
        const csrfToken = _getCsrfToken();
        if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

        console.log('[startGradingSession] payload:', { idSubmission, idTeacher, gradingMode });

        const response = await fetch(API_CONFIG.ENDPOINTS.GRADING_SESSION_START, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ idSubmission, idTeacher, gradingMode }),
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => null);
            const errMsg = errBody?.message || errBody?.error || JSON.stringify(errBody) || '';
            console.error('[startGradingSession] HTTP', response.status, errBody);
            throw new Error(`Khởi tạo phiên chấm thất bại: HTTP ${response.status}${errMsg ? ' – ' + errMsg : ''}`);
        }

        const data = await response.json().catch(() => null);
        return data?.data ?? data;
    },

    /**
     * Lấy chi tiết lỗi theo phiên chấm
     * GET http://localhost:8080/public/grading-error/{idSession}
     * @param {number|string} idSession - ID phiên chấm
     * @returns {Promise<Array>} Mảng error detail objects
     */
    async getGradingErrorDetail(idSession, gradingMode) {
        const url = API_CONFIG.ENDPOINTS.GRADING_ERROR_DETAIL(idSession, gradingMode);
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error(`Lấy chi tiết lỗi thất bại: HTTP ${response.status}`);
        }
        const json = await response.json().catch(() => null);
        return Array.isArray(json?.data) ? json.data : [];
    },

    /**
     * Tính điểm cuối cùng cho phiên chấm
     * POST http://localhost:8080/public/grading-session
     * @param {string} idSubmission - ID bài nộp của sinh viên
     * @param {string} idTeacher - ID giáo viên chấm
     * @param {string} gradingMode - "OFFICIAL" hoặc "PRACTICE"
     * @returns {Promise<object>} { id, totalDeduction, finalScore, status, ... }
     */
    async finalizeGradingSession(idSubmission, idTeacher, gradingMode) {
        const headers = { 'Content-Type': 'application/json' };
        const csrfToken = _getCsrfToken();
        if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

        const response = await fetch(API_CONFIG.ENDPOINTS.GRADING_SESSION_FINALIZE, {
            method: 'POST',
            headers,
            credentials: 'include',
            body: JSON.stringify({ idSubmission, idTeacher, gradingMode }),
        });

        if (!response.ok) {
            throw new Error(`Tính điểm phiên chấm thất bại: HTTP ${response.status}`);
        }

        const data = await response.json().catch(() => null);
        return data?.data ?? data;
    },

    /**
     * Lấy trạng thái phiên chấm theo submissionId
     * GET http://localhost:8080/public/grading-session/submission/{submissionId}
     * @param {string|number} submissionId - ID bài nộp
     * @returns {Promise<object|null>} { id, status, gradingMode, ... } hoặc null
     */
    async getGradingSessionBySubmission(submissionId, page = 0, size = 3) {
        const url = API_CONFIG.ENDPOINTS.GRADING_SESSION_BY_SUBMISSION(submissionId, page, size);
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return null;
        const json = await response.json().catch(() => null);
        // Hỗ trợ cả dạng Page<> (content) và dạng list/object đơn
        return json?.data?.content ?? json?.data ?? json ?? null;
    },

    /**
     * Lấy bảng điểm theo submissionId
     * GET http://localhost:8080/public/grade-board/{submissionId}
     * @param {string|number} submissionId - ID bài nộp
     * @returns {Promise<Array>} Mảng grade board entries
     */
    async getGradeBoard(submissionId) {
        const url = API_CONFIG.ENDPOINTS.GRADE_BOARD(submissionId);
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Lấy bảng điểm thất bại: HTTP ${response.status}`);
        }
        const json = await response.json().catch(() => null);
        return Array.isArray(json?.data) ? json.data : [];
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
