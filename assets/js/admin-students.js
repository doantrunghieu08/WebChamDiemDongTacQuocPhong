let adminStudentsUser = null;
let adminStudentsClasses = [];
let activeClassId = null;
let adminStudentsPopupConfirmHandler = null;
let adminStudentsPopupCancelHandler = null;

function getStudentAccounts() {
  return getAdminAccounts().filter(account => account.role === 'student' && account.status !== 'locked');
}

function updateStudentLookupState(message, variant = 'default') {
  const messageNode = document.getElementById('studentLookupMessage');
  if (!messageNode) return;
  messageNode.textContent = message;
  messageNode.className = `admin-student-lookup ${variant}`;
}

function formatStudentBirthday(birthday) {
  if (!birthday) return 'Chưa cập nhật';
  const normalized = birthday.toString().trim();
  if (!normalized) return 'Chưa cập nhật';
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
  }
  return normalized;
}

function formatGender(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim().toLowerCase();
  if (!s) return '';
  if (s === 'male' || s === 'm' || s === 'nam') return 'Nam';
  if (s === 'female' || s === 'f' || s === 'nu' || s === 'nữ') return 'Nữ';
  if (s === 'other' || s === 'khác' || s === 'khac') return 'Khác';
  return value;
}

function formatRoom(room) {
  if (!room) return '';
  let r = room.toString().trim();
  r = r.replace(/^(Phòng|phòng|Room|room)\s*[:\-–]?\s*/i, '');
  return `Phòng ${r}`;
}

function getStoredStudentProfile(studentCode) {
  const normalizedCode = studentCode.trim().toLowerCase();
  if (!normalizedCode) return null;

  const classStudents = Object.values(getStoredClassStudents());
  for (const classStudentList of classStudents) {
    if (!Array.isArray(classStudentList)) continue;
    const matchedStudent = classStudentList.find(student => (student.code || '').toLowerCase() === normalizedCode);
    if (matchedStudent) {
      return matchedStudent;
    }
  }

  return null;
}

// Tìm lớp (classId) chứa sinh viên theo mã. Trả về null nếu không tìm thấy.
function findStudentClass(studentCode) {
  const code = (studentCode || '').toString().trim().toLowerCase();
  if (!code) return null;
  const all = getStoredClassStudents();
  for (const [classId, list] of Object.entries(all)) {
    if (!Array.isArray(list)) continue;
    if (list.find(s => (s.code || '').toLowerCase() === code)) {
      return classId;
    }
  }
  return null;
}

function fillStudentLookupFields(student = null) {
  const nameInput = document.getElementById('studentClassName');
  const birthdayInput = document.getElementById('studentClassBirthday');
  const genderInput = document.getElementById('studentClassGender');
  if (!nameInput || !birthdayInput || !genderInput) return;

  if (!student) {
    nameInput.value = '';
    birthdayInput.value = '';
    genderInput.value = '';
    return;
  }

  nameInput.value = student.name || '';
  birthdayInput.value = formatStudentBirthday(student.birthday);
  genderInput.value = student.gender ? formatGender(student.gender) : 'Chưa cập nhật';
}

function findStudentAccountByCode(inputCode) {
  const normalizedCode = inputCode.trim().toLowerCase();
  if (!normalizedCode) return null;

  const studentAccounts = getStudentAccounts();
  return studentAccounts.find(account => account.id.toLowerCase() === normalizedCode) || null;
}

// Try fetch student info from admin API using POST (server expects POST payload).
// Returns normalized student object or null.
async function fetchStudentFromServer(studentId) {
  if (!studentId) return null;
  const postUrl = `${API_CONFIG.ADMIN_BASE_URL}/student`;
  const headers = { 'Content-Type': 'application/json' };
  // Add CSRF header when available (XSRF token is stored in cookie by the server)
  const csrfToken = (typeof _getCsrfToken === 'function') ? _getCsrfToken() : null;
  if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;
  try {
    let res = await fetch(postUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ id: studentId })
    });

    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        res = await fetch(postUrl, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ id: studentId }) });
      }
    }

    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const data = json?.data || json;
    if (!data) return null;

    return {
      id: data.id || data.code || data.studentId,
      name: data.fullName || data.name || data.full_name || '',
      birthday: data.birthday || data.dob || '',
      gender: data.gender || data.sex || ''
    };
  } catch (err) {
    return null;
  }
}

async function handleStudentCodeLookup() {
  const codeInput = document.getElementById('studentClassCode');
  if (!codeInput) return;

  const rawCode = codeInput.value.trim().toUpperCase();
  codeInput.value = rawCode;

  if (!rawCode) {
    fillStudentLookupFields();
    updateStudentLookupState('Nhập mã sinh viên đã có trong danh sách tài khoản để tự động điền thông tin cơ bản.', 'default');
    return;
  }
  updateStudentLookupState('Đang tìm...', 'info');

  // Try server first, then fallback to local accounts
  let matchedAccount = null;
  try {
    const serverStudent = await fetchStudentFromServer(rawCode);
    if (serverStudent) {
      matchedAccount = {
        id: serverStudent.id,
        name: serverStudent.name,
        birthday: serverStudent.birthday ? serverStudent.birthday.split('T')[0] : serverStudent.birthday,
        gender: serverStudent.gender
      };
    }
  } catch (e) {
    // ignore and fallback
  }

  if (!matchedAccount) {
    matchedAccount = findStudentAccountByCode(rawCode);
  }

  if (!matchedAccount) {
    fillStudentLookupFields();
    updateStudentLookupState('Không tìm thấy tài khoản sinh viên tương ứng với mã này.', 'warning');
    return;
  }

  const storedProfile = getStoredStudentProfile(rawCode);
  fillStudentLookupFields({
    ...matchedAccount,
    birthday: matchedAccount.birthday || storedProfile?.birthday || '',
    gender: matchedAccount.gender || storedProfile?.gender || ''
  });
  updateStudentLookupState(`Đã tìm thấy sinh viên: ${matchedAccount.name}`, 'success');
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

async function checkAdminStudentsAccess() {
  const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

  if (!storedUser) {
    window.location.href = '/index.html';
    return null;
  }

  let sessionRole = localStorage.getItem('currentUserRole');

  // Nếu role không có trong sessionStorage, thử lấy từ server qua cookie
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

function getAdminClasses() {
  const stored = JSON.parse(sessionStorage.getItem('adminClasses') || 'null');
  const classes = Array.isArray(stored) ? stored : [];
  const normalized = classes.map(cls => ({
    ...cls,
    studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0),
    assignedTeacherId: cls.assignedTeacherId || '',
    assignedTeacherName: cls.assignedTeacherName || ''
  }));
  sessionStorage.setItem('adminClasses', JSON.stringify(normalized));
  return normalized;
}

function getAdminAccounts() {
  return JSON.parse(sessionStorage.getItem('adminAccounts') || '[]');
}

function getStoredClassStudents() {
  return JSON.parse(sessionStorage.getItem('classStudents') || '{}');
}

function syncTeacherClassAssignments() {
  const adminAccounts = getAdminAccounts();
  const teachers = adminAccounts.filter(account => account.role === 'teacher');
  teachers.forEach(teacher => {
    const assignedClasses = teacher.status === 'active'
      ? adminStudentsClasses
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

function updateStoredClassStudents(classId, students) {
  const allStudents = getStoredClassStudents();
  allStudents[classId] = students;
  sessionStorage.setItem('classStudents', JSON.stringify(allStudents));

  adminStudentsClasses = adminStudentsClasses.map(cls => cls.classId === classId
    ? { ...cls, studentCount: students.length }
    : cls);
  sessionStorage.setItem('adminClasses', JSON.stringify(adminStudentsClasses));

  const selectedClass = JSON.parse(sessionStorage.getItem('selectedClass') || 'null');
  if (selectedClass && selectedClass.classId === classId) {
    selectedClass.studentCount = students.length;
    sessionStorage.setItem('selectedClass', JSON.stringify(selectedClass));
  }

  syncTeacherClassAssignments();
}

// ---- Student list search + pagination state ----
let studentListPage = 0;
let studentListPageSize = 10;
let studentListTotalPages = 1;
let studentListKeyword = '';
let _studentSearchTimer = null;

async function searchClassStudentsFromServer(classId, keyword, page, size) {
  try {
    const url = API_CONFIG.ENDPOINTS.CLASS_STUDENT_SEARCH(classId, keyword, page, size);
    const headers = { Accept: 'application/json' };
    let res = await fetch(url, { headers, credentials: 'include' });
    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) res = await fetch(url, { headers, credentials: 'include' });
    }
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);

    // Support Spring Page in json.data or json.data.content
    let rawList, totalPages, totalElements;
    if (json?.data && !Array.isArray(json.data) && Array.isArray(json.data.content)) {
      rawList = json.data.content;
      totalPages = json.data.totalPages ?? 1;
      totalElements = json.data.totalElements ?? rawList.length;
    } else if (Array.isArray(json?.data?.content ?? json?.content)) {
      rawList = json.content || json.data.content;
      totalPages = json.totalPages ?? json.data?.totalPages ?? 1;
      totalElements = json.totalElements ?? json.data?.totalElements ?? rawList.length;
    } else {
      rawList = Array.isArray(json?.data) ? json.data : [];
      totalPages = json?.totalPages ?? 1;
      totalElements = json?.totalElements ?? rawList.length;
    }

    const students = rawList.map(s => ({
      code: s.id || s.code || s.studentId || '',
      name: s.fullName || s.name || '',
      birthday: s.birthday ? s.birthday.split('T')[0] : '',
      gender: s.gender || '',
      avatarImage: s.avatarImage || null
    }));
    return { students, totalPages: Math.max(1, totalPages), totalElements };
  } catch (err) {
    console.error('searchClassStudentsFromServer error', err);
    return null;
  }
}

async function loadStudentListPage(page = 0) {
  if (!activeClassId) return;
  studentListPage = page;
  const result = await searchClassStudentsFromServer(activeClassId, studentListKeyword, page, studentListPageSize);
  if (!result) {
    // Fallback: render từ dữ liệu đã lưu trong sessionStorage khi search endpoint thất bại
    if (page === 0) {
      const storedStudents = getStoredClassStudents()[activeClassId] || [];
      const filtered = studentListKeyword
        ? storedStudents.filter(s =>
            (s.name || '').toLowerCase().includes(studentListKeyword.toLowerCase()) ||
            (s.code || '').toLowerCase().includes(studentListKeyword.toLowerCase())
          )
        : storedStudents;
      renderStudentManagerListFromData(filtered);
    }
    return;
  }
  studentListTotalPages = result.totalPages;
  renderStudentManagerListFromData(result.students);
  renderStudentListPagination();

  // Cập nhật lại tổng số sinh viên hiển thị ở tiêu đề lớp
  if (page === 0 && !studentListKeyword) {
    const countElem = document.getElementById('adminStudentsCount');
    if (countElem) {
      countElem.textContent = `${result.totalElements} sinh viên`;
    }
    // Cập nhật class item trong adminStudentsClasses
    const cls = getActiveClass();
    if (cls) {
      cls.studentCount = result.totalElements;
    }
  }

  // Scroll lên đầu danh sách sau khi chuyển trang
  setTimeout(() => {
    const listPanel = document.querySelector('.admin-students-list-panel');
    if (listPanel) {
      listPanel.scrollTo({ top: 0, behavior: 'smooth' });
      // Trên mobile, khi danh sách nằm dưới form, cuộn nguyên trang đến đầu danh sách
      if (window.innerWidth <= 1100) {
        listPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, 50);
}

function renderStudentManagerListFromData(students) {
  const listContainer = document.getElementById('studentManagerList');
  if (!listContainer) return;
  document.getElementById('adminStudentsListHint').textContent =
    `Toàn bộ thay đổi được đồng bộ ngay cho lớp ${activeClassId} và giảng viên được phân công.`;
  if (!students || students.length === 0) {
    listContainer.innerHTML = '<div class="admin-student-empty">Không tìm thấy sinh viên nào.</div>';
    return;
  }
  const offset = studentListPage * studentListPageSize;
  listContainer.innerHTML = `
    <div class="admin-student-list">
      ${students.map((student, index) => {
        const avatarHtml = student.avatarImage
          ? `<img class="admin-student-avatar-img" src="${student.avatarImage}" alt="${student.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="admin-student-avatar-fallback" style="display:none"><i class=\"fas fa-user\"></i></div>`
          : `<div class="admin-student-avatar-fallback"><i class="fas fa-user"></i></div>`;
        return `
        <div class="admin-student-item">
          <div class="admin-student-order">${offset + index + 1}</div>
          <div class="admin-student-avatar">${avatarHtml}</div>
          <div class="admin-student-content">
            <div class="admin-student-name">${student.name}</div>
            <div class="admin-student-meta">${student.code} · ${student.gender ? formatGender(student.gender) : 'Chưa cập nhật'} · ${formatStudentBirthday(student.birthday)}</div>
          </div>
        </div>
      `;
      }).join('')}
    </div>
  `;
}

function renderStudentListPagination() {
  const container = document.getElementById('studentListPagination');
  if (!container) return;
  if (studentListTotalPages <= 1) { container.innerHTML = ''; return; }
  let btns = '';
  btns += `<button class="admin-page-btn" onclick="loadStudentListPage(${studentListPage - 1})" ${studentListPage === 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 0; i < studentListTotalPages; i++) {
    btns += `<button class="admin-page-btn${i === studentListPage ? ' active' : ''}" onclick="loadStudentListPage(${i})">${i + 1}</button>`;
  }
  btns += `<button class="admin-page-btn" onclick="loadStudentListPage(${studentListPage + 1})" ${studentListPage + 1 >= studentListTotalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  container.innerHTML = `<div class="admin-pagination" style="margin-top:12px"><div class="admin-page-controls">${btns}</div></div>`;
}

async function loadClassStudentsFromServer(classId) {
  if (!classId) return null;
  const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
  const baseHost = (adminBase.split('/admin')[0]) || (API_CONFIG?.BASE_URL?.split('/public')[0]) || '';
  const url = `${baseHost}/classes/api/${encodeURIComponent(classId)}`;
  const headers = { Accept: 'application/json' };
  try {
    let res = await fetch(url, { headers, credentials: 'include' });
    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        res = await fetch(url, { headers, credentials: 'include' });
      }
    }

    if (!res.ok) {
      console.warn('loadClassStudentsFromServer: server returned', res.status);
      return null;
    }

    const json = await res.json().catch(() => null);
    let list = json?.data || json;
    if (list && !Array.isArray(list) && Array.isArray(list.content)) {
      list = list.content;
    } else if (json && Array.isArray(json.content)) {
      list = json.content;
    }
    if (!Array.isArray(list)) return null;

    const students = list.map(s => ({
      code: s.id || s.code || s.studentId,
      name: s.fullName || s.name || '',
      birthday: s.birthday ? s.birthday.split('T')[0] : (s.dob ? s.dob.split('T')[0] : ''),
      gender: s.gender || s.sex || '',
      avatarImage: s.avatarImage || null
    }));

    updateStoredClassStudents(classId, students);
    return students;
  } catch (err) {
    console.error('loadClassStudentsFromServer error', err);
    return null;
  }
}

function openAdminStudentsPopup({ title, message, variant = 'info', confirmText = 'Đồng ý', cancelText = 'Hủy', showCancel = false, onConfirm = null, onCancel = null }) {
  const modal = document.getElementById('adminStudentsFeedbackModal');
  const icon = document.getElementById('adminStudentsFeedbackIcon');
  const titleNode = document.getElementById('adminStudentsFeedbackTitle');
  const messageNode = document.getElementById('adminStudentsFeedbackMessage');
  const actions = document.getElementById('adminStudentsFeedbackActions');
  const cancelButton = document.getElementById('adminStudentsFeedbackCancel');
  const confirmButton = document.getElementById('adminStudentsFeedbackConfirm');
  if (!modal || !icon || !titleNode || !messageNode || !actions || !cancelButton || !confirmButton) return;

  const iconMap = {
    info: 'fa-circle-info',
    success: 'fa-circle-check',
    warning: 'fa-triangle-exclamation',
    danger: 'fa-trash-can'
  };

  adminStudentsPopupConfirmHandler = onConfirm;
  adminStudentsPopupCancelHandler = onCancel;

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

function closeAdminStudentsPopup() {
  const modal = document.getElementById('adminStudentsFeedbackModal');
  if (!modal) return;
  modal.style.display = 'none';
  adminStudentsPopupConfirmHandler = null;
  adminStudentsPopupCancelHandler = null;
}

function confirmAdminStudentsPopup() {
  const handler = adminStudentsPopupConfirmHandler;
  closeAdminStudentsPopup();
  if (typeof handler === 'function') {
    handler();
  }
}

function cancelAdminStudentsPopup() {
  const handler = adminStudentsPopupCancelHandler;
  closeAdminStudentsPopup();
  if (typeof handler === 'function') {
    handler();
  }
}

let _studentImportProgressInterval = null;
function showStudentImportProgress(message = 'Đang tải lên...') {
  let overlay = document.getElementById('studentImportProgressOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'studentImportProgressOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;flex-direction:column;';
    overlay.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:8px;width:320px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
        <h4 id="studentImportProgressTitle" style="margin:0 0 16px 0;color:#1e293b;font-size:16px;">${message}</h4>
        <div style="background:#e2e8f0;border-radius:999px;height:12px;overflow:hidden;margin-bottom:8px;">
          <div id="studentImportProgressBar" style="background:#16a34a;height:100%;width:0%;transition:width 0.3s ease;"></div>
        </div>
        <div id="studentImportProgressText" style="font-size:14px;color:#64748b;font-weight:bold;">0%</div>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    document.getElementById('studentImportProgressTitle').textContent = message;
  }
  overlay.style.display = 'flex';
  
  const bar = document.getElementById('studentImportProgressBar');
  const text = document.getElementById('studentImportProgressText');
  let pct = 0;
  bar.style.width = '0%';
  text.textContent = '0%';
  
  _studentImportProgressInterval = setInterval(() => {
    if (pct < 50) pct += 5;
    else if (pct < 80) pct += 2;
    else if (pct < 95) pct += 0.5;
    if (pct > 99) pct = 99;
    
    bar.style.width = pct + '%';
    text.textContent = Math.floor(pct) + '%';
  }, 200);
}

function hideStudentImportProgress() {
  if (_studentImportProgressInterval) {
    clearInterval(_studentImportProgressInterval);
    _studentImportProgressInterval = null;
  }
  const overlay = document.getElementById('studentImportProgressOverlay');
  if (overlay) {
    const bar = document.getElementById('studentImportProgressBar');
    const text = document.getElementById('studentImportProgressText');
    if (bar) bar.style.width = '100%';
    if (text) text.textContent = '100%';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }
}

function showAdminStudentsNotice(title, message, variant = 'info') {
  openAdminStudentsPopup({ title, message, variant, confirmText: 'Đóng' });
}

function showAdminStudentsConfirm(title, message, onConfirm, options = {}) {
  openAdminStudentsPopup({
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

function getActiveClass() {
  return adminStudentsClasses.find(cls => cls.classId === activeClassId) || null;
}

function renderStudentPageHeader() {
  const classItem = getActiveClass();
  if (!classItem) {
    window.location.href = '../pages/admin.html?tab=classes';
    return;
  }

  const students = getStoredClassStudents()[activeClassId] || [];
  document.getElementById('adminStudentsTitle').textContent = classItem.className;
  const roomText = formatRoom(classItem.roomNumber);
  document.getElementById('adminStudentsSubtitle').textContent = `Học kỳ ${classItem.semester} · Năm học ${classItem.year}${roomText ? ' · ' + roomText : ''}`;
  document.getElementById('adminStudentsClassCode').textContent = classItem.classId;
  document.getElementById('adminStudentsCount').textContent = `${students.length} sinh viên`;
}

function renderStudentManagerList() {
  // Delegate to server-side search (keyword empty = load all)
  loadStudentListPage(0);
}

function refreshStudentPage() {
  renderStudentPageHeader();
  renderStudentManagerList();
}

async function addStudentToClass(event) {
  event.preventDefault();
  if (!activeClassId) return;

  const code = document.getElementById('studentClassCode').value.trim();
  const name = document.getElementById('studentClassName').value.trim();
  const birthday = document.getElementById('studentClassBirthday').value.trim();
  const gender = document.getElementById('studentClassGender').value.trim();

  if (!code) {
    showAdminStudentsNotice('Thiếu thông tin', 'Vui lòng nhập mã sinh viên.', 'warning');
    return;
  }

  // Try local account first, then server for basic info
  let matchedAccount = findStudentAccountByCode(code);
  if (!matchedAccount) matchedAccount = await fetchStudentFromServer(code);

  if (!matchedAccount || !name) {
    showAdminStudentsNotice('Không tìm thấy sinh viên', 'Mã sinh viên này chưa tồn tại trong danh sách tài khoản sinh viên.', 'warning');
    return;
  }

  const students = getStoredClassStudents()[activeClassId] || [];
  // Nếu sinh viên đã thuộc lớp khác thì chặn
  const existingClass = findStudentClass(code);
  if (existingClass && existingClass !== activeClassId) {
    showAdminStudentsNotice('Sinh viên đã có lớp', `Sinh viên này đã thuộc lớp ${existingClass}. Không thể thêm vào lớp khác.`, 'warning');
    return;
  }
  if (students.some(student => student.code.toLowerCase() === code.toLowerCase())) {
    showAdminStudentsNotice('Trùng mã sinh viên', 'Mã sinh viên đã tồn tại trong lớp này.', 'warning');
    return;
  }

  // Call server API to add student to class. If it fails (network/server), fallback to local save.
  let serverData = null;
  const apiUrl = `${API_CONFIG.ADMIN_BASE_URL}/class/student`;
  const headers = { 'Content-Type': 'application/json' };
  try {
    let res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ idStudent: code, idClass: activeClassId }),
    });

    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        res = await fetch(apiUrl, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ idStudent: code, idClass: activeClassId }) });
      }
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const msg = errJson?.message || `Lỗi ${res.status}`;
      if (res.status === 409) {
        showAdminStudentsNotice('Sinh viên đã có trong lớp', msg, 'warning');
        return;
      }
      // Permission denied from server (consistent error code/message)
      if (res.status === 403 || errJson?.code === 1002) {
        showAdminStudentsNotice('Không có quyền', 'Bạn không có quyền thực hiện hành động này. Vui lòng đăng nhập bằng tài khoản có quyền hoặc liên hệ quản trị viên.', 'danger');
        return;
      }
      // Non-fatal server error: inform user and fallback to local save
      showAdminStudentsNotice('Lỗi server', `${msg}. Lưu cục bộ tạm thời.`, 'warning');
    } else {
      const json = await res.json().catch(() => null);
      serverData = json?.data || json;
    }
  } catch (err) {
    console.error('Lỗi khi gọi API thêm sinh viên:', err);
    showAdminStudentsNotice('Lỗi kết nối', 'Không thể liên hệ server. Lưu cục bộ tạm thời.', 'warning');
  }

  // Build student record to store locally (prefer server response when available)
  const storedStudent = {
    code,
    name: serverData?.fullName || serverData?.name || matchedAccount.name || name,
    birthday: serverData?.birthday || serverData?.dob || matchedAccount?.birthday || birthday,
    gender: formatGender(serverData?.gender || matchedAccount?.gender || gender)
  };

  updateStoredClassStudents(activeClassId, [...students, storedStudent]);
  document.getElementById('studentManagerForm')?.reset();
  fillStudentLookupFields();
  updateStudentLookupState('Nhập mã sinh viên đã có trong danh sách tài khoản để tự động điền thông tin cơ bản.', 'default');
  refreshStudentPage();
  showAdminStudentsNotice('Cập nhật thành công', `Đã thêm sinh viên ${code} vào lớp.`, 'success');
}

function removeStudentFromClass(studentCode) {
  if (!activeClassId) return;

  const students = getStoredClassStudents()[activeClassId] || [];
  const target = students.find(student => student.code === studentCode);
  if (!target) return;
  showAdminStudentsConfirm(
    'Xóa sinh viên',
    `Bạn có chắc chắn muốn xóa sinh viên ${target.name} (${target.code}) khỏi lớp này?`,
    () => {
      updateStoredClassStudents(activeClassId, students.filter(student => student.code !== studentCode));
      refreshStudentPage();
      showAdminStudentsNotice('Xóa thành công', `Đã xóa sinh viên ${studentCode} khỏi lớp.`, 'success');
    },
    { confirmText: 'Xóa', variant: 'danger' }
  );
}

function triggerStudentExcelImport() {
  document.getElementById('studentExcelInput').click();
}

async function handleStudentExcelFile(event) {
  if (!activeClassId) return;
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
  const baseHost = (adminBase.split('/admin')[0]) || (API_CONFIG?.BASE_URL?.split('/public')[0]) || '';
  const importUrl = `${baseHost}/admin/import-to-class/${encodeURIComponent(activeClassId)}`;

  showStudentImportProgress('Đang nhập sinh viên từ Excel...');

  // Thử upload lên server trước
  try {
    const formData = new FormData();
    formData.append('file', file);

    let res = await fetch(importUrl, { method: 'POST', body: formData, credentials: 'include' });
    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        const fd2 = new FormData(); fd2.append('file', file);
        res = await fetch(importUrl, { method: 'POST', body: fd2, credentials: 'include' });
      }
    }

    if (res.ok) {
      const json = await res.json().catch(() => null);
      // Reload danh sách sinh viên từ server
      await loadClassStudentsFromServer(activeClassId);
      refreshStudentPage();
      hideStudentImportProgress();
      showAdminStudentsNotice('Nhập thành công', json?.message || 'Đã nhập sinh viên từ Excel (server).', 'success');
      return;
    }
  } catch (err) {
    console.warn('Server import-to-class failed, falling back to client parse.', err);
    hideStudentImportProgress();
  }

  // Fallback: xử lý client-side
  const reader = new FileReader();
  reader.onload = function(loadEvent) {
    try {
      const data = new Uint8Array(loadEvent.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) {
        hideStudentImportProgress();
        showAdminStudentsNotice('Thiếu dữ liệu', 'File Excel không có dữ liệu.', 'warning');
        return;
      }

      const header = rows[0].map(item => (item || '').toString().toLowerCase().trim());
      let codeIdx = header.findIndex(item => item.includes('mã') || item.includes('code') || item.includes('mssv'));
      let nameIdx = header.findIndex(item => item.includes('tên') || item.includes('name') || item.includes('họ'));
      let genderIdx = header.findIndex(item => item.includes('giới') || item.includes('gender') || item.includes('phái'));

      if (codeIdx === -1) codeIdx = 0;
      if (nameIdx === -1) nameIdx = 1;
      if (genderIdx === -1) genderIdx = 2;

      const students = [...(getStoredClassStudents()[activeClassId] || [])];
      let added = 0;
      let skipped = 0;

      for (let index = 1; index < rows.length; index += 1) {
        const row = rows[index];
        const code = (row[codeIdx] || '').toString().trim();
        const name = (row[nameIdx] || '').toString().trim();
        const gender = (row[genderIdx] || 'Nam').toString().trim();

        if (!code || !name) {
          continue;
        }

        if (students.some(student => student.code.toLowerCase() === code.toLowerCase())) {
          skipped += 1;
          continue;
        }

        const otherClass = findStudentClass(code);
        if (otherClass && otherClass !== activeClassId) {
          skipped += 1;
          continue;
        }

        students.push({ code, name, gender });
        added += 1;
      }

      updateStoredClassStudents(activeClassId, students);
      refreshStudentPage();

      let message = `Đã thêm ${added} sinh viên vào lớp.`;
      if (skipped > 0) {
        message += ` Bỏ qua ${skipped} mã trùng.`;
      }
      hideStudentImportProgress();
      showAdminStudentsNotice('Cập nhật thành công', message, 'success');
    } catch (error) {
      hideStudentImportProgress();
      showAdminStudentsNotice('Đọc file thất bại', 'Không đọc được file Excel. Vui lòng kiểm tra định dạng file.', 'warning');
    }
  };

  reader.readAsArrayBuffer(file);
}

function handleAdminStudentsLogout() {
  showAdminStudentsConfirm(
    'Xác nhận đăng xuất',
    'Bạn có chắc chắn muốn thoát khỏi trang quản lý sinh viên?',
    () => { AuthService.logout(); },
    { confirmText: 'Đăng xuất', variant: 'warning' }
  );
}

function goBackToAdmin() {
  window.location.href = '../pages/admin.html?tab=classes';
}

function attachAdminStudentsEvents() {
  document.getElementById('btnAdminStudentsLogout')?.addEventListener('click', handleAdminStudentsLogout);
  document.getElementById('studentManagerForm')?.addEventListener('submit', addStudentToClass);
  document.getElementById('studentClassCode')?.addEventListener('input', handleStudentCodeLookup);

  // Search bar for student list
  const searchInput = document.getElementById('studentListSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(_studentSearchTimer);
      _studentSearchTimer = setTimeout(() => {
        studentListKeyword = searchInput.value.trim();
        loadStudentListPage(0);
      }, 350);
    });
  }
  // When user presses Enter in the student code input, perform lookup (fill fields)
  // and prevent the form from submitting immediately. Move focus to submit button.
  const codeInput = document.getElementById('studentClassCode');
  const submitBtn = document.querySelector('#studentManagerForm button[type="submit"]');
  if (codeInput) {
    codeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStudentCodeLookup();
        // focus the submit button so user can press Enter again to submit if they want
        if (submitBtn) {
          submitBtn.focus();
        }
      }
    });
  }
  document.getElementById('adminStudentsFeedbackConfirm')?.addEventListener('click', confirmAdminStudentsPopup);
  document.getElementById('adminStudentsFeedbackCancel')?.addEventListener('click', cancelAdminStudentsPopup);

  window.addEventListener('click', (event) => {
    const feedbackModal = document.getElementById('adminStudentsFeedbackModal');
    if (event.target === feedbackModal) cancelAdminStudentsPopup();
  });
}

async function initializeAdminStudentsPage() {
  adminStudentsUser = await checkAdminStudentsAccess();
  if (!adminStudentsUser) return;

  document.getElementById('adminStudentsUserName').textContent = adminStudentsUser.studentId || adminStudentsUser.name || adminStudentsUser.fullName || 'Quản trị viên';
  adminStudentsClasses = getAdminClasses();
  activeClassId = new URLSearchParams(window.location.search).get('classId');

  if (!activeClassId || !getActiveClass()) {
    window.location.href = '../pages/admin.html?tab=classes';
    return;
  }

  // Try load latest student list from server; fallback to local if fails
  try {
    await loadClassStudentsFromServer(activeClassId);
  } catch (e) {
    // ignore and continue with local data
  }

  refreshStudentPage();
  attachAdminStudentsEvents();
}

document.addEventListener('DOMContentLoaded', initializeAdminStudentsPage);
