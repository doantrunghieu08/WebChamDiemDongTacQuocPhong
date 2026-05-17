// ===== CLASS DETAIL PAGE LOGIC =====

function avatarColor(name) {
  const colors = ['#DC143C','#FF6B35','#4a90d9','#5a67d8','#38a169','#d69e2e','#805ad5','#dd6b20'];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="60%" height="60%"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;

function avatarInitial(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1][0].toUpperCase();
}

let classData = null;
let studentsData = [];
let serverClassExams = null; // bài thi từ API, null = chưa tải
let classBoardAvatarBySubmission = {}; // { submissionId: avatarImage } — link đáng tin cậy giữa grade board và studentsData
let classBoardStudentList = []; // danh sách sinh viên trích từ grade board (fallback khi fetchClassStudentsFromServer thất bại)
let classExamTotalPages = 1;  // tổng số trang exam từ server
let classExamSize = 3;        // số bài thi mỗi trang (= CARDS_PER_PAGE)
const classExamLoadedPages = new Set(); // các trang đã tải
let submissionsMap = {}; // { classExamId: { studentId: submissionRecord } }
let gradingSessionStatusMap = {}; // { submissionId: 'FINALIZED'|'IN_PROGRESS'|null }
let selectedExam = null;
let selectedStudent = null;
let selectedSubmissionId = null;
let pendingDeleteExamId = null;
let pendingRestoreExamId = null;
let deletedClassExams = [];
let classDetailToastTimer = null;
let classBoardCache = null; // null = chưa fetch, {} = đã fetch (Map: studentCode → gradeEntry[]);

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

function formatGender(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim().toLowerCase();
  if (!s) return '';
  if (s === 'male' || s === 'm' || s === 'nam') return 'Nam';
  if (s === 'female' || s === 'f' || s === 'nu' || s === 'nữ') return 'Nữ';
  if (s === 'other' || s === 'khác' || s === 'khac') return 'Khác';
  return value;
}

// ===== STUDENT DATA (sessionStorage) =====
function getClassStudents(classId) {
  const all = JSON.parse(sessionStorage.getItem('classStudents') || '{}');
  return all[classId] || [];
}

function saveClassStudents(classId, students) {
  const all = JSON.parse(sessionStorage.getItem('classStudents') || '{}');
  all[classId] = students;
  sessionStorage.setItem('classStudents', JSON.stringify(all));

  // Cập nhật số lượng sinh viên trong selectedClass
  if (classData) {
    classData.studentCount = students.length;
    sessionStorage.setItem('selectedClass', JSON.stringify(classData));
  }

  // Cập nhật trong danh sách lớp của giảng viên
  const user = JSON.parse(sessionStorage.getItem('currentUser'));
  if (user) {
    const key = `classes_${user.studentId || user.username}`;
    const classes = JSON.parse(sessionStorage.getItem(key) || '[]');
    const cls = classes.find(c => c.classId === classId);
    if (cls) {
      cls.studentCount = students.length;
      sessionStorage.setItem(key, JSON.stringify(classes));
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
  const existing = JSON.parse(sessionStorage.getItem('classStudents') || '{}');
  let changed = false;
  for (const [id, students] of Object.entries(sampleData)) {
    if (!existing[id]) {
      existing[id] = students;
      changed = true;
    }
  }
  if (changed) sessionStorage.setItem('classStudents', JSON.stringify(existing));
}

// All available exam types
function getAllExamTypes() {
  const stored = JSON.parse(sessionStorage.getItem('examCatalog') || 'null');
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .filter(exam => !exam.deleted)
    .map((exam, index) => ({
      id: exam.id || `exam-${Date.now()}-${index}`,
      name: exam.name || 'Bài thi mới',
      icon: '📝',
      iconClass: 'custom-exam',
      description: exam.description || 'Mô tả đang được cập nhật',
      videos: Array.isArray(exam.videos) ? exam.videos : []
    }));
}

// Lấy danh sách bài thi của lớp (ưu tiên dữ liệu từ server)
function getClassExams() {
  if (Array.isArray(serverClassExams)) {
    return serverClassExams;
  }
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

// Tải bài thi của lớp từ server (có hỗ trợ phân trang)
async function fetchClassExamsFromAPI(classId, page = 0) {
  if (!classId || typeof ExamsService?.getExamsByClass !== 'function') return;
  try {
    const result = await ExamsService.getExamsByClass(classId, page, classExamSize);

    if (!Array.isArray(serverClassExams)) serverClassExams = [];


    // Gộp bài thi mới vào, tránh trùng lặp theo classExamId
    const existingIds = new Set(serverClassExams.map(e => String(e.classExamId ?? e.id)));
    result.exams.forEach(exam => {
      const key = String(exam.classExamId ?? exam.id);
      if (!existingIds.has(key)) {
        serverClassExams.push(exam);
        existingIds.add(key);
      }
    });

    classExamTotalPages = result.totalPages;

    if (result.allLoaded) {
      // Backend trả về toàn bộ, đánh dấu tất cả trang đã tải
      for (let i = 0; i < classExamTotalPages; i++) classExamLoadedPages.add(i);
    } else {
      classExamLoadedPages.add(page);
    }
  } catch (err) {
    console.warn('fetchClassExamsFromAPI lỗi, dùng dữ liệu local:', err);
    serverClassExams = serverClassExams ?? null;
  }
}

// Tải TẤT CẢ trang bài thi (dùng khi cần dữ liệu đầy đủ: modal, sau xóa/khôi phục/thêm)
async function fetchAllClassExamsPages(classId) {
  serverClassExams = [];
  classExamLoadedPages.clear();
  // Trang 0 trước để lấy totalPages
  await fetchClassExamsFromAPI(classId, 0);
  if (classExamTotalPages > 1) {
    const remaining = [];
    for (let p = 1; p < classExamTotalPages; p++) {
      if (!classExamLoadedPages.has(p)) remaining.push(p);
    }
    if (remaining.length > 0) {
      await Promise.all(remaining.map(p => fetchClassExamsFromAPI(classId, p)));
    }
  }
}

// Tải danh sách bài nộp của sinh viên theo từng classExam
async function fetchSubmissionsForAllExams() {
  const exams = getClassExams();
  if (!exams.length) return;

  await Promise.allSettled(exams.map(async exam => {
    const classExamId = exam.classExamId ?? exam.id;
    if (!classExamId) return;
    try {
      const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.TEACHER_CLASS_SUBMISSIONS)
        ? API_CONFIG.ENDPOINTS.TEACHER_CLASS_SUBMISSIONS(classExamId)
        : `http://103.75.182.246:8080/teacher/class/${encodeURIComponent(classExamId)}/submissions`;

      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return;
      const json = await response.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];

      submissionsMap[String(classExamId)] = {};
      list.forEach(item => {
        const sid = item.idStudent ?? item.studentId;
        if (sid != null) submissionsMap[String(classExamId)][String(sid)] = item;
      });
    } catch (err) {
      console.warn(`fetchSubmissions error for classExam ${classExamId}:`, err);
    }
  }));
}

// Tải trạng thái phiên chấm cho tất cả bài nộp đã biết
async function fetchGradingSessionStatuses() {
  const submissionIds = new Set();
  Object.values(submissionsMap).forEach(map => {
    Object.values(map).forEach(item => {
      const sid = item.id ?? item.submissionId ?? item.idSubmission;
      if (sid != null) submissionIds.add(String(sid));
    });
  });

  if (submissionIds.size === 0) return;

  await Promise.allSettled([...submissionIds].map(async submissionId => {
    try {
      const session = await ExamsService.getGradingSessionBySubmission(submissionId);
      // Lấy status từ mảng hoặc object đơn (backend có thể trả mảng nhiều session)
      let status = null;
      if (Array.isArray(session)) {
        // Ưu tiên OFFICIAL FINALIZED, sau đó bất kỳ FINALIZED nào
        const finalized = session.find(s => s.status === 'FINALIZED' && s.gradingMode === 'OFFICIAL')
          || session.find(s => s.status === 'FINALIZED');
        status = finalized ? 'FINALIZED' : (session[0]?.status ?? null);
      } else if (session) {
        status = session.status ?? null;
      }
      gradingSessionStatusMap[submissionId] = status;
    } catch (_) {
      // bỏ qua lỗi từng submission
    }
  }));
}

function isGradingSessionFinalized(submissionId) {
  if (submissionId == null) return false;
  return gradingSessionStatusMap[String(submissionId)] === 'FINALIZED';
}

function getSubmission(classExamId, studentCode) {
  const map = submissionsMap[String(classExamId)];
  if (!map) return null;
  // Thử lookup trực tiếp theo key (student code hoặc numeric ID)
  if (map[String(studentCode)]) return map[String(studentCode)];
  // Fallback: tìm trong values theo các trường studentCode/idStudent
  return Object.values(map).find(item =>
    String(item.studentCode ?? item.idStudent ?? item.studentId ?? '') === String(studentCode)
  ) || null;
}

// Lưu bài thi cho lớp
function saveClassExams(examAssignments) {
  const all = getStoredClassExamAssignments();
  all[classData.classId] = examAssignments.map(normalizeClassExamAssignment);
  sessionStorage.setItem('classExams', JSON.stringify(all));
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
  if (changed) sessionStorage.setItem('classExams', JSON.stringify(existing));
}

// ===== INIT =====
async function fetchClassStudentsFromServer(classId) {
  if (!classId) return null;
  const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
  const baseHost = (adminBase.split('/admin')[0]) || (API_CONFIG?.BASE_URL?.split('/public')[0]) || `${location.protocol}//${location.host}`;
  const headers = { Accept: 'application/json' };

  const _fetchPage = async (page, size) => {
    const url = `${baseHost}/classes/api/${encodeURIComponent(classId)}?page=${page}&size=${size}`;
    let res = await fetch(url, { headers, credentials: 'include' });
    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) res = await fetch(url, { headers, credentials: 'include' });
    }
    if (!res.ok) return null;
    return res.json().catch(() => null);
  };

  try {
    const PAGE_SIZE = 30;
    const firstJson = await _fetchPage(0, PAGE_SIZE);
    if (!firstJson) return null;

    // Kiểm tra dạng phân trang Spring Page<>
    const pageData = firstJson?.data;
    if (pageData && Array.isArray(pageData.content) && pageData.totalPages != null) {
      let allContent = [...pageData.content];
      const totalPages = pageData.totalPages;
      if (totalPages > 1) {
        const remaining = [];
        for (let p = 1; p < totalPages; p++) remaining.push(_fetchPage(p, PAGE_SIZE));
        const results = await Promise.all(remaining);
        for (const json of results) {
          const content = json?.data?.content ?? json?.content ?? [];
          allContent = allContent.concat(content);
        }
      }
      const students = allContent.map(s => ({
        code: s.studentCode || s.id || s.code || s.studentId,
        name: s.studentName || s.fullName || s.name || '',
        birthday: s.birthday ? s.birthday.split('T')[0] : (s.dob ? s.dob.split('T')[0] : ''),
        gender: s.gender || s.sex || '',
        avatarImage: s.avatarImage || s.exams?.find(e => e.avatarImage)?.avatarImage || ''
      }));
      saveClassStudents(classId, students);
      return students;
    }

    // Fallback: mảng thẳng không phân trang
    const list = Array.isArray(pageData?.content) ? pageData.content
               : Array.isArray(pageData) ? pageData
               : Array.isArray(firstJson?.content) ? firstJson.content
               : Array.isArray(firstJson) ? firstJson
               : null;
    if (!list) return null;
    const students = list.map(s => ({
      code: s.studentCode || s.id || s.code || s.studentId,
      name: s.studentName || s.fullName || s.name || '',
      birthday: s.birthday ? s.birthday.split('T')[0] : (s.dob ? s.dob.split('T')[0] : ''),
      gender: s.gender || s.sex || '',
      avatarImage: s.avatarImage || s.exams?.find(e => e.avatarImage)?.avatarImage || ''
    }));
    saveClassStudents(classId, students);
    return students;
  } catch (err) {
    console.error('fetchClassStudentsFromServer error', err);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  const user = JSON.parse(sessionStorage.getItem('currentUser'));
  if (!user) {
    window.location.href = '/index.html';
    return;
  }
  document.getElementById('cdUserName').textContent = user.studentId || user.name || 'Giảng viên';

  classData = JSON.parse(sessionStorage.getItem('selectedClass'));
  if (!classData) {
    window.location.href = '/pages/home.html';
    return;
  }

  // Tải song song: sinh viên, bài thi và bảng điểm từ server
  await Promise.allSettled([
    fetchClassStudentsFromServer(classData.classId),
    fetchClassExamsFromAPI(classData.classId),
    fetchClassGradeBoard(classData.classId),
  ]);

  // Tải danh sách bài nộp sau khi đã có exams
  await fetchSubmissionsForAllExams();

  // Tải trạng thái phiên chấm (FINALIZED / IN_PROGRESS) cho từng bài nộp
  await fetchGradingSessionStatuses();

  studentsData = getClassStudents(classData.classId);

  // Nếu fetchClassStudentsFromServer thất bại (endpoint chưa có hoặc trả lỗi),
  // fallback dùng danh sách sinh viên trích từ grade board
  if (studentsData.length === 0 && classBoardStudentList.length > 0) {
    studentsData = classBoardStudentList;
    saveClassStudents(classData.classId, studentsData);
  }

  // Nếu vẫn rỗng, thử build từ submissionsMap
  if (studentsData.length === 0 && Object.keys(submissionsMap).length > 0) {
    const seen = new Set();
    for (const examMap of Object.values(submissionsMap)) {
      for (const item of Object.values(examMap)) {
        const code = String(item.studentCode ?? item.idStudent ?? item.studentId ?? '');
        if (code && !seen.has(code)) {
          seen.add(code);
          studentsData.push({
            code,
            name: item.studentName || item.fullName || '',
            birthday: '',
            gender: '',
            avatarImage: item.avatarImage || ''
          });
        }
      }
    }
    if (studentsData.length > 0) saveClassStudents(classData.classId, studentsData);
  }

  // Enrich avatarImage từ grade board: tìm theo submissionId (khóa chắc chắn, vì
  // grade board dùng login username ("cuongdv") nhưng studentsData dùng mã quân sự ("SV006", "233730"))
  if (Object.keys(classBoardAvatarBySubmission).length > 0) {
    studentsData.forEach(s => {
      if (s.avatarImage) return;
      // Duyệt tất cả classExam, tìm submission của sinh viên này
      for (const examMap of Object.values(submissionsMap)) {
        const sub = examMap[String(s.code)]
          || Object.values(examMap).find(item =>
              String(item.idStudent ?? item.studentId ?? item.studentCode ?? '') === String(s.code)
            );
        if (!sub) continue;
        const subId = String(sub.id ?? sub.submissionId ?? sub.idSubmission ?? '');
        if (subId && classBoardAvatarBySubmission[subId]) {
          s.avatarImage = classBoardAvatarBySubmission[subId];
          break;
        }
      }
    });
  }

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

// ===== GRADE BOARD (điểm bảng toàn lớp) =====
async function fetchClassGradeBoard(classId) {
  if (!classId) return;
  try {
    const url = API_CONFIG.ENDPOINTS.CLASS_GRADE_BOARD(classId);
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) { classBoardCache = {}; return; }
    const json = await response.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];
    classBoardCache = {};
    classBoardAvatarBySubmission = {};
    classBoardStudentList = [];
    list.forEach(entry => {
      const exams = Array.isArray(entry.exams) ? entry.exams : [];
      // Index grade entries bằng cả studentCode (login: "cuongdv") lẫn studentId
      if (entry.studentCode) classBoardCache[entry.studentCode] = exams;
      if (entry.studentId != null) classBoardCache[String(entry.studentId)] = exams;
      // Thu thập thông tin sinh viên để dùng làm fallback cho studentsData
      if (entry.studentCode || entry.studentName) {
        const avatarFromExam = exams.find(e => e.avatarImage)?.avatarImage || '';
        classBoardStudentList.push({
          code: entry.studentCode || '',
          name: entry.studentName || '',
          birthday: '',
          gender: '',
          avatarImage: entry.avatarImage || avatarFromExam
        });
      }
      // avatarImage nằm trong từng exam entry — index theo submissionId (khóa đáng tin cậy)
      exams.forEach(e => {
        if (e.submissionId != null && e.avatarImage) {
          classBoardAvatarBySubmission[String(e.submissionId)] = e.avatarImage;
        }
      });
    });
  } catch (err) {
    console.warn('fetchClassGradeBoard error:', err);
    classBoardCache = {};
  }
}

function getGradeBoardEntry(studentCode, submissionId, examIndex) {
  if (!classBoardCache) return null;

  // Chiến lược 1: khớp trực tiếp theo studentCode (nếu key trùng)
  const entriesByCode = classBoardCache[studentCode] || [];
  if (entriesByCode.length > 0) {
    if (submissionId != null) {
      const byId = entriesByCode.find(e => String(e.submissionId) === String(submissionId));
      if (byId) return byId;
    }
    if (examIndex != null && entriesByCode[examIndex] != null) {
      return entriesByCode[examIndex];
    }
  }

  // Chiến lược 2: tìm theo submissionId xuyên toàn bộ bảng điểm
  // (xử lý trường hợp studentCode truy cập không khớp: mã quân sự vs tên đăng nhập)
  if (submissionId != null) {
    for (const entries of Object.values(classBoardCache)) {
      const found = entries.find(e => String(e.submissionId) === String(submissionId));
      if (found) return found;
    }
  }

  return null;
}

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

// Xây dựng HTML panel bài thi cho một sinh viên (dùng grade board data nếu có)
function buildExamPanelHTML(s) {
  const exams = getClassExams();
  const savedScores = JSON.parse(sessionStorage.getItem('examScores') || '{}');

  if (exams.length === 0) {
    return `<div class="cd-exam-empty"><p>Lớp chưa có bài thi nào</p></div>`;
  }

  const CARDS_PER_PAGE = 3;
  const examCards = exams.map((exam, examIndex) => {
    const classExamId = exam.classExamId ?? exam.id;
    const submission = getSubmission(classExamId, s.code);
    const submissionId = submission?.id ?? submission?.submissionId ?? submission?.idSubmission ?? null;

    // Ưu tiên dữ liệu từ grade board API, fallback sang sessionStorage
    const boardEntry = getGradeBoardEntry(s.code, submissionId, examIndex);

    let practiceScore, officialScore, hasPractice, hasOfficial;
    if (boardEntry) {
      practiceScore = boardEntry.practiceScore;
      officialScore = boardEntry.officialScore;
      hasPractice = practiceScore != null;
      hasOfficial = officialScore != null;
    } else {
      const practiceKey = `${classData.classId}_${s.code}_${exam.id}_practice`;
      const officialKey = `${classData.classId}_${s.code}_${exam.id}_official`;
      practiceScore = savedScores[practiceKey];
      officialScore = savedScores[officialKey];
      hasPractice = practiceScore !== undefined;
      hasOfficial = officialScore !== undefined;
    }
    const hasAnyScore = hasPractice || hasOfficial;

    // Trạng thái nộp bài
    let submissionStatusHTML;
    if (boardEntry && boardEntry.lastUpdated) {
      const timeStr = new Date(boardEntry.lastUpdated).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      submissionStatusHTML = `<div class="cd-submission-status cd-submission-submitted"><i class="fas fa-check-circle"></i> Đã nộp bài<span class="cd-submitted-time">${timeStr}</span></div>`;
    } else if (submission) {
      submissionStatusHTML = `<div class="cd-submission-status cd-submission-${submission.status.toLowerCase()}">
          ${submission.status === 'SUBMITTED' ? `<i class="fas fa-check-circle"></i> Đã nộp bài` : `<i class="fas fa-save"></i> ${submission.status}`}
          ${submission.submittedAt ? `<span class="cd-submitted-time">${new Date(submission.submittedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
         </div>`;
    } else {
      submissionStatusHTML = `<div class="cd-submission-status cd-submission-none"><i class="fas fa-clock"></i> Chưa nộp bài</div>`;
    }

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

    const gradingLocked = isDeadlinePassed(exam.gradingDeadline);

    // Khi phiên chấm chính thức đã được chốt (FINALIZED): ẩn hoàn toàn card
    if (isGradingSessionFinalized(submissionId)) {
      return '';
    }

    // Khi hết hạn chấm: ẩn card đầy đủ, chỉ hiện trạng thái hết hạn
    if (gradingLocked) {
      return `
        <div class="cd-exam-card cd-exam-card-expired">
          <div class="cd-exam-top">
            <div class="cd-exam-icon ${exam.iconClass}">${exam.icon}</div>
            <div>
              <div class="cd-exam-title">${exam.name}</div>
              <div class="cd-exam-sub">${exam.description}</div>
            </div>
          </div>
          <div class="cd-exam-expired-badge"><i class="fas fa-clock"></i> Đã hết hạn chấm · ${formatDeadline(exam.gradingDeadline)}</div>
        </div>
      `;
    }

    const cardClass = hasOfficial ? 'cd-exam-graded cd-exam-official' : (hasPractice ? 'cd-exam-graded cd-exam-practiced' : '');

    const btnHTML = hasAnyScore
      ? `<div class="cd-exam-btn cd-btn-regrading"><i class="fas fa-redo"></i> Chấm lại</div>`
      : `<div class="cd-exam-btn"><i class="fas fa-pen"></i> Chấm bài</div>`;

    const deadlineHTML = `
      <div class="cd-exam-deadlines">
        <div class="cd-exam-deadline"><i class="fas fa-hourglass-end"></i><span>Hạn nộp: ${formatDeadline(exam.submissionDeadline)}</span></div>
        <div class="cd-exam-deadline"><i class="fas fa-user-clock"></i><span>Hạn chấm: ${formatDeadline(exam.gradingDeadline)}</span></div>
      </div>
    `;

    return `
      <div class="cd-exam-card ${cardClass}" onclick="openGradingModal('${s.code}', '${exam.id}', ${submissionId ?? 0}); event.stopPropagation();">
        <div class="cd-exam-top">
          <div class="cd-exam-icon ${exam.iconClass}">${exam.icon}</div>
          <div>
            <div class="cd-exam-title">${exam.name}</div>
            <div class="cd-exam-sub">${exam.description}</div>
          </div>
        </div>
        ${deadlineHTML}
        ${submissionStatusHTML}
        ${scoreHTML}
        ${btnHTML}
      </div>
    `;
  });

  // Số trang được render (dựa trên exams đã tải), data-total dùng tổng trang từ server
  const renderedPages = Math.ceil(examCards.length / CARDS_PER_PAGE) || 1;
  const totalPages = classExamTotalPages; // tổng trang từ server (dùng cho nút next/prev)
  const sliderId = `exam-slider-${s.code}`;
  const prevBtnId = `exam-prev-${s.code}`;
  const nextBtnId = `exam-next-${s.code}`;
  const dotsId = `exam-dots-${s.code}`;

  const pagesHTML = Array.from({ length: renderedPages }, (_, p) => {
    const pageCards = examCards.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
    return `<div class="cd-exam-slide${p === 0 ? ' active' : ''}">${pageCards.join('')}</div>`;
  }).join('');

  const dotsHTML = totalPages > 1
    ? `<div class="cd-exam-dots" id="${dotsId}">
        ${Array.from({ length: totalPages }, (_, p) =>
          `<button class="cd-exam-dot${p === 0 ? ' active' : ''}" onclick="goToExamPage('${s.code}',${p})" aria-label="Trang ${p+1}"></button>`
        ).join('')}
       </div>`
    : '';

  const navHTML = totalPages > 1
    ? `<button class="cd-exam-nav cd-exam-nav-prev" id="${prevBtnId}" onclick="prevExamPage('${s.code}')" aria-label="Trang trước"><i class="fas fa-chevron-left"></i></button>
       <button class="cd-exam-nav cd-exam-nav-next" id="${nextBtnId}" onclick="nextExamPage('${s.code}')" aria-label="Trang sau"><i class="fas fa-chevron-right"></i></button>`
    : '';

  return `
    <div class="cd-exam-slider-wrapper">
      ${navHTML}
      <div class="cd-exam-slider" id="${sliderId}" data-page="0" data-total="${totalPages}" data-student="${s.code}">
        ${pagesHTML}
      </div>
      ${dotsHTML}
    </div>
  `;
}

// ===== EXAM SLIDER NAVIGATION =====
function _getSliderEl(studentCode) {
  return document.getElementById(`exam-slider-${studentCode}`);
}

function _updateSliderState(studentCode, page) {
  const slider = _getSliderEl(studentCode);
  if (!slider) return;
  const total = parseInt(slider.dataset.total, 10);

  // Dịch chuyển slides
  const slides = slider.querySelectorAll('.cd-exam-slide');
  slides.forEach((slide, i) => {
    slide.classList.remove('active', 'slide-enter-left', 'slide-enter-right', 'slide-exit-left', 'slide-exit-right');
    slide.classList.toggle('active', i === page);
  });

  // Cập nhật dots
  const dotsEl = document.getElementById(`exam-dots-${studentCode}`);
  if (dotsEl) {
    dotsEl.querySelectorAll('.cd-exam-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === page);
    });
  }

  // Cập nhật nút prev/next
  const prev = document.getElementById(`exam-prev-${studentCode}`);
  const next = document.getElementById(`exam-next-${studentCode}`);
  if (prev) prev.classList.toggle('disabled', page === 0);
  if (next) next.classList.toggle('disabled', page === total - 1);

  slider.dataset.page = page;
}

function _animateSlider(studentCode, direction) {
  const slider = _getSliderEl(studentCode);
  if (!slider) return;
  const currentPage = parseInt(slider.dataset.page, 10);
  const total = parseInt(slider.dataset.total, 10);
  const newPage = direction === 'next'
    ? Math.min(currentPage + 1, total - 1)
    : Math.max(currentPage - 1, 0);

  if (newPage === currentPage) return;

  const slides = slider.querySelectorAll('.cd-exam-slide');
  const current = slides[currentPage];
  const next = slides[newPage];

  const enterClass = direction === 'next' ? 'slide-enter-right' : 'slide-enter-left';
  const exitClass  = direction === 'next' ? 'slide-exit-left'  : 'slide-exit-right';

  current.classList.add(exitClass);
  next.classList.add(enterClass, 'active');

  // Sau animation xong thì dọn class
  const onEnd = () => {
    current.classList.remove('active', exitClass);
    next.classList.remove(enterClass);
    current.removeEventListener('animationend', onEnd);
  };
  current.addEventListener('animationend', onEnd, { once: true });

  // Cập nhật dots + nút
  const dotsEl = document.getElementById(`exam-dots-${studentCode}`);
  if (dotsEl) {
    dotsEl.querySelectorAll('.cd-exam-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === newPage);
    });
  }
  const prevBtn = document.getElementById(`exam-prev-${studentCode}`);
  const nextBtn = document.getElementById(`exam-next-${studentCode}`);
  if (prevBtn) prevBtn.classList.toggle('disabled', newPage === 0);
  if (nextBtn) nextBtn.classList.toggle('disabled', newPage === total - 1);

  slider.dataset.page = newPage;
}

function nextExamPage(studentCode) {
  const slider = _getSliderEl(studentCode);
  if (!slider) return;
  const currentPage = parseInt(slider.dataset.page, 10);
  const total = parseInt(slider.dataset.total, 10);
  const newPage = currentPage + 1;
  if (newPage >= total) return;

  // Kiểm tra trang exam mới có dữ liệu chưa
  if (!classExamLoadedPages.has(newPage)) {
    _fetchExamPageAndNavigate(studentCode, newPage);
    return;
  }
  _animateSlider(studentCode, 'next');
}

function prevExamPage(studentCode) {
  _animateSlider(studentCode, 'prev');
}

async function _fetchExamPageAndNavigate(studentCode, targetPage) {
  const nextBtn = document.getElementById(`exam-next-${studentCode}`);
  const prevBtn = document.getElementById(`exam-prev-${studentCode}`);
  if (nextBtn) { nextBtn.disabled = true; nextBtn.classList.add('disabled'); }
  if (prevBtn) { prevBtn.disabled = true; }

  try {
    await fetchClassExamsFromAPI(classData.classId, targetPage);
    // Tải bài nộp và trạng thái phiên chấm cho exam mới
    await fetchSubmissionsForAllExams();
    await fetchGradingSessionStatuses();

    // Rebuild panel cho sinh viên này rồi nhảy đến trang đích
    const student = studentsData.find(s => s.code === studentCode);
    const row = document.getElementById(`student-${studentCode}`);
    const panel = row?.querySelector('.cd-exam-panel');
    if (student && panel) {
      panel.innerHTML = buildExamPanelHTML(student);
      _updateSliderState(studentCode, targetPage);
    }
  } catch (err) {
    console.warn('_fetchExamPageAndNavigate lỗi:', err);
  } finally {
    const nb = document.getElementById(`exam-next-${studentCode}`);
    const pb = document.getElementById(`exam-prev-${studentCode}`);
    if (nb) nb.disabled = false;
    if (pb) pb.disabled = false;
  }
}

async function goToExamPage(studentCode, page) {
  const slider = _getSliderEl(studentCode);
  if (!slider) return;
  const currentPage = parseInt(slider.dataset.page, 10);
  if (page === currentPage) return;

  // Kiểm tra trang exam đích có dữ liệu chưa
  if (!classExamLoadedPages.has(page)) {
    await _fetchExamPageAndNavigate(studentCode, page);
    return;
  }

  const direction = page > currentPage ? 'next' : 'prev';
  const total = parseInt(slider.dataset.total, 10);
  slider.dataset.page = currentPage; // đảm bảo đúng before animate
  const slides = slider.querySelectorAll('.cd-exam-slide');
  const current = slides[currentPage];
  const target = slides[page];
  const enterClass = direction === 'next' ? 'slide-enter-right' : 'slide-enter-left';
  const exitClass  = direction === 'next' ? 'slide-exit-left'  : 'slide-exit-right';

  current.classList.add(exitClass);
  target.classList.add(enterClass, 'active');
  const onEnd = () => {
    current.classList.remove('active', exitClass);
    target.classList.remove(enterClass);
  };
  current.addEventListener('animationend', onEnd, { once: true });

  const dotsEl = document.getElementById(`exam-dots-${studentCode}`);
  if (dotsEl) {
    dotsEl.querySelectorAll('.cd-exam-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === page);
    });
  }
  const prevBtn = document.getElementById(`exam-prev-${studentCode}`);
  const nextBtn = document.getElementById(`exam-next-${studentCode}`);
  if (prevBtn) prevBtn.classList.toggle('disabled', page === 0);
  if (nextBtn) nextBtn.classList.toggle('disabled', page === total - 1);

  slider.dataset.page = page;
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

  container.innerHTML = students.map((s, i) => `
    <div class="cd-student-row" id="student-${s.code}">
      <div class="cd-student-header" onclick="toggleStudent('${s.code}')">
        <div class="cd-student-number">${i + 1}</div>
        ${s.avatarImage
          ? `<img src="${s.avatarImage}" alt="avatar" class="cd-student-avatar">`
          : `<div class="cd-student-avatar cd-student-avatar-default">${DEFAULT_AVATAR_SVG}</div>`
        }
        <div class="cd-student-info">
          <div class="cd-student-name">${s.name}</div>
          <div class="cd-student-meta">${s.code} · ${formatGender(s.gender) || 'Chưa cập nhật'}</div>
        </div>
        <span class="cd-student-arrow"><i class="fas fa-chevron-right"></i></span>
      </div>
      <div class="cd-exam-panel">
        ${buildExamPanelHTML(s)}
      </div>
    </div>
  `).join('');
}

// ===== INTERACTIONS =====
async function toggleStudent(code) {
  const row = document.getElementById(`student-${code}`);
  if (!row) return;

  // collapse any other open row
  document.querySelectorAll('.cd-student-row.expanded').forEach(r => {
    if (r.id !== `student-${code}`) r.classList.remove('expanded');
  });

  const isExpanding = !row.classList.contains('expanded');
  row.classList.toggle('expanded');

  if (isExpanding) {
    // Gọi API bảng điểm mỗi lần mở để luôn có dữ liệu mới nhất
    await fetchClassGradeBoard(classData.classId);
    // Cập nhật trạng thái phiên chấm mới nhất
    await fetchSubmissionsForAllExams();
    await fetchGradingSessionStatuses();
    // Re-render panel với dữ liệu grade board mới nhất
    const student = studentsData.find(s => s.code === code);
    if (student) {
      const panel = row.querySelector('.cd-exam-panel');
      if (panel) panel.innerHTML = buildExamPanelHTML(student);
    }
  }
}

function filterStudents() {
  const term = document.getElementById('searchStudent').value.toLowerCase();
  const filtered = studentsData.filter(s =>
    s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)
  );
  renderStudents(filtered);
}

// ===== GRADING MODAL =====
function openGradingModal(studentCode, examId, submissionId) {
  const student = studentsData.find(s => s.code === studentCode);
  const exams = getClassExams();
  const exam = exams.find(e => e.id === examId);
  if (!student || !exam) return;
  if (isDeadlinePassed(exam.gradingDeadline)) {
    alert('Đã hết thời gian chấm bài cho bài thi này. Hệ thống đã khóa chấm.');
    return;
  }
  if (isGradingSessionFinalized(submissionId)) {
    alert('Phiên chấm đã được chốt điểm (FINALIZED). Không thể chấm lại.');
    return;
  }

  selectedStudent = student;
  selectedExam = exam;
  selectedSubmissionId = submissionId || null;

  document.getElementById('gradingModalTitle').textContent = `Chấm: ${exam.name}`;

  const videosText = exam.videos.length > 0
    ? exam.videos.map(v => v.name).join(', ')
    : 'Chưa cập nhật video mẫu';
  const avatarHTML = student.avatarImage
    ? `<img src="${student.avatarImage}" alt="avatar" class="grading-exam-avatar">`
    : `<div class="grading-exam-avatar grading-exam-avatar-default">${DEFAULT_AVATAR_SVG}</div>`;
  document.getElementById('gradingExamInfo').innerHTML = `
    <div class="grading-exam-info-cols">
      <div class="grading-exam-info-text">
        <div><strong>Sinh viên:</strong> ${student.name} (${student.code})</div>
        <div><strong>Bài thi:</strong> ${exam.name}</div>
        <div><strong>Video:</strong> ${videosText}</div>
        <div><strong>Hạn nộp:</strong> ${formatDeadline(exam.submissionDeadline)}</div>
        <div><strong>Hạn chấm:</strong> ${formatDeadline(exam.gradingDeadline)}</div>
      </div>
      ${avatarHTML}
    </div>
  `;

  document.getElementById('gradingModal').style.display = 'flex';
}

function closeGradingModal() {
  document.getElementById('gradingModal').style.display = 'none';
  selectedExam = null;
  selectedStudent = null;
  selectedSubmissionId = null;
}

function startGrading(mode) {
  if (!selectedExam || !selectedStudent) return;
  if (isDeadlinePassed(selectedExam.gradingDeadline)) {
    alert('Đã hết thời gian chấm bài cho bài thi này.');
    return;
  }

  const gradingApiMode = mode === 'official' ? 'OFFICIAL' : 'PRACTICE';
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const teacherId = currentUser?.id || currentUser?.studentId || null;
  const classExamId = selectedExam.classExamId ?? selectedExam.id;
  const studentCode = selectedStudent.code;
  const submissionId = selectedSubmissionId;

  sessionStorage.setItem('gradingMode', mode);
  sessionStorage.setItem('gradingExam', JSON.stringify(selectedExam));
  sessionStorage.setItem('gradingStudent', JSON.stringify(selectedStudent));

  // Save selectedStudent data for chamdiem.js
  sessionStorage.setItem('selectedStudent', JSON.stringify({
    studentId: selectedStudent.code,
    name: selectedStudent.name,
    classId: classData.classId,
    className: classData.className,
    subject: selectedExam.name
  }));

  closeGradingModal();

  // Luôn lưu đủ thông tin để chamdiem.js gọi API khởi tạo phiên chấm
  if (teacherId) {
    sessionStorage.setItem('pendingGradingSession', JSON.stringify({
      idSubmission: submissionId ? String(submissionId) : null,
      idTeacher: teacherId,
      gradingMode: gradingApiMode,
      classExamId: classExamId,
      studentCode: studentCode,
    }));
  } else {
    sessionStorage.removeItem('pendingGradingSession');
  }

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

async function refreshExamCatalogFromServer() {
  try {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const teacherId = currentUser?.id || currentUser?.studentId || null;
    if (!teacherId || typeof ExamsService?.getTeacherExams !== 'function') return;

    let allExams = [];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const result = await ExamsService.getTeacherExams(teacherId, page, 100);
      if (!result || !Array.isArray(result.exams)) break;

      const normalized = result.exams.map((exam, index) => ({
        id: String(exam.id || exam.examId || `exam-api-${index}`),
        name: exam.name || exam.examName || exam.title || 'Bài thi',
        icon: '📝',
        iconClass: 'custom-exam',
        description: exam.description || exam.content || '',
        deleted: exam.isDeleted === true,
        videos: Array.isArray(exam.videos)
          ? exam.videos.map(v => ({ name: v.name || v.title || '', url: v.url || v.videoUrl || '' }))
          : (exam.sampleVideoUrl ? [{ name: exam.name || 'Video mẫu', url: exam.sampleVideoUrl }] : [])
      }));

      allExams = page === 0 ? normalized : [...allExams, ...normalized];
      totalPages = result.totalPages ?? 1;
      page++;
    }

    if (allExams.length > 0) {
      sessionStorage.setItem('examCatalog', JSON.stringify(allExams));
    }
  } catch (e) {
    console.warn('refreshExamCatalogFromServer error:', e);
  }
}

async function openAddExamModal() {
  // Tải toàn bộ trang bài thi để modal hiển thị đầy đủ
  await Promise.all([
    fetchAllClassExamsPages(classData.classId),
    fetchDeletedClassExams(classData.classId),
    refreshExamCatalogFromServer(),
  ]);

  // Reset về tab "Đang áp dụng"
  switchExamTab('active');

  const assignedExams = getClassExams();
  const assignedIds = assignedExams.map(e => e.id);
  const deletedIds = deletedClassExams.map(e => e.id);
  const allExams = getAllExamTypes();
  const available = allExams.filter(e => !assignedIds.includes(e.id) && !deletedIds.includes(e.id));

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
        <input type="radio" name="examRadio" value="${exam.id}">
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

function showClassDetailToast(message, type = 'success') {
  const toast = document.getElementById('classDetailToast');
  const messageEl = document.getElementById('classDetailToastMessage');
  const icon = toast?.querySelector('i');
  if (!toast || !messageEl) return;

  messageEl.textContent = message;
  toast.classList.toggle('cd-toast--error', type === 'error');
  if (icon) icon.className = type === 'error' ? 'fas fa-times-circle' : 'fas fa-check-circle';
  toast.style.display = 'flex';

  if (classDetailToastTimer) {
    clearTimeout(classDetailToastTimer);
  }

  classDetailToastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 2600);
}

function switchExamTab(tab) {
  const activePane = document.getElementById('examTabActive');
  const deletedPane = document.getElementById('examTabDeleted');
  const btnActive = document.getElementById('examTabBtnActive');
  const btnDeleted = document.getElementById('examTabBtnDeleted');
  if (tab === 'deleted') {
    activePane.style.display = 'none';
    deletedPane.style.display = '';
    btnActive.classList.remove('cd-modal-tab--active');
    btnDeleted.classList.add('cd-modal-tab--active');
    renderDeletedExamTab();
  } else {
    activePane.style.display = '';
    deletedPane.style.display = 'none';
    btnActive.classList.add('cd-modal-tab--active');
    btnDeleted.classList.remove('cd-modal-tab--active');
  }
}

async function fetchDeletedClassExams(classId) {
  if (!classId) return;
  try {
    const url = API_CONFIG.ENDPOINTS.DELETED_CLASS_EXAMS(classId);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) { deletedClassExams = []; return; }
    const json = await res.json().catch(() => null);

    // Backend trả về ApiResponse<Page<ExamResponse>>
    let list = [];
    if (Array.isArray(json?.data?.content)) {
      list = json.data.content;
    } else if (Array.isArray(json?.data)) {
      list = json.data;
    } else if (Array.isArray(json)) {
      list = json;
    }

    deletedClassExams = typeof ExamsService?._normalizeClassExams === 'function'
      ? ExamsService._normalizeClassExams(list)
      : list;
  } catch (e) {
    console.warn('fetchDeletedClassExams error:', e);
    deletedClassExams = [];
  }
}

function renderDeletedExamTab() {
  const container = document.getElementById('deletedExamList');
  if (!container) return;
  if (!deletedClassExams.length) {
    container.innerHTML = '<p class="cd-assigned-empty">Không có bài thi nào đã xóa.</p>';
    return;
  }
  container.innerHTML = deletedClassExams.map(exam => `
    <div class="cd-assigned-exam-item">
      <div class="cd-assigned-exam-info">
        <span class="cd-assigned-exam-icon">${exam.icon || '📝'}</span>
        <div>
          <div class="cd-assigned-exam-name">${exam.name}</div>
          <div class="cd-assigned-exam-desc">${exam.description}</div>
          <div class="cd-assigned-exam-time">
            <span>Hạn nộp: ${formatDeadline(exam.submissionDeadline)}</span>
            <span>Hạn chấm: ${formatDeadline(exam.gradingDeadline)}</span>
          </div>
        </div>
      </div>
      <button type="button" class="cd-assigned-exam-restore" onclick="openRestoreExamModal('${exam.id}')">
        <i class="fas fa-undo"></i> Khôi phục
      </button>
    </div>
  `).join('');
}

function openRestoreExamModal(examId) {
  pendingRestoreExamId = examId;
  const exam = deletedClassExams.find(e => String(e.id) === String(examId));
  const name = exam?.name || 'này';
  document.getElementById('restoreExamMessage').textContent = `Khôi phục bài thi "${name}" vào lớp?`;
  document.getElementById('restoreExamModal').style.display = 'flex';
}

function closeRestoreExamModal() {
  document.getElementById('restoreExamModal').style.display = 'none';
  pendingRestoreExamId = null;
}

async function confirmRestoreExam() {
  const examId = pendingRestoreExamId;
  if (!examId) return;
  closeRestoreExamModal();
  try {
    const csrfToken = typeof _getCsrfToken === 'function' ? _getCsrfToken() : null;
    const headers = {};
    if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;
    const url = API_CONFIG.ENDPOINTS.RESTORE_EXAM_TO_CLASS(classData.classId, examId);
    const res = await fetch(url, { method: 'POST', headers, credentials: 'include' });

    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        const retry = await fetch(url, { method: 'POST', headers, credentials: 'include' });
        if (!retry.ok) {
          const err = await retry.json().catch(() => null);
          showClassDetailToast(err?.message || `Khôi phục thất bại (${retry.status}).`, 'error');
          return;
        }
      } else {
        showClassDetailToast('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.', 'error');
        return;
      }
    } else if (!res.ok) {
      const err = await res.json().catch(() => null);
      showClassDetailToast(err?.message || `Khôi phục thất bại (${res.status}).`, 'error');
      return;
    }
  } catch (e) {
    console.error('restoreExam error:', e);
    showClassDetailToast('Có lỗi kết nối khi khôi phục. Vui lòng thử lại.', 'error');
    return;
  }
  await Promise.all([
    fetchAllClassExamsPages(classData.classId),
    fetchDeletedClassExams(classData.classId),
  ]);
  showClassDetailToast('Đã khôi phục bài thi thành công.');
  await openAddExamModal();
  switchExamTab('deleted');
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

async function confirmDeleteExam() {
  if (!pendingDeleteExamId) return;

  try {
    const csrfToken = typeof _getCsrfToken === 'function' ? _getCsrfToken() : null;
    const headers = {};
    if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

    const url = API_CONFIG.ENDPOINTS.REMOVE_EXAM_FROM_CLASS(classData.classId, pendingDeleteExamId);
    const res = await fetch(url, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });

    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        const retry = await fetch(url, { method: 'DELETE', headers, credentials: 'include' });
        if (!retry.ok) {
          const err = await retry.json().catch(() => null);
          alert(err?.message || `Xóa bài thi thất bại (${retry.status}).`);
          return;
        }
      } else {
        alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        return;
      }
    } else if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.message || `Xóa bài thi thất bại (${res.status}).`);
      return;
    }
  } catch (e) {
    console.error('confirmDeleteExam API error', e);
    alert('Có lỗi kết nối khi xóa bài thi. Vui lòng thử lại.');
    return;
  }

  // openAddExamModal sẽ tự xóa cache và tải lại tất cả trang
  await openAddExamModal();
  renderStudents(studentsData);
  closeDeleteExamModal();
  showClassDetailToast('Đã xóa bài thi khỏi lớp thành công.');
}

async function addExamsToClass() {
  const selected = document.querySelector('#examCheckboxList input[type="radio"]:checked');
  const selectedId = selected ? selected.value : null;
  const submissionDeadline = document.getElementById('submissionDeadline').value;
  const gradingDeadline = document.getElementById('gradingDeadline').value;

  if (!selectedId) {
    alert('Vui lòng chọn một bài thi.');
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

  // Gọi API thêm bài thi vào lớp
  try {
    const csrfToken = typeof _getCsrfToken === 'function' ? _getCsrfToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

    const res = await fetch(API_CONFIG.ENDPOINTS.ASSIGN_EXAM_TO_CLASS, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        idExam: Number(selectedId),
        idClass: classData.classId,
        submissionDeadline: submissionDeadline,
        gradingDeadline: gradingDeadline,
      }),
    });

    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) {
        const retry = await fetch(API_CONFIG.ENDPOINTS.ASSIGN_EXAM_TO_CLASS, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            idExam: Number(selectedId),
            idClass: classData.classId,
            submissionDeadline: submissionDeadline,
            gradingDeadline: gradingDeadline,
          }),
        });
        if (!retry.ok) {
          const err = await retry.json().catch(() => null);
          alert(err?.message || `Thêm bài thi thất bại (${retry.status}).`);
          return;
        }
      } else {
        alert('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        return;
      }
    } else if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.message || `Thêm bài thi thất bại (${res.status}).`);
      return;
    }
  } catch (e) {
    console.error('addExamsToClass API error', e);
    alert('Có lỗi kết nối khi thêm bài thi. Vui lòng thử lại.');
    return;
  }

  // Tải lại toàn bộ trang bài thi
  await fetchAllClassExamsPages(classData.classId);
  renderStudents(studentsData);
  closeAddExamModal();
  showClassDetailToast('Đã thêm bài thi vào lớp thành công.');
}
