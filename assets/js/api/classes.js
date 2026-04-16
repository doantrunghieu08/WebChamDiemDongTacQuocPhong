// ============================================
//  Classes API Service — HACTECH Grading System
// ============================================

const ClassesService = {
    /**
     * Lấy danh sách lớp của giảng viên
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
