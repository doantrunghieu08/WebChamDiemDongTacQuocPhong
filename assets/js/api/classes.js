// ============================================
//  Classes API Service — HACTECH Grading System
// ============================================

const ClassesService = {
    /**
     * Lấy danh sách lớp của giảng viên có phân trang
     * @param {string} teacherId
     * @param {number} page - 0-based
     * @param {number} size
     * @returns {Promise<{ classes, totalPages, totalElements }>}
     */
    async getClassesByTeacher(teacherId, page = 0, size = 8) {
        const url = `${API_CONFIG.ENDPOINTS.TEACHER_CLASSES(teacherId)}?page=${page}&size=${size}`;

        const response = await ApiClient.fetchWithAuth(url, { method: 'GET' });
        if (response.status === 401) {
            throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        }
        const json = await response.json();

        let rawList, totalPages, totalElements;

        // Spring Page trong json.data
        if (json.data && !Array.isArray(json.data) && Array.isArray(json.data.content)) {
            rawList       = json.data.content;
            totalPages    = json.data.totalPages    ?? null;
            totalElements = json.data.totalElements ?? null;
        }
        // Flat array trong json.data (fallback)
        else {
            rawList       = Array.isArray(json.data) ? json.data : [];
            totalPages    = json.totalPages    ?? null;
            totalElements = json.totalElements ?? null;
        }

        if (totalElements === null) totalElements = rawList.length;
        if (totalPages === null) {
            totalPages = rawList.length > 0 ? page + 2 : Math.max(1, page);
        }

        return {
            classes: rawList,
            totalPages: Math.max(1, totalPages),
            totalElements,
        };
    },

    /**
     * Lấy danh sách lớp của giảng viên (endpoint cũ)
     * @returns {Promise<Array>} Mảng class objects
     */
    async getClasses() {
        return ApiClient.get(API_CONFIG.ENDPOINTS.CLASSES);
    },

    /**
     * Lấy chi tiết 1 lớp
     * @param {string} classId
     * @returns {Promise<object>} Class object
     */
    async getClassDetail(classId) {
        return ApiClient.get(API_CONFIG.ENDPOINTS.CLASS_DETAIL(classId));
    },

    /**
     * Tạo lớp mới
     * @param {object} classData - { className, semester, year, roomNumber }
     * @returns {Promise<object>} Created class
     */
    async createClass(classData) {
        return ApiClient.post(API_CONFIG.ENDPOINTS.CLASSES, classData);
    },

    /**
     * Cập nhật thông tin lớp
     * @param {string} classId
     * @param {object} classData
     * @returns {Promise<object>} Updated class
     */
    async updateClass(classId, classData) {
        return ApiClient.put(API_CONFIG.ENDPOINTS.CLASS_DETAIL(classId), classData);
    },

    /**
     * Xóa lớp
     * @param {string} classId
     * @returns {Promise<void>}
     */
    async deleteClass(classId) {
        return ApiClient.delete(API_CONFIG.ENDPOINTS.CLASS_DETAIL(classId));
    },
};
