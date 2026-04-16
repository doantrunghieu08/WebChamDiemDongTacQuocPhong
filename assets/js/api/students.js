// ============================================
//  Students API Service — HACTECH Grading System
// ============================================

const StudentsService = {
    /**
     * Lấy danh sách sinh viên của lớp
     * @param {string} classId
     * @returns {Promise<Array>} Mảng student objects
     */
    async getStudents(classId) {
        return ApiClient.get(API_CONFIG.ENDPOINTS.STUDENTS(classId));
    },

    /**
     * Lấy chi tiết 1 sinh viên
     * @param {string} classId
     * @param {string} studentCode
     * @returns {Promise<object>} Student object
     */
    async getStudent(classId, studentCode) {
        return ApiClient.get(API_CONFIG.ENDPOINTS.STUDENT_DETAIL(classId, studentCode));
    },

    /**
     * Thêm sinh viên vào lớp
     * @param {string} classId
     * @param {object} studentData - { code, name, gender }
     * @returns {Promise<object>} Created student
     */
    async addStudent(classId, studentData) {
        return ApiClient.post(API_CONFIG.ENDPOINTS.STUDENTS(classId), studentData);
    },

    /**
     * Xóa sinh viên khỏi lớp
     * @param {string} classId
     * @param {string} studentCode
     * @returns {Promise<void>}
     */
    async deleteStudent(classId, studentCode) {
        return ApiClient.delete(API_CONFIG.ENDPOINTS.STUDENT_DETAIL(classId, studentCode));
    },

    /**
     * Import sinh viên từ file Excel
     * @param {string} classId
     * @param {File} file - File .xlsx/.xls/.csv
     * @returns {Promise<{imported: number, errors: Array}>}
     */
    async importFromExcel(classId, file) {
        const formData = new FormData();
        formData.append('file', file);
        return ApiClient.upload(API_CONFIG.ENDPOINTS.IMPORT_STUDENTS(classId), formData);
    },
};
