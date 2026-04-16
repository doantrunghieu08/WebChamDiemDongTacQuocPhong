// Mở modal cập nhật tài khoản, điền sẵn thông tin
function openUpdateAccountModal(accountId) {
  const account = adminAccounts.find(acc => acc.id === accountId);
  if (!account) return;
  document.getElementById('accountModal').style.display = 'flex';
  document.getElementById('accountId').value = account.id;
  document.getElementById('accountName').value = account.name;
  document.getElementById('accountUsername').value = account.username;
  document.getElementById('accountRole').value = account.role;
  document.getElementById('accountPassword').value = account.password;
  document.getElementById('accountBirthday').value = account.birthday;
  document.getElementById('accountEmail').value = account.email;
  // Disable sửa mã tài khoản
  document.getElementById('accountId').readOnly = true;
  // Set status
  document.getElementById('accountStatus').value = account.status || 'active';
}
let adminUser = null;
let adminAccounts = [];
let adminClasses = [];
let adminPopupConfirmHandler = null;
let adminPopupCancelHandler = null;

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

function checkAdminAccess() {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  if (user.role !== 'admin') {
    window.location.href = '/pages/home.html';
    return null;
  }
  return user;
}

function getStoredStudentCount(classId, fallback = 0) {
  const allStudents = JSON.parse(localStorage.getItem('classStudents') || '{}');
  if (Array.isArray(allStudents[classId])) {
    return allStudents[classId].length;
  }
  return fallback;
}

function getDefaultAdminAccounts() {
  return [
    { id: 'ADMIN001', name: 'Quản trị viên hệ thống', username: 'admin', password: 'admin123', birthday: '1988-08-08', gender: 'Nam', role: 'admin', status: 'active', email: 'admin@hactech.edu.vn' },
    { id: 'GV001', name: 'Nguyễn Văn A', username: 'nguyenvana', password: 'gv00123', birthday: '1985-06-15', gender: 'Nam', role: 'teacher', status: 'active', email: 'gv001@hactech.edu.vn' },
    { id: 'GV002', name: 'Trần Minh Quang', username: 'tranminhquang', password: 'gv00223', birthday: '1987-10-21', gender: 'Nam', role: 'teacher', status: 'active', email: 'gv002@hactech.edu.vn' },
    { id: 'SV001', name: 'Nguyễn Văn An', username: 'sv001', password: 'sv00123', birthday: '2004-03-20', gender: 'Nam', role: 'student', status: 'active', email: 'sv001@student.hactech.edu.vn' },
    { id: 'SV002', name: 'Trần Thị Bình', username: 'sv002', password: 'sv00223', birthday: '2004-08-12', gender: 'Nữ', role: 'student', status: 'active', email: 'sv002@student.hactech.edu.vn' }
  ].map(normalizeAdminAccount);
}

function getDefaultAdminClasses() {
  return [
    { classId: '1', className: 'Lớp Quân sự 1', subject: 'Động tác Quốc phòng', semester: 'I', year: '2025-2026', roomNumber: '101', studentCount: getStoredStudentCount('1', 30), assignedTeacherId: 'GV001', assignedTeacherName: 'Nguyễn Văn A' },
    { classId: '2', className: 'Lớp Quân sự 2', subject: 'Động tác Quốc phòng', semester: 'I', year: '2025-2026', roomNumber: '102', studentCount: getStoredStudentCount('2', 28), assignedTeacherId: 'GV002', assignedTeacherName: 'Trần Minh Quang' },
    { classId: '3', className: 'Lớp Quân sự 3', subject: 'Động tác Quốc phòng', semester: 'II', year: '2025-2026', roomNumber: '203', studentCount: getStoredStudentCount('3', 32), assignedTeacherId: 'GV001', assignedTeacherName: 'Nguyễn Văn A' }
  ];
}

function getAdminAccounts() {
  const stored = JSON.parse(localStorage.getItem('adminAccounts') || 'null');
  const accounts = (Array.isArray(stored) ? stored : getDefaultAdminAccounts()).map(normalizeAdminAccount);
  localStorage.setItem('adminAccounts', JSON.stringify(accounts));
  return accounts;
}

function saveAdminAccounts(accounts) {
  adminAccounts = accounts.map(normalizeAdminAccount);
  localStorage.setItem('adminAccounts', JSON.stringify(adminAccounts));
}

function getAdminClasses() {
  const stored = JSON.parse(localStorage.getItem('adminClasses') || 'null');
  const classes = Array.isArray(stored) ? stored : getDefaultAdminClasses();
  const normalized = classes.map(cls => ({
    ...cls,
    studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0),
    assignedTeacherId: cls.assignedTeacherId || '',
    assignedTeacherName: cls.assignedTeacherName || ''
  }));
  localStorage.setItem('adminClasses', JSON.stringify(normalized));
  return normalized;
}

function saveAdminClasses(classes) {
  adminClasses = classes.map(cls => ({
    ...cls,
    studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0)
  }));
  localStorage.setItem('adminClasses', JSON.stringify(adminClasses));
  syncTeacherClassAssignments();
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
    localStorage.setItem(`classes_${teacher.id}`, JSON.stringify(assignedClasses));
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
  if (role === 'admin') return 'Quản trị';
  if (role === 'teacher') return 'Giảng viên';
  return 'Sinh viên';
}

function getStatusLabel(status) {
  return status === 'locked' ? 'Tạm khóa' : 'Hoạt động';
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('active'));
  document.getElementById(`${tabName}-tab`)?.classList.add('active');
  document.querySelector(`.admin-nav-link[data-tab="${tabName}"]`)?.classList.add('active');

  if (tabName === 'accounts') renderAccounts();
  if (tabName === 'classes') renderClasses();
  if (tabName === 'assignments') renderAssignments();
}

function renderAccounts() {
  const container = document.getElementById('accountsContent');
  if (!container) return;

  // Lọc theo tìm kiếm
  const searchValue = (document.getElementById('accountSearchInput')?.value || '').toLowerCase();
  let filtered = adminAccounts;
  if (searchValue) {
    filtered = adminAccounts.filter(acc =>
      acc.name.toLowerCase().includes(searchValue) ||
      acc.id.toLowerCase().includes(searchValue) ||
      acc.username.toLowerCase().includes(searchValue)
    );
  }

  const teachers = filtered.filter(account => account.role === 'teacher').length;
  const students = filtered.filter(account => account.role === 'student').length;
  const locked = filtered.filter(account => account.status === 'locked').length;

  container.innerHTML = `
    <div class="admin-summary-grid">
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-users"></i></div>
        <div class="admin-summary-value">${filtered.length}</div>
        <div class="admin-summary-label">Tổng tài khoản</div>
      </div>
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-chalkboard-teacher"></i></div>
        <div class="admin-summary-value">${teachers}</div>
        <div class="admin-summary-label">Giảng viên</div>
      </div>
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-user-graduate"></i></div>
        <div class="admin-summary-value">${students}</div>
        <div class="admin-summary-label">Sinh viên</div>
      </div>
      <div class="admin-summary-card">
        <div class="admin-summary-icon"><i class="fas fa-lock"></i></div>
        <div class="admin-summary-value">${locked}</div>
        <div class="admin-summary-label">Tài khoản khóa</div>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Họ tên</th>
            <th>Username</th>
            <th>Vai trò</th>
            <th>Ngày sinh</th>
            <th>Email</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(account => `
            <tr>
              <td><strong>${account.id}</strong></td>
              <td>${account.name}</td>
              <td>${account.username}</td>
              <td><span class="admin-role-badge ${account.role}">${getRoleLabel(account.role)}</span></td>
              <td>${account.birthday}</td>
              <td>${account.email}</td>
              <td><span class="admin-status-badge ${account.status}">${getStatusLabel(account.status)}</span></td>
              <td>
                <div class="admin-action-group">
                  <button class="admin-update-btn" onclick="openUpdateAccountModal('${account.id}')">
                    Cập nhật
                  </button>
                  <button class="admin-delete-btn" onclick="deleteAccount('${account.id}')">Xóa</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
      cls.classId.toLowerCase().includes(searchValue) ||
      cls.subject.toLowerCase().includes(searchValue)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="admin-empty-state">Không tìm thấy lớp nào phù hợp.</div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-class-grid">
      ${filtered.map(cls => `
        <div class="admin-class-card">
          <div class="admin-class-top">
            <div>
              <div class="admin-class-title">${cls.className}</div>
              <div class="admin-class-subtitle">Mã lớp: ${cls.classId}</div>
            </div>
            <span class="admin-assigned-badge">${cls.semester}</span>
          </div>
          <div class="admin-class-meta">
            <span><i class="fas fa-calendar-alt"></i> Năm học: ${cls.year}</span>
            <span><i class="fas fa-door-open"></i> Phòng: ${cls.roomNumber}</span>
            <span><i class="fas fa-users"></i> Sinh viên: ${getStoredStudentCount(cls.classId, cls.studentCount || 0)}</span>
            <span><i class="fas fa-user-tie"></i> Giảng viên: ${cls.assignedTeacherName || 'Chưa phân công'}</span>
          </div>
          <div class="admin-class-actions">
            <button class="admin-secondary-btn" onclick="openStudentManagerPage('${cls.classId}')"><i class="fas fa-users"></i> Quản lý sinh viên</button>
            <button class="admin-delete-btn" onclick="deleteClassAdmin('${cls.classId}')">Xóa lớp</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAssignments() {
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

  const teachers = adminAccounts.filter(account => account.role === 'teacher' && account.status === 'active');
  if (filtered.length === 0) {
    container.innerHTML = '<div class="admin-empty-state">Không tìm thấy lớp nào phù hợp.</div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-assignment-grid">
      ${filtered.map(cls => `
        <div class="admin-assignment-card">
          <div class="admin-assignment-top">
            <div>
              <div class="admin-assignment-title">${cls.className}</div>
              <div class="admin-assignment-subtitle">Mã lớp: ${cls.classId} · Phòng ${cls.roomNumber}</div>
            </div>
            <span class="admin-assigned-badge">${getStoredStudentCount(cls.classId, cls.studentCount || 0)} SV</span>
          </div>
          <div class="admin-assignment-meta">
            <span><i class="fas fa-calendar-week"></i> Học kỳ ${cls.semester} - ${cls.year}</span>
            <span><i class="fas fa-user-check"></i> Hiện tại: ${cls.assignedTeacherName || 'Chưa phân công'}</span>
          </div>
          <select class="admin-assignment-select" id="assignTeacher-${cls.classId}">
            <option value="">Chưa phân công</option>
            ${teachers.map(teacher => `<option value="${teacher.id}" ${teacher.id === cls.assignedTeacherId ? 'selected' : ''}>${teacher.name} (${teacher.id})</option>`).join('')}
          </select>
          <button class="admin-assign-btn" onclick="saveAssignment('${cls.classId}')">Lưu phân công</button>
        </div>
      `).join('')}
    </div>
  `;
}

function openAccountModal() {
  const form = document.getElementById('accountForm');
  if (form) form.reset();
  const idInput = document.getElementById('accountId');
  if (idInput) idInput.readOnly = false;
  document.getElementById('accountModal').style.display = 'flex';
  // Reset status to active
  const statusInput = document.getElementById('accountStatus');
  if (statusInput) statusInput.value = 'active';
}

function closeAccountModal() {
  document.getElementById('accountModal').style.display = 'none';
}

function openClassModal() {
  document.getElementById('classForm')?.reset();
  document.getElementById('classModal').style.display = 'flex';
}

function closeClassModal() {
  document.getElementById('classModal').style.display = 'none';
}

function openStudentManagerPage(classId) {
  window.location.href = `/pages/admin-students.html?classId=${encodeURIComponent(classId)}`;
}

function addAccount(event) {
  event.preventDefault();
  const id = document.getElementById('accountId').value.trim();
  const name = document.getElementById('accountName').value.trim();
  const username = document.getElementById('accountUsername').value.trim();
  const role = document.getElementById('accountRole').value;
  const password = document.getElementById('accountPassword').value.trim();
  const birthday = document.getElementById('accountBirthday').value;
  const email = document.getElementById('accountEmail').value.trim();
  const status = document.getElementById('accountStatus').value;

  if (!id || !name || !username || !password || !birthday || !email) {
    showAdminNotice('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin tài khoản.', 'warning');
    return;
  }
  if (password.length < 6) {
    showAdminNotice('Mật khẩu chưa hợp lệ', 'Mật khẩu phải có ít nhất 6 ký tự.', 'warning');
    return;
  }
  if (adminAccounts.some(account => account.id.toLowerCase() === id.toLowerCase())) {
    showAdminNotice('Trùng mã tài khoản', 'Mã tài khoản đã tồn tại.', 'warning');
    return;
  }
  if (adminAccounts.some(account => account.username.toLowerCase() === username.toLowerCase())) {
    showAdminNotice('Trùng username', 'Username đã tồn tại.', 'warning');
    return;
  }

  saveAdminAccounts([{ id, name, username, password, birthday, role, status, email }, ...adminAccounts]);
  syncTeacherClassAssignments();
  closeAccountModal();
  renderAccounts();
  renderAssignments();
  showAdminNotice('Cập nhật thành công', `Đã thêm tài khoản ${id}.`, 'success');
}

function addClass(event) {
  event.preventDefault();
  const classId = document.getElementById('adminClassId').value.trim();
  const className = document.getElementById('adminClassName').value.trim();
  const subject = document.getElementById('adminClassSubject').value.trim();
  const roomNumber = document.getElementById('adminClassRoom').value.trim();
  const semester = document.getElementById('adminClassSemester').value;
  const year = document.getElementById('adminClassYear').value.trim();

  if (!classId || !className || !subject || !roomNumber || !year) {
    showAdminNotice('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin lớp học.', 'warning');
    return;
  }
  if (adminClasses.some(cls => cls.classId.toLowerCase() === classId.toLowerCase())) {
    showAdminNotice('Trùng mã lớp', 'Mã lớp đã tồn tại.', 'warning');
    return;
  }

  const newClass = {
    classId,
    className,
    subject,
    semester,
    year,
    roomNumber,
    studentCount: 0,
    assignedTeacherId: '',
    assignedTeacherName: ''
  };

  saveAdminClasses([newClass, ...adminClasses]);
  closeClassModal();
  renderClasses();
  renderAssignments();
  showAdminNotice('Cập nhật thành công', `Đã tạo lớp ${className}.`, 'success');
}

function deleteAccount(accountId) {
  const target = adminAccounts.find(account => account.id === accountId);
  if (!target) return;
  if (target.id === adminUser.studentId) {
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
        localStorage.removeItem(`classes_${accountId}`);
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
  if (target.id === adminUser.studentId) {
    showAdminNotice('Không thể cập nhật', 'Không thể khóa tài khoản admin đang đăng nhập.', 'warning');
    return;
  }

  const nextStatus = target.status === 'locked' ? 'active' : 'locked';
  showAdminConfirm(
    nextStatus === 'locked' ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
    nextStatus === 'locked'
      ? `Bạn có chắc chắn muốn khóa tài khoản ${accountId}?`
      : `Bạn có chắc chắn muốn mở khóa tài khoản ${accountId}?`,
    () => {
      saveAdminAccounts(adminAccounts.map(account => account.id === accountId
        ? { ...account, status: nextStatus }
        : account));
      syncTeacherClassAssignments();
      renderAccounts();
      renderAssignments();
      showAdminNotice(
        'Cập nhật thành công',
        nextStatus === 'locked' ? `Đã khóa tài khoản ${accountId}.` : `Đã mở khóa tài khoản ${accountId}.`,
        'success'
      );
    },
    { confirmText: 'Xác nhận', variant: 'warning' }
  );
}

function deleteClassAdmin(classId) {
  const target = adminClasses.find(cls => cls.classId === classId);
  if (!target) return;
  showAdminConfirm(
    'Xóa lớp',
    `Bạn có chắc chắn muốn xóa lớp ${target.className}?`,
    () => {
      saveAdminClasses(adminClasses.filter(cls => cls.classId !== classId));
      renderClasses();
      renderAssignments();
      showAdminNotice('Xóa thành công', `Đã xóa lớp ${target.className}.`, 'success');
    },
    { confirmText: 'Xóa', variant: 'danger' }
  );
}

function saveAssignment(classId) {
  const select = document.getElementById(`assignTeacher-${classId}`);
  const teacherId = select ? select.value : '';
  const teacher = adminAccounts.find(account => account.id === teacherId);

  saveAdminClasses(adminClasses.map(cls => cls.classId === classId
    ? {
        ...cls,
        assignedTeacherId: teacherId,
        assignedTeacherName: teacher ? teacher.name : ''
      }
    : cls));

  renderAssignments();
  renderClasses();
  showAdminNotice('Cập nhật thành công', teacher ? `Đã phân công lớp cho ${teacher.name}.` : 'Đã hủy phân công lớp.', 'success');
}

function handleAdminLogout() {
  showAdminConfirm(
    'Xác nhận đăng xuất',
    'Bạn có chắc chắn muốn thoát khỏi trang quản trị?',
    () => {
      localStorage.removeItem('currentUser');
      window.location.href = '/index.html';
    },
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

    // Xử lý nhập lớp từ Excel
    function handleClassExcelImport(e) {
      const file = e.target.files[0];
      if (!file) return;
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
        // Các trường: classId, className, subject, semester, year, roomNumber
        const newClasses = [];
        for (const row of rows) {
          const classId = (row['classId'] || row['Mã lớp'] || '').toString().trim();
          const className = (row['className'] || row['Tên lớp'] || '').toString().trim();
          const subject = (row['subject'] || row['Môn học'] || '').toString().trim();
          const semester = (row['semester'] || row['Học kỳ'] || '').toString().trim();
          const year = (row['year'] || row['Năm học'] || '').toString().trim();
          const roomNumber = (row['roomNumber'] || row['Phòng học'] || '').toString().trim();
          if (!classId || !className || !subject || !semester || !year || !roomNumber) continue;
          if (adminClasses.some(cls => cls.classId.toLowerCase() === classId.toLowerCase())) continue;
          newClasses.push({ classId, className, subject, semester, year, roomNumber, studentCount: 0, assignedTeacherId: '', assignedTeacherName: '' });
        }
        if (!newClasses.length) {
          showAdminNotice('Không có lớp mới', 'Tất cả lớp trong file đã tồn tại hoặc thiếu thông tin.', 'warning');
          return;
        }
        saveAdminClasses([...newClasses, ...adminClasses]);
        renderClasses();
        renderAssignments();
        showAdminNotice('Nhập thành công', `Đã thêm ${newClasses.length} lớp từ Excel.`, 'success');
        e.target.value = '';
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

  // Xử lý nhập tài khoản từ Excel
  function handleExcelImport(e) {
    const file = e.target.files[0];
    if (!file) return;
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
  function updateAccount(event) {
    event.preventDefault();
    const id = document.getElementById('accountId').value.trim();
    const name = document.getElementById('accountName').value.trim();
    const username = document.getElementById('accountUsername').value.trim();
    const role = document.getElementById('accountRole').value;
    const password = document.getElementById('accountPassword').value.trim();
    const birthday = document.getElementById('accountBirthday').value;
    const email = document.getElementById('accountEmail').value.trim();
    const status = document.getElementById('accountStatus').value;

    if (!id || !name || !username || !password || !birthday || !email) {
      showAdminNotice('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin tài khoản.', 'warning');
      return;
    }
    if (password.length < 6) {
      showAdminNotice('Mật khẩu chưa hợp lệ', 'Mật khẩu phải có ít nhất 6 ký tự.', 'warning');
      return;
    }
    // Không kiểm tra trùng mã/username khi cập nhật chính tài khoản này
    saveAdminAccounts(adminAccounts.map(acc => acc.id === id ? { id, name, username, password, birthday, role, status, email } : acc));
    syncTeacherClassAssignments();
    closeAccountModal();
    renderAccounts();
    renderAssignments();
    showAdminNotice('Cập nhật thành công', `Đã cập nhật tài khoản ${id}.`, 'success');
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

function initializeAdminPage() {
  adminUser = checkAdminAccess();
  if (!adminUser) return;

  document.getElementById('adminUserName').textContent = adminUser.name || adminUser.studentId || 'Quản trị viên';
  adminAccounts = getAdminAccounts();
  adminClasses = getAdminClasses();
  syncTeacherClassAssignments();
  renderAccounts();
  renderClasses();
  renderAssignments();
  // Gắn sự kiện tìm kiếm
  const classSearchInput = document.getElementById('classSearchInput');
  if (classSearchInput) classSearchInput.addEventListener('input', renderClasses);
  const accountSearchInput = document.getElementById('accountSearchInput');
  if (accountSearchInput) accountSearchInput.addEventListener('input', renderAccounts);
  const assignmentSearchInput = document.getElementById('assignmentSearchInput');
  if (assignmentSearchInput) assignmentSearchInput.addEventListener('input', renderAssignments);
  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'accounts';
  switchAdminTab(initialTab);
  attachAdminEvents();
}

document.addEventListener('DOMContentLoaded', initializeAdminPage);