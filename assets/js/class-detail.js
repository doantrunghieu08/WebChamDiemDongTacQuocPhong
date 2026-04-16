// ===== CLASS DETAIL PAGE LOGIC =====

let classData = null;
let studentsData = [];
let selectedExam = null;
let selectedStudent = null;
let pendingDeleteExamId = null;
let classDetailToastTimer = null;

function normalizeClassExamAssignment(assignment, index) {
  if (typeof assignment === 'string') {
    return {
      id: assignment,
      submissionDeadline: '',
      gradingDeadline: ''
    };
  }

  return {
    id: assignment?.id || `exam-${Date.now()}-${index}`,
    submissionDeadline: assignment?.submissionDeadline || '',
    gradingDeadline: assignment?.gradingDeadline || ''
  };
}

function getStoredClassExamAssignments() {
  const all = JSON.parse(localStorage.getItem('classExams') || '{}');
  let changed = false;

  Object.keys(all).forEach(classId => {
    const assignments = Array.isArray(all[classId]) ? all[classId] : [];
    const normalized = assignments.map(normalizeClassExamAssignment);
    if (JSON.stringify(assignments) !== JSON.stringify(normalized)) {
      all[classId] = normalized;
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem('classExams', JSON.stringify(all));
  }

  return all;
}

function getClassExamAssignments() {
  const all = getStoredClassExamAssignments();
  return all[classData.classId] || [];
}

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const timestamp = new Date(deadline).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() > timestamp;
}

function formatDeadline(deadline) {
  if (!deadline) return 'Chưa đặt';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ===== STUDENT DATA (localStorage) =====
function getClassStudents(classId) {
  const all = JSON.parse(localStorage.getItem('classStudents') || '{}');
  return all[classId] || [];
}

function saveClassStudents(classId, students) {
  const all = JSON.parse(localStorage.getItem('classStudents') || '{}');
  all[classId] = students;
  localStorage.setItem('classStudents', JSON.stringify(all));

  // Cập nhật số lượng sinh viên trong selectedClass
  if (classData) {
    classData.studentCount = students.length;
    localStorage.setItem('selectedClass', JSON.stringify(classData));
  }

  // Cập nhật trong danh sách lớp của giảng viên
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (user) {
    const key = `classes_${user.studentId || user.username}`;
    const classes = JSON.parse(localStorage.getItem(key) || '[]');
    const cls = classes.find(c => c.classId === classId);
    if (cls) {
      cls.studentCount = students.length;
      localStorage.setItem(key, JSON.stringify(classes));
    }
  }
}

function seedSampleStudents() {
  const sampleData = {
    '1': [
      { code: 'SV001', name: 'Nguyễn Văn An', gender: 'Nam' },
      { code: 'SV002', name: 'Trần Thị Bình', gender: 'Nữ' },
      { code: 'SV003', name: 'Lê Hoàng Cường', gender: 'Nam' },
      { code: 'SV004', name: 'Phạm Minh Đức', gender: 'Nam' },
      { code: 'SV005', name: 'Vũ Thị Hoa', gender: 'Nữ' },
    ],
    '2': [
      { code: 'SV006', name: 'Đỗ Quang Huy', gender: 'Nam' },
      { code: 'SV007', name: 'Hoàng Thị Lan', gender: 'Nữ' },
      { code: 'SV008', name: 'Bùi Văn Mạnh', gender: 'Nam' },
      { code: 'SV009', name: 'Ngô Thị Ngọc', gender: 'Nữ' },
    ],
    '3': [
      { code: 'SV010', name: 'Đinh Văn Phúc', gender: 'Nam' },
      { code: 'SV011', name: 'Lý Thị Quỳnh', gender: 'Nữ' },
      { code: 'SV012', name: 'Trương Văn Sơn', gender: 'Nam' },
    ]
  };
  const existing = JSON.parse(localStorage.getItem('classStudents') || '{}');
  let changed = false;
  for (const [id, students] of Object.entries(sampleData)) {
    if (!existing[id]) {
      existing[id] = students;
      changed = true;
    }
  }
  if (changed) localStorage.setItem('classStudents', JSON.stringify(existing));
}

// All available exam types
function getAllExamTypes() {
  const stored = JSON.parse(localStorage.getItem('examCatalog') || 'null');
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.map((exam, index) => ({
    id: exam.id || `exam-${Date.now()}-${index}`,
    name: exam.name || 'Bài thi mới',
    icon: '📝',
    iconClass: 'custom-exam',
    description: exam.description || 'Mô tả đang được cập nhật',
    videos: Array.isArray(exam.videos) ? exam.videos : []
  }));
}

// Lấy danh sách bài thi của lớp
function getClassExams() {
  const allExams = getAllExamTypes();
  const assignments = getClassExamAssignments();

  return assignments.map(assignment => {
    const exam = allExams.find(item => item.id === assignment.id);
    if (!exam) return null;

    return {
      ...exam,
      submissionDeadline: assignment.submissionDeadline,
      gradingDeadline: assignment.gradingDeadline
    };
  }).filter(Boolean);
}

// Lưu bài thi cho lớp
function saveClassExams(examAssignments) {
  const all = getStoredClassExamAssignments();
  all[classData.classId] = examAssignments.map(normalizeClassExamAssignment);
  localStorage.setItem('classExams', JSON.stringify(all));
}

// Seed bài thi mẫu cho lớp
function seedSampleExams() {
  const existing = getStoredClassExamAssignments();
  const allExamIds = getAllExamTypes().map(e => e.id);
  let changed = false;
  ['1', '2', '3'].forEach(classId => {
    if (!existing[classId]) {
      existing[classId] = allExamIds.map(id => ({
        id,
        submissionDeadline: '',
        gradingDeadline: ''
      }));
      changed = true;
    }
  });
  if (changed) localStorage.setItem('classExams', JSON.stringify(existing));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) {
    window.location.href = '/index.html';
    return;
  }
  document.getElementById('cdUserName').textContent = user.studentId || user.name || 'Giảng viên';

  classData = JSON.parse(localStorage.getItem('selectedClass'));
  if (!classData) {
    window.location.href = '/pages/home.html';
    return;
  }

  seedSampleStudents();
  seedSampleExams();
  studentsData = getClassStudents(classData.classId);
  renderBanner();
  renderStudents(studentsData);

  // close modals on backdrop click
  document.getElementById('gradingModal').addEventListener('click', function (e) {
    if (e.target === this) closeGradingModal();
  });
  document.getElementById('addExamModal').addEventListener('click', function (e) {
    if (e.target === this) closeAddExamModal();
  });
});

// ===== RENDER =====
function renderBanner() {
  const el = document.getElementById('classBanner');
  document.getElementById('breadcrumbClass').textContent = `${classData.className} (${classData.classId})`;
  el.innerHTML = `
    <div class="banner-icon"><i class="fas fa-chalkboard-teacher"></i></div>
    <div class="banner-info">
      <h1>${classData.className}</h1>
      <p>Mã lớp: ${classData.classId}</p>
    </div>
    <div class="banner-stats">
      <div class="banner-stat"><div class="val">${studentsData.length}</div><div class="lbl">Học sinh</div></div>
      <div class="banner-stat"><div class="val">${classData.semester}</div><div class="lbl">Học kỳ</div></div>
      <div class="banner-stat"><div class="val">${classData.roomNumber}</div><div class="lbl">Phòng</div></div>
      <div class="banner-stat"><div class="val">${classData.year}</div><div class="lbl">Năm học</div></div>
    </div>
  `;
}

function renderStudents(students) {
  const container = document.getElementById('studentList');
  const btnAddExam = document.getElementById('btnAddExam');

  if (!students || students.length === 0) {
    if (btnAddExam) btnAddExam.style.display = 'none';
    container.innerHTML = `
      <div class="cd-empty-state">
        <i class="fas fa-users"></i>
        <p>Chưa có sinh viên trong lớp</p>
        <span>Danh sách sinh viên được quản lý tại trang admin.</span>
      </div>`;
    return;
  }

  if (btnAddExam) btnAddExam.style.display = '';

  const savedScores = JSON.parse(localStorage.getItem('examScores') || '{}');

  container.innerHTML = students.map((s, i) => {
    const exams = getClassExams();

    let examPanelContent = '';
    if (exams.length === 0) {
      examPanelContent = `
        <div class="cd-exam-empty">
          <p>Lớp chưa có bài thi nào</p>
        </div>
      `;
    } else {
      const examCardsHTML = exams.map(exam => {
      const practiceKey = `${classData.classId}_${s.code}_${exam.id}_practice`;
      const officialKey = `${classData.classId}_${s.code}_${exam.id}_official`;
      const practiceScore = savedScores[practiceKey];
      const officialScore = savedScores[officialKey];
      const hasPractice = practiceScore !== undefined;
      const hasOfficial = officialScore !== undefined;
      const hasAnyScore = hasPractice || hasOfficial;

      let scoreHTML = '';
      if (hasAnyScore) {
        scoreHTML = '<div class="cd-exam-scores">';
        if (hasPractice) {
          scoreHTML += `<div class="cd-exam-score cd-score-practice"><span class="cd-score-label">📝 Luyện tập:</span> <span class="cd-score-value cd-val-practice">${parseFloat(practiceScore).toFixed(1)}/10</span></div>`;
        }
        if (hasOfficial) {
          scoreHTML += `<div class="cd-exam-score cd-score-official"><span class="cd-score-label">🏅 Chính thức:</span> <span class="cd-score-value cd-val-official">${parseFloat(officialScore).toFixed(1)}/10</span></div>`;
        }
        scoreHTML += '</div>';
      }

      const cardClass = hasOfficial ? 'cd-exam-graded cd-exam-official' : (hasPractice ? 'cd-exam-graded cd-exam-practiced' : '');
      const gradingLocked = isDeadlinePassed(exam.gradingDeadline);
      const btnHTML = gradingLocked
        ? `<div class="cd-exam-btn cd-exam-btn-locked"><i class="fas fa-lock"></i> Đã khóa chấm</div>`
        : hasAnyScore
        ? `<div class="cd-exam-btn cd-btn-regrading"><i class="fas fa-redo"></i> Chấm lại</div>`
        : `<div class="cd-exam-btn"><i class="fas fa-pen"></i> Chấm bài</div>`;
      const deadlineHTML = `
        <div class="cd-exam-deadlines">
          <div class="cd-exam-deadline"><i class="fas fa-hourglass-end"></i><span>Hạn nộp: ${formatDeadline(exam.submissionDeadline)}</span></div>
          <div class="cd-exam-deadline"><i class="fas fa-user-clock"></i><span>Hạn chấm: ${formatDeadline(exam.gradingDeadline)}</span></div>
          ${gradingLocked ? '<div class="cd-exam-lock-badge">Đã khóa chấm</div>' : ''}
        </div>
      `;

      return `
        <div class="cd-exam-card ${cardClass}" onclick="openGradingModal('${s.code}', '${exam.id}'); event.stopPropagation();">
          <div class="cd-exam-top">
            <div class="cd-exam-icon ${exam.iconClass}">${exam.icon}</div>
            <div>
              <div class="cd-exam-title">${exam.name}</div>
              <div class="cd-exam-sub">${exam.description}</div>
            </div>
          </div>
          ${deadlineHTML}
          ${scoreHTML}
          ${btnHTML}
        </div>
      `;
    }).join('');
      examPanelContent = `
        <div class="cd-exam-grid">${examCardsHTML}</div>
      `;
    }

    return `
      <div class="cd-student-row" id="student-${s.code}">
        <div class="cd-student-header" onclick="toggleStudent('${s.code}')">
          <div class="cd-student-number">${i + 1}</div>
          <div class="cd-student-info">
            <div class="cd-student-name">${s.name}</div>
            <div class="cd-student-meta">${s.code} · ${s.gender}</div>
          </div>
          <span class="cd-student-arrow"><i class="fas fa-chevron-right"></i></span>
        </div>
        <div class="cd-exam-panel">
          ${examPanelContent}
        </div>
      </div>
    `;
  }).join('');
}

// ===== INTERACTIONS =====
function toggleStudent(code) {
  const row = document.getElementById(`student-${code}`);
  if (!row) return;

  // collapse any other open row
  document.querySelectorAll('.cd-student-row.expanded').forEach(r => {
    if (r.id !== `student-${code}`) r.classList.remove('expanded');
  });

  row.classList.toggle('expanded');
}

function filterStudents() {
  const term = document.getElementById('searchStudent').value.toLowerCase();
  const filtered = studentsData.filter(s =>
    s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)
  );
  renderStudents(filtered);
}

// ===== GRADING MODAL =====
function openGradingModal(studentCode, examId) {
  const student = studentsData.find(s => s.code === studentCode);
  const exams = getClassExams();
  const exam = exams.find(e => e.id === examId);
  if (!student || !exam) return;
  if (isDeadlinePassed(exam.gradingDeadline)) {
    alert('Đã hết thời gian chấm bài cho bài thi này. Hệ thống đã khóa chấm.');
    return;
  }

  selectedStudent = student;
  selectedExam = exam;

  document.getElementById('gradingModalTitle').textContent = `Chấm: ${exam.name}`;

  const videosText = exam.videos.length > 0
    ? exam.videos.map(v => v.name).join(', ')
    : 'Chưa cập nhật video mẫu';
  document.getElementById('gradingExamInfo').innerHTML = `
    <div><strong>Sinh viên:</strong> ${student.name} (${student.code})</div>
    <div><strong>Bài thi:</strong> ${exam.name}</div>
    <div><strong>Video:</strong> ${videosText}</div>
    <div><strong>Hạn nộp:</strong> ${formatDeadline(exam.submissionDeadline)}</div>
    <div><strong>Hạn chấm:</strong> ${formatDeadline(exam.gradingDeadline)}</div>
  `;

  document.getElementById('gradingModal').style.display = 'flex';
}

function closeGradingModal() {
  document.getElementById('gradingModal').style.display = 'none';
  selectedExam = null;
  selectedStudent = null;
}

function startGrading(mode) {
  if (!selectedExam || !selectedStudent) return;
  if (isDeadlinePassed(selectedExam.gradingDeadline)) {
    alert('Đã hết thời gian chấm bài cho bài thi này.');
    return;
  }

  localStorage.setItem('gradingMode', mode);
  localStorage.setItem('gradingExam', JSON.stringify(selectedExam));
  localStorage.setItem('gradingStudent', JSON.stringify(selectedStudent));

  // Save selectedStudent data for chamdiem.js
  localStorage.setItem('selectedStudent', JSON.stringify({
    studentId: selectedStudent.code,
    name: selectedStudent.name,
    classId: classData.classId,
    className: classData.className,
    subject: selectedExam.name
  }));

  closeGradingModal();
  window.location.href = '/pages/chamdiem.html';
}

function goBack() {
  window.location.href = '/pages/home.html';
}

function showStudentManagementNotice() {
  alert('Chỉ admin mới có quyền thêm hoặc cập nhật sinh viên cho lớp này.');
}

function openAddStudentModal() {
  showStudentManagementNotice();
}

function closeAddStudentModal() {
  return;
}

function addStudent(event) {
  event?.preventDefault?.();
  showStudentManagementNotice();
}

function deleteStudent() {
  showStudentManagementNotice();
}

function closeDeleteModal() {
  return;
}

function confirmDeleteStudent() {
  showStudentManagementNotice();
}

function triggerExcelImport() {
  showStudentManagementNotice();
}

function handleExcelFile() {
  showStudentManagementNotice();
}

// ===== ADD EXAM TO CLASS =====

function openAddExamModal() {
  const assignedExams = getClassExams();
  const assignedIds = assignedExams.map(e => e.id);
  const allExams = getAllExamTypes();
  const available = allExams.filter(e => !assignedIds.includes(e.id));

  const assignedContainer = document.getElementById('assignedExamList');
  const container = document.getElementById('examCheckboxList');
  document.getElementById('submissionDeadline').value = '';
  document.getElementById('gradingDeadline').value = '';
  if (assignedExams.length === 0) {
    assignedContainer.innerHTML = '<p class="cd-assigned-empty">Chưa có bài thi nào được thêm vào lớp này.</p>';
  } else {
    assignedContainer.innerHTML = assignedExams.map(exam => `
      <div class="cd-assigned-exam-item">
        <div class="cd-assigned-exam-info">
          <span class="cd-assigned-exam-icon">${exam.icon}</span>
          <div>
            <div class="cd-assigned-exam-name">${exam.name}</div>
            <div class="cd-assigned-exam-desc">${exam.description}</div>
            <div class="cd-assigned-exam-time">
              <span>Hạn nộp: ${formatDeadline(exam.submissionDeadline)}</span>
              <span>Hạn chấm: ${formatDeadline(exam.gradingDeadline)}</span>
            </div>
          </div>
        </div>
        <button type="button" class="cd-assigned-exam-remove" onclick="requestDeleteExam('${exam.id}')">
          <i class="fas fa-trash-alt"></i> Xóa
        </button>
      </div>
    `).join('');
  }

  if (allExams.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;padding:12px;">Chưa có bài thi nào trong danh mục. Hãy tạo bài thi ở mục Bài Thi tại trang home trước.</p>';
  } else if (available.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#999;padding:12px;">Đã thêm tất cả bài thi.</p>';
  } else {
    container.innerHTML = available.map(exam => `
      <label class="cd-exam-checkbox">
        <input type="checkbox" value="${exam.id}">
        <span class="cd-exam-check-body">
          <span class="cd-exam-check-name">${exam.name}</span>
          <span class="cd-exam-check-desc">${exam.description}</span>
        </span>
      </label>
    `).join('');
  }

  document.getElementById('addExamModal').style.display = 'flex';
}

function closeAddExamModal() {
  document.getElementById('addExamModal').style.display = 'none';
  document.getElementById('submissionDeadline').value = '';
  document.getElementById('gradingDeadline').value = '';
}

function showClassDetailToast(message) {
  const toast = document.getElementById('classDetailToast');
  const messageEl = document.getElementById('classDetailToastMessage');
  if (!toast || !messageEl) return;

  messageEl.textContent = message;
  toast.style.display = 'flex';

  if (classDetailToastTimer) {
    clearTimeout(classDetailToastTimer);
  }

  classDetailToastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2600);
}

function requestDeleteExam(examId) {
  const exam = getClassExams().find(item => item.id === examId);
  if (!exam) return;

  pendingDeleteExamId = examId;
  document.getElementById('deleteExamMessage').textContent = `Bạn có chắc chắn muốn xóa bài thi ${exam.name} khỏi lớp ${classData.className}?`;
  document.getElementById('deleteExamModal').style.display = 'flex';
}

function closeDeleteExamModal() {
  document.getElementById('deleteExamModal').style.display = 'none';
  pendingDeleteExamId = null;
}

function confirmDeleteExam() {
  if (!pendingDeleteExamId) return;

  const nextExamAssignments = getClassExamAssignments().filter(exam => exam.id !== pendingDeleteExamId);

  saveClassExams(nextExamAssignments);
  renderStudents(studentsData);
  openAddExamModal();
  closeDeleteExamModal();
}

function addExamsToClass() {
  const checkboxes = document.querySelectorAll('#examCheckboxList input[type="checkbox"]:checked');
  const newIds = Array.from(checkboxes).map(cb => cb.value);
  const submissionDeadline = document.getElementById('submissionDeadline').value;
  const gradingDeadline = document.getElementById('gradingDeadline').value;

  if (newIds.length === 0) {
    alert('Vui lòng chọn ít nhất một bài thi.');
    return;
  }

  if (!submissionDeadline || !gradingDeadline) {
    alert('Vui lòng nhập đầy đủ hạn nộp bài và hạn chấm bài.');
    return;
  }

  if (new Date(gradingDeadline).getTime() <= new Date(submissionDeadline).getTime()) {
    alert('Hạn chấm bài phải lớn hơn hạn nộp bài.');
    return;
  }

  const current = getClassExamAssignments();
  const newAssignments = newIds.map(id => ({
    id,
    submissionDeadline,
    gradingDeadline
  }));
  saveClassExams([...current, ...newAssignments]);
  renderStudents(studentsData);
  closeAddExamModal();
  showClassDetailToast(`Đã thêm ${newIds.length} bài thi vào lớp thành công.`);
}
