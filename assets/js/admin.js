// Mở modal cập nhật tài khoản, điền sẵn thông tin
function openUpdateAccountModal(accountId) {
  const account = adminAccounts.find(acc => acc.id === accountId);
  if (!account) return;
  document.getElementById('accountModal').style.display = 'flex';
  const titleEl = document.getElementById('accountModalTitle');
  if (titleEl) titleEl.textContent = 'Cập nhật thông tin';
  document.getElementById('accountId').value = account.id;
  document.getElementById('accountName').value = account.name;
  document.getElementById('accountUsername').value = account.username;
  document.getElementById('accountRole').value = account.role;
  document.getElementById('accountBirthday').value = account.birthday;
  document.getElementById('accountEmail').value = account.email;
  // Ẩn trường mật khẩu khi cập nhật
  const pwRow = document.getElementById('accountPasswordRow');
  const pwInput = document.getElementById('accountPassword');
  if (pwRow) pwRow.style.display = 'none';
  if (pwInput) { pwInput.required = false; pwInput.value = ''; }
  const genderEl = document.getElementById('accountGender');
  if (genderEl) genderEl.value = (account.gender || 'MALE').toUpperCase();
  // Disable sửa mã tài khoản
  document.getElementById('accountId').readOnly = true;
  // Cho phép sửa username, lưu giá trị gốc để phát hiện thay đổi
  const usernameEl = document.getElementById('accountUsername');
  if (usernameEl) {
    usernameEl.readOnly = false;
    usernameEl.dataset.original = account.username;
  }
  // Set status
  document.getElementById('accountStatus').value = account.status || 'active';
  // Set avatar preview
  const avatarPreview = document.getElementById('accountAvatarPreview');
  const avatarInput = document.getElementById('accountAvatar');
  if (avatarInput) avatarInput.value = '';
  if (avatarPreview) {
    if (account.avatarImage) {
      avatarPreview.innerHTML = `<img src="${account.avatarImage}" alt="avatar">`;
    } else {
      avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
    }
  }
}
let adminUser = null;
let adminAccounts = [];
let adminClasses = [];
let adminPopupConfirmHandler = null;
let adminPopupCancelHandler = null;
let activeRoleFilter = '';

// ---- Infinite scroll state ----
let userCurrentPage   = 0;
let userPageSize      = 10;
let userTotalPages    = 1;
let userTotalElements = 0;
let userIsLoading     = false;
let _userObserver     = null;

// ---- Class pagination state ----
let classCurrentPage   = 0;
let classPageSize      = 8;
let classTotalPages    = 1;
let classTotalElements = 0;
let classIsLoading     = false;

// Fetch helper: tự động refresh token khi gặp 401
async function fetchWithAuth(url, options = {}) {
  const getHeaders = () => {
    const h = {};
    // Chỉ set Content-Type: application/json khi body KHÔNG phải FormData
    // (FormData cần browser tự set Content-Type kèm boundary)
    if (!(options.body instanceof FormData)) {
      h['Content-Type'] = 'application/json';
    }
    Object.assign(h, options.headers);
    // Thêm CSRF token cho các request thay đổi dữ liệu
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfCookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
      if (csrfCookie) h['X-XSRF-TOKEN'] = decodeURIComponent(csrfCookie.split('=')[1]);
    }
    return h;
  };

  let response = await fetch(url, { ...options, headers: getHeaders(), credentials: 'include' });

  if (response.status === 401 && typeof ApiClient?._refreshToken === 'function') {
    const refreshed = await ApiClient._refreshToken();
    if (refreshed) {
      response = await fetch(url, { ...options, headers: getHeaders(), credentials: 'include' });
    } else {
      // Không tự redirect — loadUsersFromApi/loadClassesFromApi sẽ catch và trả null
      throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  return response;
}

/**
 * Tải danh sách tài khoản có phân trang từ server.
 * @param {number} page  - Số trang (0-based)
 * @param {number} size  - Số bản ghi mỗi trang
 * @param {string} search - Từ khóa tìm kiếm (tuỳ chọn)
 * @param {string} role   - Lọc theo vai trò (tuỳ chọn)
 * @returns {{ users, totalPages, totalElements } | null}
 */
async function loadUsersFromApi(page = 0, size = userPageSize, search = '', role = '') {
  try {
    const params = new URLSearchParams({ page, size });

    let url;
    const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
    const baseHost = (adminBase.split('/admin')[0]) || '';

    if (search) {
      // Dùng endpoint global-search khi có keyword
      url = API_CONFIG.ENDPOINTS.GLOBAL_SEARCH(search, page, size);
    } else if (role) {
      // Dùng endpoint filter khi chỉ lọc theo vai trò
      params.set('role', role.toUpperCase());
      url = `${baseHost}/admin/filter/user?${params.toString()}`;
    } else {
      url = `${API_CONFIG.ADMIN_BASE_URL}/user?${params.toString()}`;
    }

    const response = await fetchWithAuth(url, { headers: {} });
    if (!response.ok) throw new Error('Lỗi tải danh sách người dùng');
    const json = await response.json();

    // Hỗ trợ 2 cấu trúc response:
    // (1) Spring Page trong json.data: { content:[], totalElements, totalPages, ... }
    // (2) Mảng trực tiếp trong json.data, metadata ở root: { data:[], totalPages, totalElements }
    let rawList, totalPages, totalElements;

    if (json.data && !Array.isArray(json.data) && Array.isArray(json.data.content)) {
      // Cấu trúc Spring Page
      rawList       = json.data.content;
      totalPages    = json.data.totalPages    ?? null;
      totalElements = json.data.totalElements ?? null;
    } else {
      rawList       = Array.isArray(json.data) ? json.data : [];
      totalPages    = json.totalPages    ?? null;
      totalElements = json.totalElements ?? null;
    }

    // Nếu backend không trả totalPages/totalElements,
    // dùng heuristic: nhận đúng `size` bản ghi → còn trang tiếp
    if (totalElements === null) totalElements = rawList.length;
    if (totalPages === null) {
      totalPages = rawList.length >= size ? page + 2 : page + 1;
    }

    const users = rawList.map(u => ({
      id: u.id,
      name: u.fullName,
      username: u.username,
      birthday: u.birthday ? u.birthday.split('T')[0] : '',
      gender: u.gender || '',
      role: (u.role || '').toLowerCase(),
      status: (u.status || '').toUpperCase() === 'ACTIVE' ? 'active' : 'locked',
      email: u.email || '',
      requirePasswordChange: u.requirePasswordChange,
      avatarImage: u.avatarImage || '',
    }));

    return { users, totalPages: Math.max(1, totalPages), totalElements };
  } catch (err) {
    console.error('Không tải được danh sách người dùng:', err);
    return null;
  }
}

  /**
   * Tải danh sách giảng viên từ endpoint không phân trang (dùng cho dropdown phân công)
   * Trả về mảng { id, name, status }
   */
  async function loadTeacherListFromApi() {
    try {
      const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
      const baseHost = (adminBase.split('/admin')[0]) || '';
      const url = `${baseHost}/admin/teacher-list`;
      const response = await fetchWithAuth(url, { headers: {} });
      if (!response.ok) throw new Error('Lỗi tải danh sách giảng viên');
      const json = await response.json().catch(() => null);

      let list = [];
      if (Array.isArray(json?.data)) list = json.data;
      else if (Array.isArray(json)) list = json;
      else if (json?.data && Array.isArray(json.data.content)) list = json.data.content;

      const teachers = (list || []).map(t => ({
        id: t.id || t.teacherId || t.username || t.code || '',
        name: t.fullName || t.name || t.teacherName || t.displayName || '',
        status: (t.status || 'active').toString().toLowerCase()
      }));

      return teachers;
    } catch (err) {
      console.warn('Không tải được danh sách giảng viên:', err);
      return null;
    }
  }

async function refreshUserList(page = 0) {
  if (userIsLoading) return;
  userIsLoading = true;

  const search = (document.getElementById('accountSearchInput')?.value || '').trim();
  const role   = activeRoleFilter || '';

  if (page === 0) {
    // Reset toàn bộ: dữ liệu + render skeleton
    adminAccounts = [];
    const container = document.getElementById('accountsContent');
    if (container) _renderAccountsSkeleton(container);
    _updateSummaryCards();
  }

  const result = await loadUsersFromApi(page, userPageSize, search, role);
  userIsLoading = false;

  if (!result) return;

  userCurrentPage   = page;
  userTotalPages    = result.totalPages;
  userTotalElements = result.totalElements;

  if (page === 0) {
    adminAccounts = result.users;
    _updateSummaryCards();
    _renderTableRows(adminAccounts); // render toàn bộ lần đầu
  } else {
    adminAccounts = [...adminAccounts, ...result.users];
    _appendTableRows(result.users);  // chỉ append thêm
  }

  sessionStorage.setItem('adminAccounts', JSON.stringify(adminAccounts));
  _updateAccountFooter();

  if (page === 0) {
    _attachWrapScrollListener(); // gắn scroll listener một lần duy nhất
  }
  // Nếu nội dung chưa lấp đầy wrap → tự động tải thêm
  requestAnimationFrame(_checkAutoFill);
}

function _updateSummaryCards() {
  const el = id => document.getElementById(id);

  // Hiển thị tạm từ local trong khi chờ API
  if (el('summaryTotal'))   el('summaryTotal').textContent   = userTotalElements || adminAccounts.length;
  if (el('summaryTeacher')) el('summaryTeacher').textContent = adminAccounts.filter(a => a.role === 'teacher').length;
  if (el('summaryStudent')) el('summaryStudent').textContent = adminAccounts.filter(a => a.role === 'student').length;
  if (el('summaryLocked'))  el('summaryLocked').textContent  = adminAccounts.filter(a => a.status === 'locked').length;

  // Lấy thống kê chính xác từ API
  fetchWithAuth('http://103.75.182.246:8080/public/statistics', { headers: {} })
    .then(r => r.json())
    .then(json => {
      const d = json?.data;
      if (!d) return;
      if (el('summaryTotal'))   el('summaryTotal').textContent   = d.totalUsers   ?? el('summaryTotal').textContent;
      if (el('summaryTeacher')) el('summaryTeacher').textContent = d.totalTeachers ?? el('summaryTeacher').textContent;
      if (el('summaryStudent')) el('summaryStudent').textContent = d.totalStudents ?? el('summaryStudent').textContent;
      if (el('summaryLocked'))  el('summaryLocked').textContent  = d.lockedUsers  ?? el('summaryLocked').textContent;
    })
    .catch(() => {}); // giữ nguyên số local nếu API lỗi
}

function _makeAccountRow(account) {
  const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="60%" height="60%"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;
  const avatarHtml = account.avatarImage
    ? `<div class="admin-avatar" style="background:transparent;padding:0"><img src="${account.avatarImage}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:block"></div>`
    : `<div class="admin-avatar admin-avatar-default">${DEFAULT_AVATAR_SVG}</div>`;
  return `
    <tr class="${account.status === 'locked' ? 'locked' : ''}">
      <td><strong>${account.id}</strong></td>
      <td>
        <div class="admin-member-cell">
          ${avatarHtml}
          <div>
            <div class="admin-member-name">${account.name}</div>
            <div class="admin-member-email">${account.email || ''}</div>
          </div>
        </div>
      </td>
      <td>${account.username}</td>
      <td><span class="admin-role-badge ${account.role}">${getRoleLabel(account.role)}</span></td>
      <td>${formatBirthday(account.birthday)}</td>
      <td><span class="admin-status-badge ${account.status}">${getStatusLabel(account.status)}</span></td>
      <td>
        <div class="admin-action-group">
          <button class="admin-update-btn" onclick="openUpdateAccountModal('${account.id}')">
            <i class="fas fa-pen-to-square"></i> Cập nhật
          </button>
          <button class="${account.status === 'locked' ? 'admin-lock-btn unlock' : 'admin-lock-btn lock'}" onclick="toggleAccountLock('${account.id}')">
            ${account.status === 'locked' ? '<i class="fas fa-lock-open"></i> Mở khóa' : '<i class="fas fa-lock"></i> Khóa'}
          </button>
        </div>
      </td>
    </tr>`;
}

function _renderTableRows(accounts) {
  const tbody = document.getElementById('accountTableBody');
  if (!tbody) return;
  tbody.innerHTML = accounts.length === 0
    ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8">Không có tài khoản nào</td></tr>`
    : accounts.map(_makeAccountRow).join('');
}

function _appendTableRows(accounts) {
  const tbody = document.getElementById('accountTableBody');
  if (!tbody || !accounts.length) return;
  tbody.insertAdjacentHTML('beforeend', accounts.map(_makeAccountRow).join(''));
}

function _updateAccountFooter() {
  const shown = adminAccounts.length;
  const total = userTotalElements || shown;
  const loader = document.getElementById('userLoadingMore');
  if (loader) loader.style.display = 'none';
}

/** Gắn scroll listener trên wrap (chỉ gắn 1 lần, tự dọn khi skeleton mới) */
function _attachWrapScrollListener() {
  if (_userObserver) { _userObserver.disconnect(); _userObserver = null; }
  const wrap = document.querySelector('.admin-table-wrap');
  if (!wrap || wrap._scrollBound) return;

  wrap._scrollBound = true;
  wrap.addEventListener('scroll', function () {
    if (userIsLoading) return;
    if (userCurrentPage + 1 >= userTotalPages) return;
    // Chỉ trigger khi gần đáy (scroll xuống)
    if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 160) {
      _loadMoreAccounts();
    }
  });
}

/** Kiểm tra sau mỗi lần render: nếu wrap chưa tràn → tải thêm để lấp đầy */
function _checkAutoFill() {
  if (userIsLoading) return;
  if (userCurrentPage + 1 >= userTotalPages) return;
  const wrap = document.querySelector('.admin-table-wrap');
  if (!wrap) return;
  if (wrap.scrollHeight > wrap.clientHeight) return; // đã có scroll bar → dừng lại
  _loadMoreAccounts();
}

async function _loadMoreAccounts() {
  if (userIsLoading) return;
  if (userCurrentPage + 1 >= userTotalPages) return;
  const loader = document.getElementById('userLoadingMore');
  if (loader) loader.style.display = 'flex';
  await refreshUserList(userCurrentPage + 1);
}

// Load classes from admin API with pagination.
async function loadClassesFromApi(page = 0, size = classPageSize) {
  try {
    const params = new URLSearchParams({ page, size });
    const response = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/class?${params.toString()}`, { headers: {} });
    if (!response.ok) throw new Error('Lỗi tải danh sách lớp');
    const json = await response.json();

    let rawList, totalPages, totalElements, isLast, actualSize;

    // Trường hợp 1: Spring Page trong json.data → { data: { content:[], totalPages, totalElements, last, size } }
    if (json.data && !Array.isArray(json.data) && Array.isArray(json.data.content)) {
      rawList       = json.data.content;
      totalPages    = json.data.totalPages    ?? null;
      totalElements = json.data.totalElements ?? null;
      isLast        = json.data.last           ?? null;
      actualSize    = json.data.size           ?? json.data.pageable?.pageSize ?? size;
    }
    // Trường hợp 2: Spring Page ở root
    else if (Array.isArray(json.content)) {
      rawList       = json.content;
      totalPages    = json.totalPages    ?? null;
      totalElements = json.totalElements ?? null;
      isLast        = json.last           ?? null;
      actualSize    = json.size           ?? size;
    }
    // Trường hợp 3: Flat array trong json.data
    else {
      rawList       = Array.isArray(json.data) ? json.data : [];
      totalPages    = json.totalPages    ?? json.total_pages ?? null;
      totalElements = json.totalElements ?? json.total       ?? null;
      isLast        = null;
      actualSize    = size;
    }

    if (totalElements === null) totalElements = rawList.length;
    if (totalPages === null) {
      // Heuristic khi backend không trả totalPages
      totalPages = (isLast === false || rawList.length >= actualSize) ? page + 2 : page + 1;
    }

    const classes = rawList.map(c => {
      const classId = c.id || c.classId || '';
      const semesterRaw = (c.semester || '').toString();
      const semester = semesterRaw === '1' || semesterRaw.toUpperCase() === 'I' ? 'I' : (semesterRaw === '2' || semesterRaw.toUpperCase() === 'II' ? 'II' : semesterRaw.toUpperCase());
      const year = c.academicYear || c.year || '';
      return {
        classId: classId,
        className: c.className || c.name || '',
        subject: c.subject || '',
        semester: semester,
        year: year,
        roomNumber: c.roomNumber || c.room || c.roomName || c.location || c.roomNo || c['room_number'] || '',
        studentCount: getStoredStudentCount(classId, c.studentCount ?? c.totalStudent ?? 0),
        assignedTeacherId: c.assignedTeacherId || c.teacherId || '',
        assignedTeacherName: c.teacherName || c.assignedTeacherName || ''
      };
    });
    return { classes, totalPages: Math.max(1, totalPages), totalElements, actualSize };
  } catch (err) {
    console.error('Không tải được danh sách lớp:', err);
    return null;
  }
}

async function refreshClassList(page = 0) {
  if (classIsLoading) return;
  classIsLoading = true;

  const result = await loadClassesFromApi(page, classPageSize);
  classIsLoading = false;

  if (!result) return;

  // Nếu trang > 0 trả về rỗng → tự quay về trang trước
  if (result.classes.length === 0 && page > 0) {
    classTotalPages = page;
    await refreshClassList(page - 1);
    return;
  }

  classCurrentPage   = page;
  classTotalPages    = result.totalPages;
  classTotalElements = result.totalElements;
  // Đồng bộ pageSize thực tế từ BE (có thể khác giá trị mặc định)
  if (result.actualSize) classPageSize = result.actualSize;
  adminClasses = result.classes;
  sessionStorage.setItem('adminClasses', JSON.stringify(adminClasses));
  syncTeacherClassAssignments();
  populateClassSemesterFilter();
  renderClasses();
  renderAssignments();
}

function normalizeAdminAccount(account) {
  return {
    ...account,
    username: account.username || account.id.toLowerCase(),
    password: account.password || '123456',
    birthday: account.birthday || '1990-01-01',
    gender: account.gender || '',
    status: account.status || 'active'
  };
}

// Helper: normalize role string to 'admin' | 'teacher' | 'student' | ''
function normalizeRole(role) {
  if (!role) return '';
  const s = role.toString().toUpperCase();
  if (s === 'ADMIN' || s === 'ROLE_ADMIN') return 'admin';
  if (s === 'TEACHER' || s === 'ROLE_TEACHER') return 'teacher';
  if (s === 'STUDENT' || s === 'ROLE_STUDENT') return 'student';
  return s.toLowerCase();
}

// Kiểm tra quyền admin bằng cách đọc sessionStorage (nhanh, không cần gọi server).
async function checkAdminAccess() {
  const storedUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');

  if (!storedUser) {
    window.location.href = '/index.html';
    return null;
  }

  let sessionRole = sessionStorage.getItem('currentUserRole');

  // Nếu role không có trong sessionStorage (BE không trả trong body login),
  // thử lấy từ server qua cookie đã được set
  if (!sessionRole) {
    try {
      const profile = await AuthService.fetchProfile(storedUser.username || null);
      if (profile?.role) {
        sessionRole = profile.role; // fetchProfile đã lưu vào sessionStorage
      }
    } catch {}
  }

  if (normalizeRole(sessionRole) !== 'admin') {
    window.location.href = '/pages/home.html';
    return null;
  }
  return { ...storedUser, role: sessionRole };
}

function getStoredStudentCount(classId, fallback = 0) {
  const allStudents = JSON.parse(sessionStorage.getItem('classStudents') || '{}');
  if (Array.isArray(allStudents[classId])) {
    return allStudents[classId].length;
  }
  return fallback;
}

function getDefaultAdminAccounts() {
  // No default/local sample accounts — rely on server or sessionStorage
  return [];
}

function getDefaultAdminClasses() {
  // No default/local sample classes — rely on server or sessionStorage
  return [];
}

function getAdminAccounts() {
  const stored = JSON.parse(sessionStorage.getItem('adminAccounts') || 'null');
  const accounts = (Array.isArray(stored) ? stored : getDefaultAdminAccounts()).map(normalizeAdminAccount);
  sessionStorage.setItem('adminAccounts', JSON.stringify(accounts));
  return accounts;
}

// Return only active teachers for assignment dropdowns
function getActiveTeachers() {
  return adminAccounts.filter(acc =>
    (acc.role || '').toString().toLowerCase() === 'teacher' &&
    (acc.status || '').toString().toLowerCase() === 'active'
  );
}

function saveAdminAccounts(accounts) {
  adminAccounts = accounts.map(normalizeAdminAccount);
  sessionStorage.setItem('adminAccounts', JSON.stringify(adminAccounts));
}

function getAdminClasses() {
  const stored = JSON.parse(sessionStorage.getItem('adminClasses') || 'null');
  const classes = Array.isArray(stored) ? stored : getDefaultAdminClasses();
  const normalized = classes.map(cls => ({
    ...cls,
    semester: normalizeSemester(cls.semester || cls.semesterRaw || cls.semester),
    studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0),
    assignedTeacherId: cls.assignedTeacherId || '',
    assignedTeacherName: cls.assignedTeacherName || ''
  }));
  sessionStorage.setItem('adminClasses', JSON.stringify(normalized));
  return normalized;
}

function getSemesterLabelFromClass(cls) {
  const year = (cls.year || '').toString().split('-')[0] || '';
  const sem = (cls.semester || '').toString().toUpperCase() || '';
  return (year + sem).trim();
}

function formatRoom(room) {
  if (!room) return '';
  let r = room.toString().trim();
  // Remove leading words like 'Phòng', 'phòng', 'Room', etc., to avoid duplication
  r = r.replace(/^(Phòng|phòng|Room|room)\s*[:\-–]?\s*/i, '');
  return `Phòng ${r}`;
}

function normalizeSemester(s) {
  const sem = (s || '').toString().trim();
  if (!sem) return '';
  if (sem === '1' || sem.toUpperCase() === 'I') return 'I';
  if (sem === '2' || sem.toUpperCase() === 'II') return 'II';
  return sem.toUpperCase();
}

function populateClassSemesterFilter() {
  const selects = [
    document.getElementById('classSemesterFilter'),
    document.getElementById('assignmentSemesterFilter')
  ].filter(Boolean);
  if (!selects.length) return;
  const set = new Set();
  adminClasses.forEach(cls => {
    const label = getSemesterLabelFromClass(cls);
    if (label) set.add(label);
  });
  const options = Array.from(set).sort((a, b) => {
    const ya = parseInt(a.slice(0, 4)) || 0;
    const yb = parseInt(b.slice(0, 4)) || 0;
    if (ya === yb) return a.localeCompare(b);
    return yb - ya;
  });
  const html = '<option value="">Tất cả kỳ</option>' + options.map(o => `<option value="${o}">${o}</option>`).join('');
  selects.forEach(s => { s.innerHTML = html; });
}

function saveAdminClasses(classes) {
  adminClasses = classes.map(cls => ({
    ...cls,
    semester: normalizeSemester(cls.semester || cls.semesterRaw || cls.semester),
    studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0)
  }));
  sessionStorage.setItem('adminClasses', JSON.stringify(adminClasses));
  syncTeacherClassAssignments();
  populateClassSemesterFilter();
}

function syncTeacherClassAssignments() {
  const teachers = adminAccounts.filter(account => account.role === 'teacher');
  teachers.forEach(teacher => {
    const assignedClasses = teacher.status === 'active'
      ? adminClasses
      .filter(cls => cls.assignedTeacherId === teacher.id)
      .map(cls => ({
        classId: cls.classId,
        className: cls.className,
        subject: cls.subject,
        semester: cls.semester,
        year: cls.year,
        studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0),
        roomNumber: cls.roomNumber
      }))
      : [];
    sessionStorage.setItem(`classes_${teacher.id}`, JSON.stringify(assignedClasses));
  });
}

function openAdminPopup({ title, message, variant = 'info', confirmText = 'Đồng ý', cancelText = 'Hủy', showCancel = false, onConfirm = null, onCancel = null }) {
  const modal = document.getElementById('adminFeedbackModal');
  const icon = document.getElementById('adminFeedbackIcon');
  const titleNode = document.getElementById('adminFeedbackTitle');
  const messageNode = document.getElementById('adminFeedbackMessage');
  const actions = document.getElementById('adminFeedbackActions');
  const cancelButton = document.getElementById('adminFeedbackCancel');
  const confirmButton = document.getElementById('adminFeedbackConfirm');
  if (!modal || !icon || !titleNode || !messageNode || !actions || !cancelButton || !confirmButton) return;

  const iconMap = {
    info: 'fa-circle-info',
    success: 'fa-circle-check',
    warning: 'fa-triangle-exclamation',
    danger: 'fa-trash-can'
  };

  adminPopupConfirmHandler = onConfirm;
  adminPopupCancelHandler = onCancel;

  icon.className = `admin-feedback-icon ${variant}`;
  icon.innerHTML = `<i class="fas ${iconMap[variant] || iconMap.info}"></i>`;
  titleNode.textContent = title;
  messageNode.textContent = message;
  confirmButton.textContent = confirmText;
  cancelButton.textContent = cancelText;
  cancelButton.style.display = showCancel ? 'inline-flex' : 'none';
  actions.classList.toggle('single', !showCancel);
  confirmButton.className = `admin-primary-btn admin-feedback-confirm ${variant}`;
  modal.style.display = 'flex';
}

function closeAdminPopup() {
  const modal = document.getElementById('adminFeedbackModal');
  if (!modal) return;
  modal.style.display = 'none';
  adminPopupConfirmHandler = null;
  adminPopupCancelHandler = null;
}

function confirmAdminPopup() {
  const handler = adminPopupConfirmHandler;
  closeAdminPopup();
  if (typeof handler === 'function') {
    handler();
  }
}

function cancelAdminPopup() {
  const handler = adminPopupCancelHandler;
  closeAdminPopup();
  if (typeof handler === 'function') {
    handler();
  }
}

function showAdminNotice(title, message, variant = 'info') {
  openAdminPopup({ title, message, variant, confirmText: 'Đóng' });
}

function showAdminConfirm(title, message, onConfirm, options = {}) {
  openAdminPopup({
    title,
    message,
    variant: options.variant || 'warning',
    confirmText: options.confirmText || 'Đồng ý',
    cancelText: options.cancelText || 'Hủy',
    showCancel: true,
    onConfirm,
    onCancel: options.onCancel || null
  });
}

function getRoleLabel(role) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'Quản trị';
  if (r === 'teacher') return 'Giảng viên';
  if (r === 'student') return 'Sinh viên';
  return role;
}

function getStatusLabel(status) {
  return status === 'locked'
    ? '<i class="fas fa-lock" style="font-size:11px"></i> Tạm khóa'
    : '<i class="fas fa-circle-check" style="font-size:11px"></i> Hoạt động';
}

function avatarInitial(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const _avatarPalette = [
  '#DC143C','#16a34a','#2563eb','#d97706','#7c3aed','#0891b2','#db2777','#ea580c'
];
function avatarColor(name) {
  if (!name) return _avatarPalette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return _avatarPalette[Math.abs(hash) % _avatarPalette.length];
}

function formatBirthday(dateStr) {
  if (!dateStr) return '';
  // Hỗ trợ cả ISO (2005-03-11T...) lẫn yyyy-mm-dd
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
  document.querySelector(`.admin-nav-link[data-tab="${tabName}"]`)?.classList.add('active');

  if (tabName === 'accounts') renderAccounts();
  if (tabName === 'classes') renderClasses();
  if (tabName === 'assignments') renderAssignments();
  if (tabName === 'exams') renderExams();
}

function renderAccounts() {
  const container = document.getElementById('accountsContent');
  if (!container) return;
  if (!document.getElementById('accountTableBody')) {
    _renderAccountsSkeleton(container);
    // Lần đầu tạo skeleton → hiển thị số liệu đang có
    _updateSummaryCards();
  }
  // Không gọi _updateSummaryCards() ở đây — chỉ cập nhật tbody + footer
  _renderTableRows(adminAccounts);
  _updateAccountFooter();
  _attachWrapScrollListener();
  requestAnimationFrame(_checkAutoFill);
}

function _renderAccountsSkeleton(container) {
  container.innerHTML = `
    <div class="admin-summary-grid" id="accountSummaryGrid">
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-users"></i></div>
        <div class="admin-summary-value" id="summaryTotal">0</div>
        <div class="admin-summary-label">Tổng tài khoản</div>
      </div>
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-chalkboard-teacher"></i></div>
        <div class="admin-summary-value" id="summaryTeacher">0</div>
        <div class="admin-summary-label">Giảng viên</div>
      </div>
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-user-graduate"></i></div>
        <div class="admin-summary-value" id="summaryStudent">0</div>
        <div class="admin-summary-label">Sinh viên</div>
      </div>
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-lock"></i></div>
        <div class="admin-summary-value" id="summaryLocked">0</div>
        <div class="admin-summary-label">Tài khoản khóa</div>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Thành viên</th>
            <th>Username</th>
            <th>Vai trò</th>
            <th>Ngày sinh</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody id="accountTableBody"></tbody>
      </table>
      <div id="userLoadingMore" class="admin-loading-more" style="display:none;padding:12px;justify-content:center">
        <i class="fas fa-spinner fa-spin"></i>&nbsp; Đang tải thêm…
      </div>
    </div>

  `;
}

function renderClasses() {
  const container = document.getElementById('classesContent');
  if (!container) return;

  // Lọc theo tìm kiếm
  const searchValue = (document.getElementById('classSearchInput')?.value || '').toLowerCase();
  let filtered = adminClasses;
  if (searchValue) {
    filtered = adminClasses.filter(cls =>
      cls.className.toLowerCase().includes(searchValue) ||
      cls.classId.toLowerCase().includes(searchValue)
    );
  }

  // Lọc theo kỳ học (ví dụ: 2025I)
  const semesterFilter = (document.getElementById('classSemesterFilter')?.value || '').trim().toUpperCase();
  if (semesterFilter) {
    filtered = filtered.filter(cls => {
      const year = (cls.year || '').toString().split('-')[0] || '';
      const sem = (cls.semester || '').toString().toUpperCase() || '';
      const label = (year + sem).toUpperCase();
      return label === semesterFilter;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="admin-empty-state">Không tìm thấy lớp nào phù hợp.</div>${_buildClassPagination()}`;
    return;
  }

  const cards = filtered.map(cls => {
    const scount = getStoredStudentCount(cls.classId, cls.studentCount || 0);
    const deleteDisabled = scount > 0;
    const deleteBtnAttrs = deleteDisabled ? 'disabled title="Không thể xóa: lớp có sinh viên"' : `onclick="deleteClassAdmin('${cls.classId}')"`;
    const deleteBtnLabel = deleteDisabled ? 'Không thể xóa' : 'Xóa lớp';

    return `
        <div class="admin-class-card">
          <div class="admin-class-top">
            <div>
              <div class="admin-class-title">${cls.className}</div>
                <div class="admin-class-subtitle">Mã lớp: ${cls.classId}</div>
            </div>
            <span class="admin-assigned-badge">${scount} SV</span>
          </div>
          <div class="admin-class-meta">
              <span><i class="fas fa-calendar-alt"></i> Năm học: ${cls.year}</span>
              <span><i class="fas fa-clock"></i> Học kỳ: ${cls.semester || ''}</span>
              <span><i class="fas fa-door-open"></i> ${formatRoom(cls.roomNumber)}</span>
            <span><i class="fas fa-users"></i> Sinh viên: ${scount}</span>
            ${cls.assignedTeacherName ? `<span><i class="fas fa-user-tie"></i> Giảng viên: ${cls.assignedTeacherName}</span>` : ''}
          </div>
          <div class="admin-class-actions">
            <button class="admin-update-btn" onclick="openEditClassModal('${cls.classId}')"><i class="fas fa-edit"></i> Cập nhật lớp</button>
            <button class="admin-secondary-btn" onclick="openStudentManagerPage('${cls.classId}')"><i class="fas fa-users"></i> Quản lý sinh viên</button>
            <button class="admin-delete-btn ${deleteDisabled ? 'disabled' : ''}" ${deleteBtnAttrs}>${deleteBtnLabel}</button>
          </div>
        </div>
    `;
  });

  container.innerHTML = `<div class="admin-class-grid">${cards.join('')}</div>${_buildClassPagination()}`;
}

function _buildClassPagination() {
  const total = classTotalElements;
  if (total === 0 && classCurrentPage === 0 && classTotalPages <= 1) return '';

  const start = classCurrentPage * classPageSize + 1;
  const end   = Math.min(start + adminClasses.length - 1, total || (start + adminClasses.length - 1));
  const isLastPage = classCurrentPage + 1 >= classTotalPages;

  let btns = '';
  // Nút Trước
  btns += `<button class="admin-page-btn" onclick="refreshClassList(${classCurrentPage - 1})" ${classCurrentPage === 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  // Số trang (hiển thị tối đa 7 nút, dùng ellipsis cho phần còn lại)
  const winSize = 2;
  for (let i = 0; i < classTotalPages; i++) {
    const showBtn = i === 0 || i === classTotalPages - 1 ||
                    (i >= classCurrentPage - winSize && i <= classCurrentPage + winSize);
    const showEllipsis = i === classCurrentPage - winSize - 1 || i === classCurrentPage + winSize + 1;
    if (showBtn) {
      btns += `<button class="admin-page-btn${i === classCurrentPage ? ' active' : ''}" onclick="refreshClassList(${i})">${i + 1}</button>`;
    } else if (showEllipsis) {
      btns += `<span class="admin-page-ellipsis">…</span>`;
    }
  }

  // Nút Sau
  btns += `<button class="admin-page-btn" onclick="refreshClassList(${classCurrentPage + 1})" ${isLastPage ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

  const infoText = total > 0
    ? `Hiển thị ${start}–${end} trong tổng số ${total} lớp`
    : `Trang ${classCurrentPage + 1} / ${classTotalPages}`;

  return `
    <div class="admin-pagination">
      <span class="admin-page-info">${infoText}</span>
      <div class="admin-page-controls">${btns}</div>
    </div>`;
}

async function renderAssignments() {
  const container = document.getElementById('assignmentsContent');
  if (!container) return;

  // Lọc theo tìm kiếm
  const searchValue = (document.getElementById('assignmentSearchInput')?.value || '').toLowerCase();
  let filtered = adminClasses;
  if (searchValue) {
    filtered = adminClasses.filter(cls =>
      cls.className.toLowerCase().includes(searchValue) ||
      cls.classId.toLowerCase().includes(searchValue) ||
      (cls.assignedTeacherName || '').toLowerCase().includes(searchValue)
    );
  }

  // Lọc theo kỳ học (assignment filter)
  const assignmentSemester = (document.getElementById('assignmentSemesterFilter')?.value || '').trim().toUpperCase();
  if (assignmentSemester) {
    filtered = filtered.filter(cls => {
      const year = (cls.year || '').toString().split('-')[0] || '';
      const sem = (cls.semester || '').toString().toUpperCase() || '';
      const label = (year + sem).toUpperCase();
      return label === assignmentSemester;
    });
  }

  // Prefer remote teacher list if available (non-paginated endpoint), fallback to local adminAccounts
  let teachers = getActiveTeachers();
  try {
    const remote = await loadTeacherListFromApi();
    if (Array.isArray(remote) && remote.length) {
      teachers = remote.filter(t => (t.status || 'active').toString().toLowerCase() === 'active');
    }
  } catch (err) {
    console.warn('loadTeacherListFromApi failed', err);
  }
  if (filtered.length === 0) {
    container.innerHTML = `<div class="admin-empty-state">Không tìm thấy lớp nào phù hợp.</div>${_buildClassPagination()}`;
    return;
  }

  let html = '<div class="admin-assignment-grid">';
  for (const cls of filtered) {
    const assignedId = cls.assignedTeacherId || '';
    const assignedName = cls.assignedTeacherName || '';
    const assignedInActive = assignedId && teachers.some(t => t.id === assignedId);

    // Build options: if there is an assigned teacher but they're not in active list, show a top disabled option
    let options = '';
    if (assignedName && (!assignedId || !assignedInActive)) {
      // if no id, use a name-sentinel value so we can detect it on save
      const value = assignedId || `__name:${encodeURIComponent(assignedName)}`;
      const note = assignedId ? ' (Không hoạt động)' : ' (Đã phân công)';
      // Show the assigned teacher as a selectable option (not disabled) so it appears in the dropdown
      options += `<option value="${value}" selected>${assignedName}${note}</option>`;
    }
    options += '<option value="">Chưa phân công</option>';
    options += teachers.map(teacher => `<option value="${teacher.id}" ${teacher.id === assignedId ? 'selected' : ''}>${teacher.name} (${teacher.id})</option>`).join('');

    html += `
      <div class="admin-assignment-card">
        <div class="admin-assignment-top">
          <div>
            <div class="admin-assignment-title">${cls.className}</div>
            <div class="admin-assignment-subtitle">Mã lớp: ${cls.classId}</div>
          </div>
          <span class="admin-assigned-badge">${getStoredStudentCount(cls.classId, cls.studentCount || 0)} SV</span>
        </div>
        <div class="admin-class-meta">
          <span><i class="fas fa-calendar-alt"></i> Năm học: ${cls.year}</span>
          <span><i class="fas fa-clock"></i> Học kỳ: ${cls.semester || ''}</span>
          <span><i class="fas fa-door-open"></i> ${formatRoom(cls.roomNumber)}</span>
          <span><i class="fas fa-users"></i> Sinh viên: ${getStoredStudentCount(cls.classId, cls.studentCount || 0)}</span>
          ${cls.assignedTeacherName ? `<span><i class="fas fa-user-tie"></i> Giảng viên: ${cls.assignedTeacherName}</span>` : ''}
        </div>
        <select class="admin-assignment-select" id="assignTeacher-${cls.classId}">
          ${options}
        </select>
        <button class="admin-assign-btn" onclick="saveAssignment('${cls.classId}')">Lưu phân công</button>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html + _buildClassPagination();
}

function populateClassDropdown() {
  const select = document.getElementById('accountClass');
  if (!select) return;
  select.innerHTML = '<option value="">-- Chọn lớp --</option>';
  adminClasses.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls.classId;
    opt.textContent = cls.className;
    select.appendChild(opt);
  });
}

function toggleClassField() {
  const role = document.getElementById('accountRole')?.value;
  const row = document.getElementById('accountClassRow');
  const select = document.getElementById('accountClass');
  if (!row) return;
  if (role === 'student') {
    row.style.display = '';
    if (select) select.required = true;
  } else {
    row.style.display = 'none';
    if (select) { select.required = false; select.value = ''; }
  }
}

async function uploadAvatarToCloud(id, saveToUser = true) {
  const input = document.getElementById('accountAvatar');
  const file = input && input.files && input.files[0];
  if (!file) return null;
  const formData = new FormData();
  formData.append('id', id);
  formData.append('file', file);
  const response = await fetch('http://103.75.182.246:8080/public/upload-avatar', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || `Lỗi upload ảnh (${response.status})`);
  }
  const json = await response.json();
  const imageUrl = json?.data?.imageUrl || null;
  if (imageUrl && saveToUser) {
    // Gán avatar vào user (chỉ dùng khi cập nhật user đã tồn tại)
    const saveRes = await fetchWithAuth(`http://103.75.182.246:8080/public/upload/avatar/${id}`, {
      method: 'POST',
      body: JSON.stringify(imageUrl)
    });
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => null);
      throw new Error(err?.message || `Lỗi lưu avatar (${saveRes.status})`);
    }
  }
  return imageUrl;
}

function previewAccountAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('accountAvatarPreview');
    preview.innerHTML = `<img src="${e.target.result}" alt="avatar">`;
  };
  reader.readAsDataURL(file);
}

function openAccountModal() {
  const form = document.getElementById('accountForm');
  if (form) form.reset();
  const avatarPreview = document.getElementById('accountAvatarPreview');
  if (avatarPreview) avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
  const idInput = document.getElementById('accountId');
  if (idInput) idInput.readOnly = false;
  const usernameInput = document.getElementById('accountUsername');
  if (usernameInput) usernameInput.readOnly = false;
  // Hiện trường mật khẩu khi thêm mới
  const pwRow = document.getElementById('accountPasswordRow');
  const pwInput = document.getElementById('accountPassword');
  if (pwRow) pwRow.style.display = '';
  if (pwInput) { pwInput.required = true; pwInput.value = ''; }
  document.getElementById('accountModal').style.display = 'flex';
  const titleEl = document.getElementById('accountModalTitle');
  if (titleEl) titleEl.textContent = 'Thêm tài khoản';
  // Reset status to active
  const statusInput = document.getElementById('accountStatus');
  if (statusInput) statusInput.value = 'active';
  // Populate and hide class field
  populateClassDropdown();
  toggleClassField();
  // Attach role change listener
  const roleSelect = document.getElementById('accountRole');
  if (roleSelect) {
    roleSelect.onchange = toggleClassField;
  }
}

function closeAccountModal() {
  document.getElementById('accountModal').style.display = 'none';
}

function openClassModal() {
  const modal = document.getElementById('classModal');
  document.getElementById('classForm')?.reset();
  if (modal) {
    delete modal.dataset.editing;
    modal.style.display = 'flex';
    const header = modal.querySelector('.admin-modal-header h3');
    if (header) header.textContent = 'Thêm lớp học';
    const submit = modal.querySelector('#classForm .admin-primary-btn');
    if (submit) submit.textContent = 'Lưu lớp';
    const idInput = document.getElementById('adminClassId');
    if (idInput) idInput.readOnly = false;
  }
}

function closeClassModal() {
  const modal = document.getElementById('classModal');
  if (!modal) return;
  modal.style.display = 'none';
  delete modal.dataset.editing;
  const header = modal.querySelector('.admin-modal-header h3');
  if (header) header.textContent = 'Thêm lớp học';
  const submit = modal.querySelector('#classForm .admin-primary-btn');
  if (submit) submit.textContent = 'Lưu lớp';
  const idInput = document.getElementById('adminClassId');
  if (idInput) idInput.readOnly = false;
}

function openEditClassModal(classId) {
  const cls = adminClasses.find(c => c.classId === classId);
  if (!cls) {
    showAdminNotice('Lỗi', 'Lớp không tồn tại.', 'danger');
    return;
  }
  const modal = document.getElementById('classModal');
  if (!modal) return;
  modal.dataset.editing = classId;
  document.getElementById('adminClassId').value = cls.classId;
  document.getElementById('adminClassName').value = cls.className || '';
  document.getElementById('adminClassRoom').value = cls.roomNumber || '';
  document.getElementById('adminClassSemester').value = cls.semester || 'I';
  document.getElementById('adminClassYear').value = cls.year || '';
  const header = modal.querySelector('.admin-modal-header h3');
  if (header) header.textContent = 'Cập nhật lớp học';
  const submit = modal.querySelector('#classForm .admin-primary-btn');
  if (submit) submit.textContent = 'Cập nhật lớp';
  const idInput = document.getElementById('adminClassId');
  if (idInput) idInput.readOnly = true;
  modal.style.display = 'flex';
}

function openStudentManagerPage(classId) {
  window.location.href = `/pages/admin-students.html?classId=${encodeURIComponent(classId)}`;
}
async function addAccount(event) {
  event.preventDefault();
  const idEl = document.getElementById('accountId');
  const nameEl = document.getElementById('accountName');
  const usernameEl = document.getElementById('accountUsername');
  const roleEl = document.getElementById('accountRole');
  const passwordEl = document.getElementById('accountPassword');
  const birthdayEl = document.getElementById('accountBirthday');
  const emailEl = document.getElementById('accountEmail');
  const genderEl = document.getElementById('accountGender');
  const statusEl = document.getElementById('accountStatus');

  const id = (idEl?.value || '').trim();
  const name = (nameEl?.value || '').trim();
  const username = (usernameEl?.value || '').trim();
  const role = (roleEl?.value || '');
  const password = (passwordEl?.value || '').trim();
  const birthday = (birthdayEl?.value || '');
  const email = (emailEl?.value || '').trim();
  const gender = (genderEl?.value || '');
  const status = (statusEl?.value || '');
  // Class selection removed from account creation; do not include classID in payload

  // Clear previous invalid markers
  [idEl, nameEl, usernameEl, passwordEl, birthdayEl, emailEl].forEach(el => { if (el) el.classList.remove('invalid'); });

  if (!id || !name || !username || !password || !birthday || !email) {
    showAdminNotice('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin tài khoản.', 'warning');
    return;
  }
  if (password.length < 6) {
    showAdminNotice('Mật khẩu chưa hợp lệ', 'Mật khẩu phải có ít nhất 6 ký tự.', 'warning');
    return;
  }

  // Prevent creating an account with an ID that already exists locally
  if (adminAccounts.some(acc => (acc.id || '').toLowerCase() === id.toLowerCase())) {
    if (idEl) idEl.classList.add('invalid');
    showAdminNotice('Mã đã tồn tại', 'Mã tài khoản này đã tồn tại. Vui lòng chọn mã khác hoặc chuyển sang Cập nhật.', 'warning');
    return;
  }

  // New: Prevent creating account with duplicate email locally
  if (adminAccounts.some(acc => (acc.email || '').toLowerCase() === email.toLowerCase())) {
    if (emailEl) emailEl.classList.add('invalid');
    showAdminNotice('Email đã tồn tại', 'Email này đã được sử dụng bởi tài khoản khác.', 'warning');
    return;
  }

  const submitBtn = event.target.querySelector('[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang lưu...'; }

  try {
    // Truyền saveToUser = false vì user chưa tồn tại, avatarImage sẽ được gửi trong payload tạo mới
    const avatarImage = await uploadAvatarToCloud(id, false);
    const payload = {
      id,
      fullName: name,
      username,
      password,
      role: role.toUpperCase(),
      birthday,
      email,
      gender: (gender || 'MALE').toUpperCase(),
      statusType: status === 'active' ? 'ACTIVE' : 'LOCKED',
      ...(avatarImage ? { avatarImage } : {})
    };

    const response = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/user/create`, {
      method: 'POST',
      headers: {},
      body: JSON.stringify(payload)
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = json?.message || `Lỗi ${response.status}`;
      const lower = (msg || '').toString().toLowerCase();
      if (lower.includes('email') && (lower.includes('exist') || lower.includes('duplicate') || lower.includes('trùng') || lower.includes('đã tồn tại'))) {
        if (emailEl) emailEl.classList.add('invalid');
        throw new Error('Email đã tồn tại. Vui lòng dùng email khác.');
      }
      throw new Error(msg);
    }

    // Reload danh sách từ API (về trang đầu sau khi thêm mới)
    syncTeacherClassAssignments();
    closeAccountModal();
    await refreshUserList(0);
    renderAssignments();
    showAdminNotice('Thêm thành công', `Đã thêm tài khoản ${id}.`, 'success');
  } catch (err) {
    const message = err?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
    showAdminNotice('Thêm thất bại', message, 'danger');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu tài khoản'; }
  }
}

async function addClass(event) {
  event.preventDefault();
  const modal = document.getElementById('classModal');
  const editingId = modal?.dataset.editing || '';
  const classIdEl = document.getElementById('adminClassId');
  const classNameEl = document.getElementById('adminClassName');
  const roomNumberEl = document.getElementById('adminClassRoom');
  const semesterEl = document.getElementById('adminClassSemester');
  const yearEl = document.getElementById('adminClassYear');

  const classId = (classIdEl?.value || '').trim();
  const className = (classNameEl?.value || '').trim();
  const roomNumber = (roomNumberEl?.value || '').trim();
  const semester = (semesterEl?.value || 'I');
  const year = (yearEl?.value || '').trim();

  // Clear previous invalid markers
  [classIdEl, classNameEl, roomNumberEl, yearEl].forEach(el => { if (el) el.classList.remove('invalid'); });

  // Validate and mark empty fields with visual error
  let hasInvalid = false;
  if (!classId) { classIdEl && classIdEl.classList.add('invalid'); hasInvalid = true; }
  if (!className) { classNameEl && classNameEl.classList.add('invalid'); hasInvalid = true; }
  if (!roomNumber) { roomNumberEl && roomNumberEl.classList.add('invalid'); hasInvalid = true; }
  if (!year) { yearEl && yearEl.classList.add('invalid'); hasInvalid = true; }
  if (hasInvalid) {
    showAdminNotice('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin lớp học.', 'warning');
    return;
  }

  const submitBtn = event?.target?.querySelector('[type="submit"]') || modal?.querySelector('.admin-primary-btn');

  // Editing existing class
  if (editingId) {
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang cập nhật...'; }

    const semPayload = (semester || '').toString().toUpperCase() === 'I' ? '1' : (semester || '').toString().toUpperCase() === 'II' ? '2' : (semester || '');
    const payload = { className: className, semester: semPayload, academicYear: year, roomNumber: roomNumber };

    try {
      const response = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/class/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        headers: {},
        body: JSON.stringify(payload)
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message || `Lỗi ${response.status}`);

      const data = json?.data || json || {};
      const mappedSemester = (data?.semester === '1' || (data?.semester || '').toString().toUpperCase() === 'I') ? 'I' : (data?.semester === '2' || (data?.semester || '').toString().toUpperCase() === 'II') ? 'II' : (semester || '');
      const mappedYear = data?.academicYear || data?.year || year;
      const mappedRoom = data?.roomNumber || data?.roomName || roomNumber;

      saveAdminClasses(adminClasses.map(c => c.classId === editingId ? {
        ...c,
        classId: data?.id || editingId,
        className: data?.className || className,
        semester: mappedSemester,
        year: mappedYear,
        roomNumber: mappedRoom,
        assignedTeacherId: data?.teacherId || c.assignedTeacherId,
        assignedTeacherName: data?.teacherName || c.assignedTeacherName
      } : c));

      closeClassModal();
      renderClasses();
      renderAssignments();
      showAdminNotice('Cập nhật thành công', json?.message || `Đã cập nhật lớp ${className}.`, 'success');
      return;
    } catch (err) {
      saveAdminClasses(adminClasses.map(c => c.classId === editingId ? { ...c, className, semester, year, roomNumber } : c));
      closeClassModal();
      renderClasses();
      renderAssignments();
      showAdminNotice('Cập nhật (offline)', err?.message || 'Không thể cập nhật lên server, đã lưu cục bộ.', 'warning');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Cập nhật lớp'; }
      return;
    }
  }

  // Create new class
  if (adminClasses.some(cls => cls.classId.toLowerCase() === classId.toLowerCase())) {
    if (classIdEl) classIdEl.classList.add('invalid');
    showAdminNotice('Trùng mã lớp', 'Mã lớp đã tồn tại.', 'warning');
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang lưu...'; }

  const semPayloadCreate = (semester || '').toString().toUpperCase() === 'I' ? '1' : (semester || '').toString().toUpperCase() === 'II' ? '2' : (semester || '');
  const payloadCreate = { id: classId, className: className, semester: semPayloadCreate, academicYear: year, roomNumber: roomNumber, teacherId: null };

  try {
    const res = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/class`, { method: 'POST', headers: {}, body: JSON.stringify(payloadCreate) });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.message || `Lỗi ${res.status}`);

    const data = json?.data || json || {};
    const mappedSemesterCreate = (data?.semester === '1' || (data?.semester || '').toString().toUpperCase() === 'I' || (data?.semester || '').toString().includes('1')) ? 'I' : (data?.semester === '2' || (data?.semester || '').toString().toUpperCase() === 'II' || (data?.semester || '').toString().includes('2')) ? 'II' : (semester || '');

    const createdClass = {
      classId: data?.id || classId,
      className: data?.className || className,
      semester: mappedSemesterCreate,
      year: data?.academicYear || data?.year || year,
      roomNumber: data?.roomNumber || data?.roomName || roomNumber,
      studentCount: data?.studentCount || 0,
      assignedTeacherId: data?.teacherId || data?.assignedTeacherId || '',
      assignedTeacherName: data?.teacherName || data?.assignedTeacherName || ''
    };

    saveAdminClasses([createdClass, ...adminClasses]);
    closeClassModal();
    renderClasses();
    renderAssignments();
    showAdminNotice('Thêm thành công', json?.message || `Đã tạo lớp ${createdClass.className}.`, 'success');
  } catch (err) {
    const newClass = { classId, className, semester, year, roomNumber, studentCount: 0, assignedTeacherId: '', assignedTeacherName: '' };
    saveAdminClasses([newClass, ...adminClasses]);
    closeClassModal();
    renderClasses();
    renderAssignments();
    showAdminNotice('Tạo (offline)', err?.message || 'Không thể tạo lớp trên server, đã lưu cục bộ.', 'warning');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu lớp'; }
  }
}

function deleteAccount(accountId) {
  const target = adminAccounts.find(account => account.id === accountId);
  if (!target) return;
  if (target.id === (adminUser.id || adminUser.studentId)) {
    showAdminNotice('Không thể xóa', 'Không thể xóa tài khoản admin đang đăng nhập.', 'warning');
    return;
  }
  showAdminConfirm(
    'Xóa tài khoản',
    `Bạn có chắc chắn muốn xóa tài khoản ${target.name} (${target.id})?`,
    () => {
      saveAdminAccounts(adminAccounts.filter(account => account.id !== accountId));
      if (target.role === 'teacher') {
        saveAdminClasses(adminClasses.map(cls => cls.assignedTeacherId === accountId
          ? { ...cls, assignedTeacherId: '', assignedTeacherName: '' }
          : cls));
        sessionStorage.removeItem(`classes_${accountId}`);
      }
      renderAccounts();
      renderAssignments();
      renderClasses();
      showAdminNotice('Xóa thành công', `Đã xóa tài khoản ${accountId}.`, 'success');
    },
    { confirmText: 'Xóa', variant: 'danger' }
  );
}

function toggleAccountLock(accountId) {
  const target = adminAccounts.find(account => account.id === accountId);
  if (!target) return;
  if (target.id === (adminUser.id || adminUser.studentId)) {
    showAdminNotice('Không thể cập nhật', 'Không thể khóa tài khoản admin đang đăng nhập.', 'warning');
    return;
  }

  const nextStatus = target.status === 'locked' ? 'active' : 'locked';
  showAdminConfirm(
    nextStatus === 'locked' ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
    nextStatus === 'locked'
      ? `Bạn có chắc chắn muốn khóa tài khoản ${accountId}?`
      : `Bạn có chắc chắn muốn mở khóa tài khoản ${accountId}?`,
    async () => {
      try {
        const apiAction = nextStatus === 'locked' ? 'lock-user' : 'unlock-user';
        const url = `${API_CONFIG.ADMIN_BASE_URL}/${apiAction}/${encodeURIComponent(accountId)}`;
        const payload = {
          fullName: target.name || target.fullName || '',
          password: target.password || undefined,
          role: (target.role || '').toUpperCase(),
          birthday: target.birthday || undefined,
          email: target.email || undefined,
          gender: (target.gender || '').toUpperCase() || undefined,
          statusType: nextStatus === 'locked' ? 'LOCKED' : 'ACTIVE'
        };

        const response = await fetchWithAuth(url, {
          method: 'PUT',
          headers: {},
          body: JSON.stringify(payload)
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(json?.message || `Lỗi ${response.status}`);
        }

        // If API returns updated user data, use it; otherwise fallback to toggling status
        const updated = json?.data || null;
        if (updated && updated.id) {
          const mappedStatus = (updated.status || '').toUpperCase() === 'ACTIVE' ? 'active' : 'locked';
          saveAdminAccounts(adminAccounts.map(account => account.id === accountId
            ? { ...account, status: mappedStatus, name: updated.fullName || account.name, email: updated.email || account.email }
            : account
          ));
        } else {
          saveAdminAccounts(adminAccounts.map(account => account.id === accountId
            ? { ...account, status: nextStatus }
            : account));
        }

        syncTeacherClassAssignments();
        renderAccounts();
        renderAssignments();
        showAdminNotice(
          'Cập nhật thành công',
          json?.message || (nextStatus === 'locked' ? `Đã khóa tài khoản ${accountId}.` : `Đã mở khóa tài khoản ${accountId}.`),
          'success'
        );
      } catch (err) {
        showAdminNotice('Cập nhật thất bại', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.', 'danger');
      }
    },
    { confirmText: 'Xác nhận', variant: 'warning' }
  );
}

function deleteClassAdmin(classId) {
  const target = adminClasses.find(cls => cls.classId === classId);
  if (!target) return;

  const scount = getStoredStudentCount(classId, target.studentCount || 0);
  if (scount > 0) {
    showAdminNotice('Không thể xóa', 'Lớp đang có sinh viên, không thể xóa.', 'warning');
    return;
  }

  showAdminConfirm(
    'Xóa lớp',
    `Bạn có chắc chắn muốn xóa lớp ${target.className}?`,
    async () => {
      try {
        const response = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/class/${encodeURIComponent(classId)}`, {
          method: 'DELETE',
          headers: {}
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.message || `Lỗi ${response.status}`);

        saveAdminClasses(adminClasses.filter(cls => cls.classId !== classId));
        renderClasses();
        renderAssignments();
        showAdminNotice('Xóa thành công', json?.message || `Đã xóa lớp ${target.className}.`, 'success');
      } catch (err) {
        showAdminNotice('Xóa thất bại', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.', 'danger');
      }
    },
    { confirmText: 'Xóa', variant: 'danger' }
  );
}

async function saveAssignment(classId) {
  const select = document.getElementById(`assignTeacher-${classId}`);
  const teacherId = select ? select.value : '';
  const cls = adminClasses.find(c => c.classId === classId);
  // Load active teachers from remote endpoint if available, otherwise fallback to local cached accounts
  let activeTeachers = getActiveTeachers();
  try {
    const remote = await loadTeacherListFromApi();
    if (Array.isArray(remote) && remote.length) {
      activeTeachers = remote.filter(t => (t.status || 'active').toString().toLowerCase() === 'active');
    }
  } catch (err) {
    console.warn('loadTeacherListFromApi failed', err);
  }

  if (!cls) {
    showAdminNotice('Lỗi', 'Lớp không tồn tại.', 'danger');
    return;
  }

  // If selected is a name-sentinel (teacher name provided by API without id), keep existing assignment
  if (teacherId && teacherId.startsWith('__name:')) {
    showAdminNotice('Không thay đổi', 'Giữ nguyên phân công hiện tại.', 'info');
    return;
  }

  // Prepare payload
  const payload = { idClass: classId, idTeacher: teacherId || null };

  try {
    const response = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/class`, {
      method: 'PUT',
      headers: {},
      body: JSON.stringify(payload)
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(json?.message || `Lỗi ${response.status}`);
    }

    const data = json?.data || null;
    if (data && data.id) {
      // Map API response to local class structure
      const updatedClassId = data.id || classId;
      const mappedSemester = data.semester === '1' ? 'I' : data.semester === '2' ? 'II' : (data.semester || cls.semester);
      const mappedYear = data.academicYear || data.year || cls.year;
      const mappedRoom = data.roomNumber || cls.roomNumber;
      const mappedTeacherId = data.teacherId || payload.idTeacher || '';
      const mappedTeacherName = data.teacherName || '';

      saveAdminClasses(adminClasses.map(c => c.classId === updatedClassId
        ? {
            ...c,
            semester: mappedSemester,
            year: mappedYear,
            roomNumber: mappedRoom,
            assignedTeacherId: mappedTeacherId,
            assignedTeacherName: mappedTeacherName
          }
        : c
      ));
    } else {
      // Fallback local update when API doesn't return data
      if (!teacherId) {
        saveAdminClasses(adminClasses.map(c => c.classId === classId ? { ...c, assignedTeacherId: '', assignedTeacherName: '' } : c));
      } else {
        const teacher = activeTeachers.find(t => t.id === teacherId) || { id: teacherId, name: '' };
        saveAdminClasses(adminClasses.map(c => c.classId === classId ? { ...c, assignedTeacherId: teacher.id, assignedTeacherName: teacher.name } : c));
      }
    }

    renderAssignments();
    renderClasses();
    showAdminNotice('Cập nhật thành công', json?.message || (teacherId ? 'Đã phân công giảng viên.' : 'Đã hủy phân công.'), 'success');
  } catch (err) {
    showAdminNotice('Cập nhật thất bại', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.', 'danger');
  }
}

function handleAdminLogout() {
  showAdminConfirm(
    'Xác nhận đăng xuất',
    'Bạn có chắc chắn muốn thoát khỏi trang quản trị?',
    () => { AuthService.logout(); },
    { confirmText: 'Đăng xuất', variant: 'warning' }
  );
}

function attachAdminEvents() {
      // Sự kiện nhập lớp từ Excel
      const importClassBtn = document.getElementById('importClassExcelBtn');
      const classFileInput = document.getElementById('classExcelFileInput');
      if (importClassBtn && classFileInput) {
        importClassBtn.addEventListener('click', () => classFileInput.click());
        classFileInput.addEventListener('change', handleClassExcelImport);
      }

      // Tải mẫu Excel tài khoản
      document.getElementById('downloadAccountTemplateBtn')?.addEventListener('click', () => {
        const headers = ['ID', 'Họ và tên', 'Username', 'Mật khẩu', 'Vai trò (TEACHER/STUDENT/ADMIN)', 'Ngày sinh (yyyy-MM-dd)', 'Email', 'Giới tính (MALE/FEMALE)', 'Trạng thái (ACTIVE/LOCKED)'];
        const sample = ['GV001', 'Nguyễn Văn A', 'nguyenvana', 'Password@123', 'TEACHER', '1990-01-15', 'gv001@hactech.edu.vn', 'MALE', 'ACTIVE'];
        const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
        ws['!cols'] = headers.map(() => ({ wch: 28 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TaiKhoan');
        XLSX.writeFile(wb, 'mau_import_taikhoan.xlsx');
      });

      // Tải mẫu Excel lớp học
      document.getElementById('downloadClassTemplateBtn')?.addEventListener('click', () => {
        const headers = ['Mã lớp', 'Tên lớp', 'Học kỳ (I/II)', 'Năm học', 'Phòng học'];
        const sample = ['QS01', 'Lớp Quân sự 1', 'I', '2024-2025', '101'];
        const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
        ws['!cols'] = headers.map(() => ({ wch: 22 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'LopHoc');
        XLSX.writeFile(wb, 'mau_import_lophoc.xlsx');
      });

    // Xử lý nhập lớp từ Excel — upload lên server `/admin/import-classes`, fallback về xử lý client-side
    async function handleClassExcelImport(e) {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      const importUrl = API_CONFIG.ENDPOINTS.IMPORT_CLASSES;

      // Thử upload lên server trước
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetchWithAuth(importUrl, { method: 'POST', body: formData });
        const json = await res.json().catch(() => null);

        if (res.ok) {
          // Reload danh sách lớp từ server
          const apiClasses = await loadClassesFromApi();
          if (apiClasses && Array.isArray(apiClasses.classes)) {
            adminClasses = apiClasses.classes;
            sessionStorage.setItem('adminClasses', JSON.stringify(adminClasses));
            syncTeacherClassAssignments();
            populateClassSemesterFilter();
          }
          renderClasses();
          renderAssignments();
          showAdminNotice('Nhập thành công', json?.message || 'Đã nhập lớp từ Excel (server).', 'success');
          return;
        }
        const rowErrors = Array.isArray(json?.data) ? json.data : [];
        const detail = rowErrors.length
          ? rowErrors.join('\n')
          : (json?.message || `Server trả lỗi ${res.status}`);
        throw new Error(detail);
      } catch (err) {
        console.warn('Server import-classes failed:', err);
        showAdminNotice('Lỗi import lên server', err?.message || 'Không thể import lên server. Kiểm tra lại.', 'danger');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function(evt) {
        const data = evt.target.result;
        let workbook;
        try {
          workbook = XLSX.read(data, { type: 'binary' });
        } catch (err) {
          showAdminNotice('Lỗi file', 'Không đọc được file Excel.', 'danger');
          return;
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!rows.length) {
          showAdminNotice('File rỗng', 'Không có dữ liệu trong file.', 'warning');
          return;
        }
        // Các trường: classId, className, semester, year, roomNumber
        const newClasses = [];
        for (const row of rows) {
          const classId = (row['classId'] || row['Mã lớp'] || '').toString().trim();
          const className = (row['className'] || row['Tên lớp'] || '').toString().trim();
          const semester = (row['semester'] || row['Học kỳ'] || '').toString().trim();
          const year = (row['year'] || row['Năm học'] || '').toString().trim();
          const roomNumber = (row['roomNumber'] || row['Phòng học'] || '').toString().trim();
          if (!classId || !className || !semester || !year || !roomNumber) continue;
          if (adminClasses.some(cls => cls.classId.toLowerCase() === classId.toLowerCase())) continue;
          newClasses.push({ classId, className, semester, year, roomNumber, studentCount: 0, assignedTeacherId: '', assignedTeacherName: '' });
        }
        if (!newClasses.length) {
          showAdminNotice('Không có lớp mới', 'Tất cả lớp trong file đã tồn tại hoặc thiếu thông tin.', 'warning');
          return;
        }
        saveAdminClasses([...newClasses, ...adminClasses]);
        renderClasses();
        renderAssignments();
        showAdminNotice('Nhập thành công', `Đã thêm ${newClasses.length} lớp từ Excel.`, 'success');
      };
      reader.readAsBinaryString(file);
    }
    // Sự kiện nhập từ Excel
    const importBtn = document.getElementById('importExcelBtn');
    const fileInput = document.getElementById('excelFileInput');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', handleExcelImport);
    }

  // Xử lý nhập tài khoản từ Excel — upload lên server `/admin/import`, fallback về xử lý client-side
  async function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const importUrl = API_CONFIG.ENDPOINTS.IMPORT_USERS;

    // Thử upload lên server trước
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetchWithAuth(importUrl, { method: 'POST', body: formData });
      const json = await res.json().catch(() => null);

      if (res.ok) {
        // Reload danh sách tài khoản từ server
        syncTeacherClassAssignments();
        await refreshUserList(0);
        renderAssignments();
        showAdminNotice('Nhập thành công', json?.message || 'Đã nhập tài khoản từ Excel (server).', 'success');
        e.target.value = '';
        return;
      }
      // Hiển thị lỗi chi tiết từng dòng nếu có
      const rowErrors = Array.isArray(json?.data) ? json.data : [];
      const detail = rowErrors.length
        ? rowErrors.join('\n')
        : (json?.message || `Server trả lỗi ${res.status}`);
      throw new Error(detail);
    } catch (err) {
      console.warn('Server import (accounts) failed:', err);
      showAdminNotice('Lỗi import lên server', err?.message || 'Không thể import lên server. Kiểm tra lại.', 'danger');
      e.target.value = '';
      return;
    }

    // Fallback: xử lý client-side
    const reader = new FileReader();
    reader.onload = function(evt) {
      const data = evt.target.result;
      let workbook;
      try {
        workbook = XLSX.read(data, { type: 'binary' });
      } catch (err) {
        showAdminNotice('Lỗi file', 'Không đọc được file Excel.', 'danger');
        return;
      }
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) {
        showAdminNotice('File rỗng', 'Không có dữ liệu trong file.', 'warning');
        return;
      }
      // Các trường: id, name, username, role, password, birthday
      const newAccounts = [];
      for (const row of rows) {
        const id = (row['id'] || row['ID'] || row['Mã tài khoản'] || '').toString().trim();
        const name = (row['name'] || row['Họ và tên'] || '').toString().trim();
        const username = (row['username'] || row['Username'] || '').toString().trim();
        const role = (row['role'] || row['Vai trò'] || '').toString().trim().toLowerCase();
        const password = (row['password'] || row['Mật khẩu'] || '').toString().trim();
        const birthday = (row['birthday'] || row['Ngày sinh'] || '').toString().trim();
        if (!id || !name || !username || !role || !password || !birthday) continue;
        if (!['teacher','student','admin'].includes(role)) continue;
        if (adminAccounts.some(acc => acc.id.toLowerCase() === id.toLowerCase())) continue;
        if (adminAccounts.some(acc => acc.username.toLowerCase() === username.toLowerCase())) continue;
        newAccounts.push({ id, name, username, role, password, birthday, status: 'active', email: '' });
      }
      if (!newAccounts.length) {
        showAdminNotice('Không có tài khoản mới', 'Tất cả tài khoản trong file đã tồn tại hoặc thiếu thông tin.', 'warning');
        return;
      }
      saveAdminAccounts([...newAccounts, ...adminAccounts]);
      syncTeacherClassAssignments();
      renderAccounts();
      renderAssignments();
      showAdminNotice('Nhập thành công', `Đã thêm ${newAccounts.length} tài khoản từ Excel.`, 'success');
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  }
  document.getElementById('btnAdminLogout')?.addEventListener('click', handleAdminLogout);
  // Gắn lại sự kiện submit cho form để phân biệt thêm/sửa
  async function updateAccount(event) {
    event.preventDefault();
    const id = document.getElementById('accountId').value.trim();
    const name = document.getElementById('accountName').value.trim();
    const username = document.getElementById('accountUsername').value.trim();
    const role = document.getElementById('accountRole').value;
    const birthday = document.getElementById('accountBirthday').value;
    const email = document.getElementById('accountEmail').value.trim();
    const status = document.getElementById('accountStatus').value;
    const gender = document.getElementById('accountGender')?.value || '';
    const classId = role === 'student' ? (document.getElementById('accountClass')?.value || null) : null;

    if (!id || !name || !username || !birthday || !email) {
      showAdminNotice('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin tài khoản.', 'warning');
      return;
    }

    const submitBtn = event.target.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Đang cập nhật...'; }

    try {
      const avatarImage = await uploadAvatarToCloud(id);
      const payload = {
        fullName: name,
        username: username,
        role: (role || '').toUpperCase(),
        birthday: birthday,
        email: email,
        gender: (gender || 'MALE').toUpperCase(),
        statusType: (status || 'active').toUpperCase(),
        ...(avatarImage ? { avatarImage } : {})
      };

      const response = await fetchWithAuth(`${API_CONFIG.ADMIN_BASE_URL}/user/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {},
        body: JSON.stringify(payload)
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.message || `Lỗi ${response.status}`);
      }

      // Kiểm tra username có thay đổi để xử lý logout nếu đang cập nhật chính bản thân
      const usernameInput = document.getElementById('accountUsername');
      const originalUsername = usernameInput?.dataset.original || '';
      const usernameChanged = originalUsername && username && username !== originalUsername;

      // Reload lại trang hiện tại sau khi cập nhật
      syncTeacherClassAssignments();
      closeAccountModal();
      await refreshUserList(0);
      renderAssignments();

      // Nếu đang sửa username của tài khoản đang đăng nhập → logout bắt buộc
      const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
      const isSelf = currentUser && (currentUser.id === id || currentUser.username === originalUsername);
      if (usernameChanged && isSelf) {
        showAdminNotice('Đổi username thành công', 'Username đã thay đổi. Vui lòng đăng nhập lại bằng username mới.', 'success');
        setTimeout(() => AuthService.logout(), 2000);
        return;
      }

      showAdminNotice('Cập nhật thành công', json?.message || `Đã cập nhật tài khoản ${id}.`, 'success');
    } catch (err) {
      showAdminNotice('Cập nhật thất bại', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.', 'danger');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Lưu tài khoản'; }
    }
  }

  const accountForm = document.getElementById('accountForm');
  if (accountForm) {
    accountForm.addEventListener('submit', function(event) {
      const isUpdate = document.getElementById('accountId').readOnly;
      if (isUpdate) {
        updateAccount(event);
      } else {
        addAccount(event);
      }
    });
  }
  // Remove invalid marker when user starts typing in class fields
  ['adminClassId','adminClassName','adminClassRoom','adminClassYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => el.classList.remove('invalid'));
  });
  document.getElementById('classForm')?.addEventListener('submit', addClass);
  document.getElementById('adminFeedbackConfirm')?.addEventListener('click', confirmAdminPopup);
  document.getElementById('adminFeedbackCancel')?.addEventListener('click', cancelAdminPopup);

  window.addEventListener('click', (event) => {
    const accountModal = document.getElementById('accountModal');
    const classModal = document.getElementById('classModal');
    const feedbackModal = document.getElementById('adminFeedbackModal');
    if (event.target === accountModal) closeAccountModal();
    if (event.target === classModal) closeClassModal();
    if (event.target === feedbackModal) cancelAdminPopup();
  });
}

async function initializeAdminPage() {
  adminUser = await checkAdminAccess();
  if (!adminUser) return;

  document.getElementById('adminUserName').textContent = adminUser.fullName || adminUser.name || adminUser.id || 'Quản trị viên';

  // Tải trang đầu tiên danh sách lớp từ API
  await refreshClassList(0);

  // Tải trang đầu tiên danh sách tài khoản
  await refreshUserList(0);

  // Load total student counts per class (best-effort) and apply to adminClasses
  try {
    const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
    const baseHost = (adminBase.split('/admin')[0]) || (API_CONFIG?.BASE_URL?.split('/public')[0]) || '';
    const totalsUrl = `${baseHost}/classes/total-student`;
    const headers = { Accept: 'application/json' };
    let res = await fetch(totalsUrl, { headers, credentials: 'include' });
    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        res = await fetch(totalsUrl, { headers, credentials: 'include' });
      }
    }
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const totals = json?.data || json || {};
      if (totals && typeof totals === 'object') {
        adminClasses = adminClasses.map(c => ({ ...c, studentCount: (totals[c.classId] != null) ? totals[c.classId] : c.studentCount }));
        sessionStorage.setItem('adminClasses', JSON.stringify(adminClasses));
        syncTeacherClassAssignments();
        renderClasses();
        renderAssignments();
      }
    }
  } catch (e) {
    // Not critical — ignore errors silently
  }

  // Gắn sự kiện tìm kiếm
  const classSearchInput = document.getElementById('classSearchInput');
  if (classSearchInput) classSearchInput.addEventListener('input', () => { classIsLoading = false; renderClasses(); });
  const classSemesterFilter = document.getElementById('classSemesterFilter');
  if (classSemesterFilter) classSemesterFilter.addEventListener('change', () => { classIsLoading = false; renderClasses(); });
  const assignmentSemesterFilter = document.getElementById('assignmentSemesterFilter');
  if (assignmentSemesterFilter) assignmentSemesterFilter.addEventListener('change', renderAssignments);
  const accountSearchInput = document.getElementById('accountSearchInput');
  if (accountSearchInput) {
    // Debounce search để giảm số request lên server
    let _searchTimer;
    accountSearchInput.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => {
        userIsLoading = false; // reset nếu đang load dở
        refreshUserList(0);
      }, 350);
    });
  }
  const assignmentSearchInput = document.getElementById('assignmentSearchInput');
  if (assignmentSearchInput) assignmentSearchInput.addEventListener('input', renderAssignments);

  // Gắn sự kiện lọc vai trò — reload từ server trang 0
  const roleFilterSelect = document.getElementById('accountRoleFilter');
  if (roleFilterSelect) {
    roleFilterSelect.addEventListener('change', () => {
      activeRoleFilter = roleFilterSelect.value;
      userIsLoading = false; // reset nếu đang load dở
      refreshUserList(0);
    });
  }

  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'accounts';
  switchAdminTab(initialTab);
  attachAdminEvents();
}

function syncSidebarTop() {
  const header = document.querySelector('.admin-header');
  const sidebar = document.querySelector('.admin-sidebar');
  if (!header || !sidebar) return;
  const h = header.getBoundingClientRect().height;
  const top = Math.round(h) + 16;
  sidebar.style.top = top + 'px';
  sidebar.style.maxHeight = `calc(100vh - ${top + 24}px)`;
}

document.addEventListener('DOMContentLoaded', () => {
  initializeAdminPage();
  syncSidebarTop();
  window.addEventListener('resize', syncSidebarTop);

  const examForm = document.getElementById('adminExamForm');
  if (examForm) {
    examForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = document.getElementById('adminExamName').value.trim();
      const tagName = rawName.toUpperCase().replace(/\s+/g, '_');
      
      if (!tagName) return;

      const editId = examForm.dataset.editId;
      if (editId) {
        // If changing name, ensure new name doesn't exist
        if (tagName !== editId && adminExams.some(ex => ex.id === tagName)) {
          showAdminNotice('Lỗi', 'Tag bài thi này đã tồn tại.', 'warning');
          return;
        }
        const idx = adminExams.findIndex(ex => ex.id === editId);
        if (idx !== -1) {
          adminExams[idx].id = tagName;
          adminExams[idx].name = tagName;
        }
      } else {
        if (adminExams.some(ex => ex.id === tagName)) {
          showAdminNotice('Lỗi', 'Tag bài thi đã tồn tại.', 'warning');
          return;
        }
        adminExams.push({ id: tagName, name: tagName, description: '', icon: '📝', videos: [], deleted: false });
      }
      saveAdminExams(adminExams);
      closeAdminExamModal();
      renderExams();
    });
  }
  
  const searchInput = document.getElementById('examSearchInput');
  if(searchInput) {
    searchInput.addEventListener('input', () => renderExams());
  }
});

let adminExams = [];

function getAdminExams() {
  const stored = JSON.parse(sessionStorage.getItem('examCatalog') || 'null');
  if (Array.isArray(stored)) {
    return stored;
  }
  return [
    { id: 'DI_DEU', name: 'DI_DEU', icon: '📝', description: '', videos: [], deleted: false },
    { id: 'BAN_SUNG', name: 'BAN_SUNG', icon: '📝', description: '', videos: [], deleted: false },
    { id: 'VO_THUAT', name: 'VO_THUAT', icon: '📝', description: '', videos: [], deleted: false }
  ];
}

function saveAdminExams(exams) {
  adminExams = exams;
  sessionStorage.setItem('examCatalog', JSON.stringify(adminExams));
}

function getExamUsageCount(tagId) {
  const allClassExams = JSON.parse(sessionStorage.getItem('classExams') || '{}');
  let count = 0;
  for (const classId in allClassExams) {
    const assignments = allClassExams[classId];
    if (Array.isArray(assignments)) {
      count += assignments.filter(item => item.id === tagId || item.classExamId === tagId).length;
    }
  }
  return count;
}

function renderExams() {
  adminExams = getAdminExams();
  const container = document.getElementById('examsContent');
  if (!container) return;
  const search = (document.getElementById('examSearchInput')?.value || '').toLowerCase().trim();

  let filtered = adminExams.filter(e => !e.deleted);
  if (search) {
    filtered = filtered.filter(e => e.name.toLowerCase().includes(search));
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Tên tag</th>
            <th style="width: 200px; text-align: center;">Số lượng bài thi</th>
            <th style="width: 200px;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? '<tr><td colspan="3" style="text-align:center;padding:24px;">Không có tag nào</td></tr>' : ''}
          ${filtered.map(e => {
            const usageCount = getExamUsageCount(e.id);
            return `
            <tr>
              <td><strong>${e.name}</strong></td>
              <td style="text-align: center;">
                <span style="display:inline-block; padding: 4px 12px; background: #e2e8f0; border-radius: 12px; font-weight: bold; font-size: 13px;">${usageCount}</span>
              </td>
              <td>
                <div class="admin-action-group">
                  <button class="admin-update-btn" onclick="openAdminExamModal('${e.id}')"><i class="fas fa-pen-to-square"></i> Cập nhật</button>
                  <button class="admin-lock-btn lock" onclick="deleteAdminExam('${e.id}')" ${usageCount > 0 ? 'style="opacity:0.5;cursor:not-allowed;" title="Không thể xóa do đang có bài thi sử dụng"' : ''}><i class="fas fa-trash"></i> Xóa</button>
                </div>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openAdminExamModal(examId = null) {
  document.getElementById('adminExamModal').style.display = 'flex';
  const form = document.getElementById('adminExamForm');
  form.reset();
  form.dataset.editId = '';
  document.getElementById('adminExamModalTitle').textContent = 'Thêm Tag Bài Thi';

  if (examId && typeof examId === 'string') {
    const exam = adminExams.find(e => e.id === examId);
    if (exam) {
      document.getElementById('adminExamModalTitle').textContent = 'Cập nhật Tag Bài Thi';
      document.getElementById('adminExamName').value = exam.name;
      form.dataset.editId = exam.id;
    }
  }
}

function closeAdminExamModal() {
  document.getElementById('adminExamModal').style.display = 'none';
}

function deleteAdminExam(examId) {
  const usageCount = getExamUsageCount(examId);
  if (usageCount > 0) {
    showAdminNotice('Không thể xóa', \`Tag \${examId} đang được gán cho \${usageCount} bài thi. Vui lòng gỡ bài thi trước khi xóa.\`, 'warning');
    return;
  }
  
  showAdminConfirm('Xác nhận xóa', \`Bạn có chắc chắn muốn xóa tag \${examId} không?\`, () => {
    adminExams = adminExams.filter(e => e.id !== examId);
    saveAdminExams(adminExams);
    renderExams();
  });
}
