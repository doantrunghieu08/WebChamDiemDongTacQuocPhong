// ============================================
//  API Configuration — HACTECH Grading System
// ============================================

const API_CONFIG = {
    BASE_URL: 'http://103.75.182.246:8080/public/api',
    ADMIN_BASE_URL: 'http://103.75.182.246:8080/admin/api',
    TEACHER_BASE_URL: 'http://103.75.182.246:8080/teacher/api',

    // Timeout (ms)
    TIMEOUT: 15000,

    // Endpoints
    ENDPOINTS: {
        // Auth
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        FORGOT_PASSWORD: '/auth/forgot-password',
        CHANGE_PASSWORD: '/auth/change-password',
        REFRESH_TOKEN: '/auth/refresh',

        // Admin
        USER_LIST: '/admin/api/user',
        USER_CREATE: '/admin/api/user/create',
        IMPORT_USERS: '/admin/import',
        IMPORT_CLASSES: '/admin/import-classes',
        GLOBAL_SEARCH: (keyword, page, size) => `/admin/global-search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`,
        CLASS_STUDENT_SEARCH: (classId, keyword, page, size) => `/public/classes/${encodeURIComponent(classId)}/search?keyword=${encodeURIComponent(keyword)}&page=${page}&size=${size}`,

        // Teacher
        TEACHER_CLASSES: (teacherId) => `/teacher/api/class/${teacherId}`,

        // Classes
        CLASSES: '/classes',
        CLASS_DETAIL: (id) => `/classes/${id}`,

        // Students
        STUDENTS: (classId) => `/classes/${classId}/students`,
        STUDENT_DETAIL: (classId, studentCode) => `/classes/${classId}/students/${studentCode}`,
        IMPORT_STUDENTS: (classId) => `/classes/${classId}/students/import`,

        // Exams
        EXAM_TYPES: '/exams/types',
        CLASS_EXAMS: (classId, page = 0, size = 3) => `/public/exam/class/${encodeURIComponent(classId)}?page=${page}&size=${size}`,
        TEACHER_EXAMS: (teacherId, page = 0, size = 9) => `/api/exam/teacher/${teacherId}?page=${page}&size=${size}`,
        CREATE_TEACHER_EXAM: '/api/teacher/exam',
        ASSIGN_EXAM_TO_CLASS: '/api/teacher/exam/class',
        REMOVE_EXAM_FROM_CLASS: (idClass, idExam) => `/api/teacher/exam/class?idClass=${encodeURIComponent(idClass)}&idExam=${encodeURIComponent(idExam)}`,
        DELETED_CLASS_EXAMS: (idClass, page = 0, size = 100) => `/api/teacher/exam/class/deleted?idClass=${encodeURIComponent(idClass)}&page=${page}&size=${size}`,
        RESTORE_EXAM_TO_CLASS: (idClass, idExam) => `/api/teacher/restore?idClass=${encodeURIComponent(idClass)}&idExam=${encodeURIComponent(idExam)}`,
        DELETE_TEACHER_EXAM: (examId) => `/api/teacher/exam/${encodeURIComponent(examId)}`,
        RESTORE_TEACHER_EXAM: (examId) => `/api/teacher/exam/${encodeURIComponent(examId)}`,
        STUDENT_EXAMS: (classId, studentCode) => `/classes/${classId}/students/${studentCode}/exams`,
        ASSIGN_EXAMS: (classId, studentCode) => `/classes/${classId}/students/${studentCode}/exams`,

        // Scores
        SCORES: (classId, studentCode) => `/classes/${classId}/students/${studentCode}/scores`,
        SUBMIT_SCORE: (classId, studentCode, examId) => `/classes/${classId}/students/${studentCode}/exams/${examId}/score`,

        // Errors
        ERRORS: '/errors',
        CREATE_TEACHER_ERROR: '/api/teacher/error',
        TEACHER_ERRORS: (teacherId, page = 0, size = 10) => `/api/teacher/error/${encodeURIComponent(teacherId)}?page=${page}&size=${size}`,
        DELETE_TEACHER_ERROR: (errorId) => `/api/teacher/error/${encodeURIComponent(errorId)}`,
        RESTORE_TEACHER_ERROR: (errorId) => `/api/teacher/error/${encodeURIComponent(errorId)}`,
        ME: '/auth/me',

        // Sample Video Upload (public endpoint — Cloudinary)
        UPLOAD_SAMPLE_VIDEO: '/public/upload-sample',

        // Teacher: upload video bài thi sinh viên lên Cloudinary (bước 1)
        UPLOAD_STUDENT_EXAM_VIDEO: '/public/upload-student-exam',

        // Student submission (nộp bài)
        STUDENT_SUBMISSION: '/student/submission',
        STUDENT_SUBMISSIONS_BY_STUDENT: (studentId) => `/student/submission/${encodeURIComponent(studentId)}`,

        // Teacher: lấy danh sách bài nộp theo classExam
        TEACHER_CLASS_SUBMISSIONS: (classExamId) => `/teacher/class/${encodeURIComponent(classExamId)}/submissions`,

        // Teacher: khởi tạo phiên chấm
        GRADING_SESSION_START: '/teacher/grading-session/start',

        // Teacher: thêm lỗi vào khung hình trong phiên chấm
        GRADING_SESSION_ADD_ERROR: (idSession) => `/teacher/grading-session/${encodeURIComponent(idSession)}/add-error`,

        // Capture error frame (chụp khung hình bằng chứng)
        CAPTURE_ERROR_FRAME: '/public/capture-error-frame',

        // Chi tiết lỗi theo phiên chấm
        GRADING_ERROR_DETAIL: (idSession, gradingMode) => `/public/grading-error/${encodeURIComponent(idSession)}${gradingMode ? '?gradingMode=' + encodeURIComponent(gradingMode) : ''}`,

        // Tính điểm cuối cùng cho phiên chấm
        GRADING_SESSION_FINALIZE: '/public/grading-session',

        // Bảng điểm theo submissionId
        GRADE_BOARD: (submissionId) => `/public/grade-board/${encodeURIComponent(submissionId)}`,

        // Lịch sử chấm theo teacherId
        GRADING_HISTORY: (teacherId, page = 0, size = 10) => `/teacher/grading-session/history/${encodeURIComponent(teacherId)}?page=${page}&size=${size}`,

        // Bảng điểm toàn lớp theo classId
        CLASS_GRADE_BOARD: (classId) => `/public/class-grade-board/submission/${encodeURIComponent(classId)}`,

        // Teacher: tải video bài thi của sinh viên lên (thay thế / bổ sung video)
        TEACHER_UPLOAD_SUBMISSION_VIDEO: (submissionId) => `/teacher/submission/${encodeURIComponent(submissionId)}/upload-video`,

        // AI gợi ý chấm điểm
        AI_GRADE: (idTeacher, videoUrl) => `http://103.75.182.246:8080/teacher/grade?idTeacher=${encodeURIComponent(idTeacher)}&videoUrl=${encodeURIComponent(videoUrl)}`,

        // Trạng thái phiên chấm theo submissionId
        GRADING_SESSION_BY_SUBMISSION: (submissionId, page = 0, size = 3) => `/teacher/grading-session/submission/${encodeURIComponent(submissionId)}?page=${page}&size=${size}`,

        // Điểm bài thi của sinh viên (student view)
        STUDENT_MY_EXAM: (studentCode, page = 0, size = 10) => `/student/my-exam/${encodeURIComponent(studentCode)}?page=${page}&size=${size}`,
    }
};

// ============================================
//  Token Management — Token nằm trong HttpOnly Cookie
//  JS không thể đọc/ghi token. Chỉ quản lý session user info.
// ============================================

const TokenManager = {
    getAccessToken() {
        // Ưu tiên đọc từ sessionStorage (khi BE trả token trong body — cross-origin)
        return sessionStorage.getItem('accessToken') || null;
    },
    getRefreshToken() {
        return sessionStorage.getItem('refreshToken');
    },
    setTokens(accessToken, refreshToken) {
        if (accessToken) sessionStorage.setItem('accessToken', accessToken);
        if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
    },
    clearTokens() {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    },
    isAuthenticated() {
        return !!JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    }
};

// ============================================
//  CSRF Helper — Đọc XSRF-TOKEN cookie (không phải HttpOnly)
//  Spring Security CookieCsrfTokenRepository gửi cookie này theo mọi request
// ============================================

function _getCsrfToken() {
    const match = document.cookie.split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
}

// ============================================
//  API Client — Fetch Wrapper
// ============================================

// Shared promise để tránh gọi refresh token nhiều lần đồng thời (race condition)
let _pendingRefreshPromise = null;

// Token nằm trong HttpOnly Cookie — trình duyệt tự gửi qua credentials: 'include'
// Frontend không cần lưu hay inject token thủ công

// Khi refresh token hết hạn / không hợp lệ → xoá session và chuyển về trang login
function _handleSessionExpired() {
    TokenManager.clearTokens();
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUserRole');
    sessionStorage.setItem('sessionExpired', '1');
    window.location.href = '/index.html';
}

const ApiClient = {
    async request(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        // Không set Content-Type khi body là FormData (browser tự set multipart boundary)
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        // Gửi access token qua Authorization header nếu có (hỗ trợ cross-origin)
        const _accessToken = TokenManager.getAccessToken();
        if (_accessToken && !headers['Authorization']) {
            headers['Authorization'] = `Bearer ${_accessToken}`;
        }

        // Thêm CSRF token header cho các request thay đổi dữ liệu (POST/PUT/DELETE)
        // Spring Security CookieCsrfTokenRepository gửi XSRF-TOKEN (không HttpOnly) — JS đọc được
        const _method = (options.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(_method)) {
            const csrfToken = _getCsrfToken();
            if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Chỉ intercept 401 (Unauthorized / token hết hạn) — không intercept 403
            // Không intercept 401 cho auth endpoints (login/logout/change-password) vì
            // 401 từ các endpoint này là lỗi nghiệp vụ (sai mật khẩu...), không phải hết token
            const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/logout')
                || url.includes('/auth/change-password') || url.includes('/auth/refresh');
            if (response.status === 401 && !isAuthEndpoint && typeof this._refreshToken === 'function') {
                const refreshed = await this._refreshToken();
                if (refreshed) {
                    // Cookie mới đã được BE set — retry ngay với credentials: 'include'
                    const retryResponse = await fetch(url, { ...options, headers, credentials: 'include' });
                    return this._handleResponse(retryResponse);
                } else {
                    // _refreshToken đã gọi _handleSessionExpired() nếu token thực sự hết hạn
                    throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
                }
            }

            return this._handleResponse(response);
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Yêu cầu quá thời gian, vui lòng thử lại');
            }
            throw error;
        }
    },

    async _handleResponse(response) {
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const message = data?.message || `Lỗi ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    },

    async _refreshToken() {
        // Nếu đang có refresh request đang chạy, dùng chung promise đó
        // tránh gửi nhiều request refresh đồng thời khi nhiều API cùng nhận 401
        if (_pendingRefreshPromise) return _pendingRefreshPromise;

        _pendingRefreshPromise = (async () => {
            try {
                const csrfToken = (typeof _getCsrfToken === 'function') ? _getCsrfToken() : null;
                const headers = {};
                if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

                // refreshToken được lưu trong sessionStorage sau khi đăng nhập
                // Gửi trong body để backend xác thực
                const storedRefreshToken = TokenManager.getRefreshToken();
                const body = storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : null;
                if (body) headers['Content-Type'] = 'application/json';

                const response = await fetch(
                    `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`,
                    {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        ...(body ? { body } : {}),
                    }
                );

                if (!response.ok) {
                    const errJson = await response.json().catch(() => null);
                    console.warn(`[_refreshToken] thất bại ${response.status}:`, errJson);
                    // Refresh token hết hạn / không hợp lệ → buộc đăng xuất
                    _handleSessionExpired();
                    return false;
                }

                // BE trả accessToken qua HttpOnly cookie và/hoặc trong body, refreshToken mới qua body
                const refreshData = await response.json().catch(() => null);
                const newAccessToken = refreshData?.data?.accessToken || refreshData?.accessToken || refreshData?.data?.access_token || refreshData?.access_token || null;
                const newRefreshToken = refreshData?.data?.refreshToken || refreshData?.refreshToken || refreshData?.data?.refresh_token || refreshData?.refresh_token || null;
                if (newAccessToken || newRefreshToken) TokenManager.setTokens(newAccessToken, newRefreshToken);

                return true;
            } catch (e) {
                console.warn('[_refreshToken] lỗi mạng:', e);
                return false;
            } finally {
                _pendingRefreshPromise = null;
            }
        })();

        return _pendingRefreshPromise;
    },

    /**
     * fetch() với tự động refresh token khi gặp 401.
     * Dùng cho các API gọi bằng URL tuyệt đối (không qua ApiClient.request).
     * @param {string} url - URL tuyệt đối
     * @param {RequestInit} options
     * @returns {Promise<Response>}
     */
    async fetchWithAuth(url, options = {}) {
        const _accessToken = TokenManager.getAccessToken();
        const authHeaders = _accessToken ? { 'Authorization': `Bearer ${_accessToken}` } : {};
        const opts = {
            credentials: 'include',
            ...options,
            headers: { ...authHeaders, ...(options.headers || {}) },
        };
        const response = await fetch(url, opts);
        if (response.status !== 401) return response;

        // Thử refresh token
        const refreshed = await this._refreshToken();
        if (!refreshed) {
            // _refreshToken đã gọi _handleSessionExpired() nếu token thực sự hết hạn
            return response;
        }
        // Retry với token mới sau refresh
        const _newToken = TokenManager.getAccessToken();
        const retryHeaders = _newToken ? { 'Authorization': `Bearer ${_newToken}` } : {};
        return fetch(url, { ...opts, headers: { ...retryHeaders, ...(options.headers || {}) } });
    },

    // Shorthand methods
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // Upload file (FormData) — không set Content-Type, để browser tự set multipart boundary
    upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData,
            // Không truyền headers: {} — request() sẽ tự xóa Content-Type khi body là FormData
        });
    },
};
