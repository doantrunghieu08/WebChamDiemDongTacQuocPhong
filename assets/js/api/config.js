// ============================================
//  API Configuration — HACTECH Grading System
// ============================================

const API_CONFIG = {
    BASE_URL: 'http://localhost:8080/api',

    // Timeout (ms)
    TIMEOUT: 15000,

    // Endpoints
    ENDPOINTS: {
        // Auth
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        FORGOT_PASSWORD: '/auth/forgot-password',
        REFRESH_TOKEN: '/auth/refresh',

        // Classes
        CLASSES: '/classes',
        CLASS_DETAIL: (id) => `/classes/${id}`,

        // Students
        STUDENTS: (classId) => `/classes/${classId}/students`,
        STUDENT_DETAIL: (classId, studentCode) => `/classes/${classId}/students/${studentCode}`,
        IMPORT_STUDENTS: (classId) => `/classes/${classId}/students/import`,

        // Exams
        EXAM_TYPES: '/exams/types',
        STUDENT_EXAMS: (classId, studentCode) => `/classes/${classId}/students/${studentCode}/exams`,
        ASSIGN_EXAMS: (classId, studentCode) => `/classes/${classId}/students/${studentCode}/exams`,

        // Scores
        SCORES: (classId, studentCode) => `/classes/${classId}/students/${studentCode}/scores`,
        SUBMIT_SCORE: (classId, studentCode, examId) => `/classes/${classId}/students/${studentCode}/exams/${examId}/score`,

        // Errors
        ERRORS: '/errors',

        // Report
        REPORT_SUMMARY: '/report/summary',
        REPORT_CHARTS: '/report/charts',
    }
};

// ============================================
//  Token Management
// ============================================

const TokenManager = {
    getAccessToken() {
        return localStorage.getItem('accessToken');
    },

    getRefreshToken() {
        return localStorage.getItem('refreshToken');
    },

    setTokens(accessToken, refreshToken) {
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
    },

    clearTokens() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    },

    isAuthenticated() {
        return !!this.getAccessToken();
    }
};

// ============================================
//  API Client — Fetch Wrapper
// ============================================

const ApiClient = {
    async request(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        // Attach token nếu đã đăng nhập
        const token = TokenManager.getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Token hết hạn → thử refresh
            if (response.status === 401 && TokenManager.getRefreshToken()) {
                const refreshed = await this._refreshToken();
                if (refreshed) {
                    headers['Authorization'] = `Bearer ${TokenManager.getAccessToken()}`;
                    const retryResponse = await fetch(url, { ...options, headers });
                    return this._handleResponse(retryResponse);
                } else {
                    TokenManager.clearTokens();
                    window.location.href = '/index.html';
                    throw new Error('Phiên đăng nhập hết hạn');
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
        try {
            const response = await fetch(
                `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH_TOKEN}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: TokenManager.getRefreshToken() }),
                }
            );
            if (response.ok) {
                const data = await response.json();
                TokenManager.setTokens(data.accessToken, data.refreshToken);
                return true;
            }
            return false;
        } catch {
            return false;
        }
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

    // Upload file (FormData, không set Content-Type)
    upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            headers: {}, // Để browser tự set multipart boundary
            body: formData,
        });
    },
};
