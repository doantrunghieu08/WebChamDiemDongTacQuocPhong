let currentUser = null;
let currentClasses = [];
let isStudentView = false;
let pendingDeleteAction = null;
let pendingSaveExamAction = null;
let homeToastTimer = null;
let selectedGradingHistoryId = null;
const MIN_SAMPLE_VIDEOS_PER_EXAM = 1;
const SAMPLE_VIDEO_DB_NAME = 'hactech-sample-video-db';
const SAMPLE_VIDEO_STORE = 'examSampleVideos';
const SAMPLE_VIDEO_DB_VERSION = 1;
let sampleVideoDbPromise = null;

function checkLoginStatus() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  if (user.role === 'admin') {
    window.location.href = '/pages/admin.html';
    return null;
  }
  return user;
}

function getSampleStudents(classId) {
  const allStudents = {
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
  return allStudents[classId] || [];
}

function getSampleClasses() {
  return [
    { classId: '1', className: 'Lớp Quân sự 1', subject: 'Động tác Quốc phòng', semester: 'I', year: '2025-2026', studentCount: 30, roomNumber: '101' },
    { classId: '2', className: 'Lớp Quân sự 2', subject: 'Động tác Quốc phòng', semester: 'I', year: '2025-2026', studentCount: 28, roomNumber: '102' },
    { classId: '3', className: 'Lớp Quân sự 3', subject: 'Động tác Quốc phòng', semester: 'II', year: '2025-2026', studentCount: 32, roomNumber: '203' }
  ];
}

function getClassStorageKey() {
  return `classes_${currentUser.studentId || currentUser.name || 'teacher'}`;
}

function getTeacherClasses() {
  const stored = localStorage.getItem(getClassStorageKey());
  if (stored) {
    return JSON.parse(stored);
  }
  const seed = getSampleClasses();
  localStorage.setItem(getClassStorageKey(), JSON.stringify(seed));
  return seed;
}

function saveTeacherClasses(classes) {
  localStorage.setItem(getClassStorageKey(), JSON.stringify(classes));
}

function getDefaultExamCatalog() {
  return [
    {
      id: 'di-deu',
      name: 'Đi đều',
      icon: '🚶',
      iconClass: 'di-deu',
      description: 'Đi đều đúng nhịp, đúng tư thế',
      videos: [
        { name: 'Video mặt trước', file: 'di-deu-front.mp4' },
        { name: 'Video mặt bên', file: 'di-deu-side.mp4' }
      ]
    },
    {
      id: 'ban-sung',
      name: 'Bắn súng',
      icon: '🎯',
      iconClass: 'ban-sung',
      description: 'Tư thế bắn, ngắm, kỹ thuật bóp cò',
      videos: [
        { name: 'Video tổng quan', file: 'ban-sung-overview.mp4' },
        { name: 'Video chi tiết tay', file: 'ban-sung-detail.mp4' }
      ]
    },
    {
      id: 'vo-thuat',
      name: 'Võ thuật',
      icon: '🥋',
      iconClass: 'vo-thuat',
      description: 'Các đòn đánh cơ bản và phòng thủ',
      videos: [
        { name: 'Video bài quyền', file: 'vo-thuat-quyen.mp4' }
      ]
    },
    {
      id: 'the-duc',
      name: 'Thể dục',
      icon: '🤸',
      iconClass: 'the-duc',
      description: 'Bài tập thể dục buổi sáng',
      videos: [
        { name: 'Video toàn bài', file: 'the-duc-full.mp4' },
        { name: 'Video từng động tác', file: 'the-duc-parts.mp4' }
      ]
    },
    {
      id: 'chay-vu-trang',
      name: 'Chạy vũ trang',
      icon: '🏃',
      iconClass: 'chay-vu-trang',
      description: 'Chạy mang trang bị quân sự',
      videos: [
        { name: 'Video toàn trình', file: 'chay-vt-full.mp4' }
      ]
    }
  ];
}

function normalizeExamItem(exam, index) {
  return {
    id: exam.id || `exam-${Date.now()}-${index}`,
    name: exam.name || 'Bài thi mới',
    icon: '📝',
    iconClass: 'custom-exam',
    description: exam.description || 'Mô tả đang được cập nhật',
    videos: Array.isArray(exam.videos) ? exam.videos : []
  };
}

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

function getNormalizedClassExamMap() {
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

function isDeadlinePassed(deadline) {
  if (!deadline) return false;
  const timestamp = new Date(deadline).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() > timestamp;
}

function syncClassExamAssignments(validExamIds) {
  const allClassExams = getNormalizedClassExamMap();
  let changed = false;

  Object.keys(allClassExams).forEach(classId => {
    const assignments = Array.isArray(allClassExams[classId]) ? allClassExams[classId] : [];
    const filtered = assignments.filter(item => validExamIds.includes(item.id));
    if (filtered.length !== assignments.length) {
      allClassExams[classId] = filtered;
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem('classExams', JSON.stringify(allClassExams));
  }
}

function getExamCatalog() {
  const stored = JSON.parse(localStorage.getItem('examCatalog') || 'null');
  const base = Array.isArray(stored) ? stored : getDefaultExamCatalog();
  const normalized = base.map(normalizeExamItem);

  if (!stored || JSON.stringify(stored) !== JSON.stringify(normalized)) {
    localStorage.setItem('examCatalog', JSON.stringify(normalized));
  }

  syncClassExamAssignments(normalized.map(exam => exam.id));
  return normalized;
}

function saveExamCatalog(exams) {
  const normalized = exams.map(normalizeExamItem);
  localStorage.setItem('examCatalog', JSON.stringify(normalized));
  syncClassExamAssignments(normalized.map(exam => exam.id));
  return normalized;
}

function getExamUsageCount(examId) {
  const allClassExams = getNormalizedClassExamMap();
  return Object.values(allClassExams).filter(assignments => Array.isArray(assignments) && assignments.some(item => item.id === examId)).length;
}

function cleanupExamScores(examId) {
  const scores = JSON.parse(localStorage.getItem('examScores') || '{}');
  let changed = false;

  Object.keys(scores).forEach(key => {
    if (key.includes(`_${examId}_`)) {
      delete scores[key];
      changed = true;
    }
  });

  if (changed) {
    localStorage.setItem('examScores', JSON.stringify(scores));
  }
}

function getDefaultErrorData() {
  return [
    {
      id: 1,
      name: 'Sai tư thế đứng nghiêm',
      description: 'Không đứng thẳng, hai chân không khép, tay không áp sát thân',
      severity: 'cao',
      deduction: 2,
      icon: 'fas fa-male',
      students: [
        { name: 'Nguyễn Văn An', code: 'SV001', class: 'QP-01', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+tư+thế+đứng' },
        { name: 'Trần Thị Bình', code: 'SV005', class: 'QP-01', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+tư+thế+đứng' },
        { name: 'Lê Hoàng Cường', code: 'SV012', class: 'QP-02', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+tư+thế+đứng' },
        { name: 'Phạm Minh Đức', code: 'SV018', class: 'QP-02', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+tư+thế+đứng' },
        { name: 'Hoàng Thị Em', code: 'SV024', class: 'QP-03', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+tư+thế+đứng' }
      ]
    },
    {
      id: 2,
      name: 'Bước chân không đều',
      description: 'Nhịp bước không đồng đều, chân không nâng đúng độ cao quy định',
      severity: 'cao',
      deduction: 1.5,
      icon: 'fas fa-walking',
      students: [
        { name: 'Vũ Quang Hải', code: 'SV003', class: 'QP-01', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+bước+chân' },
        { name: 'Đỗ Văn Khoa', code: 'SV008', class: 'QP-01', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+bước+chân' },
        { name: 'Ngô Thị Lan', code: 'SV015', class: 'QP-02', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+bước+chân' }
      ]
    },
    {
      id: 3,
      name: 'Tay vung sai kỹ thuật',
      description: 'Tay vung không đúng biên độ, không phối hợp nhịp nhàng với chân',
      severity: 'trung-binh',
      deduction: 1,
      icon: 'fas fa-hand-paper',
      students: [
        { name: 'Bùi Anh Minh', code: 'SV002', class: 'QP-01', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+vung+tay' },
        { name: 'Trịnh Đức Nam', code: 'SV009', class: 'QP-01', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+vung+tay' },
        { name: 'Lý Thị Oanh', code: 'SV016', class: 'QP-02', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+vung+tay' },
        { name: 'Phan Văn Phúc', code: 'SV022', class: 'QP-03', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+vung+tay' }
      ]
    },
    {
      id: 4,
      name: 'Sai động tác quay',
      description: 'Quay không đúng hướng, không xoay trên gót chân, mất thăng bằng',
      severity: 'cao',
      deduction: 2,
      icon: 'fas fa-sync-alt',
      students: [
        { name: 'Cao Thị Quyên', code: 'SV006', class: 'QP-01', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+quay' },
        { name: 'Đinh Văn Sơn', code: 'SV011', class: 'QP-02', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+quay' },
        { name: 'Hà Minh Tâm', code: 'SV019', class: 'QP-02', image: 'https://placehold.co/400x300/ffebee/c62828?text=Lỗi+quay' }
      ]
    },
    {
      id: 5,
      name: 'Không giữ đúng cự ly hàng',
      description: 'Khoảng cách giữa các hàng không đều, không thẳng hàng ngang dọc',
      severity: 'trung-binh',
      deduction: 0.5,
      icon: 'fas fa-arrows-alt-h',
      students: [
        { name: 'Lưu Văn Uy', code: 'SV004', class: 'QP-01', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+cự+ly' },
        { name: 'Mai Thị Vân', code: 'SV014', class: 'QP-02', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+cự+ly' },
        { name: 'Nguyễn Xuân Yên', code: 'SV025', class: 'QP-03', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+cự+ly' },
        { name: 'Trần Đình Bảo', code: 'SV028', class: 'QP-03', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+cự+ly' },
        { name: 'Lê Hồng Châu', code: 'SV031', class: 'QP-03', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+cự+ly' },
        { name: 'Phạm Quốc Dũng', code: 'SV034', class: 'QP-04', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+cự+ly' }
      ]
    },
    {
      id: 6,
      name: 'Mắt không nhìn thẳng',
      description: 'Mắt nhìn xuống đất hoặc nhìn ngang, không tập trung nhìn thẳng phía trước',
      severity: 'trung-binh',
      deduction: 0.5,
      icon: 'fas fa-eye',
      students: [
        { name: 'Hoàng Gia Hưng', code: 'SV007', class: 'QP-01', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+mắt' },
        { name: 'Vũ Thị Kim', code: 'SV017', class: 'QP-02', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+mắt' },
        { name: 'Đặng Văn Long', code: 'SV023', class: 'QP-03', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+mắt' }
      ]
    },
    {
      id: 7,
      name: 'Thân người nghiêng khi di chuyển',
      description: 'Người không giữ thẳng khi đi đều, ngả về trước hoặc sau',
      severity: 'trung-binh',
      deduction: 1,
      icon: 'fas fa-street-view',
      students: [
        { name: 'Ngô Bá Nhân', code: 'SV010', class: 'QP-01', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+nghiêng' },
        { name: 'Bùi Thị Phương', code: 'SV020', class: 'QP-02', image: 'https://placehold.co/400x300/fff3e0/e65100?text=Lỗi+nghiêng' }
      ]
    }
  ];
}

function getStoredErrors() {
  const stored = JSON.parse(localStorage.getItem('teacherErrorCatalog') || 'null');
  if (Array.isArray(stored)) {
    return stored;
  }
  const seed = getDefaultErrorData();
  localStorage.setItem('teacherErrorCatalog', JSON.stringify(seed));
  return seed;
}

function saveStoredErrors(errors) {
  localStorage.setItem('teacherErrorCatalog', JSON.stringify(errors));
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));

  const activeTab = document.getElementById(`${tabName}-tab`);
  const activeMenu = document.querySelector(`.menu-link[data-tab="${tabName}"]`);

  if (activeTab) {
    activeTab.classList.add('active');
  }
  if (activeMenu) {
    activeMenu.classList.add('active');
  }

  // Teacher tabs
  if (tabName === 'classes') {
    renderClasses(currentClasses);
  }
  if (tabName === 'exams') {
    loadExamsContent();
  }
  if (tabName === 'profile') {
    loadProfileContent();
  }
  if (tabName === 'errors') {
    loadErrorsContent();
  }
  if (tabName === 'history') {
    loadGradingHistoryContent();
  }
  if (tabName === 'report') {
    loadReportContent();
  }

  // Student tabs
  if (tabName === 'st-profile') {
    loadStudentProfile();
  }
  if (tabName === 'st-exams') {
    loadStudentExams();
  }
}

function loadProfileContent() {
  const container = document.getElementById('profileContent');
  if (!container) {
    return;
  }

  const teacherId = currentUser.studentId || 'GV001';
  const teacherName = currentUser.name || 'Nguyễn Văn A';

  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar"><i class="fas fa-user-tie"></i></div>
        <div class="profile-name">${teacherName}</div>
        <div class="profile-role">Giảng viên</div>
        <div class="profile-status"><span class="status-dot"></span> Đang hoạt động</div>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-card-title"><i class="fas fa-id-card"></i> Thông tin cá nhân</div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-fingerprint"></i> Mã giảng viên</span>
        <span class="field-value">${teacherId}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-user"></i> Họ và tên</span>
        <span class="field-value">${teacherName}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-envelope"></i> Email</span>
        <span class="field-value">${teacherId.toLowerCase()}@hactech.edu.vn</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-phone"></i> Số điện thoại</span>
        <span class="field-value">0987 654 321</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-birthday-cake"></i> Ngày sinh</span>
        <span class="field-value">15/06/1985</span>
      </div>
    </div>
  `;
}

function renderClasses(classes) {
  const classGrid = document.getElementById('classGrid');
  const emptyState = document.getElementById('emptyState');
  if (!classGrid || !emptyState) {
    return;
  }

  if (!classes || classes.length === 0) {
    classGrid.style.display = 'none';
    classGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  classGrid.innerHTML = classes.map(cls => `
    <div class="class-card" data-class-id="${cls.classId}" onclick="goToClass('${cls.classId}')">
      <div class="class-header">
        <div>
          <div class="class-title">${cls.className}</div>
          <div class="class-code">Mã lớp: ${cls.classId}</div>
        </div>
        <div class="class-badge">${cls.semester}</div>
      </div>
      <div class="class-info">
        <div class="info-item">
          <span class="info-label">Năm học</span>
          <span class="info-value">${cls.year}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Phòng</span>
          <span class="info-value">${cls.roomNumber}</span>
        </div>
      </div>
      <div class="class-students"><strong>${cls.studentCount}</strong> học sinh</div>
      <div class="class-action">
        <button class="btn-class-action btn-details" onclick="viewClassDetails('${cls.classId}'); event.stopPropagation();">Vào lớp</button>
      </div>
    </div>
  `).join('');

  classGrid.style.display = 'grid';
  emptyState.style.display = 'none';
}

function goToClass(classId) {
  const selected = currentClasses.find(c => c.classId === classId);
  if (!selected) {
    return;
  }
  localStorage.setItem('selectedClassId', classId);
  localStorage.setItem('selectedClass', JSON.stringify(selected));
  window.location.href = '/pages/class-detail.html';
}

function viewClassDetails(classId) {
  const selected = currentClasses.find(c => c.classId === classId);
  if (!selected) {
    return;
  }
  localStorage.setItem('selectedClassId', classId);
  localStorage.setItem('selectedClass', JSON.stringify(selected));
  window.location.href = '/pages/class-detail.html';
}

function deleteClass(classId) {
  const selected = currentClasses.find(c => c.classId === classId);
  if (!selected) {
    return;
  }

  openDeleteConfirmModal(`Bạn có chắc chắn muốn xóa lớp ${selected.className} không?`, () => {
    currentClasses = currentClasses.filter(c => c.classId !== classId);
    saveTeacherClasses(currentClasses);
    renderClasses(currentClasses);
  });
}

function openAddClassModal() {
  const modal = document.getElementById('addClassModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeAddClassModal() {
  const modal = document.getElementById('addClassModal');
  const form = document.getElementById('addClassForm');
  if (form) {
    form.reset();
  }
  if (modal) {
    modal.style.display = 'none';
  }
}

function toggleStudentList() {
  const section = document.getElementById('studentListSection');
  const btn = document.querySelector('.btn-view-students');
  if (!section) return;

  if (section.style.display === 'none') {
    section.style.display = 'block';
    if (btn) btn.innerHTML = '<i class="fas fa-chevron-up"></i> Ẩn danh sách sinh viên';
  } else {
    section.style.display = 'none';
    if (btn) btn.innerHTML = '<i class="fas fa-users"></i> Xem danh sách sinh viên';
  }
}

function closeDetailsModal() {
  const modal = document.getElementById('classDetailsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function addClass(event) {
  event.preventDefault();

  const className = document.getElementById('newClassName').value.trim();
  const semester = document.getElementById('newClassSemester').value;
  const year = document.getElementById('newClassYear').value.trim();
  const roomNumber = document.getElementById('newClassRoom').value.trim();

  if (!className || !semester || !year || !roomNumber) {
    alert('Vui lòng nhập đầy đủ thông tin lớp học.');
    return;
  }

  const newClass = {
    classId: Date.now().toString(),
    className,
    semester,
    year,
    studentCount: 0,
    roomNumber
  };

  currentClasses = [newClass, ...currentClasses];
  saveTeacherClasses(currentClasses);
  renderClasses(currentClasses);
  closeAddClassModal();
}

function loadExamsContent() {
  const examGrid = document.getElementById('examGrid');
  const emptyState = document.getElementById('examEmptyState');
  if (!examGrid || !emptyState) {
    return;
  }

  const keyword = (document.getElementById('searchExamCatalog')?.value || '').toLowerCase().trim();
  const exams = getExamCatalog().filter(exam => {
    const text = `${exam.name} ${exam.description}`.toLowerCase();
    return text.includes(keyword);
  });

  if (exams.length === 0) {
    examGrid.innerHTML = '';
    examGrid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  examGrid.innerHTML = exams.map(exam => `
    <div class="exam-card">
      <div class="exam-card-header">
        <div>
          <h3 class="exam-card-title">${exam.name}</h3>
          <p class="exam-card-desc">${exam.description}</p>
        </div>
        <span class="exam-card-badge">${getExamUsageCount(exam.id)} lớp</span>
      </div>
      <div class="exam-card-meta">
        <span class="exam-meta-chip"><i class="fas fa-film"></i> ${exam.videos.length} video mẫu</span>
        <span class="exam-meta-chip"><i class="fas fa-id-badge"></i> ${exam.id}</span>
      </div>
      <div class="exam-card-actions">
        <button class="btn-exam-action btn-exam-edit" onclick="openExamModal('${exam.id}')">Cập nhật</button>
        <button class="btn-exam-action btn-exam-delete" onclick="deleteExam('${exam.id}')">Xóa</button>
      </div>
    </div>
  `).join('');

  examGrid.style.display = 'grid';
  emptyState.style.display = 'none';
}

function searchExams() {
  loadExamsContent();
}

function openSampleVideoDb() {
  if (!window.indexedDB) {
    return Promise.resolve(null);
  }

  if (sampleVideoDbPromise) {
    return sampleVideoDbPromise;
  }

  sampleVideoDbPromise = new Promise(resolve => {
    const request = window.indexedDB.open(SAMPLE_VIDEO_DB_NAME, SAMPLE_VIDEO_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAMPLE_VIDEO_STORE)) {
        db.createObjectStore(SAMPLE_VIDEO_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

  return sampleVideoDbPromise;
}

async function saveSampleVideoBlob(file, storageKey) {
  const db = await openSampleVideoDb();
  if (!db || !file) {
    return '';
  }

  return new Promise(resolve => {
    const tx = db.transaction(SAMPLE_VIDEO_STORE, 'readwrite');
    const store = tx.objectStore(SAMPLE_VIDEO_STORE);
    const request = store.put({
      id: storageKey,
      blob: file,
      fileName: file.name,
      updatedAt: Date.now()
    });

    request.onsuccess = () => resolve(storageKey);
    request.onerror = () => resolve('');
    tx.onabort = () => resolve('');
  });
}

async function removeSampleVideoBlobByKey(storageKey) {
  if (!storageKey) {
    return;
  }

  const db = await openSampleVideoDb();
  if (!db) {
    return;
  }

  return new Promise(resolve => {
    const tx = db.transaction(SAMPLE_VIDEO_STORE, 'readwrite');
    const store = tx.objectStore(SAMPLE_VIDEO_STORE);
    store.delete(storageKey);
    tx.oncomplete = () => resolve();
    tx.onabort = () => resolve();
  });
}

async function getSampleVideoBlob(storageKey) {
  if (!storageKey) {
    return null;
  }

  const db = await openSampleVideoDb();
  if (!db) {
    return null;
  }

  return new Promise(resolve => {
    const tx = db.transaction(SAMPLE_VIDEO_STORE, 'readonly');
    const store = tx.objectStore(SAMPLE_VIDEO_STORE);
    const request = store.get(storageKey);

    request.onsuccess = () => {
      const record = request.result;
      resolve(record?.blob || null);
    };
    request.onerror = () => resolve(null);
  });
}

async function getSampleVideoBlobByFileName(fileName) {
  if (!fileName) {
    return null;
  }

  const db = await openSampleVideoDb();
  if (!db) {
    return null;
  }

  return new Promise(resolve => {
    const tx = db.transaction(SAMPLE_VIDEO_STORE, 'readonly');
    const store = tx.objectStore(SAMPLE_VIDEO_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const rows = Array.isArray(request.result) ? request.result : [];
      const normalizedTarget = fileName.toLowerCase().trim();
      const match = rows
        .filter(item => (item?.fileName || '').toLowerCase().trim() === normalizedTarget)
        .sort((left, right) => Number(right?.updatedAt || 0) - Number(left?.updatedAt || 0))[0];
      resolve(match?.blob || null);
    };
    request.onerror = () => resolve(null);
  });
}

async function buildExamVideoPayloads(videoDrafts, examId) {
  const timestamp = Date.now();
  const payloads = [];

  for (let index = 0; index < videoDrafts.length; index += 1) {
    const draft = videoDrafts[index];
    const selectedFile = draft.selectedFile;
    const fileName = selectedFile?.name || draft.file;
    const videoPayload = {
      name: buildSampleVideoName(fileName, index, draft.existingName),
      file: fileName
    };

    if (selectedFile) {
      const storageKey = `${examId}_${timestamp}_${index}`;
      const savedKey = await saveSampleVideoBlob(selectedFile, storageKey);
      if (savedKey) {
        videoPayload.storageKey = savedKey;
      }
    } else if (draft.existingStorageKey) {
      videoPayload.storageKey = draft.existingStorageKey;
    } else if (draft.existingSource) {
      videoPayload.url = draft.existingSource;
    }

    payloads.push(videoPayload);
  }

  return payloads;
}

function getExamVideoDrafts() {
  return Array.from(document.querySelectorAll('.exam-video-row')).map((row, index) => {
    const fileInput = document.getElementById(`examVideoFile${index}`);
    const selectedFile = fileInput?.files && fileInput.files[0] ? fileInput.files[0] : null;
    const existingFile = row.dataset.existingFile || '';
    const existingName = row.dataset.existingName || '';
    const existingStorageKey = row.dataset.existingStorageKey || '';
    const existingSource = row.dataset.existingSource || '';
    const file = selectedFile?.name || existingFile;
    return {
      name: buildSampleVideoName(file, index),
      file,
      selectedFile,
      existingName,
      existingStorageKey,
      existingSource
    };
  });
}

function buildSampleVideoName(fileName, index, fallbackName = '') {
  if (fileName) {
    const normalized = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (normalized) {
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }

  if (fallbackName) {
    return fallbackName;
  }

  return `Video mẫu ${index + 1}`;
}

function revokeExamVideoRowPreview(row) {
  if (!row) return;
  const previewObjectUrl = row.dataset.previewObjectUrl;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    row.dataset.previewObjectUrl = '';
  }
}

function cleanupExamVideoPreviewUrls(container) {
  if (!container) return;
  container.querySelectorAll('.exam-video-row').forEach(row => revokeExamVideoRowPreview(row));
}

function updateExamVideoPreview(row, source, isObjectUrl = false) {
  if (!row) return;
  const preview = row.querySelector('.exam-video-preview');
  const player = row.querySelector('.exam-video-preview-player');
  const emptyNote = row.querySelector('.exam-video-preview-empty');
  if (!preview || !player) return;

  revokeExamVideoRowPreview(row);

  if (!source) {
    preview.style.display = 'none';
    player.removeAttribute('src');
    player.load();
    if (emptyNote) {
      emptyNote.style.display = '';
    }
    return;
  }

  preview.style.display = '';
  player.src = source;
  player.load();
  if (emptyNote) {
    emptyNote.style.display = 'none';
  }

  if (isObjectUrl) {
    row.dataset.previewObjectUrl = source;
  }
}

async function hydrateExamVideoPreviews(container) {
  if (!container) return;

  const rows = Array.from(container.querySelectorAll('.exam-video-row'));
  await Promise.all(rows.map(async row => {
    const existingSource = row.dataset.existingSource || '';
    if (existingSource) {
      return;
    }

    const storageKey = row.dataset.existingStorageKey || '';
    const existingFileName = row.dataset.existingFile || '';
    let blob = null;

    if (storageKey) {
      blob = await getSampleVideoBlob(storageKey);
    }

    if (!blob && existingFileName) {
      blob = await getSampleVideoBlobByFileName(existingFileName);
    }

    if (!blob) {
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    updateExamVideoPreview(row, objectUrl, true);
  }));
}

function renderExamVideoFields(videos = []) {
  const container = document.getElementById('examVideoList');
  if (!container) {
    return;
  }

  cleanupExamVideoPreviewUrls(container);

  const rows = videos.length > 0 ? videos : [{ name: '', file: '' }];
  container.innerHTML = rows.map((video, index) => `
    <div class="exam-video-row ${video.file ? 'has-file' : ''}" data-existing-file="${video.file || ''}" data-existing-name="${video.name || ''}" data-existing-storage-key="${video.storageKey || ''}" data-existing-source="${video.url || video.src || video.blobUrl || ''}">
      <div class="form-row exam-upload-row">
        <label for="examVideoFile${index}">Tải file video</label>
        <input id="examVideoFile${index}" class="exam-video-file" type="file" accept="video/*">
        <label for="examVideoFile${index}" class="exam-upload-box">
          <span class="exam-upload-icon"><i class="fas fa-video"></i></span>
          <span class="exam-upload-copy">
            <span class="exam-upload-title">Chọn video mẫu</span>
            <span class="exam-upload-subtitle">MP4, MOV hoặc video bất kỳ từ thiết bị của bạn</span>
          </span>
          <span class="exam-upload-button">Tải lên</span>
        </label>
        <div class="exam-video-file-name ${video.file ? 'has-file' : ''}">${video.file ? `Đã chọn: ${video.file}` : 'Chưa chọn file video'}</div>
        <div class="exam-video-preview" style="display:none">
          <video class="exam-video-preview-player" controls preload="metadata"></video>
        </div>
        <div class="exam-video-preview-empty" style="display:none">Video này hiện chỉ có tên file. Hãy chọn lại file để xem trực tiếp.</div>
      </div>
      <button type="button" class="btn-remove-video-row" onclick="removeExamVideoField(${index})" aria-label="Xóa video mẫu">&times;</button>
    </div>
  `).join('');

  container.querySelectorAll('.exam-video-row').forEach(row => {
    updateExamVideoPreview(row, row.dataset.existingSource || '');
    const emptyNote = row.querySelector('.exam-video-preview-empty');
    if (emptyNote && !row.dataset.existingSource && row.dataset.existingFile) {
      emptyNote.style.display = '';
    }
  });

  hydrateExamVideoPreviews(container).catch(() => {});

  container.querySelectorAll('.exam-video-file').forEach((input, index) => {
    input.addEventListener('change', function() {
      const row = this.closest('.exam-video-row');
      const label = row?.querySelector('.exam-video-file-name');
      const fileName = this.files && this.files[0] ? this.files[0].name : (row?.dataset.existingFile || '');
      if (row) {
        row.dataset.existingFile = fileName;
        if (this.files && this.files[0]) {
          row.dataset.existingStorageKey = '';
          row.dataset.existingSource = '';
        }
        row.dataset.existingName = buildSampleVideoName(fileName, index, row.dataset.existingName || '');
        row.classList.toggle('has-file', !!fileName);
      }
      if (label) {
        label.textContent = fileName ? `Đã chọn: ${fileName}` : 'Chưa chọn file video';
        label.classList.toggle('has-file', !!fileName);
      }

      const selectedFile = this.files && this.files[0] ? this.files[0] : null;
      const previewSource = selectedFile
        ? URL.createObjectURL(selectedFile)
        : (row?.dataset.existingSource || '');
      updateExamVideoPreview(row, previewSource, Boolean(selectedFile));
    });
  });
}

function addExamVideoField() {
  const currentVideos = getExamVideoDrafts();
  currentVideos.push({ name: '', file: '' });
  renderExamVideoFields(currentVideos);
}

function removeExamVideoField(indexToRemove) {
  const currentVideos = getExamVideoDrafts();
  const nextVideos = currentVideos.filter((_, index) => index !== indexToRemove);
  renderExamVideoFields(nextVideos);
}

function openExamModal(examId = '') {
  const modal = document.getElementById('examModal');
  const title = document.getElementById('examModalTitle');
  const idInput = document.getElementById('examEditId');
  const nameInput = document.getElementById('examName');
  const descInput = document.getElementById('examDescription');

  if (!modal || !title || !idInput || !nameInput || !descInput) {
    return;
  }

  if (examId) {
    const exam = getExamCatalog().find(item => item.id === examId);
    if (!exam) {
      return;
    }
    title.textContent = 'Cập nhật bài thi';
    idInput.value = exam.id;
    nameInput.value = exam.name;
    descInput.value = exam.description;
    renderExamVideoFields(exam.videos || []);
  } else {
    title.textContent = 'Thêm bài thi mới';
    idInput.value = '';
    nameInput.value = '';
    descInput.value = '';
    renderExamVideoFields();
  }

  modal.style.display = 'flex';
}

function closeExamModal() {
  const modal = document.getElementById('examModal');
  const form = document.getElementById('examForm');
  const videoContainer = document.getElementById('examVideoList');
  cleanupExamVideoPreviewUrls(videoContainer);
  if (form) {
    form.reset();
  }
  const idInput = document.getElementById('examEditId');
  if (idInput) {
    idInput.value = '';
  }
  renderExamVideoFields();
  if (modal) {
    modal.style.display = 'none';
  }
}

function openSaveExamConfirmModal(message, onConfirm) {
  const modal = document.getElementById('saveExamConfirmModal');
  const messageNode = document.getElementById('saveExamConfirmMessage');
  if (!modal || !messageNode) {
    return;
  }

  pendingSaveExamAction = onConfirm;
  messageNode.textContent = message;
  modal.style.display = 'flex';
}

function closeSaveExamConfirmModal() {
  const modal = document.getElementById('saveExamConfirmModal');
  pendingSaveExamAction = null;
  if (modal) {
    modal.style.display = 'none';
  }
}

function confirmSaveExamAction() {
  const action = pendingSaveExamAction;
  closeSaveExamConfirmModal();
  if (typeof action === 'function') {
    action();
  }
}

function openExamVideoNoticeModal(message = 'Vui lòng chọn video mẫu trước khi lưu bài thi.') {
  const modal = document.getElementById('examVideoNoticeModal');
  const messageNode = document.getElementById('examVideoNoticeMessage');
  if (!modal || !messageNode) {
    return;
  }

  messageNode.textContent = message;
  modal.style.display = 'flex';
}

function closeExamVideoNoticeModal() {
  const modal = document.getElementById('examVideoNoticeModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function focusExamVideoPicker() {
  closeExamVideoNoticeModal();
  const firstVideoInput = document.querySelector('.exam-video-file');
  if (firstVideoInput) {
    firstVideoInput.click();
  }
}

function showHomeToast(message) {
  const toast = document.getElementById('homeToast');
  const messageNode = document.getElementById('homeToastMessage');
  if (!toast || !messageNode) {
    return;
  }

  if (homeToastTimer) {
    clearTimeout(homeToastTimer);
  }

  messageNode.textContent = message;
  toast.style.display = 'inline-flex';

  homeToastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

function saveExam(event) {
  event.preventDefault();

  const id = document.getElementById('examEditId').value.trim();
  const targetExamId = id || `exam-${Date.now()}`;
  const name = document.getElementById('examName').value.trim();
  const description = document.getElementById('examDescription').value.trim();
  const videoDrafts = getExamVideoDrafts().filter(video => video.file || video.selectedFile);

  if (!name || !description) {
    alert('Vui lòng nhập đầy đủ thông tin bài thi.');
    return;
  }

  if (videoDrafts.length < MIN_SAMPLE_VIDEOS_PER_EXAM || videoDrafts.some(video => !video.file && !video.selectedFile)) {
    openExamVideoNoticeModal('Vui lòng chọn video mẫu trước khi lưu bài thi.');
    return;
  }

  const exams = getExamCatalog();
  const duplicate = exams.find(exam => exam.name.toLowerCase() === name.toLowerCase() && exam.id !== id);
  if (duplicate) {
    alert('Tên bài thi đã tồn tại. Vui lòng chọn tên khác.');
    return;
  }

  const confirmMessage = id
    ? `Bạn có chắc chắn muốn cập nhật bài thi ${name} không?`
    : `Bạn có chắc chắn muốn thêm bài thi ${name} không?`;
  const successMessage = id
    ? `Đã cập nhật bài thi ${name} thành công.`
    : `Đã thêm bài thi ${name} thành công.`;

  openSaveExamConfirmModal(confirmMessage, async () => {
    const videos = await buildExamVideoPayloads(videoDrafts, targetExamId);

    let updatedExams;
    if (id) {
      const previousExam = exams.find(exam => exam.id === id);
      const preservedKeys = new Set(videos.map(video => video.storageKey).filter(Boolean));
      const removedKeys = (previousExam?.videos || [])
        .map(video => video.storageKey)
        .filter(storageKey => storageKey && !preservedKeys.has(storageKey));

      await Promise.all(removedKeys.map(removeSampleVideoBlobByKey));

      updatedExams = exams.map(exam => exam.id === id ? {
        ...exam,
        name,
        description,
        videos
      } : exam);
    } else {
      updatedExams = [
        {
          id: targetExamId,
          name,
          description,
          icon: '📝',
          iconClass: 'custom-exam',
          videos
        },
        ...exams
      ];
    }

    saveExamCatalog(updatedExams);
    loadExamsContent();
    closeExamModal();
    showHomeToast(successMessage);
  });
}

function deleteExam(examId) {
  const exam = getExamCatalog().find(item => item.id === examId);
  if (!exam) {
    return;
  }

  openDeleteConfirmModal(`Bạn có chắc chắn muốn xóa bài thi ${exam.name} không?`, async () => {
    const storageKeys = (exam.videos || []).map(video => video.storageKey).filter(Boolean);
    await Promise.all(storageKeys.map(removeSampleVideoBlobByKey));

    const updated = getExamCatalog().filter(item => item.id !== examId);
    saveExamCatalog(updated);
    cleanupExamScores(examId);
    loadExamsContent();
  });
}

let currentErrorData = [];

function loadErrorsContent() {
  const container = document.getElementById('errorsContent');
  if (!container) {
    return;
  }

  if (currentErrorData.length === 0) {
    currentErrorData = getStoredErrors();
  }

  renderErrors();
}

function renderErrors() {
  const container = document.getElementById('errorsContent');
  if (!container) return;

  const totalStudents = currentErrorData.reduce((sum, e) => sum + e.students.length, 0);
  const highCount = currentErrorData.filter(e => e.severity === 'cao').length;
  const medCount = currentErrorData.filter(e => e.severity === 'trung-binh').length;

  const severityText = (s) => s === 'cao' ? 'Nghiêm trọng' : 'Trung bình';

  container.innerHTML = `
    <div class="error-summary">
      <div class="summary-item">
        <span class="summary-label"><i class="fas fa-exclamation-triangle"></i> Tổng lỗi</span>
        <span class="summary-value">${currentErrorData.length}</span>
      </div>
      <div class="summary-item summary-high">
        <span class="summary-label"><i class="fas fa-times-circle"></i> Nghiêm trọng</span>
        <span class="summary-value">${highCount}</span>
      </div>
      <div class="summary-item summary-medium">
        <span class="summary-label"><i class="fas fa-info-circle"></i> Trung bình</span>
        <span class="summary-value">${medCount}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label"><i class="fas fa-users"></i> SV mắc lỗi</span>
        <span class="summary-value">${totalStudents}</span>
      </div>
    </div>

    <div class="error-type-list">
      ${currentErrorData.map(error => `
        <div class="error-type-card" id="error-card-${error.id}">
          <div class="error-type-header">
            <div class="error-type-info" onclick="toggleError(${error.id})">
              <div class="error-type-name">
                ${error.name}
                <span class="error-type-count">${error.students.length} sinh viên</span>
              </div>
              <div class="error-type-description">${error.note || error.description}</div>
            </div>
            <div class="error-deduction-badge">-${error.deduction} điểm</div>
            <div class="error-type-severity ${error.severity}">${severityText(error.severity)}</div>
            <button class="btn-delete-error" onclick="deleteError(${error.id})" title="Xóa lỗi"><i class="fas fa-trash-alt"></i></button>
            <i class="fas fa-chevron-down expand-icon" id="expand-icon-${error.id}" onclick="toggleError(${error.id})"></i>
          </div>
          <div class="error-type-details" id="error-details-${error.id}" style="display:none;">
            <div class="error-student-list">
              ${error.students.length === 0 ? `
                <div class="error-student-empty">Chưa có sinh viên nào được ghi nhận mắc lỗi này.</div>
              ` : error.students.map((sv, idx) => `
                <div class="error-student-item" onclick="toggleErrorStudent(${error.id}, ${idx})">
                  <div class="error-student-header">
                    <div class="error-student-rank">${idx + 1}</div>
                    <div class="error-student-info">
                      <div class="error-student-name">${sv.name}</div>
                      <div class="error-student-meta">${sv.code} · ${sv.class}</div>
                    </div>
                    <i class="fas fa-image error-img-icon" id="img-icon-${error.id}-${idx}"></i>
                  </div>
                  <div class="error-student-image" id="error-img-${error.id}-${idx}" style="display:none;">
                    <img src="${sv.image}" alt="Lỗi ${error.name} - ${sv.name}" loading="lazy">
                    <div class="error-img-caption">Hình ảnh lỗi: <strong>${error.name}</strong> — ${sv.name} (${sv.code})</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function deleteError(errorId) {
  const error = currentErrorData.find(e => e.id === errorId);
  if (!error) return;

  openDeleteConfirmModal('Bạn có chắc muốn xóa lỗi "' + error.name + '" không?', () => {
    currentErrorData = currentErrorData.filter(e => e.id !== errorId);
    saveStoredErrors(currentErrorData);
    renderErrors();
  });
}

function openErrorModal() {
  const modal = document.getElementById('errorModal');
  const form = document.getElementById('errorForm');
  if (form) {
    form.reset();
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeErrorModal() {
  const modal = document.getElementById('errorModal');
  const form = document.getElementById('errorForm');
  if (form) {
    form.reset();
  }
  if (modal) {
    modal.style.display = 'none';
  }
}

function addErrorCatalog(event) {
  event.preventDefault();

  const name = document.getElementById('errorName').value.trim();
  const description = document.getElementById('errorDescription').value.trim();
  const severity = document.getElementById('errorSeverity').value;
  const deduction = parseFloat(document.getElementById('errorDeduction').value);

  if (!name || !description || Number.isNaN(deduction) || deduction <= 0) {
    alert('Vui lòng nhập đầy đủ thông tin lỗi hợp lệ.');
    return;
  }

  const duplicate = currentErrorData.find(error => error.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    alert('Tên lỗi đã tồn tại. Vui lòng nhập tên khác.');
    return;
  }

  const newError = {
    id: Date.now(),
    name,
    description,
    severity,
    deduction,
    icon: 'fas fa-exclamation-circle',
    students: []
  };

  currentErrorData = [newError, ...currentErrorData];
  saveStoredErrors(currentErrorData);
  closeErrorModal();
  renderErrors();
  showHomeToast(`Đã thêm lỗi ${name} thành công.`);
}

function openDeleteConfirmModal(message, onConfirm) {
  const modal = document.getElementById('deleteConfirmModal');
  const messageNode = document.getElementById('deleteConfirmMessage');
  if (!modal || !messageNode) {
    return;
  }

  pendingDeleteAction = onConfirm;
  messageNode.textContent = message;
  modal.style.display = 'flex';
}

function closeDeleteConfirmModal() {
  const modal = document.getElementById('deleteConfirmModal');
  pendingDeleteAction = null;
  if (modal) {
    modal.style.display = 'none';
  }
}

function confirmDeleteAction() {
  const action = pendingDeleteAction;
  closeDeleteConfirmModal();
  if (typeof action === 'function') {
    action();
  }
}

function searchErrors() {
  const keyword = document.getElementById('searchError').value.toLowerCase().trim();
  const cards = document.querySelectorAll('.error-type-card');
  cards.forEach(card => {
    const name = card.querySelector('.error-type-name');
    const desc = card.querySelector('.error-type-description');
    const text = (name ? name.textContent : '') + ' ' + (desc ? desc.textContent : '');
    card.style.display = text.toLowerCase().includes(keyword) ? '' : 'none';
  });
}

function searchClasses() {
  const keyword = document.getElementById('searchClass').value.toLowerCase().trim();
  const cards = document.querySelectorAll('.class-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(keyword) ? '' : 'none';
  });
}

function searchHistory() {
  // Trigger reload of grading history with current search query
  loadGradingHistoryContent();
}

function clearHistorySearch() {
  const el = document.getElementById('historySearch');
  if (el) el.value = '';
  loadGradingHistoryContent();
}

function getStoredGradingHistory() {
  const stored = JSON.parse(localStorage.getItem('gradingHistoryRecords') || '[]');
  return Array.isArray(stored) ? stored : [];
}

function getTeacherGradingHistory() {
  const teacherId = currentUser?.studentId || currentUser?.name || 'teacher';
  return getStoredGradingHistory()
    .filter(record => record.teacherId === teacherId)
    .sort((left, right) => new Date(right.timestampIso || 0).getTime() - new Date(left.timestampIso || 0).getTime());
}

function getHistoryVideos(record) {
  if (!record?.videoStorageKey) {
    return [];
  }

  const stored = JSON.parse(localStorage.getItem(record.videoStorageKey) || '[]');
  return Array.isArray(stored) ? stored : [];
}

function formatHistoryMode(mode) {
  return mode === 'official' ? 'Lấy điểm' : 'Luyện tập';
}

function formatFrameTime(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const remainSeconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainSeconds}`;
}

function loadGradingHistoryContent() {
  const container = document.getElementById('historyContent');
  if (!container) {
    return;
  }

  // If a search query is present, filter teacher records by student code, name or exam name
  const qEl = document.getElementById('historySearch');
  const q = qEl ? (qEl.value || '').toLowerCase().trim() : '';
  let records = getTeacherGradingHistory();
  if (q) {
    records = records.filter(r => {
      const code = (r.studentCode || '').toLowerCase();
      const name = (r.studentName || '').toLowerCase();
      const exam = (r.examName || '').toLowerCase();
      return code.includes(q) || name.includes(q) || exam.includes(q);
    });
  }
  if (records.length === 0) {
    if (q) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h2>Không tìm thấy kết quả phù hợp</h2>
          <p>Không có bản ghi nào khớp với truy vấn tìm kiếm của bạn.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🕒</div>
          <h2>Chưa có lịch sử chấm bài</h2>
          <p>Hãy hoàn thành ít nhất một lần chấm bài để xem video và các frame lỗi tại đây.</p>
        </div>
      `;
    }
    return;
  }

  if (!selectedGradingHistoryId || !records.some(record => record.id === selectedGradingHistoryId)) {
    selectedGradingHistoryId = records[0].id;
  }

  const selectedRecord = records.find(record => record.id === selectedGradingHistoryId) || records[0];
  const totalFrames = records.reduce((sum, record) => sum + (record.totalFrames || 0), 0);
  const officialCount = records.filter(record => record.gradingMode === 'official').length;

  container.innerHTML = `
    <div class="history-summary-grid">
      <div class="history-summary-card">
        <div class="history-summary-icon"><i class="fas fa-clock-rotate-left"></i></div>
        <div class="history-summary-value">${records.length}</div>
        <div class="history-summary-label">Lần chấm</div>
      </div>
      <div class="history-summary-card">
        <div class="history-summary-icon"><i class="fas fa-clapperboard"></i></div>
        <div class="history-summary-value">${totalFrames}</div>
        <div class="history-summary-label">Frame lỗi</div>
      </div>
      <div class="history-summary-card">
        <div class="history-summary-icon"><i class="fas fa-star"></i></div>
        <div class="history-summary-value">${officialCount}</div>
        <div class="history-summary-label">Lấy điểm</div>
      </div>
    </div>
    <div class="grading-history-layout">
      <div class="grading-history-list">
        ${records.map(record => `
          <button class="grading-history-item ${record.id === selectedRecord.id ? 'active' : ''}" onclick="selectGradingHistory('${record.id}')">
            <div class="grading-history-item-top">
              <span class="grading-history-exam">${record.examName}</span>
              <span class="grading-history-mode ${record.gradingMode}">${formatHistoryMode(record.gradingMode)}</span>
            </div>
            <div class="grading-history-meta">${record.studentName} · ${record.className || 'Chưa rõ lớp'}</div>
            <div class="grading-history-time"><i class="fas fa-clock"></i> ${record.timestamp}</div>
            <div class="grading-history-footer">
              <span>${record.totalFrames || 0} frame lỗi</span>
              <strong>${Number(record.finalScore || 0).toFixed(1)}/10</strong>
            </div>
          </button>
        `).join('')}
      </div>
      <div class="grading-history-detail">
        ${renderGradingHistoryDetail(selectedRecord)}
      </div>
    </div>
  `;
}

function renderGradingHistoryDetail(record) {
  if (!record) {
    return '<div class="history-detail-empty">Chọn một bài thi đã chấm để xem chi tiết.</div>';
  }

  const videos = getHistoryVideos(record);
  const videoMarkup = videos.length === 0
    ? '<div class="history-empty-box">Không tìm thấy video đã nộp cho bài thi này.</div>'
    : `<div class="history-video-grid">${videos.map((video, index) => `
        <div class="history-video-card">
          <div class="history-video-head">
            <div class="history-video-title">Video ${String(index + 1).padStart(2, '0')}</div>
            <div class="history-video-file">${video.name || 'Video bài thi'}</div>
          </div>
          ${video.blobUrl ? `<video class="history-video-player" src="${video.blobUrl}" controls preload="metadata"></video>` : '<div class="history-video-placeholder">Không có nguồn video để phát</div>'}
          <div class="history-video-meta">${video.uploadTime || 'Không rõ thời gian tải lên'}</div>
        </div>
      `).join('')}</div>`;

  const frameMarkup = !Array.isArray(record.history) || record.history.length === 0
    ? '<div class="history-empty-box">Bài thi này không có frame lỗi nào được lưu.</div>'
    : `<div class="history-frame-grid">${record.history.map((frame, index) => `
        <div class="history-frame-card">
          <div class="history-frame-top">
            <div>
              <div class="history-frame-title">Frame ${String(index + 1).padStart(2, '0')}</div>
              <div class="history-frame-meta">Video ${String(frame.video || 1).padStart(2, '0')} · ${formatFrameTime(frame.frameTs)}</div>
            </div>
            <div class="history-frame-score">${Number(frame.total || 0).toFixed(1)}</div>
          </div>
          <div class="history-tag-list">
            ${(frame.errors || []).map(error => `<span class="history-tag">${error.name}${error.note ? ` · ${error.note}` : ''}</span>`).join('')}
          </div>
        </div>
      `).join('')}</div>`;

  return `
    <div class="history-detail-header">
      <div>
        <h3>${record.examName}</h3>
        <p>${record.studentName} (${record.studentCode}) · ${record.className || 'Chưa rõ lớp'}</p>
      </div>
      <div class="history-detail-score">${Number(record.finalScore || 0).toFixed(1)}/10</div>
    </div>
    <div class="history-detail-meta-grid">
      <div class="history-detail-meta"><span>Thời gian chấm</span><strong>${record.timestamp}</strong></div>
      <div class="history-detail-meta"><span>Chế độ</span><strong>${formatHistoryMode(record.gradingMode)}</strong></div>
      <div class="history-detail-meta"><span>Tổng frame lỗi</span><strong>${record.totalFrames || 0}</strong></div>
      <div class="history-detail-meta"><span>Tổng điểm trừ</span><strong>${Number(record.totalDeductions || 0).toFixed(1)}</strong></div>
    </div>
    <div class="history-detail-block">
      <div class="history-block-title"><i class="fas fa-video"></i> Video bài thi</div>
      ${videoMarkup}
    </div>
    <div class="history-detail-block">
      <div class="history-block-title"><i class="fas fa-camera"></i> Các frame bị lỗi và tag lỗi</div>
      ${frameMarkup}
    </div>
  `;
}

function selectGradingHistory(recordId) {
  selectedGradingHistoryId = recordId;
  loadGradingHistoryContent();
}

function toggleError(errorId) {
  const details = document.getElementById('error-details-' + errorId);
  const icon = document.getElementById('expand-icon-' + errorId);
  const card = document.getElementById('error-card-' + errorId);
  if (!details) return;

  const isOpen = details.style.display !== 'none';
  details.style.display = isOpen ? 'none' : 'block';
  icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  card.classList.toggle('expanded', !isOpen);
}

function toggleErrorStudent(errorId, idx) {
  const imgContainer = document.getElementById('error-img-' + errorId + '-' + idx);
  const imgIcon = document.getElementById('img-icon-' + errorId + '-' + idx);
  if (!imgContainer) return;

  const isOpen = imgContainer.style.display !== 'none';
  imgContainer.style.display = isOpen ? 'none' : 'block';
  if (imgIcon) {
    imgIcon.classList.toggle('fa-image', isOpen);
    imgIcon.classList.toggle('fa-times', !isOpen);
  }
}

function loadReportContent() {
  const container = document.getElementById('reportContent');
  if (!container) {
    return;
  }

  const teacherId = currentUser.studentId || 'GV001';
  const classesKey = 'classes_' + teacherId;
  const classes = JSON.parse(localStorage.getItem(classesKey) || '[]');
  const totalStudents = classes.reduce((sum, c) => sum + (c.students || 0), 0);
  const totalErrors = currentErrorData.length;
  const highErrors = currentErrorData.filter(e => e.severity === 'cao').length;
  const medErrors = currentErrorData.filter(e => e.severity === 'trung-binh').length;
  const totalSVErrors = currentErrorData.reduce((sum, e) => sum + e.students.length, 0);

  container.innerHTML = `
    <div class="report-grid">
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-school" style="color:#DC143C"></i></div>
        <div class="report-value">${classes.length}</div>
        <div class="report-label">Lớp học</div>
      </div>
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-users" style="color:#FF6B35"></i></div>
        <div class="report-value">${totalStudents}</div>
        <div class="report-label">Tổng sinh viên</div>
      </div>
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-exclamation-triangle" style="color:#e65100"></i></div>
        <div class="report-value">${totalErrors}</div>
        <div class="report-label">Loại lỗi</div>
      </div>
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-user-times" style="color:#c62828"></i></div>
        <div class="report-value">${totalSVErrors}</div>
        <div class="report-label">Lượt mắc lỗi</div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-bar"></i> Số lượng sinh viên mắc lỗi theo loại</div>
        <canvas id="chartErrorByType"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-pie"></i> Tỷ lệ mức độ lỗi</div>
        <canvas id="chartSeverity"></canvas>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-container chart-wide">
        <div class="chart-title"><i class="fas fa-chart-line"></i> Điểm trừ theo loại lỗi</div>
        <canvas id="chartDeduction"></canvas>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-bar"></i> Phân bố lỗi theo lớp</div>
        <canvas id="chartErrorByClass"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-doughnut"></i> Top 5 lỗi phổ biến</div>
        <canvas id="chartTopErrors"></canvas>
      </div>
    </div>
  `;

  renderCharts();
}

function renderCharts() {
  const errorData = currentErrorData;
  const errorNames = errorData.map(e => e.name.length > 20 ? e.name.substring(0, 20) + '...' : e.name);
  const errorStudentCounts = errorData.map(e => e.students.length);
  const errorDeductions = errorData.map(e => e.deduction);
  const highCount = errorData.filter(e => e.severity === 'cao').length;
  const medCount = errorData.filter(e => e.severity === 'trung-binh').length;

  const chartColors = ['#DC143C', '#FF6B35', '#FFB64D', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];
  const chartBgColors = chartColors.map(c => c + '33');

  // Chart 1: Bar - Students per error type
  const ctx1 = document.getElementById('chartErrorByType');
  if (ctx1) {
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: errorNames,
        datasets: [{
          label: 'Số sinh viên',
          data: errorStudentCounts,
          backgroundColor: chartColors.slice(0, errorData.length),
          borderColor: chartColors.slice(0, errorData.length),
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } } }
        }
      }
    });
  }

  // Chart 2: Doughnut - Severity ratio
  const ctx2 = document.getElementById('chartSeverity');
  if (ctx2) {
    new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Nghiêm trọng', 'Trung bình'],
        datasets: [{
          data: [highCount, medCount],
          backgroundColor: ['#c62828', '#e65100'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } }
        }
      }
    });
  }

  // Chart 3: Line - Deduction points
  const ctx3 = document.getElementById('chartDeduction');
  if (ctx3) {
    new Chart(ctx3, {
      type: 'line',
      data: {
        labels: errorNames,
        datasets: [{
          label: 'Điểm trừ',
          data: errorDeductions,
          borderColor: '#DC143C',
          backgroundColor: 'rgba(220, 20, 60, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#DC143C',
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Điểm trừ' } },
          x: { ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } } }
        }
      }
    });
  }

  // Chart 4: Bar - Errors by class
  const classErrorMap = {};
  errorData.forEach(err => {
    err.students.forEach(sv => {
      classErrorMap[sv.class] = (classErrorMap[sv.class] || 0) + 1;
    });
  });
  const classNames = Object.keys(classErrorMap).sort();
  const classCounts = classNames.map(c => classErrorMap[c]);

  const ctx4 = document.getElementById('chartErrorByClass');
  if (ctx4) {
    new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: classNames,
        datasets: [{
          label: 'Số lượt lỗi',
          data: classCounts,
          backgroundColor: ['#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#DC143C'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  // Chart 5: Polar Area - Top 5 errors
  const sorted = [...errorData].sort((a, b) => b.students.length - a.students.length).slice(0, 5);
  const ctx5 = document.getElementById('chartTopErrors');
  if (ctx5) {
    new Chart(ctx5, {
      type: 'polarArea',
      data: {
        labels: sorted.map(e => e.name.length > 18 ? e.name.substring(0, 18) + '...' : e.name),
        datasets: [{
          data: sorted.map(e => e.students.length),
          backgroundColor: ['rgba(220,20,60,0.6)', 'rgba(255,107,53,0.6)', 'rgba(255,182,77,0.6)', 'rgba(46,204,113,0.6)', 'rgba(52,152,219,0.6)'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

function handleLogout() {
  document.getElementById('logoutModal').style.display = 'flex';
}

function closeLogoutModal() {
  document.getElementById('logoutModal').style.display = 'none';
}

function confirmLogout() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('selectedClassId');
  window.location.href = '/index.html';
}

// ============================================
//  STUDENT VIEW FUNCTIONS
// ============================================

function getStudentSampleData() {
  // Dữ liệu mẫu cho sinh viên
  const studentId = currentUser.studentId;
  return {
    name: 'Nguyễn Văn An',
    code: studentId,
    gender: 'Nam',
    className: 'Lớp Quân sự 1',
    classId: '1',
    email: studentId.toLowerCase() + '@student.hactech.edu.vn',
    phone: '0912 345 678',
    birthday: '20/03/2004',
    department: 'Công nghệ thông tin',
    course: 'K26',
  };
}

function getStudentExamData() {
  const studentId = currentUser.studentId;
  const student = getStudentSampleData();
  const allExamTypes = getExamCatalog();

  // Đọc exams của lớp từ localStorage
  const storedExams = getNormalizedClassExamMap();
  const classId = student.classId || '1';
  const assignments = storedExams[classId] || [];

  // Đọc điểm từ localStorage
  const scores = JSON.parse(localStorage.getItem('examScores') || '{}');

  return assignments.map(assignment => {
    const examId = assignment.id;
    const examType = allExamTypes.find(e => e.id === examId) || { id: examId, name: examId, icon: '📝', description: 'Mô tả đang được cập nhật' };
    const practiceKey = classId + '_' + studentId + '_' + examId + '_practice';
    const officialKey = classId + '_' + studentId + '_' + examId + '_official';
    const submittedKey = `examVideos_${classId}_${student.code}_${examId}_submitted`;
    return {
      ...examType,
      submissionDeadline: assignment.submissionDeadline || '',
      gradingDeadline: assignment.gradingDeadline || '',
      practiceScore: scores[practiceKey] !== undefined ? scores[practiceKey] : null,
      officialScore: scores[officialKey] !== undefined ? scores[officialKey] : null,
      isSubmitted: localStorage.getItem(submittedKey) === 'true',
      isSubmissionClosed: isDeadlinePassed(assignment.submissionDeadline),
      isGradingClosed: isDeadlinePassed(assignment.gradingDeadline)
    };
  });
}

function getStudentErrorData() {
  const studentId = currentUser.studentId;
  // Lọc lỗi từ currentErrorData mà sinh viên này mắc phải
  if (currentErrorData.length === 0) {
    loadErrorsContent(); // Load error data nếu chưa có
  }

  const myErrors = [];
  currentErrorData.forEach(error => {
    const myOccurrences = error.students.filter(sv => sv.code === studentId);
    if (myOccurrences.length > 0) {
      myErrors.push({
        ...error,
        students: myOccurrences
      });
    }
  });

  return myErrors;
}

function loadStudentProfile() {
  const container = document.getElementById('stProfileContent');
  if (!container) return;

  const student = getStudentSampleData();

  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar"><i class="fas fa-user-graduate"></i></div>
        <div class="profile-name">${student.name}</div>
        <div class="profile-role">Sinh viên</div>
        <div class="profile-status"><span class="status-dot"></span> Đang hoạt động</div>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-card-title"><i class="fas fa-id-card"></i> Thông tin cá nhân</div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-fingerprint"></i> Mã sinh viên</span>
        <span class="field-value">${student.code}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-user"></i> Họ và tên</span>
        <span class="field-value">${student.name}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-venus-mars"></i> Giới tính</span>
        <span class="field-value">${student.gender}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-envelope"></i> Email</span>
        <span class="field-value">${student.email}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-phone"></i> Số điện thoại</span>
        <span class="field-value">${student.phone}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-birthday-cake"></i> Ngày sinh</span>
        <span class="field-value">${student.birthday}</span>
      </div>
    </div>
  `;
}

function loadStudentExams() {
  const container = document.getElementById('stExamsContent');
  if (!container) return;

  const exams = getStudentExamData();

  if (exams.length === 0) {
    container.innerHTML = `
      <div class="st-exam-empty">
        <div class="st-empty-icon">📋</div>
        <h2>Chưa có bài thi nào</h2>
        <p>Bạn chưa được gán bài thi nào. Vui lòng liên hệ giảng viên.</p>
      </div>
    `;
    return;
  }

  const totalExams = exams.length;
  const gradedExams = exams.filter(e => e.practiceScore !== null || e.officialScore !== null).length;
  const officialExams = exams.filter(e => e.officialScore !== null);
  const avgScore = officialExams.length > 0
    ? (officialExams.reduce((sum, e) => sum + e.officialScore, 0) / officialExams.length).toFixed(1)
    : '—';

  container.innerHTML = `
    <div class="st-exam-summary">
      <div class="st-summary-card">
        <div class="st-summary-icon">📝</div>
        <div class="st-summary-value">${totalExams}</div>
        <div class="st-summary-label">Tổng bài thi</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">✅</div>
        <div class="st-summary-value">${gradedExams}</div>
        <div class="st-summary-label">Đã có điểm</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">⏳</div>
        <div class="st-summary-value">${totalExams - gradedExams}</div>
        <div class="st-summary-label">Chưa thi</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">🏅</div>
        <div class="st-summary-value">${avgScore}</div>
        <div class="st-summary-label">Điểm TB chính thức</div>
      </div>
    </div>

    <div class="st-exam-list">
      ${exams.map(exam => {
        const hasAnyScore = exam.practiceScore !== null || exam.officialScore !== null;
        const deadlineBadge = exam.isSubmissionClosed
          ? '<span class="st-exam-deadline-badge closed">Hết hạn nộp</span>'
          : (exam.submissionDeadline
              ? '<span class="st-exam-deadline-badge open">Còn hạn nộp</span>'
              : '<span class="st-exam-deadline-badge none">Chưa đặt hạn</span>');
        return `
          <div class="st-exam-card" onclick="openExamDetail('${exam.id}')" style="cursor:pointer">
            <div class="st-exam-icon ${exam.officialScore !== null ? 'official' : (exam.practiceScore !== null ? 'practice' : 'no-score')}">
              ${exam.icon}
            </div>
            <div class="st-exam-info">
              <div class="st-exam-name-row">
                <div class="st-exam-name">${exam.name}</div>
                ${exam.isSubmitted ? '<span class="st-exam-submitted-badge">Đã nộp bài</span>' : ''}
                ${deadlineBadge}
              </div>
              <div class="st-exam-meta">${exam.description}</div>
              <div class="st-exam-deadlines">
                <span><i class="fas fa-hourglass-end"></i> Hạn nộp: ${formatDeadline(exam.submissionDeadline)}</span>
                <span><i class="fas fa-user-clock"></i> Hạn chấm: ${formatDeadline(exam.gradingDeadline)}</span>
              </div>
            </div>
            <div class="st-exam-scores">
              ${exam.practiceScore !== null ? `
                <div class="st-score-badge practice">
                  <span class="st-score-type">Luyện tập</span>
                  <span class="st-score-value">${exam.practiceScore}</span>
                </div>
              ` : ''}
              ${exam.officialScore !== null ? `
                <div class="st-score-badge official">
                  <span class="st-score-type">Chính thức</span>
                  <span class="st-score-value">${exam.officialScore}</span>
                </div>
              ` : ''}
              ${!hasAnyScore ? '<span class="st-score-none">Chưa có điểm</span>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function openExamDetail(examId) {
  const exams = getStudentExamData();
  const exam = exams.find(e => e.id === examId);
  if (!exam) return;

  const student = getStudentSampleData();

  const detailData = {
    ...exam,
    studentCode: student.code,
    studentName: student.name,
    className: student.className,
    classId: student.classId,
  };

  localStorage.setItem('selectedExamDetail', JSON.stringify(detailData));
  window.location.href = '/pages/exam-detail.html';
}

function loadStudentErrors() {
  const container = document.getElementById('stErrorsContent');
  if (!container) return;

  const myErrors = getStudentErrorData();


  if (myErrors.length === 0) {
    container.innerHTML = `
      <div class="st-error-empty">
        <div class="st-empty-icon">🎉</div>
        <h2>Không có lỗi nào</h2>
        <p>Bạn chưa mắc lỗi nào trong quá trình thi. Hãy tiếp tục phát huy!</p>
      </div>
    `;
    return;
  }

  const totalErrors = myErrors.length;
  const totalDeduction = myErrors.reduce((sum, e) => sum + e.deduction, 0);
  const highErrors = myErrors.filter(e => e.severity === 'cao').length;

  container.innerHTML = `
    <div class="st-error-summary">
      <div class="st-error-summary-card">
        <div class="st-err-icon">⚠️</div>
        <div class="st-err-value">${totalErrors}</div>
        <div class="st-err-label">Tổng lỗi mắc phải</div>
      </div>
      <div class="st-error-summary-card">
        <div class="st-err-icon">📉</div>
        <div class="st-err-value">-${totalDeduction}</div>
        <div class="st-err-label">Tổng điểm trừ</div>
      </div>
      <div class="st-error-summary-card">
        <div class="st-err-icon">🔴</div>
        <div class="st-err-value">${highErrors}</div>
        <div class="st-err-label">Lỗi nghiêm trọng</div>
      </div>
    </div>

    <div class="st-error-list">
      ${myErrors.map((error, idx) => `
        <div class="st-error-card ${error.severity === 'trung-binh' ? 'severity-medium' : ''}" id="st-error-${idx}">
          <div class="st-error-header" onclick="toggleStudentError(${idx})">
            <div class="st-error-info">
              <div class="st-error-name">${error.name}</div>
              <div class="st-error-desc">${error.note || error.description}</div>
            </div>
            <span class="st-error-severity-tag ${error.severity === 'cao' ? 'high' : 'medium'}">
              ${error.severity === 'cao' ? 'Nghiêm trọng' : 'Trung bình'}
            </span>
            <div class="st-error-deduction">-${error.deduction} điểm</div>
          </div>
          <div class="st-error-detail" id="st-error-detail-${idx}">
            <div class="st-error-images">
              ${error.students.map(sv => `
                <div class="st-error-img-item">
                  <img src="${sv.image}" alt="Lỗi: ${error.name}" loading="lazy">
                  <div class="st-error-img-caption">Lỗi: <strong>${error.name}</strong> — ${sv.class}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function toggleStudentError(idx) {
  const detail = document.getElementById('st-error-detail-' + idx);
  if (!detail) return;
  detail.classList.toggle('open');
}

function attachEvents() {
  const btnLogout = document.getElementById('btnLogout');
  const btnAddClass = document.getElementById('btnAddClass');
  const btnAddExamCatalog = document.getElementById('btnAddExamCatalog');
  const btnAddErrorCatalog = document.getElementById('btnAddErrorCatalog');
  const addClassForm = document.getElementById('addClassForm');
  const examForm = document.getElementById('examForm');
  const errorForm = document.getElementById('errorForm');
  const btnCloseDetails = document.getElementById('btnCloseDetails');
  const btnCloseAddClass = document.getElementById('btnCloseAddClass');
  const btnCancelAddClass = document.getElementById('btnCancelAddClass');
  const btnCloseExamModal = document.getElementById('btnCloseExamModal');
  const btnCancelExamModal = document.getElementById('btnCancelExamModal');
  const btnCloseErrorModal = document.getElementById('btnCloseErrorModal');
  const btnCancelErrorModal = document.getElementById('btnCancelErrorModal');

  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  if (btnAddClass) btnAddClass.addEventListener('click', openAddClassModal);
  if (btnAddExamCatalog) btnAddExamCatalog.addEventListener('click', () => openExamModal());
  if (btnAddErrorCatalog) btnAddErrorCatalog.addEventListener('click', openErrorModal);
  if (addClassForm) addClassForm.addEventListener('submit', addClass);
  if (examForm) examForm.addEventListener('submit', saveExam);
  if (errorForm) errorForm.addEventListener('submit', addErrorCatalog);
  if (btnCloseDetails) btnCloseDetails.addEventListener('click', closeDetailsModal);
  if (btnCloseAddClass) btnCloseAddClass.addEventListener('click', closeAddClassModal);
  if (btnCancelAddClass) btnCancelAddClass.addEventListener('click', closeAddClassModal);
  if (btnCloseExamModal) btnCloseExamModal.addEventListener('click', closeExamModal);
  if (btnCancelExamModal) btnCancelExamModal.addEventListener('click', closeExamModal);
  if (btnCloseErrorModal) btnCloseErrorModal.addEventListener('click', closeErrorModal);
  if (btnCancelErrorModal) btnCancelErrorModal.addEventListener('click', closeErrorModal);

  window.addEventListener('click', function(event) {
    const detailsModal = document.getElementById('classDetailsModal');
    const addModal = document.getElementById('addClassModal');
    const examModal = document.getElementById('examModal');
    const errorModal = document.getElementById('errorModal');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const saveExamConfirmModal = document.getElementById('saveExamConfirmModal');
    const examVideoNoticeModal = document.getElementById('examVideoNoticeModal');
    if (event.target === detailsModal) {
      closeDetailsModal();
    }
    if (event.target === addModal) {
      closeAddClassModal();
    }
    if (event.target === examModal) {
      closeExamModal();
    }
    if (event.target === errorModal) {
      closeErrorModal();
    }
    if (event.target === deleteConfirmModal) {
      closeDeleteConfirmModal();
    }
    if (event.target === saveExamConfirmModal) {
      closeSaveExamConfirmModal();
    }
    if (event.target === examVideoNoticeModal) {
      closeExamVideoNoticeModal();
    }
  });
}

function initializePage() {
  currentUser = checkLoginStatus();
  if (!currentUser) {
    return;
  }

  isStudentView = currentUser.role === 'student';

  const userName = currentUser.studentId || currentUser.name || 'Người dùng';
  const userNameNode = document.getElementById('userName');
  if (userNameNode) {
    userNameNode.textContent = userName;
  }

  if (isStudentView) {
    // Show student menu, hide teacher menu
    const teacherMenu = document.getElementById('teacherMenu');
    const studentMenu = document.getElementById('studentMenu');
    if (teacherMenu) teacherMenu.style.display = 'none';
    if (studentMenu) studentMenu.style.display = '';

    // Hide teacher tabs that might be active
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const stProfileTab = document.getElementById('st-profile-tab');
    if (stProfileTab) stProfileTab.classList.add('active');

    loadStudentProfile();
  } else {
    // Teacher view (default)
    currentClasses = getTeacherClasses();
    getExamCatalog();
    loadProfileContent();
    renderClasses(currentClasses);
    loadExamsContent();
    loadErrorsContent();
    loadGradingHistoryContent();
    loadReportContent();
  }

  attachEvents();
}

document.addEventListener('DOMContentLoaded', initializePage);
