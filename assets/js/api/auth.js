// ============================================
//  Auth API Service — HACTECH Grading System
// ============================================

const AuthService = {
    /**
     * Đăng nhập
     * @param {string} userId - Mã người dùng
     * @param {string} password - Mật khẩu
     * @returns {Promise<{accessToken, refreshToken, user}>}
     */
    async login(userId, password) {
        const data = await ApiClient.post(API_CONFIG.ENDPOINTS.LOGIN, {
            userId,
            password,
        });

        // Lưu token
        TokenManager.setTokens(data.accessToken, data.refreshToken);

        // Lưu user info (tương thích localStorage cũ)
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        return data;
    },

    /**
     * Đăng xuất
     */
    async logout() {
        try {
            await ApiClient.post(API_CONFIG.ENDPOINTS.LOGOUT, {});
        } catch {
            // Vẫn xóa token dù API lỗi
        } finally {
            TokenManager.clearTokens();
            localStorage.removeItem('currentUser');
            window.location.href = '/index.html';
        }
    },

    /**
     * Quên mật khẩu
     * @param {string} email
     * @returns {Promise<{message}>}
     */
    async forgotPassword(email) {
        return ApiClient.post(API_CONFIG.ENDPOINTS.FORGOT_PASSWORD, { email });
    },

    /**
     * Lấy thông tin user hiện tại từ localStorage
     * @returns {object|null}
     */
    getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    },

    /**
     * Kiểm tra đã đăng nhập chưa
     */
    isLoggedIn() {
        return TokenManager.isAuthenticated() && !!this.getCurrentUser();
    },
};
