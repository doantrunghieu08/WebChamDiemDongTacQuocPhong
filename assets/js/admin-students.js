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
  genderInput.value = student.gender || 'Chưa cập nhật';
}

function findStudentAccountByCode(inputCode) {
  const normalizedCode = inputCode.trim().toLowerCase();
  if (!normalizedCode) return null;

  const studentAccounts = getStudentAccounts();
  return studentAccounts.find(account => account.id.toLowerCase() === normalizedCode) || null;
}

function handleStudentCodeLookup() {
  const codeInput = document.getElementById('studentClassCode');
  if (!codeInput) return;

  const rawCode = codeInput.value.trim().toUpperCase();
  codeInput.value = rawCode;

  if (!rawCode) {
    fillStudentLookupFields();
    updateStudentLookupState('Nhập mã sinh viên đã có trong danh sách tài khoản để tự động điền thông tin cơ bản.', 'default');
    return;
  }

  const matchedAccount = findStudentAccountByCode(rawCode);
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

function checkAdminStudentsAccess() {
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

function getAdminClasses() {
  const stored = JSON.parse(localStorage.getItem('adminClasses') || 'null');
  const classes = Array.isArray(stored) ? stored : [];
  const normalized = classes.map(cls => ({
    ...cls,
    studentCount: getStoredStudentCount(cls.classId, cls.studentCount || 0),
    assignedTeacherId: cls.assignedTeacherId || '',
    assignedTeacherName: cls.assignedTeacherName || ''
  }));
  localStorage.setItem('adminClasses', JSON.stringify(normalized));
  return normalized;
}

function getAdminAccounts() {
  return JSON.parse(localStorage.getItem('adminAccounts') || '[]');
}

function getStoredClassStudents() {
  return JSON.parse(localStorage.getItem('classStudents') || '{}');
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
    localStorage.setItem(`classes_${teacher.id}`, JSON.stringify(assignedClasses));
  });
}

function updateStoredClassStudents(classId, students) {
  const allStudents = getStoredClassStudents();
  allStudents[classId] = students;
  localStorage.setItem('classStudents', JSON.stringify(allStudents));

  adminStudentsClasses = adminStudentsClasses.map(cls => cls.classId === classId
    ? { ...cls, studentCount: students.length }
    : cls);
  localStorage.setItem('adminClasses', JSON.stringify(adminStudentsClasses));

  const selectedClass = JSON.parse(localStorage.getItem('selectedClass') || 'null');
  if (selectedClass && selectedClass.classId === classId) {
    selectedClass.studentCount = students.length;
    localStorage.setItem('selectedClass', JSON.stringify(selectedClass));
  }

  syncTeacherClassAssignments();
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
    window.location.href = '/pages/admin.html?tab=classes';
    return;
  }

  const students = getStoredClassStudents()[activeClassId] || [];
  document.getElementById('adminStudentsTitle').textContent = classItem.className;
  document.getElementById('adminStudentsSubtitle').textContent = `${classItem.subject} · Học kỳ ${classItem.semester} · Năm học ${classItem.year} · Phòng ${classItem.roomNumber}`;
  document.getElementById('adminStudentsClassCode').textContent = classItem.classId;
  document.getElementById('adminStudentsCount').textContent = `${students.length} sinh viên`;
}

function renderStudentManagerList() {
  const listContainer = document.getElementById('studentManagerList');
  if (!listContainer) return;

  const students = getStoredClassStudents()[activeClassId] || [];
  document.getElementById('adminStudentsListHint').textContent = `Toàn bộ thay đổi được đồng bộ ngay cho lớp ${activeClassId} và giảng viên được phân công.`;

  if (students.length === 0) {
    listContainer.innerHTML = '<div class="admin-student-empty">Chưa có sinh viên trong lớp này. Hãy thêm thủ công hoặc nhập từ Excel.</div>';
    return;
  }

  listContainer.innerHTML = `
    <div class="admin-student-list">
      ${students.map((student, index) => `
        <div class="admin-student-item">
          <div class="admin-student-order">${index + 1}</div>
          <div class="admin-student-content">
            <div class="admin-student-name">${student.name}</div>
            <div class="admin-student-meta">${student.code} · ${student.gender || 'Chưa cập nhật'} · ${formatStudentBirthday(student.birthday)}</div>
          </div>
          <button type="button" class="admin-delete-btn" onclick="removeStudentFromClass('${student.code}')">Xóa khỏi lớp</button>
        </div>
      `).join('')}
    </div>
  `;
}

function refreshStudentPage() {
  renderStudentPageHeader();
  renderStudentManagerList();
}

function addStudentToClass(event) {
  event.preventDefault();
  if (!activeClassId) return;

  const code = document.getElementById('studentClassCode').value.trim();
  const name = document.getElementById('studentClassName').value.trim();
  const birthday = document.getElementById('studentClassBirthday').value.trim();
  const gender = document.getElementById('studentClassGender').value.trim();
  const matchedAccount = findStudentAccountByCode(code);

  if (!code) {
    showAdminStudentsNotice('Thiếu thông tin', 'Vui lòng nhập mã sinh viên.', 'warning');
    return;
  }

  if (!matchedAccount || !name) {
    showAdminStudentsNotice('Không tìm thấy sinh viên', 'Mã sinh viên này chưa tồn tại trong danh sách tài khoản sinh viên.', 'warning');
    return;
  }

  const students = getStoredClassStudents()[activeClassId] || [];
  if (students.some(student => student.code.toLowerCase() === code.toLowerCase())) {
    showAdminStudentsNotice('Trùng mã sinh viên', 'Mã sinh viên đã tồn tại trong lớp này.', 'warning');
    return;
  }

  updateStoredClassStudents(activeClassId, [...students, {
    code,
    name,
    birthday: matchedAccount?.birthday || birthday,
    gender: matchedAccount?.gender || (gender !== 'Chưa cập nhật' ? gender : '')
  }]);
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

function handleStudentExcelFile(event) {
  if (!activeClassId) return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(loadEvent) {
    try {
      const data = new Uint8Array(loadEvent.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) {
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

        students.push({ code, name, gender });
        added += 1;
      }

      updateStoredClassStudents(activeClassId, students);
      refreshStudentPage();

      let message = `Đã thêm ${added} sinh viên vào lớp.`;
      if (skipped > 0) {
        message += ` Bỏ qua ${skipped} mã trùng.`;
      }
      showAdminStudentsNotice('Cập nhật thành công', message, 'success');
    } catch (error) {
      showAdminStudentsNotice('Đọc file thất bại', 'Không đọc được file Excel. Vui lòng kiểm tra định dạng file.', 'warning');
    }
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

function handleAdminStudentsLogout() {
  showAdminStudentsConfirm(
    'Xác nhận đăng xuất',
    'Bạn có chắc chắn muốn thoát khỏi trang quản lý sinh viên?',
    () => {
      localStorage.removeItem('currentUser');
      window.location.href = '/index.html';
    },
    { confirmText: 'Đăng xuất', variant: 'warning' }
  );
}

function goBackToAdmin() {
  window.location.href = '/pages/admin.html?tab=classes';
}

function attachAdminStudentsEvents() {
  document.getElementById('btnAdminStudentsLogout')?.addEventListener('click', handleAdminStudentsLogout);
  document.getElementById('studentManagerForm')?.addEventListener('submit', addStudentToClass);
  document.getElementById('studentClassCode')?.addEventListener('input', handleStudentCodeLookup);
  document.getElementById('adminStudentsFeedbackConfirm')?.addEventListener('click', confirmAdminStudentsPopup);
  document.getElementById('adminStudentsFeedbackCancel')?.addEventListener('click', cancelAdminStudentsPopup);

  window.addEventListener('click', (event) => {
    const feedbackModal = document.getElementById('adminStudentsFeedbackModal');
    if (event.target === feedbackModal) cancelAdminStudentsPopup();
  });
}

function initializeAdminStudentsPage() {
  adminStudentsUser = checkAdminStudentsAccess();
  if (!adminStudentsUser) return;

  document.getElementById('adminStudentsUserName').textContent = adminStudentsUser.studentId || adminStudentsUser.name || 'Quản trị viên';
  adminStudentsClasses = getAdminClasses();
  activeClassId = new URLSearchParams(window.location.search).get('classId');

  if (!activeClassId || !getActiveClass()) {
    window.location.href = '/pages/admin.html?tab=classes';
    return;
  }

  refreshStudentPage();
  attachAdminStudentsEvents();
}

document.addEventListener('DOMContentLoaded', initializeAdminStudentsPage);