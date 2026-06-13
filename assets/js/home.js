// Disable Bootstrap modal plugin for custom modals
document.addEventListener('DOMContentLoaded', function() {
  // Remove Bootstrap modal classes from custom modals to prevent Bootstrap plugin interference
  const customModals = [
    'logoutModal',
    'deleteConfirmModal',
    'saveExamConfirmModal',
    'examVideoNoticeModal'
  ];
  
  customModals.forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('modal', 'fade');
      modal.removeAttribute('data-bs-toggle');
      modal.removeAttribute('data-bs-target');
    }
  });
});

let currentUser = null;
let currentClasses = [];
let isStudentView = false;
let pendingDeleteAction = null;
let pendingSaveExamAction = null;
let homeToastTimer = null;
let selectedGradingHistoryId = null;

// ---- Class pagination state ----
let classPage      = 0;
let classPageSize  = 9;
let classTotalPages = 1;
let classTotalElements = 0;
let classTeacherId = '';

// ---- Exam pagination state ----
let examPage         = 0;
let examPageSize     = 9;
let examTotalPages   = 1;
let examTotalElements = 0;
let examTeacherId    = '';

// ---- History pagination state ----
let historyPage         = 0;
let historyPageSize     = 10;
let historyTotalPages   = 1;
let historyTotalElements = 0;

// ---- My-Exam pagination state (student) ----
let myExamPage         = 0;
let myExamPageSize     = 9;
let myExamTotalPages   = 1;
let myExamTotalElements = 0;
let myExamStudentId    = '';
const MIN_SAMPLE_VIDEOS_PER_EXAM = 1;
const SAMPLE_VIDEO_DB_NAME = 'hactech-sample-video-db';
const SAMPLE_VIDEO_STORE = 'examSampleVideos';
const SAMPLE_VIDEO_DB_VERSION = 1;
let sampleVideoDbPromise = null;

function normalizeRole(role) {
  const raw = (role || '').toString().toUpperCase().replace('ROLE_', '');
  if (raw === 'ADMIN') return 'admin';
  if (raw === 'TEACHER') return 'teacher';
  if (raw === 'STUDENT') return 'student';
  return raw ? raw.toLowerCase() : '';
}

function getCurrentRoleFromStorage(user) {
  return normalizeRole(sessionStorage.getItem('currentUserRole') || user?.role);
}

function getCurrentUserDisplayName(user) {
  return user?.studentId || user?.fullName || user?.name || user?.username || 'Người dùng';
}

function checkLoginStatus() {
  const user = JSON.parse(sessionStorage.getItem('currentUser'));
  if (!user) {
    window.location.href = '/index.html';
    return null;
  }
  const role = getCurrentRoleFromStorage(user);
  if (role === 'admin') {
    window.location.href = '/pages/admin.html';
    return null;
  }
  return user;
}

function getSampleStudents(classId) {
  // Sample students removed — the app should load students from the server
  return [];
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

function getSampleClasses() {
  // No local sample classes — rely on server data
  return [];
}

function getClassStorageKey() {
  return `classes_${currentUser.studentId || currentUser.fullName || currentUser.name || currentUser.username || 'teacher'}`;
}

function getTeacherClasses() {
  const stored = sessionStorage.getItem(getClassStorageKey());
  return stored ? JSON.parse(stored) : [];
}

function saveTeacherClasses(classes) {
  sessionStorage.setItem(getClassStorageKey(), JSON.stringify(classes));
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
    id: String(exam.id || `exam-${Date.now()}-${index}`),
    name: exam.name || 'Bài thi mới',
    icon: '📝',
    iconClass: 'custom-exam',
    description: exam.description || 'Mô tả đang được cập nhật',
    videos: Array.isArray(exam.videos) ? exam.videos : [],
    deleted: exam.deleted === true,
    examCode: exam.examCode || null
  };
}

function normalizeClassExamAssignment(assignment, index) {
  if (typeof assignment === 'string') {
    return {
      id: assignment,
      classExamId: null,
      submissionDeadline: '',
      gradingDeadline: ''
    };
  }

  return {
    id: assignment?.id || `exam-${Date.now()}-${index}`,
    classExamId: assignment?.classExamId ?? null,
    submissionDeadline: assignment?.submissionDeadline || '',
    gradingDeadline: assignment?.gradingDeadline || ''
  };
}

function getNormalizedClassExamMap() {
  const all = JSON.parse(sessionStorage.getItem('classExams') || '{}');
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
    sessionStorage.setItem('classExams', JSON.stringify(all));
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
    sessionStorage.setItem('classExams', JSON.stringify(allClassExams));
  }
}

function getExamCatalog() {
  const stored = JSON.parse(sessionStorage.getItem('examCatalog') || 'null');
  const base = Array.isArray(stored) ? stored : getDefaultExamCatalog();
  const normalized = base.map(normalizeExamItem);

  if (!stored || JSON.stringify(stored) !== JSON.stringify(normalized)) {
    sessionStorage.setItem('examCatalog', JSON.stringify(normalized));
  }

  syncClassExamAssignments(normalized.map(exam => exam.id));
  return normalized;
}

function saveExamCatalog(exams) {
  const normalized = exams.map(normalizeExamItem);
  sessionStorage.setItem('examCatalog', JSON.stringify(normalized));
  syncClassExamAssignments(normalized.map(exam => exam.id));
  return normalized;
}

function getExamUsageCount(examId) {
  const allClassExams = getNormalizedClassExamMap();
  return Object.values(allClassExams).filter(assignments => Array.isArray(assignments) && assignments.some(item => item.id === examId)).length;
}

function cleanupExamScores(examId) {
  const scores = JSON.parse(sessionStorage.getItem('examScores') || '{}');
  let changed = false;

  Object.keys(scores).forEach(key => {
    if (key.includes(`_${examId}_`)) {
      delete scores[key];
      changed = true;
    }
  });

  if (changed) {
    sessionStorage.setItem('examScores', JSON.stringify(scores));
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
  const stored = JSON.parse(sessionStorage.getItem('teacherErrorCatalog') || 'null');
  if (Array.isArray(stored)) {
    return stored;
  }
  const seed = getDefaultErrorData();
  sessionStorage.setItem('teacherErrorCatalog', JSON.stringify(seed));
  return seed;
}

function saveStoredErrors(errors) {
  sessionStorage.setItem('teacherErrorCatalog', JSON.stringify(errors));
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

  const teacherId = currentUser.studentId || currentUser.id || 'GV001';
  const teacherName = currentUser.fullName || currentUser.name || currentUser.username || 'Nguyễn Văn A';
  const teacherAvatar = currentUser.avatarImage
    ? `<img src="${currentUser.avatarImage}" alt="avatar" style="width:110px;height:110px;border-radius:50%;object-fit:cover;display:block">`
    : `<i class="fas fa-user-tie"></i>`;

  const teacherEmail = currentUser.email || `${teacherId.toLowerCase()}@hactech.edu.vn`;
  const teacherBirthday = currentUser.birthday
    ? new Date(currentUser.birthday).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
  const teacherGender = formatGender(currentUser.gender) || 'Chưa cập nhật';

  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar" id="profileAvatarDisplay" style="${currentUser.avatarImage ? 'background:transparent;padding:0' : ''}">${teacherAvatar}</div>
          <button class="profile-avatar-edit-btn" onclick="document.getElementById('profileAvatarInput').click()" title="Đổi ảnh đại diện">
            <i class="fas fa-camera"></i>
          </button>
          <input type="file" id="profileAvatarInput" accept="image/*" style="display:none" onchange="handleProfileAvatarChange(event)">
        </div>
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
        <span class="field-label"><i class="fas fa-venus-mars"></i> Giới tính</span>
        <span class="field-value">${teacherGender}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-envelope"></i> Email</span>
        <span class="field-value">${teacherEmail}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-birthday-cake"></i> Ngày sinh</span>
        <span class="field-value">${teacherBirthday}</span>
      </div>
    </div>
  `;
}

function renderClasses(classes) {
  const classGrid = document.getElementById('classGrid');
  const emptyState = document.getElementById('emptyState');
  if (!classGrid || !emptyState) return;

  if (!classes || classes.length === 0) {
    classGrid.style.display = 'none';
    classGrid.innerHTML = '';
    emptyState.style.display = 'block';
    _renderClassPagination();
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
      <div class="class-action">
        <button class="btn-class-action btn-details" onclick="viewClassDetails('${cls.classId}'); event.stopPropagation();">Vào lớp</button>
      </div>
    </div>
  `).join('');

  classGrid.style.display = 'grid';
  emptyState.style.display = 'none';
  _renderClassPagination();
}

function _renderClassPagination() {
  const container = document.getElementById('classPagination');
  if (!container) return;

  const total = classTotalElements;
  const isLastPage = classPage + 1 >= classTotalPages;

  if (classTotalPages <= 1 && total <= classPageSize) {
    container.innerHTML = '';
    return;
  }

  const start = classPage * classPageSize + 1;
  const end   = Math.min(start + currentClasses.length - 1, total || (start + currentClasses.length - 1));

  let btns = '';
  btns += `<button class="home-page-btn" onclick="loadClassPage(${classPage - 1})" ${classPage === 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const winSize = 2;
  for (let i = 0; i < classTotalPages; i++) {
    const show = i === 0 || i === classTotalPages - 1 || (i >= classPage - winSize && i <= classPage + winSize);
    const ellipsis = i === classPage - winSize - 1 || i === classPage + winSize + 1;
    if (show) {
      btns += `<button class="home-page-btn${i === classPage ? ' active' : ''}" onclick="loadClassPage(${i})">${i + 1}</button>`;
    } else if (ellipsis) {
      btns += `<span class="home-page-ellipsis">…</span>`;
    }
  }

  btns += `<button class="home-page-btn" onclick="loadClassPage(${classPage + 1})" ${isLastPage ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

  const infoText = total > 0
    ? `Hiển thị ${start}–${end} trong tổng số ${total} lớp`
    : `Trang ${classPage + 1} / ${classTotalPages}`;

  container.innerHTML = `
    <div class="home-pagination">
      <span class="home-page-info">${infoText}</span>
      <div class="home-page-controls">${btns}</div>
    </div>`;
}

async function loadClassPage(page) {
  if (!classTeacherId) return;
  if (page < 0 || page >= classTotalPages) return;
  try {
    const result = await ClassesService.getClassesByTeacher(classTeacherId, page, classPageSize);
    if (!result) return;

    // Nếu trang rỗng và không phải trang 0 → quay lại
    if (result.classes.length === 0 && page > 0) {
      classTotalPages = page;
      await loadClassPage(page - 1);
      return;
    }

    classPage          = page;
    classTotalPages    = result.totalPages;
    classTotalElements = result.totalElements;

    const normalized = result.classes.map(cls => ({
      classId:     cls.id || cls.classId,
      className:   cls.className,
      semester:    cls.semester ? `Học kỳ ${cls.semester}` : '',
      year:        cls.academicYear || cls.year || '',
      roomNumber:  cls.roomNumber || '',
      teacherName: cls.teacherName || '',
      studentCount: cls.totalStudent ?? cls.studentCount ?? cls.numberOfStudents ?? 0,
    }));

    currentClasses = normalized;
    saveTeacherClasses(normalized);
    renderClasses(currentClasses);
  } catch (err) {
    console.error('Lỗi tải trang lớp:', err);
  }
}

async function loadExamPageFromAPI(page) {
  if (!examTeacherId) return;
  try {
    const result = await ExamsService.getTeacherExams(examTeacherId, page, examPageSize);
    if (!result || !Array.isArray(result.exams)) return;

    if (result.exams.length === 0 && page > 0) {
      examPage = page - 1;
      loadExamsContent();
      return;
    }

    const normalized = result.exams.map((exam, index) => {
      let videos = [];
      if (Array.isArray(exam.videos) && exam.videos.length > 0) {
        videos = exam.videos.map(v => ({
          name: v.name || v.title || '',
          file: v.file || v.fileName || '',
          url: v.url || v.videoUrl || '',
          storageKey: v.storageKey || ''
        }));
      } else if (exam.sampleVideoUrl) {
        videos = [{
          name: exam.name || `Video mẫu ${index + 1}`,
          file: exam.sampleVideoUrl.split('/').pop(),
          url: exam.sampleVideoUrl,
          storageKey: ''
        }];
      }
      return {
        id: String(exam.id || exam.examId || `exam-api-${index}`),
        name: exam.name || exam.examName || exam.title || 'Bài thi',
        icon: '📝',
        iconClass: 'custom-exam',
        description: exam.description || exam.content || '',
        deleted: exam.isDeleted === true,
        examCode: exam.examCode || null,
        videos
      };
    });

    // Khi tải trang 0 → ghi đè toàn bộ sessionStorage
    if (page === 0) {
      saveExamCatalog(normalized);
    } else {
      // Trang sau → merge vào sessionStorage để giữ các trang trước
      const existing = getExamCatalog();
      const ids = new Set(normalized.map(e => e.id));
      const merged = [...existing.filter(e => !ids.has(e.id)), ...normalized];
      saveExamCatalog(merged);
    }

    examPage          = page;
    examTotalPages    = result.totalPages;
    examTotalElements = result.totalElements;

    loadExamsContent();
  } catch (err) {
    console.error('Lỗi tải trang bài thi:', err);
    loadExamsContent(); // vẫn render từ sessionStorage
  }
}

function goToClass(classId) {
  const selected = currentClasses.find(c => c.classId === classId);
  if (!selected) {
    return;
  }
  sessionStorage.setItem('selectedClassId', classId);
  sessionStorage.setItem('selectedClass', JSON.stringify(selected));
  window.location.href = '/pages/class-detail.html';
}

function viewClassDetails(classId) {
  const selected = currentClasses.find(c => c.classId === classId);
  if (!selected) {
    return;
  }
  sessionStorage.setItem('selectedClassId', classId);
  sessionStorage.setItem('selectedClass', JSON.stringify(selected));
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
    alert('Vui lòng nhập đầy đủ thông tin đơn vị.');
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
  if (!examGrid || !emptyState) return;

  const keyword = (document.getElementById('searchExamCatalog')?.value || '').toLowerCase().trim();
  const tagFilter = document.getElementById('filterExamCatalogTag')?.value || '';
  const showDeleted = examFilterStatus === 'deleted';
  const allExams = getExamCatalog().filter(exam => {
    if (showDeleted ? !exam.deleted : exam.deleted) return false;
    if (tagFilter && exam.examCode !== tagFilter) return false;
    const text = `${exam.name} ${exam.description}`.toLowerCase();
    return text.includes(keyword);
  });

  if (allExams.length === 0) {
    examGrid.innerHTML = '';
    examGrid.style.display = 'none';
    emptyState.style.display = 'block';
    _renderExamPagination(0, 0, 0);
    return;
  }

  // Phân trang local (dùng khi lọc/search)
  const totalLocal = allExams.length;
  const totalPagesLocal = Math.ceil(totalLocal / examPageSize);
  if (examPage >= totalPagesLocal) examPage = 0;
  const start = examPage * examPageSize;
  const pageExams = allExams.slice(start, start + examPageSize);

  examGrid.innerHTML = pageExams.map(exam => `
    <div class="exam-card${exam.deleted ? ' exam-card-deleted' : ''}">
      <div class="exam-card-header">
        <div>
          <h3 class="exam-card-title">${exam.name}</h3>
          <p class="exam-card-desc">${exam.description}</p>
        </div>
      </div>
      <div class="exam-card-meta">
        <span class="exam-meta-chip"><i class="fas fa-film"></i> ${exam.videos.length} video mẫu</span>
        <span class="exam-meta-chip"><i class="fas fa-id-badge"></i> ${exam.id}</span>
        ${exam.examCode ? `<span class="exam-meta-chip exam-code-chip"><i class="fas fa-tag"></i> ${exam.examCode}</span>` : ''}
      </div>
      <div class="exam-card-actions">
        ${exam.deleted
          ? `<button class="btn-exam-action btn-exam-restore" onclick="restoreExam('${exam.id}')">Khôi phục</button>`
          : `<button class="btn-exam-action btn-exam-edit" onclick="openExamModal('${exam.id}')">Cập nhật</button>
             <button class="btn-exam-action btn-exam-delete" onclick="deleteExam('${exam.id}')">Xóa</button>`
        }
      </div>
    </div>
  `).join('');

  examGrid.style.display = 'grid';
  emptyState.style.display = 'none';
  _renderExamPagination(examPage, totalPagesLocal, totalLocal);
}

function _renderExamPagination(page, totalPages, totalElements) {
  const container = document.getElementById('examPagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const isFirst = page === 0;
  const isLast  = page + 1 >= totalPages;
  const start   = page * examPageSize + 1;
  const end     = Math.min(start + examPageSize - 1, totalElements);

  let btns = '';
  btns += `<button class="home-page-btn" onclick="goToExamPage(${page - 1})" ${isFirst ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const winSize = 2;
  for (let i = 0; i < totalPages; i++) {
    const show = i === 0 || i === totalPages - 1 || (i >= page - winSize && i <= page + winSize);
    const ellipsis = i === page - winSize - 1 || i === page + winSize + 1;
    if (show) {
      btns += `<button class="home-page-btn${i === page ? ' active' : ''}" onclick="goToExamPage(${i})">${i + 1}</button>`;
    } else if (ellipsis) {
      btns += `<span class="home-page-ellipsis">…</span>`;
    }
  }

  btns += `<button class="home-page-btn" onclick="goToExamPage(${page + 1})" ${isLast ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

  container.innerHTML = `
    <div class="home-pagination">
      <span class="home-page-info">Hiển thị ${start}–${end} trong tổng số ${totalElements} bài thi</span>
      <div class="home-page-controls">${btns}</div>
    </div>`;
}

function goToExamPage(page) {
  const allExams = getExamCatalog().filter(exam => {
    const showDeleted = examFilterStatus === 'deleted';
    return showDeleted ? exam.deleted : !exam.deleted;
  });
  const totalPages = Math.ceil(allExams.length / examPageSize);
  if (page < 0 || page >= totalPages) return;
  examPage = page;
  loadExamsContent();
}

function searchExams() {
  examPage = 0;
  loadExamsContent();
}

async function populateExamCatalogTagFilter() {
  const select = document.getElementById('filterExamCatalogTag');
  if (!select) return;

  try {
    const examTypes = await ExamsService.getExamTypes();
    const allCodes = new Set(examTypes.map(et => et.examCode).filter(Boolean));
    
    select.innerHTML = '<option value="">Tất cả tag</option>';
    Array.from(allCodes).sort().forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn('Lỗi khi tải danh sách tag bài thi', err);
  }
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

      // Upload lên server (Cloudinary) — nếu thất bại vẫn dùng IndexedDB
      try {
        const cloudUrl = await ExamsService.uploadSampleVideo(selectedFile, videoPayload.name);
        if (cloudUrl) {
          videoPayload.url = cloudUrl;
        }
      } catch (uploadErr) {
        console.warn('Không thể upload video mẫu lên server, dùng bản local:', uploadErr);
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

  const rows = videos.length > 0 ? videos.slice(0, 1) : [{ name: '', file: '' }];
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

async function populateExamCodeOptions(selectedCode) {
  const select = document.getElementById('examCodeSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Đang tải... --</option>';
  select.disabled = true;

  try {
    const examTypes = await ExamsService.getExamTypes();

    // Build a map: examCode → id for pre-selection and data-id storage
    const codeToId = {};
    examTypes.forEach(et => { if (et.examCode) codeToId[et.examCode] = et.id; });

    const allCodes = new Set(examTypes.map(et => et.examCode).filter(Boolean));
    // Always include selected code even if not returned by API
    if (selectedCode) allCodes.add(selectedCode);

    select.innerHTML = '<option value="">-- Không có mã --</option>';
    Array.from(allCodes).sort().forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      if (codeToId[code] != null) opt.dataset.id = String(codeToId[code]);
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn('[populateExamCodeOptions] Không thể tải danh sách mã bài thi:', err);
    // Fallback: dùng catalog cục bộ
    const allCodes = new Set();
    getExamCatalog().forEach(exam => { if (exam.examCode) allCodes.add(exam.examCode); });
    if (selectedCode) allCodes.add(selectedCode);
    select.innerHTML = '<option value="">-- Không có mã --</option>';
    Array.from(allCodes).sort().forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      select.appendChild(opt);
    });
  } finally {
    select.disabled = false;
    select.value = selectedCode || '';
  }
}

async function openExamModal(examId = '') {
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
    await populateExamCodeOptions(exam.examCode || '');
    renderExamVideoFields(exam.videos || []);
  } else {
    title.textContent = 'Thêm bài thi mới';
    idInput.value = '';
    nameInput.value = '';
    descInput.value = '';
    await populateExamCodeOptions('');
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
  if (typeof _stopExamSaveProgress === 'function') {
    _stopExamSaveProgress();
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

let _examSaveProgressInterval = null;

function _startExamSaveProgress(msg) {
  _stopExamSaveProgress();
  const loadingDiv = document.getElementById('exam-save-loading');
  const msgEl = document.getElementById('exam-save-loading-text');
  const actionsDiv = document.getElementById('exam-form-actions');
  
  if (loadingDiv) loadingDiv.style.display = 'flex';
  if (msgEl && msg) msgEl.textContent = msg;
  if (actionsDiv) actionsDiv.style.display = 'none';

  const bar = document.getElementById('exam-save-progress-bar');
  const pctText = document.getElementById('exam-save-progress-pct');
  if (!bar || !pctText) return;
  
  let pct = 0;
  bar.style.width = '0%';
  pctText.textContent = '0%';
  
  _examSaveProgressInterval = setInterval(() => {
    if (pct < 50) pct += 2;
    else if (pct < 80) pct += 1;
    else if (pct < 95) pct += 0.2;
    if (pct > 99) pct = 99;
    
    bar.style.width = pct + '%';
    pctText.textContent = Math.floor(pct) + '%';
  }, 300);
}

function _stopExamSaveProgress() {
  if (_examSaveProgressInterval) {
    clearInterval(_examSaveProgressInterval);
    _examSaveProgressInterval = null;
  }
  const loadingDiv = document.getElementById('exam-save-loading');
  const actionsDiv = document.getElementById('exam-form-actions');
  
  if (loadingDiv) loadingDiv.style.display = 'none';
  if (actionsDiv) actionsDiv.style.display = 'flex';
}

function saveExam(event) {
  event.preventDefault();

  const id = document.getElementById('examEditId').value.trim();
  const targetExamId = id || `exam-${Date.now()}`;
  const examCodeSelect = document.getElementById('examCodeSelect');
  const examCode = (examCodeSelect?.value || '').trim() || null;
  const examTypeId = parseInt(examCodeSelect?.selectedOptions?.[0]?.dataset?.id || '', 10) || null;
  const name = document.getElementById('examName').value.trim();
  const description = document.getElementById('examDescription').value.trim();
  const videoDrafts = getExamVideoDrafts().filter(video => video.file || video.selectedFile);

  if (!name || !description) {
    alert('Vui lòng nhập đầy đủ tên và mô tả bài thi.');
    return;
  }

  if (!examTypeId) {
    alert('Vui lòng chọn Loại/Mã bài thi hợp lệ.');
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
    const newFilesCount = videoDrafts.filter(d => d.selectedFile).length;
    if (newFilesCount > 0) {
      showHomeToast(`Đang tải lên ${newFilesCount} video mẫu...`);
    }
    const videos = await buildExamVideoPayloads(videoDrafts, targetExamId);

    let updatedExams;
    if (id) {
      const previousExam = exams.find(exam => exam.id === id);
      const preservedKeys = new Set(videos.map(video => video.storageKey).filter(Boolean));
      const removedKeys = (previousExam?.videos || [])
        .map(video => video.storageKey)
        .filter(storageKey => storageKey && !preservedKeys.has(storageKey));

      await Promise.all(removedKeys.map(removeSampleVideoBlobByKey));

      // Gọi API cập nhật bài thi lên server
      const sampleVideoUrl = videos.find(v => v.url)?.url || '';
      if (typeof ExamsService !== 'undefined') {
        try {
          // Trích xuất standardData từ video mẫu mới (nếu có)
          let standardData = null;
          if (sampleVideoUrl) {
            showHomeToast('Đang trích xuất dữ liệu chuẩn từ video mẫu...');
            _startExamSaveProgress('Đang trích xuất dữ liệu chuẩn từ video mẫu...');
            try {
              standardData = await ExamsService.extractTemplate(sampleVideoUrl);
            } catch (extractErr) {
              console.warn('Trích xuất dữ liệu chuẩn thất bại, tiếp tục cập nhật bài thi:', extractErr);
            } finally {
              _stopExamSaveProgress();
            }
          }
          await ExamsService.updateTeacherExam(id, {
            idExamType: examTypeId,
            name,
            description,
            sampleVideoUrl,
            standardData,
          });
        } catch (err) {
          console.warn('Cập nhật bài thi trên server thất bại, lưu local:', err);
        }
      }

      updatedExams = exams.map(exam => exam.id === id ? {
        ...exam,
        name,
        description,
        examCode,
        videos
      } : exam);
    } else {
      // Tạo bài thi mới — gọi API server trước, dùng ID trả về
      let serverExamId = targetExamId;
      const sampleVideoUrl = videos.find(v => v.url)?.url || '';
      const teacherId = currentUser?.studentId || currentUser?.id || currentUser?.username || '';
      if (teacherId && typeof ExamsService !== 'undefined') {
        try {
          let standardData = null;
          if (sampleVideoUrl) {
            showHomeToast('Đang trích xuất dữ liệu chuẩn từ video mẫu...');
            _startExamSaveProgress('Đang trích xuất dữ liệu chuẩn từ video mẫu...');
            try {
              standardData = await ExamsService.extractTemplate(sampleVideoUrl);
            } catch (extractErr) {
              console.warn('Trích xuất dữ liệu chuẩn thất bại, tiếp tục tạo bài thi:', extractErr);
            } finally {
              _stopExamSaveProgress();
            }
          }
          const created = await ExamsService.createTeacherExam(name, description, sampleVideoUrl, teacherId, examTypeId, standardData);
          if (created?.id) {
            serverExamId = String(created.id);
          }
        } catch (err) {
          console.warn('Tạo bài thi trên server thất bại, lưu local:', err);
        }
      }

      updatedExams = [
        {
          id: serverExamId,
          name,
          description,
          icon: '📝',
          iconClass: 'custom-exam',
          examCode,
          videos
        },
        ...exams
      ];
    }

    saveExamCatalog(updatedExams);
    loadExamsContent();
    closeExamModal();
    showHomeToast(successMessage);
    _stopExamSaveProgress();
  });
}

function deleteExam(examId) {
  const exam = getExamCatalog().find(item => item.id === examId && !item.deleted);
  if (!exam) {
    return;
  }

  openDeleteConfirmModal(`Bạn có chắc chắn muốn xóa bài thi ${exam.name} không?`, async () => {
    try {
      const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.DELETE_TEACHER_EXAM)
        ? API_CONFIG.ENDPOINTS.DELETE_TEACHER_EXAM(examId)
        : `http://103.75.182.246:8080/api/teacher/exam/${encodeURIComponent(examId)}`;

      const headers = {};
      const csrfToken = typeof _getCsrfToken === 'function' ? _getCsrfToken() : null;
      if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;
      const accessToken = typeof TokenManager !== 'undefined' ? TokenManager.getAccessToken() : null;
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch(url, { method: 'DELETE', credentials: 'include', headers });
      if (!response.ok) {
        const msg = await response.text().catch(() => '');
        showHomeToast('Xóa bài thi thất bại: ' + (msg || `HTTP ${response.status}`));
        return;
      }
    } catch (err) {
      showHomeToast('Không thể kết nối đến máy chủ để xóa bài thi.');
      return;
    }

    const allExams = getExamCatalog();
    const target = allExams.find(item => item.id === examId);
    if (target) target.deleted = true;
    saveExamCatalog(allExams);
    cleanupExamScores(examId);

    loadExamsContent();
    showHomeToast(`Đã xóa bài thi "${exam.name}" thành công.`);
  });
}

async function restoreExam(examId) {
  const exam = getExamCatalog().find(item => item.id === examId && item.deleted);
  if (!exam) return;

  try {
    const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.RESTORE_TEACHER_EXAM)
      ? API_CONFIG.ENDPOINTS.RESTORE_TEACHER_EXAM(examId)
      : `http://103.75.182.246:8080/api/teacher/exam/${encodeURIComponent(examId)}`;

    const response = await fetch(url, { method: 'PUT', credentials: 'include' });
    if (!response.ok) {
      const msg = await response.text().catch(() => '');
      showHomeToast('Khôi phục bài thi thất bại: ' + (msg || `HTTP ${response.status}`));
      return;
    }
  } catch (err) {
    showHomeToast('Không thể kết nối đến máy chủ để khôi phục bài thi.');
    return;
  }

  const allExams = getExamCatalog();
  const target = allExams.find(item => item.id === examId);
  if (target) target.deleted = false;
  saveExamCatalog(allExams);
  loadExamsContent();
  showHomeToast(`Đã khôi phục bài thi "${exam.name}" thành công.`);
}

let currentErrorData = [];
let errorFilterStatus = 'active';
let examFilterStatus = 'active';

// ---- Error pagination state ----
let errorPage         = 0;
let errorPageSize     = 10;
let errorTotalPages   = 1;
let errorTotalElements = 0;
let errorTeacherId    = '';

function switchHomeExamFilterTab(status) {
  examFilterStatus = status;
  
  const tabActive = document.getElementById('tabHomeExamActive');
  const tabDeleted = document.getElementById('tabHomeExamDeleted');
  
  if (status === 'active') {
    if (tabActive) {
      tabActive.style.borderBottomColor = '#b42318';
      tabActive.style.color = '#b42318';
      tabActive.classList.add('active');
    }
    if (tabDeleted) {
      tabDeleted.style.borderBottomColor = 'transparent';
      tabDeleted.style.color = '#64748b';
      tabDeleted.classList.remove('active');
    }
  } else {
    if (tabDeleted) {
      tabDeleted.style.borderBottomColor = '#b42318';
      tabDeleted.style.color = '#b42318';
      tabDeleted.classList.add('active');
    }
    if (tabActive) {
      tabActive.style.borderBottomColor = 'transparent';
      tabActive.style.color = '#64748b';
      tabActive.classList.remove('active');
    }
  }
  
  examPage = 0;
  loadExamsContent();
}

async function loadErrorsContent() {
  const container = document.getElementById('errorsContent');
  if (!container) return;

  // Render ngay từ cache trước
  renderErrors();

  const teacherId = currentUser?.studentId || currentUser?.id || currentUser?.username || '';
  if (!teacherId) return;

  errorTeacherId = teacherId;
  await loadErrorPageFromAPI(0);
}

async function loadErrorPageFromAPI(page) {
  if (!errorTeacherId) return;

  try {
    const url = API_CONFIG.ENDPOINTS.TEACHER_ERRORS(errorTeacherId, page, errorPageSize);
    const response = await ApiClient.fetchWithAuth(url);
    const json = await response.json().catch(() => null);

    if (!response.ok) return;

    // Hỗ trợ Spring Page<> { data: { content, totalPages, totalElements } }
    const pageData = json?.data;
    let rawList, totalPages, totalElements;

    if (pageData && Array.isArray(pageData.content)) {
      rawList       = pageData.content;
      totalPages    = pageData.totalPages    ?? 1;
      totalElements = pageData.totalElements ?? rawList.length;
    } else if (Array.isArray(json?.data)) {
      rawList       = json.data;
      totalPages    = 1;
      totalElements = rawList.length;
    } else {
      return;
    }

    const serverErrors = rawList.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description || '',
      severity: e.severityType === 'HIGH' ? 'cao' : e.severityType === 'LOW' ? 'thap' : 'trung-binh',
      deduction: e.deduction,
      icon: 'fas fa-exclamation-circle',
      students: [],
      deleted: !e.isActive
    }));

    if (page === 0) {
      currentErrorData = serverErrors;
    } else {
      // Merge: thay thế các item cùng id, thêm mới nếu chưa có
      const idSet = new Set(serverErrors.map(e => e.id));
      currentErrorData = [...currentErrorData.filter(e => !idSet.has(e.id)), ...serverErrors];
    }

    saveStoredErrors(currentErrorData);
    errorPage          = page;
    errorTotalPages    = totalPages;
    errorTotalElements = totalElements;

    renderErrors();
  } catch (err) {
    console.warn('Không thể tải danh sách lỗi từ API:', err);
  }
}

function renderErrors() {
  const container = document.getElementById('errorsContent');
  if (!container) return;

  const activeData = currentErrorData.filter(e => !e.deleted);
  const keyword = (document.getElementById('searchError')?.value || '').toLowerCase().trim();
  const severityFilter = document.getElementById('filterErrorSeverity')?.value || '';
  
  const filteredAll = (errorFilterStatus === 'deleted'
    ? currentErrorData.filter(e => e.deleted)
    : activeData
  ).filter(e => {
    if (severityFilter && e.severity !== severityFilter) return false;
    if (keyword && !`${e.name} ${e.description}`.toLowerCase().includes(keyword)) return false;
    return true;
  });

  // Phân trang local
  const totalLocal   = filteredAll.length;
  const totalPagesLocal = Math.max(1, Math.ceil(totalLocal / errorPageSize));
  if (errorPage >= totalPagesLocal) errorPage = 0;
  const startIdx   = errorPage * errorPageSize;
  const filteredData = filteredAll.slice(startIdx, startIdx + errorPageSize);

  const totalStudents = activeData.reduce((sum, e) => sum + e.students.length, 0);
  const highCount = activeData.filter(e => e.severity === 'cao').length;
  const medCount = activeData.filter(e => e.severity === 'trung-binh').length;
  const lowCount = activeData.filter(e => e.severity === 'thap').length;

  const severityText = (s) => s === 'cao' ? 'Nghiêm trọng' : s === 'thap' ? 'Thấp' : 'Trung bình';

  const emptyMessage = errorFilterStatus === 'deleted'
    ? 'Không có lỗi nào đã xóa.'
    : 'Chưa có lỗi nào.';

  container.innerHTML = `
    <div class="error-type-list">
      ${filteredData.length === 0 ? `<div class="error-empty-state">${emptyMessage}</div>` : filteredData.map(error => `
        <div class="error-type-card${error.deleted ? ' error-deleted' : ''}" id="error-card-${error.id}">
          <div class="error-type-header">
            <div class="error-type-info">
              <div class="error-type-name">
                ${error.name}
              </div>
              <div class="error-type-description">${error.note || error.description}</div>
            </div>
            <div class="error-deduction-badge">-${error.deduction} điểm</div>
            <div class="error-type-severity ${error.severity}">${severityText(error.severity)}</div>
            ${error.deleted
              ? `<button class="btn-restore-error" onclick="restoreError(${error.id})" title="Khôi phục lỗi"><i class="fas fa-undo"></i> Khôi phục</button>`
              : `<button class="btn-delete-error" onclick="deleteError(${error.id})" title="Xóa lỗi"><i class="fas fa-trash-alt"></i></button>`
            }
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Render summary vào div cố định (không bị xóa khi scroll danh sách)
  const summaryEl = document.getElementById('errorSummaryFixed');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="error-summary">
        <div class="summary-item">
          <span class="summary-label"><i class="fas fa-exclamation-triangle"></i> Tổng lỗi</span>
          <span class="summary-value">${activeData.length}</span>
        </div>
        <div class="summary-item summary-high">
          <span class="summary-label"><i class="fas fa-times-circle"></i> Nghiêm trọng</span>
          <span class="summary-value">${highCount}</span>
        </div>
        <div class="summary-item summary-medium">
          <span class="summary-label"><i class="fas fa-info-circle"></i> Trung bình</span>
          <span class="summary-value">${medCount}</span>
        </div>
        <div class="summary-item summary-low">
          <span class="summary-label"><i class="fas fa-check-circle"></i> Thấp</span>
          <span class="summary-value">${lowCount}</span>
        </div>
      </div>`;
  }

  _renderErrorPagination(errorPage, totalPagesLocal, totalLocal);
}

function _renderErrorPagination(page, totalPages, totalElements) {
  const container = document.getElementById('errorPagination');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const isFirst = page === 0;
  const isLast  = page + 1 >= totalPages;
  const start   = page * errorPageSize + 1;
  const end     = Math.min(start + errorPageSize - 1, totalElements);

  let btns = '';
  btns += `<button class="home-page-btn" onclick="goToErrorPage(${page - 1})" ${isFirst ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const winSize = 2;
  for (let i = 0; i < totalPages; i++) {
    const show = i === 0 || i === totalPages - 1 || (i >= page - winSize && i <= page + winSize);
    const ellipsis = i === page - winSize - 1 || i === page + winSize + 1;
    if (show) {
      btns += `<button class="home-page-btn${i === page ? ' active' : ''}" onclick="goToErrorPage(${i})">${i + 1}</button>`;
    } else if (ellipsis) {
      btns += `<span class="home-page-ellipsis">…</span>`;
    }
  }

  btns += `<button class="home-page-btn" onclick="goToErrorPage(${page + 1})" ${isLast ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

  container.innerHTML = `
    <div class="home-pagination">
      <span class="home-page-info">Hiển thị ${start}–${end} trong tổng số ${totalElements} lỗi</span>
      <div class="home-page-controls">${btns}</div>
    </div>`;
}

function goToErrorPage(page) {
  const filteredAll = errorFilterStatus === 'deleted'
    ? currentErrorData.filter(e => e.deleted)
    : currentErrorData.filter(e => !e.deleted);
  const totalPages = Math.max(1, Math.ceil(filteredAll.length / errorPageSize));
  if (page < 0 || page >= totalPages) return;
  errorPage = page;
  renderErrors();
}

function switchHomeErrorFilterTab(status) {
  errorFilterStatus = status;
  
  const tabActive = document.getElementById('tabHomeErrorActive');
  const tabDeleted = document.getElementById('tabHomeErrorDeleted');
  
  if (status === 'active') {
    if (tabActive) {
      tabActive.style.borderBottomColor = '#b42318';
      tabActive.style.color = '#b42318';
      tabActive.classList.add('active');
    }
    if (tabDeleted) {
      tabDeleted.style.borderBottomColor = 'transparent';
      tabDeleted.style.color = '#64748b';
      tabDeleted.classList.remove('active');
    }
  } else {
    if (tabDeleted) {
      tabDeleted.style.borderBottomColor = '#b42318';
      tabDeleted.style.color = '#b42318';
      tabDeleted.classList.add('active');
    }
    if (tabActive) {
      tabActive.style.borderBottomColor = 'transparent';
      tabActive.style.color = '#64748b';
      tabActive.classList.remove('active');
    }
  }
  
  errorPage = 0;
  renderErrors();
}

function deleteError(errorId) {
  const error = currentErrorData.find(e => e.id === errorId && !e.deleted);
  if (!error) return;

  openDeleteConfirmModal('Bạn có chắc muốn xóa lỗi "' + error.name + '" không?', async () => {
    try {
      const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.DELETE_TEACHER_ERROR)
        ? API_CONFIG.ENDPOINTS.DELETE_TEACHER_ERROR(errorId)
        : `http://103.75.182.246:8080/api/teacher/error/${encodeURIComponent(errorId)}`;

      const response = await fetch(url, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const msg = await response.text().catch(() => '');
        showHomeToast('Xóa lỗi thất bại: ' + (msg || `HTTP ${response.status}`));
        return;
      }
    } catch (err) {
      showHomeToast('Không thể kết nối đến máy chủ để xóa lỗi.');
      return;
    }

    error.deleted = true;
    saveStoredErrors(currentErrorData);
    renderErrors();
    showHomeToast('Đã xóa lỗi "' + error.name + '" thành công.');
  });
}

async function restoreError(errorId) {
  const error = currentErrorData.find(e => e.id === errorId && e.deleted);
  if (!error) return;

  try {
    const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.RESTORE_TEACHER_ERROR)
      ? API_CONFIG.ENDPOINTS.RESTORE_TEACHER_ERROR(errorId)
      : `http://103.75.182.246:8080/api/teacher/error/${encodeURIComponent(errorId)}`;

    const csrfCookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
    const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : '';

    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {})
      }
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      showHomeToast('Khôi phục lỗi thất bại: ' + (json?.message || `HTTP ${response.status}`));
      return;
    }
  } catch (err) {
    showHomeToast('Không thể kết nối đến máy chủ để khôi phục lỗi.');
    return;
  }

  error.deleted = false;
  saveStoredErrors(currentErrorData);
  renderErrors();
  showHomeToast(`Đã khôi phục lỗi "${error.name}".`);
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

async function addErrorCatalog(event) {
  event.preventDefault();

  const name = document.getElementById('errorName').value.trim();
  const description = document.getElementById('errorDescription').value.trim();
  const severity = document.getElementById('errorSeverity').value;
  const deduction = parseFloat(document.getElementById('errorDeduction').value);

  if (!name || !description || Number.isNaN(deduction) || deduction <= 0) {
    alert('Vui lòng nhập đầy đủ thông tin lỗi hợp lệ.');
    return;
  }

  const duplicate = currentErrorData.find(error => !error.deleted && error.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    alert('Tên lỗi đã tồn tại. Vui lòng nhập tên khác.');
    return;
  }

  const severityApiMap = { 'cao': 'HIGH', 'trung-binh': 'MEDIUM', 'thap': 'LOW' };
  const severityType = severityApiMap[severity] || 'MEDIUM';
  const idTeacher = currentUser?.studentId || currentUser?.id || currentUser?.username || '';

  let newErrorId = Date.now();

  try {
    const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.CREATE_TEACHER_ERROR)
      ? API_CONFIG.ENDPOINTS.CREATE_TEACHER_ERROR
      : 'http://103.75.182.246:8080/api/teacher/error';

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idTeacher, name, description, severityType, deduction })
    });

    const json = await response.json().catch(() => null);

    if ((response.ok || response.status === 201) && json?.data?.id) {
      newErrorId = json.data.id;
    } else {
      const msg = json?.message || `HTTP ${response.status}`;
      console.warn('Thêm lỗi API thất bại:', msg);
    }
  } catch (err) {
    console.warn('Không thể kết nối API thêm lỗi, lưu local:', err);
  }

  const newError = {
    id: newErrorId,
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
  errorPage = 0;
  renderErrors();
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

// Cache lịch sử từ API (null = chưa load, [] = đã load nhưng rỗng)
let _apiHistoryCache = null;

// Map record từ API response sang format frontend dùng
function _mapApiHistoryRecord(item) {
  return {
    id: item.id,
    teacherId: item.teacherId,
    teacherName: item.teacherName,
    classId: item.classId,
    className: item.className,
    studentCode: item.studentCode,
    studentName: item.studentName,
    examId: item.examId,
    examName: item.examName,
    gradingMode: (item.gradingMode || '').toLowerCase(),  // OFFICIAL → official
    gradingSessionId: item.gradingSessionId,
    submissionId: item.submissionId,
    timestamp: item.gradedAt
      ? new Date(item.gradedAt).toLocaleString('vi-VN')
      : '—',
    timestampIso: item.gradedAt || null,
    finalScore: item.finalScore ?? 10,
    totalDeductions: item.totalDeductions ?? 0,
    totalFrames: Array.isArray(item.frames) ? item.frames.length : 0,
    // Map frames sang format history
    history: Array.isArray(item.frames) ? item.frames.map((f, idx) => ({
      id: idx + 1,
      frameTs: f.frameTimeSeconds ?? 0,
      video: 1,
      total: -(f.deductionApplied ?? 0),
      errors: [{
        id: f.errorId,
        name: f.errorTypeName,
        score: -(f.deductionApplied ?? 0),
        note: f.notes || ''
      }]
    })) : [],
    _fromApi: true
  };
}

async function loadApiGradingHistory(page = 0) {
  if (!currentUser) return;
  const teacherId = currentUser.id || currentUser.studentId || currentUser.username;
  if (!teacherId) return;

  try {
    const url = API_CONFIG.ENDPOINTS.GRADING_HISTORY(teacherId, page, historyPageSize);
    const res = await ApiClient.fetchWithAuth(url);
    if (!res.ok) return;
    const json = await res.json().catch(() => null);

    // Spring Page<> format: { data: { content, totalPages, totalElements, number } }
    if (Array.isArray(json?.data?.content)) {
      _apiHistoryCache = json.data.content.map(_mapApiHistoryRecord);
      historyPage         = json.data.number ?? page;
      historyTotalPages   = json.data.totalPages ?? 1;
      historyTotalElements = json.data.totalElements ?? json.data.content.length;
    } else if (Array.isArray(json?.data)) {
      // Fallback: flat array (no pagination from server)
      _apiHistoryCache = json.data.map(_mapApiHistoryRecord);
      historyPage         = 0;
      historyTotalPages   = 1;
      historyTotalElements = _apiHistoryCache.length;
    } else {
      return;
    }

    // Re-render nếu đang ở tab lịch sử
    const container = document.getElementById('historyContent');
    if (container) loadGradingHistoryContent();
  } catch (e) {
    console.warn('[loadApiGradingHistory] Không thể tải lịch sử từ API:', e);
  }
}

function getTeacherGradingHistory() {
  // Ưu tiên dữ liệu từ API nếu đã có
  if (_apiHistoryCache !== null) {
    return _apiHistoryCache;
  }
  // Fallback về localStorage
  const teacherId = currentUser?.studentId || currentUser?.id || currentUser?.username || currentUser?.name || 'teacher';
  return getStoredGradingHistory()
    .filter(record => record.teacherId === teacherId)
    .sort((left, right) => new Date(right.timestampIso || 0).getTime() - new Date(left.timestampIso || 0).getTime());
}

function getHistoryVideos(record) {
  if (!record?.videoStorageKey) {
    return [];
  }

  const stored = JSON.parse(sessionStorage.getItem(record.videoStorageKey) || '[]');
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

  // Lần đầu vào tab → gọi API (async, sẽ re-render khi xong)
  if (_apiHistoryCache === null) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-spinner fa-spin" style="font-size:48px;color:#DC143C"></i></div>
        <h2>Đang tải lịch sử chấm...</h2>
      </div>
    `;
    loadApiGradingHistory();
    return;
  }

  // If a search query is present, filter records by student code, name or exam name
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
    const paginationEl = document.getElementById('historyPagination');
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  if (!selectedGradingHistoryId || !records.some(record => record.id === selectedGradingHistoryId)) {
    selectedGradingHistoryId = records[0].id;
  }

  const selectedRecord = records.find(record => record.id === selectedGradingHistoryId) || records[0];
  const totalFrames = records.reduce((sum, record) => sum + (record.totalFrames || 0), 0);
  const officialCount = records.filter(record =>
    (record.gradingMode || '').toLowerCase() === 'official'
  ).length;

  // Render summary cards vào vùng cố định (không scroll)
  const summaryEl = document.getElementById('historySummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
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
    `;
  }

  // Render chỉ danh sách + detail vào #historyContent (có scroll riêng)
  container.innerHTML = `
    <div class="grading-history-layout">
      <div class="grading-history-list">
        ${records.map(record => `
          <button class="grading-history-item ${record.id === selectedRecord.id ? 'active' : ''}" data-id="${record.id}" onclick="selectGradingHistory('${record.id}')">
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

  // Tải dữ liệu API cho bản ghi đang chọn (async, cập nhật sau khi load xong)
  _fetchHistoryDetailApi(selectedRecord);

  // Render pagination controls
  _renderHistoryPagination();
}

function renderGradingHistoryDetail(record) {
  if (!record) {
    return '<div class="history-detail-empty">Chọn một bài thi đã chấm để xem chi tiết.</div>';
  }

  // Lấy dữ liệu từ API cache (nếu đã fetch)
  const cached = _historyDetailCache[record.id] || {};
  const apiFrames = cached.apiFrames ?? null;
  const gradeBoardEntry = cached.gradeBoardEntry ?? null;

  // Ưu tiên frame từ API, fallback về sessionStorage
  const frames = apiFrames ?? (Array.isArray(record.history) ? record.history : []);

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

  const frameMarkup = frames.length === 0
    ? '<div class="history-empty-box">Bài thi này không có frame lỗi nào được lưu.</div>'
    : `<div class="history-frame-grid">${frames.map((frame, index) => `
        <div class="history-frame-card">
          <div class="history-frame-top">
            <div>
              <div class="history-frame-title">Frame ${String(index + 1).padStart(2, '0')}</div>
              <div class="history-frame-meta">Video ${String(frame.video || 1).padStart(2, '0')} · ${formatFrameTime(frame.frameTs)}</div>
            </div>
            <div class="history-frame-score">${Number(frame.total || 0).toFixed(1)}</div>
          </div>
          ${frame.imageUrl ? `<img src="${frame.imageUrl}" class="history-frame-img" alt="Frame ${index + 1}" loading="lazy" onclick="openImageViewer('${frame.imageUrl}')" style="cursor: pointer; transition: transform 0.2s; user-select: none; -webkit-user-select: none; -webkit-user-drag: none;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">` : ''}
          <div class="history-tag-list">
            ${(frame.errors || []).map(error => `<span class="history-tag">${error.name}${error.note ? ` · ${error.note}` : ''}</span>`).join('')}
          </div>
        </div>
      `).join('')}</div>`;

  // Điểm từ grade board API
  const practiceScore = gradeBoardEntry?.practiceScore ?? null;
  const officialScore = gradeBoardEntry?.officialScore ?? null;
  const scoreBadgeHTML = (practiceScore != null || officialScore != null) ? `
    <div class="history-score-badges">
      ${practiceScore != null ? `<span class="history-score-badge practice">📝 Luyện tập: ${Number(practiceScore).toFixed(1)}/10</span>` : ''}
      ${officialScore != null ? `<span class="history-score-badge official">🏅 Chính thức: ${Number(officialScore).toFixed(1)}/10</span>` : ''}
    </div>` : '';

  const totalFrames = apiFrames ? apiFrames.length : (record.totalFrames || 0);
  const totalDeductions = apiFrames
    ? Math.abs(apiFrames.reduce((s, f) => s + (f.total || 0), 0))
    : Number(record.totalDeductions || 0);

  return `
    <div class="history-detail-header">
      <div>
        <h3>${record.examName}</h3>
        <p>${record.studentName} (${record.studentCode}) · ${record.className || 'Chưa rõ lớp'}</p>
        ${scoreBadgeHTML}
      </div>
      <div class="history-detail-score">${Number(record.finalScore || 0).toFixed(1)}/10</div>
    </div>
    <div class="history-detail-meta-grid">
      <div class="history-detail-meta"><span>Chế độ</span><strong>${formatHistoryMode(record.gradingMode)}</strong></div>
      <div class="history-detail-meta"><span>Tổng frame lỗi</span><strong>${totalFrames}</strong></div>
      <div class="history-detail-meta"><span>Tổng điểm trừ</span><strong>${totalDeductions.toFixed(1)}</strong></div>
    </div>
    <div class="history-detail-block">
      <div class="history-block-title"><i class="fas fa-camera"></i> Các frame bị lỗi và tag lỗi</div>
      ${frameMarkup}
    </div>
  `;
}

// Cache API detail data cho bản ghi đang chọn
let _historyDetailCache = {}; // { recordId: { apiFrames, gradeBoardEntry } }

async function _fetchHistoryDetailApi(record) {
  if (!record) return;
  const recordId = record.id;
  // Bỏ qua nếu đã có cache
  if (_historyDetailCache.hasOwnProperty(recordId)) return;

  const idSession = record.gradingSessionId;
  const submissionId = record.submissionId ?? null;

  const [framesResult, gradeBoardResult] = await Promise.allSettled([
    idSession
      ? fetch(
          API_CONFIG.ENDPOINTS.GRADING_ERROR_DETAIL
            ? API_CONFIG.ENDPOINTS.GRADING_ERROR_DETAIL(idSession, record.gradingMode === 'official' ? 'OFFICIAL' : 'PRACTICE')
            : `http://103.75.182.246:8080/public/grading-error/${encodeURIComponent(idSession)}?gradingMode=${record.gradingMode === 'official' ? 'OFFICIAL' : 'PRACTICE'}`,
          { credentials: 'include' }
        ).then(r => r.json()).catch(() => null)
      : Promise.resolve(null),
    submissionId
      ? fetch(
          API_CONFIG.ENDPOINTS.GRADE_BOARD
            ? API_CONFIG.ENDPOINTS.GRADE_BOARD(submissionId)
            : `http://103.75.182.246:8080/public/grade-board/${encodeURIComponent(submissionId)}`,
          { credentials: 'include' }
        ).then(r => r.json()).catch(() => null)
      : Promise.resolve(null)
  ]);

  // Parse frames từ GRADING_ERROR_DETAIL
  let apiFrames = null;
  const framesJson = framesResult.status === 'fulfilled' ? framesResult.value : null;
  if (Array.isArray(framesJson?.data) && framesJson.data.length > 0) {
    const frameMap = new Map();
    framesJson.data.forEach(err => {
      const key = String(err.frameTimeSeconds ?? 0);
      if (!frameMap.has(key)) {
        frameMap.set(key, { frameTs: Number(err.frameTimeSeconds) || 0, imageUrl: err.frameImageUrl || null, errors: [], total: 0 });
      }
      const frame = frameMap.get(key);
      frame.errors.push({ id: err.id, name: err.errorName, score: -Math.abs(Number(err.deduction) || 0), note: err.errorDescription || '' });
      frame.total -= Math.abs(Number(err.deduction) || 0);
    });
    apiFrames = Array.from(frameMap.values());
  }

  let gradeBoardEntry = null;
  const gbJson = gradeBoardResult.status === 'fulfilled' ? gradeBoardResult.value : null;
  const list = Array.isArray(gbJson?.data?.content) ? gbJson.data.content : (Array.isArray(gbJson?.data) ? gbJson.data : []);
  if (list.length > 0) {
    gradeBoardEntry = list[0];
  }

  _historyDetailCache[recordId] = { apiFrames, gradeBoardEntry };

  // Re-render detail panel nếu bản ghi này vẫn đang được chọn
  if (selectedGradingHistoryId === recordId) {
    const detailEl = document.querySelector('.grading-history-detail');
    if (detailEl) detailEl.innerHTML = renderGradingHistoryDetail(record);
  }
}

function selectGradingHistory(recordId) {
  if (selectedGradingHistoryId === recordId) return;

  selectedGradingHistoryId = recordId;

  // Cập nhật class active trên giao diện mà không re-render danh sách (giữ vị trí scroll)
  const listItems = document.querySelectorAll('.grading-history-item');
  listItems.forEach(item => {
    if (item.getAttribute('data-id') === String(recordId)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Tìm lại bản ghi được chọn
  const records = getTeacherGradingHistory();
  const selectedRecord = records.find(r => String(r.id) === String(recordId)) || records[0];

  // Chỉ re-render phần chi tiết bên phải
  const detailEl = document.querySelector('.grading-history-detail');
  if (detailEl && selectedRecord) {
    detailEl.innerHTML = renderGradingHistoryDetail(selectedRecord);
  }

  // Lấy dữ liệu API nếu có
  if (selectedRecord) {
    _fetchHistoryDetailApi(selectedRecord);
  }
}

function _renderHistoryPagination() {
  const container = document.getElementById('historyPagination');
  if (!container) return;

  if (historyTotalPages <= 1 && historyTotalElements <= historyPageSize) {
    container.innerHTML = '';
    return;
  }

  const isFirstPage = historyPage === 0;
  const isLastPage  = historyPage + 1 >= historyTotalPages;

  const start = historyPage * historyPageSize + 1;
  const end   = Math.min(start + (_apiHistoryCache?.length ?? 0) - 1, historyTotalElements);

  let btns = '';
  btns += `<button class="home-page-btn" onclick="loadHistoryPage(${historyPage - 1})" ${isFirstPage ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const winSize = 2;
  for (let i = 0; i < historyTotalPages; i++) {
    const show = i === 0 || i === historyTotalPages - 1 || (i >= historyPage - winSize && i <= historyPage + winSize);
    const ellipsis = i === historyPage - winSize - 1 || i === historyPage + winSize + 1;
    if (show) {
      btns += `<button class="home-page-btn${i === historyPage ? ' active' : ''}" onclick="loadHistoryPage(${i})">${i + 1}</button>`;
    } else if (ellipsis) {
      btns += `<span class="home-page-ellipsis">…</span>`;
    }
  }

  btns += `<button class="home-page-btn" onclick="loadHistoryPage(${historyPage + 1})" ${isLastPage ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

  const infoText = historyTotalElements > 0
    ? `Hiển thị ${start}–${end} trong tổng số ${historyTotalElements} lần chấm`
    : `Trang ${historyPage + 1} / ${historyTotalPages}`;

  container.innerHTML = `
    <div class="home-pagination">
      <span class="home-page-info">${infoText}</span>
      <div class="home-page-controls">${btns}</div>
    </div>`;
}

async function loadHistoryPage(page) {
  if (page < 0 || page >= historyTotalPages) return;
  _apiHistoryCache = null;
  selectedGradingHistoryId = null;
  await loadApiGradingHistory(page);
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

async function loadReportContent() {
  const container = document.getElementById('reportContent');
  if (!container) {
    return;
  }

  const teacherId = currentUser?.studentId || currentUser?.id || currentUser?.username || currentUser?.name || 'GV001';

  let totalClasses = 0;
  let totalStudents = 0;
  let totalErrorTypes = 0;
  let totalErrorOccurrences = 0;

  try {
    const res = await fetch(`http://103.75.182.246:8080/public/api/reports/summary?idTeacher=${encodeURIComponent(teacherId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.code === 200 && json.data) {
        totalClasses = json.data.totalClasses || 0;
        totalStudents = json.data.totalStudents || 0;
        totalErrorTypes = json.data.totalErrorTypes || 0;
        totalErrorOccurrences = json.data.totalErrorOccurrences || 0;
      }
    }
  } catch (err) {
    console.error('Lỗi khi tải báo cáo tổng quan:', err);
  }

  container.innerHTML = `
    <div class="report-grid">
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-school" style="color:#DC143C"></i></div>
        <div class="report-value">${totalClasses}</div>
        <div class="report-label">Đơn vị</div>
      </div>
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-users" style="color:#FF6B35"></i></div>
        <div class="report-value">${totalStudents}</div>
        <div class="report-label">Tổng sinh viên</div>
      </div>
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-exclamation-triangle" style="color:#e65100"></i></div>
        <div class="report-value">${totalErrorTypes}</div>
        <div class="report-label">Loại lỗi</div>
      </div>
      <div class="report-card">
        <div class="report-icon"><i class="fas fa-user-times" style="color:#c62828"></i></div>
        <div class="report-value">${totalErrorOccurrences}</div>
        <div class="report-label">Lượt mắc lỗi</div>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-line"></i> Điểm trừ theo loại lỗi</div>
        <canvas id="chartDeduction"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-pie"></i> Tỷ lệ mức độ lỗi</div>
        <canvas id="chartSeverity"></canvas>
      </div>
    </div>

    <div class="chart-row">
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-bar"></i> Phân bố lỗi theo lớp</div>
        <canvas id="chartErrorByClass" style="max-height:260px"></canvas>
      </div>
      <div class="chart-container">
        <div class="chart-title"><i class="fas fa-chart-doughnut"></i> Top 5 lỗi phổ biến</div>
        <canvas id="chartTopErrors"></canvas>
      </div>
    </div>
  `;

  await renderCharts();
}

async function renderCharts() {
  const teacherId = currentUser?.studentId || currentUser?.id || currentUser?.username || currentUser?.name || 'GV001';

  const errorData = currentErrorData.filter(e => !e.deleted);
  const errorNames = errorData.map(e => e.name.length > 20 ? e.name.substring(0, 20) + '...' : e.name);
  const errorDeductions = errorData.map(e => e.deduction);
  const highCount = errorData.filter(e => e.severity === 'cao').length;
  const medCount = errorData.filter(e => e.severity === 'trung-binh').length;
  const lowCount = errorData.filter(e => e.severity === 'thap').length;

  let apiErrorsByClass = [];
  let apiTopErrors = [];

  try {
    const [resByClass, resTop] = await Promise.all([
      fetch(`http://103.75.182.246:8080/public/api/reports/errors-by-class?idTeacher=${encodeURIComponent(teacherId)}`),
      fetch(`http://103.75.182.246:8080/public/api/reports/top-errors?idTeacher=${encodeURIComponent(teacherId)}`)
    ]);

    if (resByClass.ok) {
      const json = await resByClass.json();
      if (json.code === 200 && json.data) apiErrorsByClass = json.data;
    }
    if (resTop.ok) {
      const json = await resTop.json();
      if (json.code === 200 && json.data) apiTopErrors = json.data;
    }
  } catch (err) {
    console.error('Lỗi khi tải dữ liệu biểu đồ:', err);
  }

  const chartColors = ['#DC143C', '#FF6B35', '#FFB64D', '#2ecc71', '#3498db', '#9b59b6', '#e67e22'];

  // Chart 1: (Đã bị gỡ bỏ theo yêu cầu)

  // Chart 2: Doughnut - Severity ratio
  const ctx2 = document.getElementById('chartSeverity');
  if (ctx2) {
    const severityLabels = [];
    const severityData = [];
    const severityColors = [];
    if (highCount > 0) { severityLabels.push('Nghiêm trọng'); severityData.push(highCount); severityColors.push('#c62828'); }
    if (medCount > 0)  { severityLabels.push('Trung bình');    severityData.push(medCount);  severityColors.push('#e65100'); }
    if (lowCount > 0)  { severityLabels.push('Thấp');          severityData.push(lowCount);  severityColors.push('#f9a825'); }
    new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: severityLabels,
        datasets: [{
          data: severityData,
          backgroundColor: severityColors,
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

  // Chart 3: Bar - Deduction points per error type
  const ctx3 = document.getElementById('chartDeduction');
  if (ctx3) {
    new Chart(ctx3, {
      type: 'line',
      data: {
        labels: errorNames,
        datasets: [{
          label: 'Điểm trừ',
          data: errorDeductions,
          backgroundColor: 'rgba(75, 83, 32, 0.2)',
          borderColor: '#4B5320',
          borderWidth: 2,
          pointBackgroundColor: errorData.map(e =>
            e.severity === 'cao' ? '#c62828' :
            e.severity === 'trung-binh' ? '#e65100' : '#f9a825'
          ),
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3
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

  // Chart 4: Bar - Errors by class (từ API; fallback: số lượng loại lỗi × số lớp)
  let chart4Labels, chart4Data, chart4DatasetLabel;
  if (apiErrorsByClass.length > 0) {
    chart4Labels = apiErrorsByClass.map(item => item.className || item.classId);
    chart4Data = apiErrorsByClass.map(item => item.totalErrors || 0);
    chart4DatasetLabel = 'Số lượt lỗi';
  } else {
    // Fallback: hiển thị số loại lỗi đang có theo từng lớp đang quản lý
    chart4Labels = currentClasses.map(c => c.className || c.classId || '').filter(Boolean);
    chart4Data = chart4Labels.map(() => errorData.length);
    chart4DatasetLabel = 'Số loại lỗi (chưa có lịch sử)';
  }

  const ctx4 = document.getElementById('chartErrorByClass');
  if (ctx4) {
    // Rút gọn nhãn dài để hiển thị đẹp trên trục
    const shortLabels = (chart4Labels.length ? chart4Labels : ['Chưa có dữ liệu']).map(label => {
      const parts = label.split(/[\-–]/);
      return parts[0].trim().length > 0 ? parts[0].trim() : label;
    });
    new Chart(ctx4, {
      type: 'bar',
      indexAxis: 'y',
      data: {
        labels: shortLabels,
        datasets: [{
          label: chart4DatasetLabel,
          data: chart4Data.length ? chart4Data : [0],
          backgroundColor: ['#DC143C', '#FF6B35', '#3498db', '#9b59b6', '#2ecc71', '#1abc9c', '#e67e22'],
          borderRadius: 6,
          barThickness: 28,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => chart4Labels[items[0].dataIndex] || items[0].label
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { ticks: { font: { size: 12 }, color: '#333' }, grid: { display: false } }
        }
      }
    });
  }

  // Chart 5: Polar Area - Top 5 errors by student count (từ API)
  let chart5Labels = [];
  let chart5Data = [];

  if (apiTopErrors.length > 0) {
    chart5Labels = apiTopErrors.map(e => {
      const name = e.errorName || '';
      return name.length > 18 ? name.substring(0, 18) + '...' : name;
    });
    chart5Data = apiTopErrors.map(e => e.totalOccurrences || 0);
  } else {
    // Fallback: nếu API không có dữ liệu, dùng deduction để xếp hạng
    const sortedErrors = errorData.length > 0
      ? [...errorData].sort((a, b) => b.deduction - a.deduction).slice(0, 5)
      : [];
    chart5Labels = sortedErrors.map(e => e.name.length > 18 ? e.name.substring(0, 18) + '...' : e.name);
    chart5Data = sortedErrors.map(e => e.deduction || 0);
  }

  const ctx5 = document.getElementById('chartTopErrors');
  if (ctx5) {
    new Chart(ctx5, {
      type: 'polarArea',
      data: {
        labels: chart5Labels,
        datasets: [{
          data: chart5Data,
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
  _apiHistoryCache = null;
  historyPage = 0;
  historyTotalPages = 1;
  historyTotalElements = 0;
  AuthService.logout();
}

// ============================================
//  STUDENT VIEW FUNCTIONS
// ============================================

function getStudentSampleData() {
  const studentId = (currentUser.studentId || currentUser.username || currentUser.id || 'SV001').toString();
  const fullName = currentUser.fullName || currentUser.name || currentUser.username || 'Sinh viên';
  const birthday = currentUser.birthday
    ? new Date(currentUser.birthday).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa cập nhật';
  return {
    name: fullName,
    code: studentId,
    gender: currentUser.gender || '',
    idClass: currentUser.idClass || null,
    email: currentUser.email || studentId.toLowerCase() + '@student.hactech.edu.vn',
    phone: 'Chưa cập nhật',
    birthday: birthday,
    department: 'Công nghệ thông tin',
    course: 'K26',
  };
}

function getStudentExamData() {
  const studentId = currentUser.studentId;
  const student = getStudentSampleData();
  const allExamTypes = getExamCatalog();

  // Đọc exams của lớp từ sessionStorage
  const storedExams = getNormalizedClassExamMap();
  const classId = student.idClass || student.classId || currentUser.idClass || currentUser.classId || '1';
  const assignments = storedExams[classId] || [];

  // Đọc điểm từ sessionStorage
  const scores = JSON.parse(sessionStorage.getItem('examScores') || '{}');

  return assignments.map(assignment => {
    const examId = assignment.id;
    const examType = allExamTypes.find(e => e.id === examId) || { id: examId, name: examId, icon: '📝', description: 'Mô tả đang được cập nhật' };
    const practiceKey = classId + '_' + studentId + '_' + examId + '_practice';
    const officialKey = classId + '_' + studentId + '_' + examId + '_official';
    const submittedKey = `examVideos_${classId}_${student.code}_${examId}_submitted`;
    const statusKey = `examVideos_${classId}_${student.code}_${examId}_status`;
    return {
      ...examType,
      classExamId: assignment.classExamId ?? examType.classExamId ?? null,
      submissionDeadline: assignment.submissionDeadline || '',
      gradingDeadline: assignment.gradingDeadline || '',
      practiceScore: scores[practiceKey] !== undefined ? scores[practiceKey] : null,
      officialScore: scores[officialKey] !== undefined ? scores[officialKey] : null,
      isSubmitted: sessionStorage.getItem(submittedKey) === 'true',
      isDraft: !sessionStorage.getItem(submittedKey) && sessionStorage.getItem(statusKey) === 'DRAFT',
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

async function handleProfileAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.');
    event.target.value = '';
    return;
  }

  // Preview ngay lập tức
  const reader = new FileReader();
  reader.onload = e => {
    const display = document.getElementById('profileAvatarDisplay');
    if (display) {
      display.style.background = 'transparent';
      display.style.padding = '0';
      display.innerHTML = `<img src="${e.target.result}" alt="avatar" style="width:110px;height:110px;border-radius:50%;object-fit:cover;display:block">`;
    }
  };
  reader.readAsDataURL(file);

  // Upload lên server
  try {
    const userId = currentUser.studentId || currentUser.id;
    const formData = new FormData();
    formData.append('id', userId);
    formData.append('file', file);

    const res = await fetch('http://103.75.182.246:8080/public/upload-avatar', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!res.ok) throw new Error(`Lỗi ${res.status}`);
    const json = await res.json();
    const imageUrl = json?.data?.imageUrl;
    if (imageUrl) {
      // Gán avatar vào user
      const saveRes = await fetch(`http://103.75.182.246:8080/public/upload/avatar/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: imageUrl,
        credentials: 'include'
      });
      if (!saveRes.ok) throw new Error(`Lỗi lưu avatar (${saveRes.status})`);

      currentUser.avatarImage = imageUrl;
      sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
      // Cập nhật ảnh trên header nếu có
      const headerAvatar = document.getElementById('headerAvatar');
      if (headerAvatar) {
        headerAvatar.src = imageUrl;
        headerAvatar.style.display = 'block';
      }
    }
  } catch (err) {
    console.warn('Upload avatar thất bại:', err);
    alert('Không thể tải ảnh lên. Vui lòng thử lại.');
  }
  event.target.value = '';
}

function loadStudentProfile() {
  const container = document.getElementById('stProfileContent');
  if (!container) return;

  const student = getStudentSampleData();
  const avatarImage = currentUser.avatarImage || '';
  const avatarHtml = avatarImage
    ? `<img src="${avatarImage}" alt="avatar" style="width:110px;height:110px;border-radius:50%;object-fit:cover;display:block">`
    : `<i class="fas fa-user-graduate"></i>`;
  const avatarStyle = avatarImage ? 'background:transparent;padding:0' : '';

  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar" id="profileAvatarDisplay" style="${avatarStyle}">${avatarHtml}</div>
          <button class="profile-avatar-edit-btn" onclick="document.getElementById('profileAvatarInput').click()" title="Đổi ảnh đại diện">
            <i class="fas fa-camera"></i>
          </button>
          <input type="file" id="profileAvatarInput" accept="image/*" style="display:none" onchange="handleProfileAvatarChange(event)">
        </div>
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
        <span class="field-value">${formatGender(student.gender)}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-envelope"></i> Email</span>
        <span class="field-value">${student.email}</span>
      </div>
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-birthday-cake"></i> Ngày sinh</span>
        <span class="field-value">${student.birthday}</span>
      </div>
      ${student.idClass ? `
      <div class="profile-field">
        <span class="field-label"><i class="fas fa-chalkboard"></i> Mã lớp</span>
        <span class="field-value">${student.idClass}</span>
      </div>` : ''}
    </div>
  `;
}

async function fetchStudentSubmissions(studentId) {
  if (!studentId) return {};
  const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.STUDENT_SUBMISSIONS_BY_STUDENT)
    ? API_CONFIG.ENDPOINTS.STUDENT_SUBMISSIONS_BY_STUDENT(studentId)
    : `http://103.75.182.246:8080/student/submission/${encodeURIComponent(studentId)}`;
  try {
    const response = await ApiClient.fetchWithAuth(url);
    if (!response.ok) return {};
    const json = await response.json().catch(() => null);
    const list = Array.isArray(json?.data?.content) ? json.data.content : (Array.isArray(json?.data) ? json.data : (Array.isArray(json?.content) ? json.content : (Array.isArray(json) ? json : [])));
    // Map theo idClassExam để tra nhanh
    const map = {};
    list.forEach(item => { map[String(item.idClassExam)] = item; });
    return map;
  } catch (err) {
    console.warn('fetchStudentSubmissions error', err);
    return {};
  }
}

// Lấy điểm bài thi của sinh viên: GET /student/my-exam/{studentCode}
// Trả về Map: submissionId (string) → entry { practiceScore, officialScore, ... }
async function fetchStudentMyExam(studentCode) {
  if (!studentCode) return {};
  try {
    const url = API_CONFIG.ENDPOINTS.STUDENT_MY_EXAM(studentCode, 0, 500);
    const response = await ApiClient.fetchWithAuth(url);
    if (!response.ok) return {};
    const json = await response.json().catch(() => null);
    const data = json?.data ?? {};
    // Handle both Page<SubmissionGradeDTO> (data.content) and plain array (data)
    const list = Array.isArray(data) ? data : (Array.isArray(data.content) ? data.content : []);
    const map = {};
    list.forEach(entry => { map[String(entry.submissionId)] = entry; });
    return map;
  } catch (err) {
    console.warn('fetchStudentMyExam error', err);
    return {};
  }
}

// Lấy điểm thi có phân trang: GET /student/my-exam/{studentCode}?page=X&size=Y
// Trả về { list, totalPages, totalElements }
async function fetchStudentMyExamPaged(studentCode, page = 0, size = 10) {
  if (!studentCode) return { list: [], totalPages: 0, totalElements: 0 };
  try {
    const url = API_CONFIG.ENDPOINTS.STUDENT_MY_EXAM(studentCode, page, size);
    const response = await ApiClient.fetchWithAuth(url);
    if (!response.ok) return { list: [], totalPages: 0, totalElements: 0 };
    const json = await response.json().catch(() => null);
    const data = json?.data ?? {};
    if (Array.isArray(data)) {
      return { list: data, totalPages: 1, totalElements: data.length };
    }
    return {
      list: Array.isArray(data.content) ? data.content : [],
      totalPages: data.totalPages ?? 1,
      totalElements: data.totalElements ?? 0
    };
  } catch (err) {
    console.warn('fetchStudentMyExamPaged error', err);
    return { list: [], totalPages: 0, totalElements: 0 };
  }
}

async function loadStudentExams() {
  myExamPage = 0;
  await _doLoadStudentExams();
}

async function _doLoadStudentExams() {
  const container = document.getElementById('stExamsContent');
  if (!container) return;

  const student = getStudentSampleData();
  const studentId = currentUser.studentId || currentUser.id || currentUser.username || '';
  const classId = student.idClass || student.classId || currentUser.idClass || currentUser.classId || null;

  myExamStudentId = studentId;

  // Fetch song song:
  // 1. Danh sách bài thi của lớp (có phân trang) — nguồn chính
  // 2. Bài nộp của sinh viên
  // 3. Toàn bộ điểm của sinh viên (size lớn để lấy hết, dùng làm map tra cứu)
  const [serverExamsResult, submissionsMap, myExamScoresMap] = await Promise.all([
    classId ? ExamsService.getExamsByClass(classId, myExamPage, myExamPageSize).catch(err => {
      console.warn('Failed to fetch class exams from server, falling back to local data', err);
      return null;
    }) : Promise.resolve(null),
    fetchStudentSubmissions(studentId),
    fetchStudentMyExam(studentId)   // trả về map submissionId → scoreEntry (size=500)
  ]);

  // Cập nhật trạng thái phân trang theo class exam API
  myExamTotalPages    = serverExamsResult?.totalPages    ?? 1;
  myExamTotalElements = serverExamsResult?.totalElements ?? 0;

  const serverExams = serverExamsResult?.exams ?? serverExamsResult;

  // Luôn lấy dữ liệu local để fallback khi API không có
  const localExams = getStudentExamData();
  const localExamMap = {};
  localExams.forEach(e => { localExamMap[String(e.id)] = e; });

  let exams = [];

  if (classId && Array.isArray(serverExams) && serverExams.length > 0) {
    // Luôn dùng danh sách bài thi lớp làm nguồn chính (bao gồm cả bài chưa nộp)
    exams = serverExams.map(examType => {
      const examId      = String(examType.id || examType.name || '');
      const classExamId = String(examType.classExamId ?? '');
      const submission  = submissionsMap[classExamId] || null;
      const submissionId = submission?.id ?? submission?.submissionId ?? null;
      const localExam   = localExamMap[examId] || null;

      // Tra điểm từ map my-exam (chỉ có nếu sinh viên đã nộp và đã chấm)
      const scoreEntry  = submissionId != null ? (myExamScoresMap[String(submissionId)] || null) : null;

      const isSubmitted = submission?.status === 'SUBMITTED' || localExam?.isSubmitted || false;
      const isDraft     = !isSubmitted && (submission?.status === 'DRAFT' || localExam?.isDraft || false);

      return {
        ...examType,
        id: examId,
        classExamId: examType.classExamId ?? null,
        submissionId: submissionId,
        practiceScore:  scoreEntry?.practiceScore  ?? localExam?.practiceScore  ?? null,
        practiceStatus: scoreEntry?.practiceStatus ?? null,
        officialScore:  scoreEntry?.officialScore  ?? localExam?.officialScore  ?? null,
        officialStatus: scoreEntry?.officialStatus ?? null,
        isSubmitted,
        isDraft,
        isSubmissionClosed: isDeadlinePassed(examType.submissionDeadline),
        isGradingClosed:    isDeadlinePassed(examType.gradingDeadline)
      };
    });
  } else {
    exams = localExams;
    myExamTotalPages    = 1;
    myExamTotalElements = localExams.length;
  }

  if (!exams || exams.length === 0) {
    container.innerHTML = `
      <div class="st-exam-empty">
        <div class="st-empty-icon">📋</div>
        <h2>Chưa có bài thi nào</h2>
        <p>Bạn chưa được gán bài thi nào. Vui lòng liên hệ giảng viên.</p>
      </div>
    `;
    _renderMyExamPagination();
    return;
  }

  // Chia thành 3 nhóm
  const doneExams    = exams.filter(e => e.practiceScore !== null || e.officialScore !== null || e.isSubmitted);
  const expiredExams = exams.filter(e => e.practiceScore === null && e.officialScore === null && !e.isSubmitted && e.isSubmissionClosed);
  const pendingExams = exams.filter(e => e.practiceScore === null && e.officialScore === null && !e.isSubmitted && !e.isSubmissionClosed);

  const officialExams = exams.filter(e => e.officialScore !== null);
  const avgScore = officialExams.length > 0
    ? (officialExams.reduce((sum, e) => sum + e.officialScore, 0) / officialExams.length).toFixed(1)
    : '—';
  const totalDisplay = myExamTotalElements > 0 ? myExamTotalElements : exams.length;

  function buildExamCard(exam) {
    const hasAnyScore = exam.practiceScore !== null || exam.officialScore !== null;
    const deadlineBadge = exam.isSubmitted
      ? ''
      : (exam.isSubmissionClosed
          ? '<span class="st-exam-deadline-badge closed">Hết hạn nộp</span>'
          : (exam.submissionDeadline
              ? '<span class="st-exam-deadline-badge open">Còn hạn nộp</span>'
              : '<span class="st-exam-deadline-badge none">Chưa đặt hạn</span>'));
    return `
      <div class="st-exam-card" onclick="openExamDetail('${exam.id}')" style="cursor:pointer">
        <div class="st-exam-icon ${exam.officialScore !== null ? 'official' : (exam.practiceScore !== null ? 'practice' : 'no-score')}">
          ${exam.icon || '📄'}
        </div>
        <div class="st-exam-info">
          <div class="st-exam-name-row">
            <div class="st-exam-name">${exam.name || exam.id}</div>
            ${exam.isSubmitted ? '<span class="st-exam-submitted-badge">Đã nộp bài</span>' : ''}
            ${exam.isDraft ? '<span class="st-exam-draft-badge">Đang soạn thảo</span>' : ''}
            ${deadlineBadge}
          </div>
          <div class="st-exam-meta">${exam.description || ''}</div>
          <div class="st-exam-deadlines">
            <span><i class="fas fa-hourglass-end"></i> Hạn nộp: ${formatDeadline(exam.submissionDeadline)}</span>
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
      </div>`;
  }

  container.innerHTML = `
    <div class="st-exam-summary">
      <div class="st-summary-card">
        <div class="st-summary-icon">📝</div>
        <div class="st-summary-value">${totalDisplay}</div>
        <div class="st-summary-label">Tổng bài thi</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">✅</div>
        <div class="st-summary-value">${doneExams.length}</div>
        <div class="st-summary-label">Đã có kết quả</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">⏳</div>
        <div class="st-summary-value">${pendingExams.length}</div>
        <div class="st-summary-label">Chưa nộp</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">🚫</div>
        <div class="st-summary-value">${expiredExams.length}</div>
        <div class="st-summary-label">Đã hết hạn</div>
      </div>
      <div class="st-summary-card">
        <div class="st-summary-icon">🏅</div>
        <div class="st-summary-value">${avgScore}</div>
        <div class="st-summary-label">Điểm TB chính thức</div>
      </div>
    </div>

    <div class="st-exam-tabs">
      <button class="st-exam-tab-btn active" id="stTabPending" onclick="switchStExamTab('pending')">
        <i class="fas fa-hourglass-half"></i>
        Chưa nộp / Chưa có kết quả
        <span class="st-tab-count">${pendingExams.length}</span>
      </button>
      <button class="st-exam-tab-btn" id="stTabDone" onclick="switchStExamTab('done')">
        <i class="fas fa-check-circle"></i>
        Đã có kết quả
        <span class="st-tab-count">${doneExams.length}</span>
      </button>
      <button class="st-exam-tab-btn" id="stTabExpired" onclick="switchStExamTab('expired')">
        <i class="fas fa-ban"></i>
        Đã hết hạn nộp
        <span class="st-tab-count">${expiredExams.length}</span>
      </button>
    </div>

    <div class="st-exam-tab-panel" id="stPanelPending">
      ${pendingExams.length === 0
        ? `<div class="st-exam-empty"><div class="st-empty-icon">🎉</div><h3>Không có bài thi nào chưa nộp</h3><p>Bạn đã nộp tất cả bài thi trong trang này.</p></div>`
        : `<div class="st-exam-list">${pendingExams.map(buildExamCard).join('')}</div>`}
    </div>

    <div class="st-exam-tab-panel" id="stPanelDone" style="display:none">
      ${doneExams.length === 0
        ? `<div class="st-exam-empty"><div class="st-empty-icon">📋</div><h3>Chưa có bài thi nào có kết quả</h3><p>Các bài thi sau khi nộp và chấm điểm sẽ xuất hiện ở đây.</p></div>`
        : `<div class="st-exam-list">${doneExams.map(buildExamCard).join('')}</div>`}
    </div>

    <div class="st-exam-tab-panel" id="stPanelExpired" style="display:none">
      ${expiredExams.length === 0
        ? `<div class="st-exam-empty"><div class="st-empty-icon">✅</div><h3>Không có bài thi nào hết hạn</h3><p>Tất cả bài thi đều trong hạn hoặc đã được nộp.</p></div>`
        : `<div class="st-exam-list">${expiredExams.map(buildExamCard).join('')}</div>`}
    </div>
  `;

  _renderMyExamPagination();
}

function switchStExamTab(tab) {
  const pendingBtn   = document.getElementById('stTabPending');
  const doneBtn      = document.getElementById('stTabDone');
  const expiredBtn   = document.getElementById('stTabExpired');
  const pendingPanel = document.getElementById('stPanelPending');
  const donePanel    = document.getElementById('stPanelDone');
  const expiredPanel = document.getElementById('stPanelExpired');
  if (!pendingBtn || !doneBtn || !pendingPanel || !donePanel) return;

  [pendingBtn, doneBtn, expiredBtn].forEach(b => b && b.classList.remove('active'));
  [pendingPanel, donePanel, expiredPanel].forEach(p => p && (p.style.display = 'none'));

  if (tab === 'pending') {
    pendingBtn.classList.add('active');
    pendingPanel.style.display = '';
  } else if (tab === 'done') {
    doneBtn.classList.add('active');
    donePanel.style.display = '';
  } else if (tab === 'expired' && expiredBtn && expiredPanel) {
    expiredBtn.classList.add('active');
    expiredPanel.style.display = '';
  }
}

function _renderMyExamPagination() {
  const container = document.getElementById('stExamPagination');
  if (!container) return;

  if (myExamTotalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const isFirstPage = myExamPage === 0;
  const isLastPage  = myExamPage + 1 >= myExamTotalPages;
  const start = myExamPage * myExamPageSize + 1;
  const end   = Math.min(start + myExamPageSize - 1, myExamTotalElements);

  let btns = '';
  btns += `<button class="home-page-btn" onclick="loadMyExamPage(${myExamPage - 1})" ${isFirstPage ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

  const winSize = 2;
  for (let i = 0; i < myExamTotalPages; i++) {
    const show     = i === 0 || i === myExamTotalPages - 1 || (i >= myExamPage - winSize && i <= myExamPage + winSize);
    const ellipsis = i === myExamPage - winSize - 1 || i === myExamPage + winSize + 1;
    if (show) {
      btns += `<button class="home-page-btn${i === myExamPage ? ' active' : ''}" onclick="loadMyExamPage(${i})">${i + 1}</button>`;
    } else if (ellipsis) {
      btns += `<span class="home-page-ellipsis">…</span>`;
    }
  }

  btns += `<button class="home-page-btn" onclick="loadMyExamPage(${myExamPage + 1})" ${isLastPage ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

  const infoText = myExamTotalElements > 0
    ? `Hiển thị ${start}–${end} trong tổng số ${myExamTotalElements} bài thi`
    : `Trang ${myExamPage + 1} / ${myExamTotalPages}`;

  container.innerHTML = `
    <div class="home-pagination">
      <span class="home-page-info">${infoText}</span>
      <div class="home-page-controls">${btns}</div>
    </div>`;
}

async function loadMyExamPage(page) {
  if (page < 0 || page >= myExamTotalPages) return;
  myExamPage = page;
  await _doLoadStudentExams();
  document.getElementById('st-exams-tab')?.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openExamDetail(examId) {
  const exams = getStudentExamData();
  let exam = exams.find(e => String(e.id) === String(examId));
  const student = getStudentSampleData();
  const studentId = currentUser.studentId || currentUser.id || currentUser.username || '';
  const classId = student.idClass || student.classId || currentUser.idClass || currentUser.classId || null;

  // Fetch song song: classExamId và điểm sinh viên
  const [serverExams, submissionsMap, myExamScores] = await Promise.all([
    (classId && (!exam || exam.classExamId == null))
      ? ExamsService.getExamsByClass(classId).catch(() => null)
      : Promise.resolve(null),
    fetchStudentSubmissions(studentId),
    fetchStudentMyExam(studentId)
  ]);

  const serverExamsList = serverExams?.exams ?? serverExams;
  if (serverExamsList && Array.isArray(serverExamsList)) {
    const serverExam = serverExamsList.find(e => String(e.id) === String(examId));
    if (serverExam) {
      exam = exam ? { ...exam, classExamId: serverExam.classExamId } : serverExam;
    }
  }

  if (!exam) {
    console.warn('openExamDetail: exam not found', examId);
    return;
  }

  // Gắn điểm từ API /student/my-exam nếu có
  const classExamId = String(exam.classExamId ?? '');
  const submission = submissionsMap[classExamId] || null;
  const submissionId = submission?.id ?? submission?.submissionId ?? exam.submissionId ?? null;
  const scoreEntry = submissionId != null ? (myExamScores[String(submissionId)] || null) : null;

  const detailData = {
    ...(scoreEntry || {}),   // spread toàn bộ fields từ STUDENT_MY_EXAM (bao gồm cả session IDs nếu có)
    ...exam,
    submissionId: submissionId,
    practiceScore: scoreEntry?.practiceScore ?? exam.practiceScore ?? null,
    practiceStatus: scoreEntry?.practiceStatus ?? null,
    officialScore: scoreEntry?.officialScore ?? exam.officialScore ?? null,
    officialStatus: scoreEntry?.officialStatus ?? null,
    studentCode: student.code,
    studentName: student.name,
    className: student.className || '',
    classId: classId,
  };

  sessionStorage.setItem('selectedExamDetail', JSON.stringify(detailData));
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

  isStudentView = getCurrentRoleFromStorage(currentUser) === 'student';

  const userName = getCurrentUserDisplayName(currentUser);
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

    // Chuyển tab tự động nếu quay lại từ trang khác (ví dụ: exam-detail → st-exams)
    const pendingTab = sessionStorage.getItem('homeActiveTab');
    if (pendingTab) {
      sessionStorage.removeItem('homeActiveTab');
      setTimeout(() => switchTab(pendingTab), 0);
    }
  } else {
    // Teacher view (default)
    currentClasses = getTeacherClasses();
    getExamCatalog();
    populateExamCatalogTagFilter();
    loadProfileContent();
    renderClasses(currentClasses);
    loadExamsContent();
    loadErrorsContent();
    loadGradingHistoryContent();
    loadReportContent();

    // Chuyển tab tự động nếu có yêu cầu từ breadcrumb/link khác
    const autoTab = localStorage.getItem('autoTab');
    if (autoTab) {
      localStorage.removeItem('autoTab');
      switchTab(autoTab);
    }

    // Tải danh sách bài thi từ API theo mã giáo viên (có phân trang)
    const teacherIdForApi = currentUser.studentId || currentUser.id || currentUser.username;
    if (teacherIdForApi && typeof ExamsService !== 'undefined') {
      examTeacherId = teacherIdForApi;
      loadExamPageFromAPI(0);
    }

    // Tải danh sách lớp từ API theo mã giáo viên (có phân trang)
    if (teacherIdForApi && typeof ClassesService !== 'undefined') {
      classTeacherId = teacherIdForApi;
      loadClassPage(0);
    }
  }

  attachEvents();
}

function openImageViewer(url) {
  let viewer = document.getElementById('imageViewerModal');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'imageViewerModal';
    viewer.style.display = 'none';
    viewer.style.position = 'fixed';
    viewer.style.zIndex = '9999';
    viewer.style.top = '0';
    viewer.style.left = '0';
    viewer.style.width = '100vw';
    viewer.style.height = '100vh';
    viewer.style.backgroundColor = 'rgba(0,0,0,0.85)';
    viewer.style.justifyContent = 'center';
    viewer.style.alignItems = 'center';
    viewer.style.backdropFilter = 'blur(5px)';
    
    viewer.innerHTML = `
      <span style="position:absolute; top:20px; right:30px; color:#fff; font-size:40px; font-weight:bold; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='#f00'" onmouseout="this.style.color='#fff'" onclick="closeImageViewer()">&times;</span>
      <img id="imageViewerImg" src="" style="max-width:90%; max-height:90%; border-radius:8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); object-fit: contain;">
    `;
    
    // Close on click outside
    viewer.addEventListener('click', function(e) {
      if (e.target === viewer) {
        closeImageViewer();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && viewer.style.display === 'flex') {
        closeImageViewer();
      }
    });
    
    document.body.appendChild(viewer);
  }
  
  document.getElementById('imageViewerImg').src = url;
  viewer.style.display = 'flex';
}

function closeImageViewer() {
  const viewer = document.getElementById('imageViewerModal');
  if (viewer) {
    viewer.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', initializePage);
