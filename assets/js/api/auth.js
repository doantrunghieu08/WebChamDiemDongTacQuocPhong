// ============================================
//  Auth API Service — HACTECH Grading System
// ============================================

const AuthService = {
    // Decode JWT payload (best-effort). Returns object or null.
    _decodeJwt(token) {
        if (!token || typeof token !== 'string') return null;
        try {
            const parts = token.split('.');
            if (parts.length < 2) return null;
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(atob(payload).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    },
    /**
     * Đăng nhập
     * @param {string} userId - Mã người dùng
     * @param {string} password - Mật khẩu
     * @returns {Promise<{accessToken, refreshToken, user}>}
     */
    async login(username, password) {
        // Bước 1: Gọi GET /auth/me/{username} để Spring Security set XSRF-TOKEN cookie
        // Dùng username đã có sẵn — BE chỉ expose endpoint có param, không có /me bare
        try {
            await fetch(`${API_CONFIG.BASE_URL}/auth/me/${encodeURIComponent(username)}`, {
                method: 'GET',
                credentials: 'include',
            });
        } catch { /* bỏ qua — mục đích chỉ để lấy CSRF cookie */ }

        // Bước 2: Gọi POST login với CSRF token (ApiClient tự đọc X-XSRF-TOKEN)
        const response = await ApiClient.post(API_CONFIG.ENDPOINTS.LOGIN, {
            username,
            password,
        }).catch(err => { throw err; });

        let userData = response?.data || response || {};

        // Lấy accessToken và refreshToken từ body (hỗ trợ cross-origin khi không dùng HttpOnly cookie)
        // accessToken cũng có thể được BE set vào HttpOnly cookie — browser tự lưu nếu same-origin
        const accessToken = userData.accessToken || userData.access_token || null;
        const refreshToken = userData.refreshToken || userData.refresh_token || null;
        if (accessToken || refreshToken) TokenManager.setTokens(accessToken, refreshToken);

        // Chuẩn hoá role từ body trả về
        let role = userData.role || userData.userRole || userData.roles || null;
        if (Array.isArray(role)) role = role[0];
        if (role) {
            const r = role.toString().toUpperCase();
            if (r === 'ADMIN' || r === 'ROLE_ADMIN') role = 'admin';
            else if (r === 'TEACHER' || r === 'ROLE_TEACHER') role = 'teacher';
            else if (r === 'STUDENT' || r === 'ROLE_STUDENT') role = 'student';
            else role = r.toLowerCase();
        }

        // Thông tin user từ body
        const minimal = {
            id: userData.id || userData.userId || null,
            username: userData.username || userData.userName || username,
            fullName: userData.fullName || userData.name || userData.displayName || '',
            name: userData.fullName || userData.name || userData.displayName || '',
            studentId: userData.studentId || userData.student_id || userData.id || userData.userId || null,
            email: userData.email || '',
            gender: userData.gender || '',
            birthday: userData.birthday || '',
            idClass: userData.idClass || userData.classId || null,
            avatarImage: userData.avatarImage || '',
            role: role || null
        };

        // Nếu body không trả role (BE đã chuyển sang HttpOnly Cookie), gọi /auth/me
        // để lấy bổ sung — cookie vừa được BE set nên request này sẽ có xác thực
        // Luôn gọi /me để đảm bảo đầy đủ thông tin (gender, email, birthday, ...)
        // dù login response đã có role hay chưa
        try {
            const profile = await this.fetchProfile(username);
            if (profile) {
                if (profile.role && !role) {
                    role = profile.role;
                }
                if (!minimal.fullName) minimal.fullName = profile.fullName || profile.name || '';
                if (!minimal.name) minimal.name = profile.fullName || profile.name || '';
                if (!minimal.id) minimal.id = profile.id || null;
                if (!minimal.studentId) minimal.studentId = profile.studentId || profile.student_id || profile.id || null;
                if (!minimal.email) minimal.email = profile.email || '';
                if (!minimal.gender) minimal.gender = profile.gender || '';
                if (!minimal.birthday) minimal.birthday = profile.birthday || '';
                if (!minimal.idClass && profile.idClass) minimal.idClass = profile.idClass;
                if (!minimal.avatarImage) minimal.avatarImage = profile.avatarImage || '';
                minimal.role = role || profile.role || null;
            }
        } catch {}

        if (role) sessionStorage.setItem('currentUserRole', role);
        sessionStorage.setItem('currentUser', JSON.stringify(minimal));

        // accessToken được BE set vào HttpOnly cookie khi login — browser tự lưu
        // Không cần đọc hay lưu thủ công ở frontend

        userData.role = role;
        return userData;
    },

    /**
     * Đăng xuất — gửi refreshToken lên API, dọn dẹp local dù BE lỗi
     */
    async logout() {
        // Hiện loading overlay
        const overlay = document.createElement('div');
        overlay.id = '__logout_overlay__';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999';
        overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:28px 36px;display:flex;flex-direction:column;align-items:center;gap:14px;font-family:inherit"><div style="width:36px;height:36px;border:4px solid #e5e7eb;border-top-color:#6366f1;border-radius:50%;animation:__spin__ .7s linear infinite"></div><span style="font-size:14px;color:#374151">Đang đăng xuất...</span></div>';
        const style = document.createElement('style');
        style.textContent = '@keyframes __spin__{to{transform:rotate(360deg)}}';
        document.head.appendChild(style);
        document.body.appendChild(overlay);

        try {
            const csrfToken = (typeof _getCsrfToken === 'function') ? _getCsrfToken() : null;
            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

            await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGOUT}`, {
                method: 'POST',
                headers,
                credentials: 'include',
            });
        } catch {
            // ignore
        } finally {
            TokenManager.clearTokens();
            sessionStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUserRole');
            sessionStorage.setItem('logoutSuccess', '1');
            window.location.href = '/index.html';
        }
    },

    /**
     * Quên mật khẩu – gửi mật khẩu mới về email
     * @param {string} email
     */
    async forgotPassword(email) {
        return ApiClient.post(API_CONFIG.ENDPOINTS.FORGOT_PASSWORD, { email });
    },

    /**
     * Đổi mật khẩu
     * @param {string} username
     * @param {string} oldPassword
     * @param {string} newPassword
     * @returns {Promise<object>} userData
     */
    async changePassword(username, oldPassword, newPassword) {
        const response = await ApiClient.post(API_CONFIG.ENDPOINTS.CHANGE_PASSWORD, {
            username,
            oldPassword,
            newPassword,
        });
        return response.data;
    },

    /**
     * Lấy thông tin user hiện tại từ sessionStorage
     * @returns {object|null}
     */
    getCurrentUser() {
        const user = sessionStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    },

    /**
     * Kiểm tra đã đăng nhập chưa
     */
    isLoggedIn() {
        // Đăng nhập khi có thông tin user trong sessionStorage
        return !!this.getCurrentUser();
    },

    /**
     * Fetch full profile (including role) from server.
     * Returns profile object or null.
     */
    async fetchProfile(username = null) {
        try {
            const url = username
                ? `${API_CONFIG.BASE_URL}/auth/me/${encodeURIComponent(username)}`
                : `${API_CONFIG.BASE_URL}/auth/me`;

            const headers = { Accept: 'application/json' };
            // Token nằm trong HttpOnly Cookie — trình duyệt tự đính kèm

            const res = await fetch(url, { headers, credentials: 'include' });
            if (!res.ok) return null;

            const json = await res.json().catch(() => null);
            const profile = json?.data || json;
            if (!profile || typeof profile !== 'object') return null;

            // Normalize role
            if (profile.role) {
                let r = Array.isArray(profile.role) ? profile.role[0] : profile.role;
                r = r.toString().toUpperCase();
                if (r === 'ADMIN' || r === 'ROLE_ADMIN') r = 'admin';
                else if (r === 'TEACHER' || r === 'ROLE_TEACHER') r = 'teacher';
                else if (r === 'STUDENT' || r === 'ROLE_STUDENT') r = 'student';
                else r = r.toLowerCase();
                sessionStorage.setItem('currentUserRole', r);
                profile.role = r;
            }
            return profile;
        } catch {
            return null;
        }
    }
};
