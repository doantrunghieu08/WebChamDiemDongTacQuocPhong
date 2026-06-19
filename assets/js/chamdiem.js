/* =============================================
   app.js – Chấm Điểm Bài Tập Đi Đều
   ============================================= */

// ---- LOAD GRADING SESSION ----
async function loadGradingSession() {
  const pending = JSON.parse(sessionStorage.getItem('pendingGradingSession') || 'null');
  if (!pending || !pending.idTeacher) return;

  // Xóa dòng dưới đây để tránh mất dữ liệu khi F5 (reload trang)
  // sessionStorage.removeItem('pendingGradingSession');

  let idSubmission = pending.idSubmission || null;

  // Nếu chưa có idSubmission (SubmissionSummaryResponse không trả về id),
  // fetch lại danh sách bài nộp theo classExamId và tìm theo studentCode
  if (!idSubmission && pending.classExamId && pending.studentCode) {
    try {
      const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.TEACHER_CLASS_SUBMISSIONS)
        ? API_CONFIG.ENDPOINTS.TEACHER_CLASS_SUBMISSIONS(pending.classExamId)
        : `http://103.75.182.246:8080/teacher/class/${encodeURIComponent(pending.classExamId)}/submissions`;

      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];

      const normalize = s => String(s ?? '').trim().toUpperCase();
      const sub = list.find(item => {
        // Hỗ trợ cả flat (idStudent / studentCode) lẫn nested (student.id / student.code)
        const sid = item.studentCode ?? item.idStudent ?? item.studentId ?? item.student_id
          ?? item.student?.id ?? item.student?.code ?? item.student?.studentCode ?? item.student?.studentId ?? null;
        return normalize(sid) === normalize(pending.studentCode);
      });

      if (sub) {
        const rawId = sub.id ?? sub.submissionId ?? sub.submission_id ?? null;
        if (rawId != null) idSubmission = String(rawId);
      }

      // Log để debug khi vẫn không tìm được
      if (!idSubmission) {
        console.warn('[loadGradingSession] studentCode cần tìm:', pending.studentCode);
        console.warn('[loadGradingSession] Raw submission item[0]:', JSON.stringify(list[0] ?? null));
        console.warn('[loadGradingSession] Tất cả keys của item[0]:', Object.keys(list[0] ?? {}));
      }
    } catch (e) {
      console.warn('[loadGradingSession] Không thể lấy submission ID:', e);
    }
  }

  // Nếu vẫn không có submission → sinh viên chưa nộp bài hoặc không tìm được
  if (!idSubmission) {
    console.warn('[loadGradingSession] Không tìm được idSubmission, bỏ qua khởi tạo phiên chấm.');
    showToast('Sinh viên chưa nộp bài. Hãy dùng "Tải Video Lên" để nộp thay.', true);
    return;
  }

  try {
    const session = await ExamsService.startGradingSession(
      idSubmission,
      pending.idTeacher,
      pending.gradingMode
    );
    sessionStorage.setItem('gradingSession', JSON.stringify(session));

    state.gradingSessionId = session?.id ?? null;
    // Lưu submissionId để dùng cho API capture-error-frame
    if (!state.submissionId) state.submissionId = idSubmission;

    const sub = session?.studentSubmissionResponse;
    if (sub) {
      if (sub.studentData) {
        try {
          state.studentPoseData = JSON.parse(sub.studentData);
        } catch (e) {
          console.warn('Lỗi parse studentData:', e);
        }
      }
      if (sub.standardData) {
        try {
          state.standardPoseData = JSON.parse(sub.standardData);
        } catch (e) {
          console.warn('Lỗi parse standardData:', e);
        }
      }

      // Đổi màu nút compare nếu đã có dữ liệu
      if (state.studentPoseData) {
        const btnCP = document.getElementById('btnComparePose');
        if (btnCP) btnCP.classList.add('has-data');
      }

      const urls = [];
      if (sub.videoUrl1) urls.push(sub.videoUrl1);
      if (sub.videoUrl2) urls.push(sub.videoUrl2);
      state.videoUrls = urls;
      state.totalVideos = urls.length || 1;
      document.getElementById('vid-total').textContent = String(state.totalVideos).padStart(2, '0');
      renderThumbs(urls.length);
      loadVideoPlayer(1);
    }
  } catch (err) {
    console.warn('Khởi tạo phiên chấm thất bại:', err);
  }
}

// ---- RENDER THUMBNAILS ----
function renderThumbs(count) {
  const container = document.querySelector('.thumbs');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const div = document.createElement('div');
    div.className = 'thumb';
    div.onclick = () => switchVideo(i);
    div.innerHTML = `<div class="thumb-img" id="thumb-${i}">&#9654; V0${i}</div><span>Video 0${i}</span>`;
    container.appendChild(div);
  }
  updateThumbActive();
}

// ---- VIDEO PLAYER (thực) ----
let _onTimeUpdate = null;

function loadVideoPlayer(index) {
  const url = state.videoUrls[index - 1];
  const area = document.getElementById('video-area');
  if (!url || !area) return;

  let vid = document.getElementById('main-video-player');
  if (!vid) {
    vid = document.createElement('video');
    vid.id = 'main-video-player';
    vid.style.cssText = 'width:100%;height:100%;object-fit:contain;position:absolute;top:0;left:0;z-index:1;background:#000;';
    vid.controls = false;
    area.insertBefore(vid, area.firstChild);
  }

  // Xoá timeupdate listener cũ trước khi gán mới
  if (_onTimeUpdate) vid.removeEventListener('timeupdate', _onTimeUpdate);
  _onTimeUpdate = () => {
    state.currentTime = Math.round(vid.currentTime);
    updateTimeDisplay();
    updateProgressBar();
  };
  vid.addEventListener('timeupdate', _onTimeUpdate);

  vid.addEventListener('loadedmetadata', () => {
    state.duration = Math.round(vid.duration) || state.duration;
    updateTimeDisplay();
    updateProgressBar();
  }, { once: true });

  // crossOrigin phải đặt TRƯỚC khi gán src để canvas.drawImage() không bị SecurityError
  vid.crossOrigin = 'anonymous';
  vid.src = url;
  vid.load();

  // Ẩn play-icon overlay ngay khi có URL thực
  const icon = document.getElementById('play-icon');
  if (icon) icon.style.display = 'none';

  // Hiện lại nếu video lỗi
  vid.addEventListener('error', () => {
    if (icon) icon.style.display = '';
  }, { once: true });
}

// ---- LOAD GRADING MODE ----
function loadGradingMode() {
  const mode = sessionStorage.getItem('gradingMode') || 'practice';
  state.gradingMode = mode;

  // Update UI title based on mode
  let modeLabel = mode === 'practice' ? '(Luyện Tập)' : '(Lấy Điểm)';
  const breadcrumb = document.querySelector('.breadcrumb .cur');
  if (breadcrumb) {
    breadcrumb.textContent = `Chấm ${modeLabel.slice(1, -1)}`;
  }
}

// ---- LOAD STUDENT INFO ----
function loadStudentInfo() {
  const selectedStudent = JSON.parse(sessionStorage.getItem('selectedStudent'));
  const selectedClass = JSON.parse(sessionStorage.getItem('selectedClass'));
  const gradingStudent = JSON.parse(sessionStorage.getItem('gradingStudent'));
  const gradingExam = JSON.parse(sessionStorage.getItem('gradingExam'));

  if (gradingStudent && gradingExam) {
    // Flow from class-detail.js
    const examName = gradingExam.name || 'Động tác Quốc phòng';
    const className = selectedClass ? selectedClass.className : '';
    document.getElementById('topbar-title').textContent = className ? `${className} - ${examName}` : examName;
    document.getElementById('breadcrumb-class').textContent = className;
    document.getElementById('breadcrumb-student').textContent = gradingStudent.name;

    // Update page title
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = `CHẤM ĐIỂM ${examName.toUpperCase()}`;
    document.title = `Chấm Điểm ${examName} – HACTECH`;

    state.currentStudent = {
      name: gradingStudent.name,
      code: gradingStudent.code,
      className: className,
      subject: examName,
      examId: gradingExam.id
    };
  } else if (selectedStudent) {
    document.getElementById('topbar-title').textContent = `${selectedStudent.className} - ${selectedStudent.subject}`;
    document.getElementById('breadcrumb-class').textContent = selectedStudent.className;
    document.getElementById('breadcrumb-student').textContent = selectedStudent.name;

    // Update page title
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = `CHẤM ĐIỂM ${selectedStudent.subject.toUpperCase()}`;
    document.title = `Chấm Điểm ${selectedStudent.subject} – HACTECH`;

    state.currentStudent = selectedStudent;
  } else if (selectedClass) {
    document.getElementById('topbar-title').textContent = `${selectedClass.className} - ${selectedClass.subject}`;
    document.getElementById('breadcrumb-class').textContent = selectedClass.className;

    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.textContent = `CHẤM ĐIỂM ${selectedClass.subject.toUpperCase()}`;
    document.title = `Chấm Điểm ${selectedClass.subject} – HACTECH`;

    state.currentStudent = { className: selectedClass.className, name: 'Học sinh', subject: selectedClass.subject };
  }
}

// ---- STATE ----
const state = {
  isPlaying: false,
  currentTime: 0,
  duration: 180,        // giả lập 3 phút
  currentVideo: 1,
  totalVideos: 2,
  capturedFrameTime: null,
  assignedErrors: [],   // lỗi gán cho frame hiện tại
  history: [],          // lịch sử tất cả frame đã chấm
  defaultScore: 10,     // điểm mặc định của bài thi
  gradingSessionId: null,   // ID phiên chấm từ API
  videoUrls: [],            // [videoUrl1, videoUrl2] từ bài nộp của sinh viên
  errorTypes: [
    { id: 1, name: 'Sai nhịp tay', score: -1.0, note: 'Tay đánh không đều theo nhịp bước.' },
    { id: 2, name: 'Bàn chân không vuông', score: -0.5, note: 'Mũi chân và hướng bàn chân chưa đúng quy định.' },
    { id: 3, name: 'Dáng người gù', score: -1.0, note: 'Tư thế thân người không giữ được độ thẳng.' },
    { id: 4, name: 'Mắt không nhìn thẳng', score: -0.5, note: 'Ánh nhìn chưa hướng thẳng về phía trước.' },
    { id: 5, name: 'Tay không đúng tư thế', score: -0.5, note: 'Biên độ và vị trí tay chưa đúng mẫu động tác.' },
  ],
  timerInterval: null,
  nextHistoryId: 1,
  currentStudent: null,
  gradingMode: 'practice', // 'practice' hoặc 'grading'
  gradingDeadline: '',
  gradingLocked: false,
  submissionId: null,        // ID bài nộp dùng cho API capture-error-frame
  capturedFrameImageUrl: null, // URL ảnh từ API sau khi chụp frame
  studentPoseData: null,       // Dữ liệu khung xương học sinh từ /api/ai/extract-student
  standardPoseData: null,      // Dữ liệu chuẩn từ /api/ai/compare-pose (nếu có)
};

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

function getCurrentExamAssignment() {
  const selectedClass = JSON.parse(sessionStorage.getItem('selectedClass') || 'null');
  const gradingExam = JSON.parse(sessionStorage.getItem('gradingExam') || 'null');
  if (!selectedClass?.classId || !gradingExam?.id) return null;

  const all = JSON.parse(sessionStorage.getItem('classExams') || '{}');
  const assignments = Array.isArray(all[selectedClass.classId]) ? all[selectedClass.classId].map(normalizeClassExamAssignment) : [];
  const normalizedAssignments = JSON.stringify(assignments);
  if (JSON.stringify(all[selectedClass.classId] || []) !== normalizedAssignments) {
    all[selectedClass.classId] = assignments;
    sessionStorage.setItem('classExams', JSON.stringify(all));
  }

  return assignments.find(item => item.id === gradingExam.id) || null;
}

function renderGradingDeadlineNotice() {
  const notice = document.getElementById('gradingDeadlineNotice');
  if (!notice) return;

  notice.style.display = 'flex';
  notice.classList.toggle('locked', state.gradingLocked);
  notice.innerHTML = state.gradingLocked
    ? `<span class="notice-icon">🔒</span><div><strong>Bài thi đã bị khóa chấm.</strong><br>Hạn chấm: ${formatDeadline(state.gradingDeadline)}. Bạn chỉ có thể xem lại giao diện, không thể chụp lỗi hoặc lưu điểm nữa.</div>`
    : `<span class="notice-icon">⏰</span><div><strong>Hạn chấm bài:</strong> ${formatDeadline(state.gradingDeadline)}.</div>`;
}

function applyGradingLockUI() {
  document.body.classList.toggle('grading-locked', state.gradingLocked);
  document.querySelectorAll('.btn-add, .btn-snap, .btn-finish').forEach(button => {
    button.disabled = state.gradingLocked;
  });

  const searchInput = document.getElementById('error-search');
  if (searchInput) {
    searchInput.disabled = state.gradingLocked;
  }
}

function loadGradingAvailability() {
  const gradingExam = JSON.parse(sessionStorage.getItem('gradingExam') || 'null');
  // Ưu tiên lấy gradingDeadline trực tiếp từ gradingExam (đã có đủ dữ liệu từ API)
  const deadlineFromExam = gradingExam?.gradingDeadline || '';
  if (deadlineFromExam) {
    state.gradingDeadline = deadlineFromExam;
  } else {
    const assignment = getCurrentExamAssignment();
    state.gradingDeadline = assignment?.gradingDeadline || '';
  }
  state.gradingLocked = isDeadlinePassed(state.gradingDeadline);
  renderGradingDeadlineNotice();
  applyGradingLockUI();
}

function ensureGradingAvailable(actionLabel) {
  if (!state.gradingLocked) return true;
  showToast(`Đã hết thời gian chấm bài. Không thể ${actionLabel}.`, true);
  return false;
}

function getDefaultSharedErrorCatalog() {
  return [
    { id: 1, name: 'Sai nhịp tay', description: 'Tay đánh không đúng nhịp', note: 'Tay đánh không đều theo nhịp bước.', severity: 'cao', deduction: 1.0, icon: 'fas fa-hand-paper', students: [] },
    { id: 2, name: 'Bàn chân không vuông', description: 'Mũi chân và hướng bàn chân chưa đúng quy định', note: 'Mũi chân và hướng bàn chân chưa đúng quy định.', severity: 'trung-binh', deduction: 0.5, icon: 'fas fa-shoe-prints', students: [] },
    { id: 3, name: 'Dáng người gù', description: 'Tư thế thân người không giữ được độ thẳng', note: 'Tư thế thân người không giữ được độ thẳng.', severity: 'cao', deduction: 1.0, icon: 'fas fa-person-falling', students: [] },
    { id: 4, name: 'Mắt không nhìn thẳng', description: 'Ánh nhìn lệch khỏi hướng chuẩn', note: 'Ánh nhìn chưa hướng thẳng về phía trước.', severity: 'trung-binh', deduction: 0.5, icon: 'fas fa-eye', students: [] },
    { id: 5, name: 'Tay không đúng tư thế', description: 'Biên độ và vị trí tay chưa đúng mẫu động tác', note: 'Biên độ và vị trí tay chưa đúng mẫu động tác.', severity: 'trung-binh', deduction: 0.5, icon: 'fas fa-hand-paper', students: [] }
  ];
}

function getSharedErrorCatalog() {
  const stored = JSON.parse(sessionStorage.getItem('teacherErrorCatalog') || 'null');
  if (Array.isArray(stored)) {
    return stored;
  }

  const seed = getDefaultSharedErrorCatalog();
  sessionStorage.setItem('teacherErrorCatalog', JSON.stringify(seed));
  return seed;
}

function saveSharedErrorCatalog(errors) {
  sessionStorage.setItem('teacherErrorCatalog', JSON.stringify(errors));
}

function syncStateErrorTypesFromCatalog() {
  state.errorTypes = getSharedErrorCatalog()
    .filter(error => error.isActive !== false && !error.deleted)
    .map(error => ({
      id: error.id,
      name: error.name,
      score: -(Number(error.deduction) || 0),
      note: error.note || error.description || ''
    }));
}

async function fetchAndSyncTeacherErrors() {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const teacherId = currentUser?.studentId || currentUser?.id || currentUser?.username || '';
  if (!teacherId) return;

  try {
    const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.TEACHER_ERRORS)
      ? API_CONFIG.ENDPOINTS.TEACHER_ERRORS(teacherId)
      : `http://103.75.182.246:8080/api/teacher/error/${encodeURIComponent(teacherId)}`;

    const response = await fetch(url, { credentials: 'include' });
    const json = await response.json().catch(() => null);

    if (response.ok && Array.isArray(json?.data)) {
      const serverErrors = json.data
        .filter(e => e.isActive !== false)
        .map(e => ({
          id: e.id,
          name: e.name,
          description: e.description || '',
          note: e.description || '',
          severity: e.severityType === 'HIGH' ? 'cao' : e.severityType === 'LOW' ? 'thap' : 'trung-binh',
          deduction: e.deduction,
          icon: 'fas fa-exclamation-circle',
          students: []
        }));

      const local = getSharedErrorCatalog();
      // Chỉ giữ lại các lỗi đã bị xóa thủ công trên local (không có trên server)
      const localDeleted = local.filter(e => e.deleted && !json.data.find(s => s.id === e.id));
      const merged = [...serverErrors, ...localDeleted];
      saveSharedErrorCatalog(merged);
      syncStateErrorTypesFromCatalog();
      renderErrorTypeList();
    }
  } catch (err) {
    console.warn('Không thể tải danh sách lỗi từ API:', err);
  }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  loadGradingMode();
  loadStudentInfo();
  await loadGradingSession();
  await loadExistingGradingErrors();
  loadGradingAvailability();
  syncStateErrorTypesFromCatalog();
  renderErrorTypeList();
  fetchAndSyncTeacherErrors();
  updateTimeDisplay();
  updateProgressBar();
  updateThumbActive();
  updateExamTotal();
  setupProgressBarDrag();

  // Setup back button
  const btnBack = document.getElementById('btnBack');
  if (btnBack) {
    btnBack.addEventListener('click', openExitConfirmModal);
  }
});

// ---- LOAD EXISTING GRADING ERRORS FROM API ----
async function loadExistingGradingErrors() {
  const idSession = state.gradingSessionId;
  if (!idSession) return;

  // Map gradingMode sang dạng API cần (PRACTICE / OFFICIAL)
  const gradingMode = state.gradingMode === 'official' ? 'OFFICIAL' : 'PRACTICE';

  try {
    const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.GRADING_ERROR_DETAIL)
      ? API_CONFIG.ENDPOINTS.GRADING_ERROR_DETAIL(idSession, gradingMode)
      : `http://103.75.182.246:8080/public/grading-error/${encodeURIComponent(idSession)}?gradingMode=${gradingMode}`;

    const response = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!response.ok) return;

    const json = await response.json().catch(() => null);
    const errors = Array.isArray(json?.data) ? json.data : [];
    if (errors.length === 0) return;

    // Nhóm các lỗi theo frameTimeSeconds để mỗi frame là một hàng trong lịch sử
    const frameMap = new Map();
    errors.forEach(err => {
      const key = String(err.frameTimeSeconds ?? 0);
      if (!frameMap.has(key)) {
        frameMap.set(key, {
          frameTs: Number(err.frameTimeSeconds) || 0,
          imageUrl: err.frameImageUrl || null,
          errors: [],
          total: 0,
        });
      }
      const frame = frameMap.get(key);
      frame.errors.push({
        id: err.id,
        name: err.errorName,
        score: -Math.abs(Number(err.deduction) || 0),
        note: err.errorDescription || '',
      });
      frame.total -= Math.abs(Number(err.deduction) || 0);
    });

    frameMap.forEach(frame => {
      state.history.push({
        id: state.nextHistoryId++,
        frameTs: frame.frameTs,
        errors: frame.errors,
        total: frame.total,
        video: 1,
        imageUrl: frame.imageUrl,
      });
    });

    renderHistoryTable();
  } catch (err) {
    console.warn('[loadExistingGradingErrors] Không thể tải lỗi từ API:', err);
  }
}

// ---- TIMER / PLAYBACK ----
function _getVideoEl() {
  return document.getElementById('main-video-player');
}

function togglePlay() {
  const vid = _getVideoEl();
  state.isPlaying = !state.isPlaying;
  const btn = document.getElementById('play-btn');
  if (state.isPlaying) {
    btn.innerHTML = '&#9646;&#9646;';
    if (vid) {
      vid.play();
      vid.addEventListener('ended', () => {
        state.isPlaying = false;
        btn.innerHTML = '&#9654;';
      }, { once: true });
    } else {
      state.timerInterval = setInterval(() => {
        state.currentTime++;
        if (state.currentTime >= state.duration) {
          state.currentTime = state.duration;
          state.isPlaying = false;
          clearInterval(state.timerInterval);
          btn.innerHTML = '&#9654;';
        }
        updateTimeDisplay();
        updateProgressBar();
      }, 1000);
    }
  } else {
    btn.innerHTML = '&#9654;';
    if (vid) {
      vid.pause();
    } else {
      clearInterval(state.timerInterval);
    }
  }
}

function seek(seconds) {
  const vid = _getVideoEl();
  state.currentTime = Math.max(0, Math.min(state.duration, state.currentTime + seconds));
  if (vid) vid.currentTime = state.currentTime;
  updateTimeDisplay();
  updateProgressBar();
}

// Tua video đến đúng thời điểm của một frame trong lịch sử
function seekToTime(frameTs, videoIndex) {
  // Chuyển sang đúng video nếu khác video hiện tại
  if (videoIndex && videoIndex !== state.currentVideo) {
    switchVideo(videoIndex);
  }
  const vid = _getVideoEl();
  state.currentTime = frameTs;
  if (vid) vid.currentTime = frameTs;
  updateTimeDisplay();
  updateProgressBar();
  showToast('Đã tua đến ' + formatTime(frameTs));
}

function resetVideo() {
  const vid = _getVideoEl();
  state.currentTime = 0;
  if (vid) vid.currentTime = 0;
  if (state.isPlaying) togglePlay();
  updateTimeDisplay();
  updateProgressBar();
}

function seekByClick(e) {
  const bar = document.getElementById('prog-bar');
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  state.currentTime = Math.round(ratio * state.duration);
  const vid = _getVideoEl();
  if (vid) vid.currentTime = state.currentTime;
  updateTimeDisplay();
  updateProgressBar();
}

function setupProgressBarDrag() {
  const progBar = document.getElementById('prog-bar');
  let isDragging = false;

  function updateProgress(e) {
    const rect = progBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.currentTime = Math.round(ratio * state.duration);
    const vid = _getVideoEl();
    if (vid) vid.currentTime = state.currentTime;
    updateTimeDisplay();
    updateProgressBar();
  }

  progBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateProgress(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      updateProgress(e);
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function switchVideo(n) {
  state.currentVideo = n;
  state.currentTime = 0;
  if (state.isPlaying) togglePlay();
  document.getElementById('vid-index').textContent = String(n).padStart(2, '0');
  if (state.videoUrls.length >= n) {
    loadVideoPlayer(n);
  }
  updateTimeDisplay();
  updateProgressBar();
  updateThumbActive();
  showToast('Đã chuyển sang Video 0' + n);
}

function updateTimeDisplay() {
  const ts = formatTime(state.currentTime);
  document.getElementById('current-time').textContent = ts;
  document.getElementById('footer-time').textContent = ts;
}

function updateProgressBar() {
  const pct = (state.currentTime / state.duration) * 100;
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-dot').style.left = pct + '%';
}

function updateThumbActive() {
  document.querySelectorAll('.thumbs .thumb-img').forEach((el, idx) => {
    el.classList.toggle('active', state.currentVideo === idx + 1);
  });
}

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return m + ':' + s;
}

// ---- CAPTURE FRAME ----
async function captureFrame() {
  if (!ensureGradingAvailable('chụp lỗi')) return;

  state.capturedFrameTime = state.currentTime;
  state.assignedErrors = [];
  state.capturedFrameImageUrl = null;
  const ts = formatTime(state.capturedFrameTime);

  // badges trong video area
  const fb = document.getElementById('frame-badge');
  fb.style.display = 'block';
  document.getElementById('frame-time').textContent = ts;

  // Ẩn err tags mặc định khi chụp mới
  document.getElementById('err-tag-r').style.display = 'none';
  document.getElementById('err-tag-a').style.display = 'none';

  // Frame preview bên phải
  const overlay = document.getElementById('frame-badge-overlay');
  overlay.style.display = 'block';
  document.getElementById('overlay-frame-time').textContent = ts;

  // Reset danh sách lỗi đã gán
  document.getElementById('error-search').value = '';
  renderAssignedErrors();
  renderErrorTypeList();

  showToast('Đã chụp frame tại ' + ts);

  // Gọi API chụp khung hình bằng chứng
  try {
    const vid = document.getElementById('main-video-player');
    if (!vid || vid.readyState < 2) {
      console.warn('[captureFrame] Video chưa sẵn sàng (readyState=' + (vid?.readyState ?? 'N/A') + ')');
      return;
    }
    if (!vid.videoWidth || !vid.videoHeight) {
      console.warn('[captureFrame] videoWidth/videoHeight = 0, video chưa load xong.');
      return;
    }

    // Chụp khung hình hiện tại vào canvas
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    } catch (secErr) {
      console.error('[captureFrame] Canvas bị tainted (CORS) – không thể drawImage:', secErr);
      showToast('Không thể chụp khung hình: lỗi CORS video. Liên hệ quản trị.', true);
      return;
    }

    // Chuyển canvas → Blob → File
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      console.error('[captureFrame] toBlob() trả về null – canvas có thể bị tainted.');
      showToast('Không thể xuất ảnh từ video. Kiểm tra CORS.', true);
      return;
    }
    const studentName = (state.currentStudent?.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const fileName = `frame_${studentName}_${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    console.log('[captureFrame] Blob size:', blob.size, 'File name:', fileName);

    // Lấy submissionId
    const submissionId = state.submissionId
      || JSON.parse(sessionStorage.getItem('gradingSession') || '{}')?.studentSubmissionResponse?.id
      || '';

    console.log('[captureFrame] submissionId:', submissionId, '| studentName:', state.currentStudent?.name || '(none)');

    const formData = new FormData();
    const removeDiacritics = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    formData.append('file', file);
    formData.append('studentName', removeDiacritics(state.currentStudent?.name || ''));
    formData.append('submissionId', String(submissionId));

    const apiUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.CAPTURE_ERROR_FRAME)
      ? API_CONFIG.ENDPOINTS.CAPTURE_ERROR_FRAME
      : 'http://103.75.182.246:8080/public/capture-error-frame';

    // Hiển thị thanh loading
    const preview = document.getElementById('frame-preview');
    let loadingBar = null;
    if (preview) {
      loadingBar = document.createElement('div');
      loadingBar.className = 'frame-upload-loading';
      preview.appendChild(loadingBar);
    }

    console.log('[captureFrame] POST →', apiUrl);
    let resp, json;
    try {
      resp = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      json = await resp.json().catch(() => null);
    } finally {
      // Ẩn thanh loading dù thành công hay lỗi
      if (loadingBar && loadingBar.parentNode) loadingBar.parentNode.removeChild(loadingBar);
    }
    console.log('[captureFrame] API response', resp.status, json);

    if ((resp.ok || resp.status === 201) && json?.data?.imageUrl) {
      state.capturedFrameImageUrl = json.data.imageUrl;
      // Hiển thị ảnh bằng chứng trong panel bên phải
      if (preview) {
        preview.innerHTML =
          '<a href="' + json.data.imageUrl + '" target="_blank" rel="noopener">' +
          '<img src="' + json.data.imageUrl + '" alt="Frame t=' + ts + '" style="width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;"/>' +
          '</a>' +
          '<div class="frame-badge-overlay" id="frame-badge-overlay" style="display:block">' +
          'Frame t=<span id="overlay-frame-time">' + ts + '</span>' +
          '</div>';
      }
      showToast('Đã lưu ảnh bằng chứng khung hình!');
    } else {
      console.warn('[captureFrame] API trả về lỗi:', json?.message || `HTTP ${resp.status}`);
    }
  } catch (err) {
    console.warn('[captureFrame] Không thể gọi API capture-error-frame:', err);
  }
}

// ---- ERROR TYPE LIST ----
function renderErrorTypeList() {
  const container = document.getElementById('error-type-list');
  container.innerHTML = '';
  state.errorTypes.forEach(et => {
    const div = document.createElement('div');
    div.className = 'drop-item';
    div.dataset.id = et.id;
    div.innerHTML =
      '<span>' + et.name + '</span>' +
      '<span class="drop-score">(' + et.score.toFixed(1) + ')</span>';
    div.addEventListener('click', () => assignError(et.id));
    container.appendChild(div);
  });
}

// ---- FILTER ERRORS ----
function filterErrors() {
  const searchInput = document.getElementById('error-search');
  const searchTerm = searchInput.value.toLowerCase();
  const errorItems = document.querySelectorAll('.drop-item');

  errorItems.forEach(item => {
    const errorName = item.querySelector('span').textContent.toLowerCase();
    if (errorName.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}


// ---- ASSIGN ERROR ----
function assignError(typeId) {
  if (!ensureGradingAvailable('gán lỗi')) return;

  if (state.capturedFrameTime === null) {
    showToast('Vui lòng chụp frame trước khi gán lỗi!', true);
    return;
  }
  const et = state.errorTypes.find(e => e.id === typeId);
  if (!et) return;

  // Không gán trùng
  if (state.assignedErrors.find(e => e.id === typeId)) {
    showToast('Lỗi này đã được gán rồi!', true);
    return;
  }

  state.assignedErrors.push({ id: typeId, name: et.name, score: et.score, note: et.note || '' });

  // Clear search input
  document.getElementById('error-search').value = '';

  // Highlight drop item
  document.querySelectorAll('.drop-item').forEach(el => {
    el.classList.toggle('sel', state.assignedErrors.some(e => e.id == el.dataset.id));
  });

  // Hiển thị tag lỗi trên video
  updateVideoErrorTags();
  renderAssignedErrors();
}

function removeAssignedError(typeId) {
  if (!ensureGradingAvailable('xóa lỗi đã gán')) return;

  state.assignedErrors = state.assignedErrors.filter(e => e.id !== typeId);
  document.querySelectorAll('.drop-item').forEach(el => {
    el.classList.toggle('sel', state.assignedErrors.some(e => e.id == el.dataset.id));
  });
  updateVideoErrorTags();
  renderAssignedErrors();
}

function renderAssignedErrors() {
  const container = document.getElementById('assigned-list');
  container.innerHTML = '';

  // Tính tổng trước  
  let total = 0;

  if (state.assignedErrors.length === 0) {
    container.innerHTML = '<div class="no-error-msg">Chưa có lỗi nào được gán.</div>';
    total = 0;
  } else {
    state.assignedErrors.forEach((e, i) => {
      const div = document.createElement('div');
      div.className = 'err-row';
      div.innerHTML =
        '<span>' +
        '<span class="err-num">' + (i + 1) + '.</span> ' +
        '<span class="err-name-txt">' + e.name + '</span>' +
        '<span class="err-score-val">(' + e.score.toFixed(1) + ')</span>' +
        (e.note ? '<div class="err-note-txt">' + e.note + '</div>' : '') +
        '</span>' +
        '<button class="err-del" data-id="' + e.id + '">[Xóa]</button>';
      div.querySelector('.err-del').addEventListener('click', () => removeAssignedError(e.id));
      container.appendChild(div);
      total += e.score;  // Cộng dồn điểm
    });
  }

  // Cập nhật tổng
  document.getElementById('frame-total').textContent = total.toFixed(1);
}

function updateVideoErrorTags() {
  const tags = state.assignedErrors;
  const tagR = document.getElementById('err-tag-r');
  const tagA = document.getElementById('err-tag-a');

  function renderVideoTag(tagEl, label, errorId) {
    tagEl.style.display = 'inline-flex';
    tagEl.innerHTML =
      '<span class="err-tag-text">' + label + '</span>' +
      '<button type="button" class="err-tag-remove" aria-label="Xóa lỗi" onclick="removeAssignedError(' + errorId + '); event.stopPropagation();">&times;</button>';
  }

  if (tags.length >= 1) {
    renderVideoTag(tagR, 'LỖI: ' + tags[0].name.toUpperCase(), tags[0].id);
  } else {
    tagR.style.display = 'none';
    tagR.innerHTML = '';
  }

  if (tags.length >= 2) {
    renderVideoTag(tagA, tags[1].name.toUpperCase(), tags[1].id);
  } else {
    tagA.style.display = 'none';
    tagA.innerHTML = '';
  }
}

// ---- FINISH GRADING ----
async function finishGrading() {
  if (!ensureGradingAvailable('lưu frame chấm')) return;

  if (state.capturedFrameTime === null) {
    showToast('Chưa có frame nào được chụp!', true);
    return;
  }
  if (state.assignedErrors.length === 0) {
    showToast('Vui lòng gán ít nhất một lỗi!', true);
    return;
  }

  // Gọi API thêm lỗi vào phiên chấm cho từng lỗi đã gán
  const idSession = state.gradingSessionId;
  if (idSession) {
    const apiUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.GRADING_SESSION_ADD_ERROR)
      ? API_CONFIG.ENDPOINTS.GRADING_SESSION_ADD_ERROR(idSession)
      : `http://103.75.182.246:8080/teacher/grading-session/${encodeURIComponent(idSession)}/add-error`;

    for (const e of state.assignedErrors) {
      try {
        const body = {
          errorTypeId: e.id,
          deduction: Math.abs(e.score),
          frameTime: state.capturedFrameTime,
          frameImageUrl: state.capturedFrameImageUrl || null,
          notes: e.note || '',
        };
        console.log('[finishGrading] POST add-error →', apiUrl, body);
        const resp = await fetch(apiUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await resp.json().catch(() => null);
        console.log('[finishGrading] add-error response', resp.status, json);
        if (!resp.ok && resp.status !== 201) {
          console.warn('[finishGrading] Lỗi khi thêm lỗi "' + e.name + '":', json?.message || `HTTP ${resp.status}`);
        }
      } catch (err) {
        console.warn('[finishGrading] Không thể gọi add-error cho "' + e.name + '":', err);
      }
    }
  } else {
    console.warn('[finishGrading] Không có gradingSessionId, bỏ qua gọi API add-error.');
  }

  const total = state.assignedErrors.reduce((sum, e) => sum + e.score, 0);
  const record = {
    id: state.nextHistoryId++,
    frameTs: state.capturedFrameTime,
    errors: [...state.assignedErrors],
    total: total,
    video: state.currentVideo,
    imageUrl: state.capturedFrameImageUrl || null,
  };
  state.history.push(record);
  renderHistoryTable();

  // Reset frame
  state.capturedFrameTime = null;
  state.assignedErrors = [];
  state.capturedFrameImageUrl = null;
  document.getElementById('frame-badge').style.display = 'none';
  document.getElementById('frame-badge-overlay') && (document.getElementById('frame-badge-overlay').style.display = 'none');
  document.getElementById('err-tag-r').style.display = 'none';
  document.getElementById('err-tag-a').style.display = 'none';
  // Khôi phục placeholder preview
  const preview = document.getElementById('frame-preview');
  if (preview) {
    preview.innerHTML =
      '<div class="frame-placeholder"><div class="frame-icon">&#9654;</div><span>Chưa chụp frame</span></div>' +
      '<div class="frame-badge-overlay" id="frame-badge-overlay" style="display:none">Frame t=<span id="overlay-frame-time">00:00</span></div>';
  }
  renderAssignedErrors();
  renderErrorTypeList();

  showToast('Đã lưu frame vào lịch sử chấm!');
}

// ---- SUBMIT EXAM SCORE ----
async function submitExamScore() {
  if (!ensureGradingAvailable('hoàn thành bài thi')) return;

  const totalDeductions = state.history.reduce((sum, rec) => sum + rec.total, 0);
  let finalScore = Math.max(0, state.defaultScore + totalDeductions);
  const submittedAt = new Date();

  // Gọi API tính điểm cuối cùng cho phiên chấm
  const idSession = state.gradingSessionId;
  const idSubmission = state.submissionId
    || JSON.parse(sessionStorage.getItem('gradingSession') || '{}')?.studentSubmissionResponse?.id
    || '';
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const idTeacher = currentUser?.studentId || currentUser?.id || currentUser?.username || '';
  const gradingModeApi = state.gradingMode === 'official' ? 'OFFICIAL' : 'PRACTICE';

  const btnFinish = document.querySelector('.btn-finish');
  if (btnFinish) btnFinish.disabled = true;

  if (idSubmission && idTeacher) {
    try {
      const result = await ExamsService.finalizeGradingSession(
        String(idSubmission),
        idTeacher,
        gradingModeApi
      );
      console.log('[submitExamScore] finalizeGradingSession →', result);
      if (result?.finalScore != null) {
        finalScore = Number(result.finalScore);
      }
    } catch (err) {
      console.warn('[submitExamScore] Không thể tính điểm từ API, dùng điểm tính cục bộ:', err);
    }
  } else {
    console.warn('[submitExamScore] Thiếu idSubmission hoặc idTeacher, bỏ qua API tính điểm.');
  }

  if (btnFinish) btnFinish.disabled = false;

  // Chuẩn bị dữ liệu để lưu
  const examData = {
    timestamp: submittedAt.toLocaleString('vi-VN'),
    defaultScore: state.defaultScore,
    totalDeductions: totalDeductions,
    finalScore: finalScore,
    totalFrames: state.history.length,
    history: state.history,
  };

  // Lưu vào sessionStorage
  sessionStorage.setItem('examGradingResult', JSON.stringify(examData));

  // Lưu điểm theo sinh viên + bài thi + chế độ
  const classId = JSON.parse(sessionStorage.getItem('selectedClass'))?.classId;
  const className = JSON.parse(sessionStorage.getItem('selectedClass'))?.className || '';
  const studentCode = state.currentStudent?.code || state.currentStudent?.studentId;
  const studentName = state.currentStudent ? state.currentStudent.name : 'Học sinh';
  const examId = state.currentStudent?.examId || JSON.parse(sessionStorage.getItem('gradingExam'))?.id;
  const examName = state.currentStudent && state.currentStudent.subject
    ? state.currentStudent.subject
    : 'Động tác Quốc phòng';
  const modeSuffix = state.gradingMode === 'official' ? '_official' : '_practice';
  if (classId && studentCode && examId) {
    const scores = JSON.parse(sessionStorage.getItem('examScores') || '{}');
    const key = `${classId}_${studentCode}_${examId}${modeSuffix}`;
    scores[key] = finalScore;
    sessionStorage.setItem('examScores', JSON.stringify(scores));

    const user = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
    const videoStorageKey = `examVideos_${classId}_${studentCode}_${examId}`;
    const gradingHistory = JSON.parse(localStorage.getItem('gradingHistoryRecords') || '[]');
    gradingHistory.unshift({
      id: `grading-${submittedAt.getTime()}`,
      teacherId: user?.studentId || user?.name || 'teacher',
      teacherName: user?.name || user?.studentId || 'Giảng viên',
      classId,
      className,
      studentCode,
      studentName,
      examId,
      examName,
      gradingMode: state.gradingMode,
      gradingSessionId: state.gradingSessionId ?? null,
      timestamp: submittedAt.toLocaleString('vi-VN'),
      timestampIso: submittedAt.toISOString(),
      finalScore,
      totalDeductions,
      totalFrames: state.history.length,
      history: state.history.map(record => ({
        id: record.id,
        frameTs: record.frameTs,
        video: record.video,
        total: record.total,
        errors: record.errors.map(error => ({
          id: error.id,
          name: error.name,
          score: error.score,
          note: error.note || ''
        }))
      })),
      videoStorageKey
    });
    localStorage.setItem('gradingHistoryRecords', JSON.stringify(gradingHistory));
  }

  // Hiển thị popup thành công
  document.getElementById('success-student').textContent = studentName;
  document.getElementById('success-exam').textContent = examName;
  document.getElementById('success-score').textContent = finalScore.toFixed(1) + '/10';
  // Ẩn các hàng bảng điểm trước khi gọi API
  ['success-practice-row', 'success-official-row', 'success-updated-row'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  document.getElementById('success-modal').style.display = 'flex';

  // Gọi API bảng điểm để hiển thị thêm thông tin bài nộp
  if (idSubmission) {
    try {
      const gradeBoardData = await ExamsService.getGradeBoard(idSubmission);
      if (Array.isArray(gradeBoardData) && gradeBoardData.length > 0) {
        const entry = gradeBoardData[0];
        if (entry.practiceScore != null) {
          document.getElementById('success-practice-score').textContent =
            `${Number(entry.practiceScore).toFixed(1)}/10 (${entry.practiceStatus || ''})`;
          document.getElementById('success-practice-row').style.display = '';
        }
        if (entry.officialScore != null) {
          document.getElementById('success-official-score').textContent =
            `${Number(entry.officialScore).toFixed(1)}/10 (${entry.officialStatus || ''})`;
          document.getElementById('success-official-row').style.display = '';
        }
        if (entry.lastUpdated) {
          document.getElementById('success-last-updated').textContent =
            new Date(entry.lastUpdated).toLocaleString('vi-VN');
          document.getElementById('success-updated-row').style.display = '';
        }
      }
    } catch (err) {
      console.warn('[submitExamScore] Không thể lấy bảng điểm:', err);
    }
  }
}

function closeSuccessModal(e) {
  if (e && e.target.id !== 'success-modal') return;
  document.getElementById('success-modal').style.display = 'none';
  // Quay về trang lớp đang chấm
  window.location.href = '/pages/class-detail.html';
}

function getBackNavigationTarget() {
  const selectedClass = JSON.parse(sessionStorage.getItem('selectedClass') || 'null');
  if (selectedClass && selectedClass.classId) {
    return '/pages/class-detail.html';
  }
  return '/pages/select-student.html';
}

function openExitConfirmModal() {
  document.getElementById('exit-confirm-modal').style.display = 'flex';
}

function closeExitConfirmModal(e) {
  if (e && e.target.id !== 'exit-confirm-modal') return;
  document.getElementById('exit-confirm-modal').style.display = 'none';
}

function confirmExitGrading() {
  closeExitConfirmModal();
  window.location.href = getBackNavigationTarget();
}


// ---- HISTORY TABLE ----
function renderHistoryTable() {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';

  if (state.history.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--txt3);padding:20px">Chưa có frame nào được chấm.</td></tr>';
    updateExamTotal();
    return;
  }

  state.history.forEach((rec, idx) => {
    const errStr = rec.errors.map(e => e.name + (e.note ? ' - ' + e.note : '') + ' (' + e.score.toFixed(1) + ')').join(', ');
    const imgCell = rec.imageUrl
      ? '<a href="' + rec.imageUrl + '" target="_blank" rel="noopener" title="Xem ảnh bằng chứng t=' + formatTime(rec.frameTs) + '">' +
      '<img src="' + rec.imageUrl + '" alt="t=' + formatTime(rec.frameTs) + '" style="width:48px;height:36px;object-fit:cover;border-radius:4px;border:1px solid var(--border);display:block;"/>' +
      '</a>'
      : '<div class="thumb-cell">V0' + rec.video + '</div>';
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="color:var(--txt3)">' + (idx + 1) + '</td>' +
      '<td>' + imgCell + '</td>' +
      '<td>' + formatTime(rec.frameTs) + '</td>' +
      '<td style="word-break:break-word">' + errStr + '</td>' +
      '<td class="score-neg">' + rec.total.toFixed(1) + '</td>' +
      '<td class="history-actions">' +
      '<button type="button" class="adel" data-id="' + rec.id + '" aria-label="Xóa bản ghi">&times;</button>' +
      '</td>';
    tr.querySelector('.adel').addEventListener('click', () => deleteRecord(rec.id));

    // Click vào hàng → tua video đến thời điểm frame
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', (e) => {
      // Không kích hoạt khi click vào nút xóa hoặc link ảnh
      if (e.target.closest('.adel') || e.target.closest('a')) return;
      seekToTime(rec.frameTs, rec.video);
    });

    tbody.appendChild(tr);
  });

  updateExamTotal();
}

function updateExamTotal() {
  const totalDeductions = state.history.reduce((sum, rec) => sum + rec.total, 0);
  const finalScore = Math.max(0, state.defaultScore + totalDeductions);  // Không dưới 0
  document.getElementById('exam-total-score').textContent = finalScore.toFixed(1);
}

function deleteRecord(id) {
  if (!ensureGradingAvailable('xóa bản ghi chấm')) return;

  state.history = state.history.filter(r => r.id !== id);
  renderHistoryTable();
  showToast('Đã xóa bản ghi.');
}

function editRecord(id) {
  const rec = state.history.find(r => r.id === id);
  if (!rec) return;
  // Khôi phục về panel để sửa
  state.capturedFrameTime = rec.frameTs;
  state.assignedErrors = [...rec.errors];
  state.history = state.history.filter(r => r.id !== id);

  const ts = formatTime(rec.frameTs);
  document.getElementById('frame-badge').style.display = 'block';
  document.getElementById('frame-time').textContent = ts;
  document.getElementById('frame-badge-overlay').style.display = 'block';
  document.getElementById('overlay-frame-time').textContent = ts;

  renderAssignedErrors();
  renderErrorTypeList();
  renderHistoryTable();
  updateVideoErrorTags();
  showToast('Đang chỉnh sửa frame tại ' + ts);
}

// ---- ADD NEW ERROR TYPE ----

// ---- UPLOAD STUDENT VIDEO ----
const _uploadVideoState = {
  file1: null, file2: null,
  uploadedUrl1: null, uploadedUrl2: null,
  uploadedSize1: 0, uploadedSize2: 0,
};

function openUploadVideoModal() {
  Object.assign(_uploadVideoState, { file1: null, file2: null, uploadedUrl1: null, uploadedUrl2: null, uploadedSize1: 0, uploadedSize2: 0 });
  ['1', '2'].forEach(n => {
    const fn = document.getElementById('file-name-' + n);
    if (fn) { fn.style.display = 'none'; fn.textContent = ''; }
    const dz = document.getElementById('drop-zone-' + n);
    if (dz) dz.classList.remove('has-file');
    const inp = document.getElementById('video-file-' + n);
    if (inp) inp.value = '';
  });
  const wrap = document.getElementById('upload-progress-wrap');
  if (wrap) wrap.style.display = 'none';
  _switchUploadPhase(1);
  document.getElementById('upload-video-modal').style.display = 'flex';
  setupDropZones();
}

function closeUploadVideoModal(e) {
  if (e && e.target !== document.getElementById('upload-video-modal')) return;
  document.getElementById('upload-video-modal').style.display = 'none';
}

function _switchUploadPhase(phase) {
  document.getElementById('upload-phase-1').style.display = phase === 1 ? '' : 'none';
  document.getElementById('upload-phase-2').style.display = phase === 2 ? '' : 'none';
  document.getElementById('btn-upload-confirm').style.display = phase === 1 ? '' : 'none';
  document.getElementById('btn-upload-submit').style.display = phase === 2 ? '' : 'none';
}

function setupDropZones() {
  [1, 2].forEach(n => {
    const dz = document.getElementById('drop-zone-' + n);
    if (!dz || dz._dropSetup) return;
    dz._dropSetup = true;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) applyVideoFile(n, file);
    });
  });
}

function handleVideoFileSelect(n, input) {
  const file = input.files?.[0];
  if (file) applyVideoFile(n, file);
}

function applyVideoFile(n, file) {
  if (!file.type.startsWith('video/')) {
    showToast('Vui lòng chọn tệp video hợp lệ (MP4, AVI, MOV, MKV…)', true);
    return;
  }
  if (file.size > 500 * 1024 * 1024) {
    showToast('Tệp video vượt quá giới hạn 500MB.', true);
    return;
  }
  if (n === 1) _uploadVideoState.file1 = file;
  else _uploadVideoState.file2 = file;

  const fn = document.getElementById('file-name-' + n);
  if (fn) {
    fn.textContent = '✓ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)';
    fn.style.display = 'block';
  }
  document.getElementById('drop-zone-' + n)?.classList.add('has-file');
}

function setUploadBtnsDisabled(disabled) {
  ['btn-upload-confirm', 'btn-upload-cancel', 'btn-upload-submit'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

// Bước 1: Upload từng file lên Cloudinary qua /public/upload-student-exam
async function doUploadToCloudinary() {
  if (!_uploadVideoState.file1 && !_uploadVideoState.file2) {
    showToast('Vui lòng chọn ít nhất một tệp video.', true);
    return;
  }

  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressLabel = document.getElementById('upload-progress-label');
  if (progressWrap) progressWrap.style.display = 'block';
  if (progressBar) progressBar.style.width = '0%';
  setUploadBtnsDisabled(true);

  const apiUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.UPLOAD_STUDENT_EXAM_VIDEO)
    ? API_CONFIG.ENDPOINTS.UPLOAD_STUDENT_EXAM_VIDEO
    : 'http://103.75.182.246:8080/public/upload-student-exam';

  const studentName = state.currentStudent?.name || 'unknown';
  const examTitle = state.currentStudent?.subject || 'exam';

  try {
    // Upload video 1
    if (_uploadVideoState.file1) {
      if (progressLabel) progressLabel.textContent = 'Đang tải Video 01 lên…';
      const res1 = await _uploadOneVideo(apiUrl, _uploadVideoState.file1, studentName, examTitle, progressBar, 0, 50);
      _uploadVideoState.uploadedUrl1 = res1.url;
      _uploadVideoState.uploadedSize1 = _uploadVideoState.file1.size;
    }

    // Upload video 2
    if (_uploadVideoState.file2) {
      if (progressLabel) progressLabel.textContent = 'Đang tải Video 02 lên…';
      const res2 = await _uploadOneVideo(apiUrl, _uploadVideoState.file2, studentName, examTitle, progressBar, 50, 100);
      _uploadVideoState.uploadedUrl2 = res2.url;
      _uploadVideoState.uploadedSize2 = _uploadVideoState.file2.size;
    }

    if (progressBar) progressBar.style.width = '100%';
    if (progressLabel) progressLabel.textContent = 'Tải lên hoàn thành!';

    // Hiển thị phase 2 xác nhận
    _renderConfirmList();
    _switchUploadPhase(2);
    setUploadBtnsDisabled(false);
  } catch (err) {
    console.error('[doUploadToCloudinary]', err);
    if (progressLabel) progressLabel.textContent = 'Tải lên thất bại!';
    showToast(err.message || 'Tải video thất bại. Vui lòng thử lại.', true);
    setUploadBtnsDisabled(false);
  }
}

function _uploadOneVideo(apiUrl, file, studentName, examTitle, progressBar, startPct, endPct) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('studentName', studentName);
    formData.append('examTitle', examTitle);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl, true);
    xhr.withCredentials = true;

    const csrfMatch = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
    if (csrfMatch) xhr.setRequestHeader('X-XSRF-TOKEN', decodeURIComponent(csrfMatch.split('=')[1]));
    const token = sessionStorage.getItem('accessToken');
    if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable && progressBar) {
        const pct = startPct + Math.round((e.loaded / e.total) * (endPct - startPct));
        progressBar.style.width = pct + '%';
      }
    });

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if ((xhr.status === 200 || xhr.status === 201) && json?.data) {
          // CloudinaryResponse: { url, secureUrl, publicId, ... }
          const d = json.data;
          resolve({ url: d.url || d.secureUrl || d.videoUrl || d });
        } else {
          reject(new Error(json?.message || 'Upload thất bại: HTTP ' + xhr.status));
        }
      } catch {
        reject(new Error('Không thể đọc phản hồi từ server.'));
      }
    };
    xhr.onerror = () => reject(new Error('Lỗi kết nối khi tải video lên.'));
    xhr.send(formData);
  });
}

function _renderConfirmList() {
  const list = document.getElementById('upload-confirm-list');
  if (!list) return;
  list.innerHTML = '';
  if (_uploadVideoState.uploadedUrl1) {
    list.innerHTML += `<div class="upload-confirm-item">
      <span class="upload-confirm-badge">Video 01</span>
      <a href="${_uploadVideoState.uploadedUrl1}" target="_blank" rel="noopener" class="upload-confirm-url">${_uploadVideoState.uploadedUrl1}</a>
      <span class="upload-confirm-size">${(_uploadVideoState.uploadedSize1 / 1024 / 1024).toFixed(1)} MB</span>
    </div>`;
  }
  if (_uploadVideoState.uploadedUrl2) {
    list.innerHTML += `<div class="upload-confirm-item">
      <span class="upload-confirm-badge">Video 02</span>
      <a href="${_uploadVideoState.uploadedUrl2}" target="_blank" rel="noopener" class="upload-confirm-url">${_uploadVideoState.uploadedUrl2}</a>
      <span class="upload-confirm-size">${(_uploadVideoState.uploadedSize2 / 1024 / 1024).toFixed(1)} MB</span>
    </div>`;
  }
}

// Bước 2: Xác nhận nộp bài — gọi teacher/submission/{submissionId}/upload-video với JSON
async function doConfirmSubmission() {
  setUploadBtnsDisabled(true);

  // Lấy classExamId và studentCode để backend tự tìm hoặc tạo submission
  const pending = JSON.parse(sessionStorage.getItem('pendingGradingSession') || '{}');
  const gradingExam = JSON.parse(sessionStorage.getItem('gradingExam') || '{}');
  const classExamId = pending.classExamId ?? gradingExam.classExamId ?? null;
  const studentCode = state.currentStudent?.code ?? pending.studentCode ?? null;

  if (!classExamId || !studentCode) {
    showToast('Không xác định được bài thi hoặc sinh viên. Vui lòng thử lại.', true);
    setUploadBtnsDisabled(false);
    return;
  }

  const body = {
    idStudent: studentCode,
    idClassExam: classExamId,   // khớp với DTO: int idClassExam
    videoUrl1: _uploadVideoState.uploadedUrl1 || null,
    fileSizeBytes1: _uploadVideoState.uploadedSize1 || 0,
    videoUrl2: _uploadVideoState.uploadedUrl2 || null,
    fileSizeBytes2: _uploadVideoState.uploadedSize2 || 0,
    status: 'SUBMITTED',
  };

  const apiUrl = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.TEACHER_UPLOAD_SUBMISSION_VIDEO)
    ? API_CONFIG.ENDPOINTS.TEACHER_UPLOAD_SUBMISSION_VIDEO
    : 'http://103.75.182.246:8080/teacher/submission/upload-video';

  let _uploadExtractProgressInterval = null;

  function _startUploadExtractProgress() {
    _stopUploadExtractProgress();
    const loadingDiv = document.getElementById('upload-extract-loading');
    if (loadingDiv) loadingDiv.style.display = 'flex';

    const bar = document.getElementById('upload-extract-progress-bar');
    const pctText = document.getElementById('upload-extract-progress-pct');
    if (!bar || !pctText) return;

    let pct = 0;
    bar.style.width = '0%';
    pctText.textContent = '0%';

    _uploadExtractProgressInterval = setInterval(() => {
      if (pct < 50) pct += 2;
      else if (pct < 80) pct += 1;
      else if (pct < 95) pct += 0.2;
      if (pct > 99) pct = 99;

      bar.style.width = pct + '%';
      pctText.textContent = Math.floor(pct) + '%';
    }, 300);
  }

  function _stopUploadExtractProgress() {
    if (_uploadExtractProgressInterval) {
      clearInterval(_uploadExtractProgressInterval);
      _uploadExtractProgressInterval = null;
    }
    const loadingDiv = document.getElementById('upload-extract-loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
  }

  try {
    let studentDataStr = null;
    const aiVideoUrl = body.videoUrl1 || body.videoUrl2;
    if (aiVideoUrl) {
      showToast('Đang trích xuất dữ liệu khung xương, vui lòng đợi...');
      _startUploadExtractProgress();
      try {
        const aiRes = await fetch('http://103.75.182.246/runpod-ai/api/ai/extract-student', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ videoUrl: aiVideoUrl, sample_rate: 1 })
        });
        const aiJson = await aiRes.json();
        if (aiJson?.status === 'success' && aiJson?.studentData) {
          studentDataStr = JSON.stringify(aiJson.studentData);
          // Lưu vào state để dùng cho compare-pose
          state.studentPoseData = aiJson.studentData;
          // Đổi màu nút compare thành xanh lá (đã có dữ liệu)
          const btnCP = document.getElementById('btnComparePose');
          if (btnCP) btnCP.classList.add('has-data');
          showToast('Trích xuất dữ liệu tư thế thành công! Có thể so sánh ngay.');
        } else {
          showToast('Trích xuất dữ liệu không thành công.');
        }
      } catch (aiErr) {
        console.warn('Lỗi trích xuất khung xương:', aiErr);
        showToast('Lỗi khi trích xuất dữ liệu khung xương.');
      } finally {
        _stopUploadExtractProgress();
      }
    }
    body.studentData = studentDataStr;

    const headers = { 'Content-Type': 'application/json' };
    const csrfMatch = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('XSRF-TOKEN='));
    if (csrfMatch) headers['X-XSRF-TOKEN'] = decodeURIComponent(csrfMatch.split('=')[1]);
    const token = sessionStorage.getItem('accessToken');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);

    if (res.ok && json) {
      const d = json?.data ?? json;
      // Lưu submissionId mới để dùng cho grading session
      const newSubmissionId = d?.id ?? d?.submissionId ?? null;
      if (newSubmissionId) state.submissionId = String(newSubmissionId);

      const newUrls = [];
      if (_uploadVideoState.uploadedUrl1) newUrls.push(_uploadVideoState.uploadedUrl1);
      if (_uploadVideoState.uploadedUrl2) newUrls.push(_uploadVideoState.uploadedUrl2);
      if (newUrls.length > 0) {
        state.videoUrls = newUrls;
        state.totalVideos = newUrls.length;
        document.getElementById('vid-total').textContent = String(state.totalVideos).padStart(2, '0');
        renderThumbs(newUrls.length);
        loadVideoPlayer(1);
      }
      showToast('Đã nộp bài thi thành công!');
      document.getElementById('upload-video-modal').style.display = 'none';

      // Khởi tạo phiên chấm ngay sau khi nộp bài thành công
      if (newSubmissionId) {
        const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
        const idTeacher = currentUser?.id ?? currentUser?.userId ?? null;
        const rawMode = sessionStorage.getItem('gradingMode') || 'official';
        const gradingMode = rawMode.toUpperCase() === 'OFFICIAL' ? 'OFFICIAL' : 'PRACTICE';

        if (idTeacher) {
          try {
            const session = await ExamsService.startGradingSession(String(newSubmissionId), idTeacher, gradingMode);
            sessionStorage.setItem('gradingSession', JSON.stringify(session));
            state.gradingSessionId = session?.id ?? null;

            // Khôi phục dữ liệu chuẩn (standardData) vào state để Compare Pose hoạt động
            const sub = session?.studentSubmissionResponse;
            if (sub && sub.standardData) {
              try {
                state.standardPoseData = JSON.parse(sub.standardData);
              } catch (e) {
                console.warn('Lỗi parse standardData:', e);
              }
            }

            console.log('[doConfirmSubmission] Đã khởi tạo phiên chấm:', state.gradingSessionId);
          } catch (err) {
            console.warn('[doConfirmSubmission] Khởi tạo phiên chấm thất bại:', err);
          }
        }
      }
    } else {
      throw new Error(json?.message || 'Xác nhận nộp bài thất bại: HTTP ' + res.status);
    }
  } catch (err) {
    console.error('[doConfirmSubmission]', err);
    showToast(err.message || 'Xác nhận nộp bài thất bại. Vui lòng thử lại.', true);
    setUploadBtnsDisabled(false);
  } finally {
    _stopUploadExtractProgress();
  }
}
// ---- END UPLOAD STUDENT VIDEO ----

function openAddErrorModal() {
  if (!ensureGradingAvailable('thêm lỗi mới')) return;

  document.getElementById('modal-backdrop').style.display = 'flex';
  document.getElementById('new-error-name').value = '';
  document.getElementById('new-error-description').value = '';
  document.getElementById('new-error-severity').value = 'trung-binh';
  document.getElementById('new-error-deduction').value = '';
  document.getElementById('new-error-name').focus();
}

function closeAddErrorModal() {
  document.getElementById('modal-backdrop').style.display = 'none';
}

function closeModal(e) {
  if (e.target.id === 'modal-backdrop') closeAddErrorModal();
}

async function addNewErrorType() {
  const name = document.getElementById('new-error-name').value.trim();
  const description = document.getElementById('new-error-description').value.trim();
  const severity = document.getElementById('new-error-severity').value;
  const deduction = parseFloat(document.getElementById('new-error-deduction').value);

  if (!name || !description) {
    showToast('Vui lòng nhập đầy đủ tên lỗi và mô tả lỗi!', true);
    return;
  }
  if (isNaN(deduction) || deduction <= 0) {
    showToast('Điểm trừ phải là số dương (VD: 1.0)!', true);
    return;
  }

  const catalog = getSharedErrorCatalog();
  const duplicate = catalog.find(error => error.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    showToast('Tên lỗi đã tồn tại trong danh sách lỗi!', true);
    return;
  }

  const severityApiMap = { 'cao': 'HIGH', 'trung-binh': 'MEDIUM', 'thap': 'LOW' };
  const severityType = severityApiMap[severity] || 'MEDIUM';
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const idTeacher = currentUser?.studentId || currentUser?.id || currentUser?.username || '';

  let newId = Math.max(...catalog.map(e => e.id || 0), 0) + 1;

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
      newId = json.data.id;
    } else {
      console.warn('API thêm lỗi thất bại:', json?.message || `HTTP ${response.status}`);
    }
  } catch (err) {
    console.warn('Không thể kết nối API thêm lỗi, lưu local:', err);
  }

  catalog.unshift({
    id: newId,
    name,
    description,
    note: description,
    severity,
    deduction,
    icon: 'fas fa-exclamation-circle',
    students: []
  });
  saveSharedErrorCatalog(catalog);
  syncStateErrorTypesFromCatalog();
  renderErrorTypeList();
  closeAddErrorModal();
  showToast('Đã thêm loại lỗi: ' + name);
}

// ---- AI GRADING SUGGESTION ----
async function callAIGrading() {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const idTeacher = currentUser?.studentId || currentUser?.id || currentUser?.username || '';
  const videoUrl = state.videoUrls[state.currentVideo - 1] || state.videoUrls[0] || '';

  if (!idTeacher || !videoUrl) {
    showToast('Không đủ thông tin để gọi AI chấm điểm (thiếu giáo viên hoặc video).', true);
    return;
  }

  _showAIGradeModal({ loading: true });

  try {
    const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.AI_GRADE)
      ? API_CONFIG.ENDPOINTS.AI_GRADE(idTeacher, videoUrl)
      : `http://103.75.182.246:8080/teacher/grade?idTeacher=${encodeURIComponent(idTeacher)}&videoUrl=${encodeURIComponent(videoUrl)}`;

    const resp = await fetch(url, { method: 'POST', credentials: 'include' });
    let json = null;
    try {
      const text = await resp.text();
      json = JSON.parse(text);
      // Spring ResponseEntity<String> đôi khi double-serialize → parse thêm lần nữa
      if (typeof json === 'string') json = JSON.parse(json);
    } catch (_) { json = null; }

    if (!resp.ok || !json) {
      _showAIGradeModal({ error: 'Không thể lấy gợi ý từ AI. Mã lỗi: ' + resp.status });
      return;
    }

    _showAIGradeModal({ data: json });
  } catch (err) {
    _showAIGradeModal({ error: 'Lỗi kết nối: ' + err.message });
  }
}

function _showAIGradeModal({ loading = false, error = null, data = null } = {}) {
  const modal = document.getElementById('ai-grade-modal');
  const body = document.getElementById('ai-grade-modal-body');
  modal.style.display = 'flex';

  if (loading) {
    body.innerHTML = '<div class="ai-loading"><span class="ai-spin">⏳</span> Đang phân tích video bằng AI, vui lòng chờ...</div>';
    return;
  }

  if (error) {
    body.innerHTML = '<div class="ai-error-msg">⚠️ ' + error + '</div>';
    return;
  }

  const score = data?.suggestedScore ?? 'N/A';
  const errors = Array.isArray(data?.detectedErrors) ? data.detectedErrors : [];

  let html = '<div class="ai-score-row">Điểm gợi ý: <span class="ai-score-val">' + score + '</span> / 10</div>';

  if (errors.length === 0) {
    html += '<div class="ai-no-errors">✅ AI không phát hiện lỗi nào trong video.</div>';
  } else {
    html += '<div class="ai-errors-title">Phát hiện ' + errors.length + ' lỗi:</div><div class="ai-errors-list">';
    errors.forEach(function (e, i) {
      const errorName = state.errorTypes.find(function (et) { return et.id === e.errorType; })?.name || ('Lỗi #' + e.errorType);
      html +=
        '<div class="ai-error-item">' +
        '<div class="ai-error-header">' +
        '<span class="ai-err-num">' + (i + 1) + '</span>' +
        '<span class="ai-err-time">⏱ ' + (e.timestamp || '--:--') + '</span>' +
        '<span class="ai-err-type">' + errorName + '</span>' +
        '</div>' +
        '<div class="ai-err-desc">' + e.description + '</div>' +
        '</div>';
    });
    html += '</div>';
  }

  body.innerHTML = html;
}

function closeAIGradeModal(e) {
  if (e && e.target !== document.getElementById('ai-grade-modal')) return;
  document.getElementById('ai-grade-modal').style.display = 'none';
}

// ---- AI API ENDPOINTS ----
const AI_BASE_URL = 'http://103.75.182.246/runpod-ai';

// ---- COMPARE POSE ----

function openComparePoseModal() {
  document.getElementById('compare-pose-modal').style.display = 'flex';
  // Nếu đã có dữ liệu studentPoseData → hiển thị ready
  if (state.studentPoseData && state.standardPoseData) {
    _setCposeState('empty');
    const desc = document.querySelector('.cpose-empty-desc');
    if (desc) desc.textContent = 'Dữ liệu tư thế của học sinh và dữ liệu chuẩn đã sẵn sàng. Nhấn bên dưới để bắt đầu so sánh.';
    const runBtn = document.getElementById('btnRunComparePose');
    if (runBtn) runBtn.textContent = '🔍 Bắt Đầu So Sánh Ngay';
  } else if (state.studentPoseData) {
    _setCposeState('empty');
    // Cập nhật mô tả trong empty state để thông báo đã có data
    const desc = document.querySelector('.cpose-empty-desc');
    if (desc) desc.textContent = 'Dữ liệu tư thế học sinh đã sẵn sàng. Nhấn bên dưới để so sánh với chuẩn.';
    const runBtn = document.getElementById('btnRunComparePose');
    if (runBtn) runBtn.textContent = '🔍 So Sánh Tư Thế Ngay';
  } else {
    _setCposeState('empty');
    const desc = document.querySelector('.cpose-empty-desc');
    if (desc) desc.textContent = 'Tải video bài thi lên và xác nhận nộp bài để hệ thống tự động trích xuất dữ liệu tư thế học sinh, sau đó nhấn nút bên dưới để so sánh.';
    const runBtn = document.getElementById('btnRunComparePose');
    if (runBtn) runBtn.textContent = '🔍 Trích Xuất & So Sánh Ngay';
  }
}

function closeComparePoseModal(e) {
  if (e && e.target !== document.getElementById('compare-pose-modal')) return;
  document.getElementById('compare-pose-modal').style.display = 'none';
}

let _extractProgressInterval = null;

function _setCposeState(stateStr, isExtracting = false) {
  document.getElementById('cpose-empty-state').style.display = stateStr === 'empty' ? '' : 'none';
  document.getElementById('cpose-loading-state').style.display = stateStr === 'loading' ? '' : 'none';
  document.getElementById('cpose-result-state').style.display = stateStr === 'result' ? '' : 'none';

  if (stateStr === 'loading') {
    const progWrap = document.getElementById('cpose-progress-wrap');
    const spinner = document.getElementById('cpose-loading-spinner');
    if (isExtracting) {
      if (spinner) spinner.style.display = 'none';
      if (progWrap) {
        progWrap.style.display = 'flex';
        _startExtractProgress();
      }
    } else {
      if (spinner) spinner.style.display = '';
      if (progWrap) {
        progWrap.style.display = 'none';
        _stopExtractProgress();
      }
    }
  } else {
    _stopExtractProgress();
  }
}

function _startExtractProgress() {
  _stopExtractProgress();
  const bar = document.getElementById('cpose-progress-bar');
  const pctText = document.getElementById('cpose-progress-pct');
  if (!bar || !pctText) return;

  let pct = 0;
  bar.style.width = '0%';
  pctText.textContent = '0%';

  _extractProgressInterval = setInterval(() => {
    if (pct < 50) pct += 2;
    else if (pct < 80) pct += 1;
    else if (pct < 95) pct += 0.2;
    if (pct > 99) pct = 99;

    bar.style.width = pct + '%';
    pctText.textContent = Math.floor(pct) + '%';
  }, 300);
}

function _stopExtractProgress() {
  if (_extractProgressInterval) {
    clearInterval(_extractProgressInterval);
    _extractProgressInterval = null;
  }
}

async function runComparePose() {
  const videoUrl = state.videoUrls[state.currentVideo - 1] || state.videoUrls[0] || '';

  // Bước 1: Nếu chưa có studentData → trích xuất trước
  if (!state.studentPoseData) {
    if (!videoUrl) {
      showToast('Chưa có video bài thi. Vui lòng tải video lên trước.', true);
      return;
    }
    _setCposeState('loading', true);
    document.getElementById('cpose-loading-text').textContent = 'Đang trích xuất dữ liệu khung xương...';
    try {
      const res = await fetch(`${AI_BASE_URL}/api/ai/extract-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoUrl, sample_rate: 1 })
      });
      const json = await res.json().catch(() => null);
      if (json?.status === 'success' && json?.studentData) {
        state.studentPoseData = json.studentData;
        const btnCP = document.getElementById('btnComparePose');
        if (btnCP) btnCP.classList.add('has-data');
      } else {
        const msg = json?.message || 'Trích xuất dữ liệu thất bại';
        _setCposeState('empty');
        showToast(msg, true);
        return;
      }
    } catch (err) {
      _setCposeState('empty');
      showToast('Lỗi kết nối khi trích xuất: ' + err.message, true);
      return;
    }
  }

  // Bước 2: Gọi compare-pose
  _setCposeState('loading');
  document.getElementById('cpose-loading-text').textContent = 'Đang so sánh tư thế với chuẩn...';

  if (!state.standardPoseData) {
    _setCposeState('empty');
    showToast('Chưa có dữ liệu tư thế chuẩn (standardData) của bài thi này. Vui lòng nộp video bài mẫu trước.', true);
    return;
  }

  // Unwrap in case data was saved with a wrapper (e.g. legacy data)
  let stuData = state.studentPoseData;
  if (stuData && stuData.studentData) stuData = stuData.studentData;
  else if (stuData && stuData.data) stuData = stuData.data;

  let stdData = state.standardPoseData;
  if (stdData && stdData.standardData) stdData = stdData.standardData;
  else if (stdData && stdData.data) stdData = stdData.data;

  if (!stuData || !stuData.frames || stuData.frames.length === 0) {
    _setCposeState('empty');
    showToast('Dữ liệu học sinh không có khung hình hợp lệ.', true);
    return;
  }
  if (!stdData || !stdData.frames || stdData.frames.length === 0) {
    _setCposeState('empty');
    showToast('Dữ liệu chuẩn không có khung hình hợp lệ. Hãy tạo lại bài thi.', true);
    return;
  }

  try {
    const payload = {
      studentData: stuData,
      standardData: stdData
    };

    const res = await fetch(`${AI_BASE_URL}/api/ai/compare-pose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.scores) {
      _setCposeState('empty');
      showToast('So sánh tư thế thất bại: HTTP ' + res.status, true);
      return;
    }

    // Bước 3: Gọi evaluate để lấy nhận xét
    document.getElementById('cpose-loading-text').textContent = 'Đang phân tích chuyên sâu bằng AI...';

    // API evaluate-pairwise-vlm yêu cầu standardData phải có video_url
    const gradingExam = JSON.parse(sessionStorage.getItem('gradingExam') || '{}');
    const standardVideoUrl = gradingExam.sampleVideoUrl
      || (gradingExam.videos && gradingExam.videos[0]?.url)
      || null;

    const evalPayload = {
      standardData: {
        ...(stdData || {}),
        video_url: standardVideoUrl
      },
      studentData: stuData,
      scores: json.scores
    };

    const evalRes = await fetch(`${AI_BASE_URL}/api/ai/evaluate-pairwise-vlm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evalPayload)
    });
    const evalJson = await evalRes.json().catch(() => null);

    const combinedData = {
      scores: json.scores,
      evaluation: evalJson?.evaluation,
      charts: evalJson?.charts
    };

    _renderComparePoseResult(combinedData);
  } catch (err) {
    _setCposeState('empty');
    showToast('Lỗi kết nối khi so sánh: ' + err.message, true);
  }
}

const JOINT_NAMES_VI = {
  left_shoulder: 'Vai trái',
  right_shoulder: 'Vai phải',
  left_elbow: 'Khuỷu trái',
  right_elbow: 'Khuỷu phải',
  left_hip: 'Hông trái',
  right_hip: 'Hông phải',
  left_knee: 'Gối trái',
  right_knee: 'Gối phải',
};

function _diffClass(deg) {
  if (deg <= 10) return 'good';
  if (deg <= 25) return 'medium';
  return 'bad';
}

function _diffLabel(deg) {
  if (deg <= 10) return '✅ Tốt';
  if (deg <= 25) return '⚠️ Cần cải thiện';
  return '❌ Lệch nhiều';
}


function resetComparePoseResult() {
  _setCposeState('empty');
  const desc = document.querySelector('.cpose-empty-desc');
  if (state.studentPoseData && state.standardPoseData) {
    if (desc) desc.textContent = 'Dữ liệu tư thế của học sinh và dữ liệu chuẩn đã sẵn sàng. Nhấn bên dưới để bắt đầu so sánh.';
    const runBtn = document.getElementById('btnRunComparePose');
    if (runBtn) runBtn.textContent = '🔍 Bắt Đầu So Sánh Ngay';
  } else if (state.studentPoseData) {
    if (desc) desc.textContent = 'Dữ liệu tư thế học sinh đã sẵn sàng. Nhấn bên dưới để so sánh với chuẩn.';
    const runBtn = document.getElementById('btnRunComparePose');
    if (runBtn) runBtn.textContent = '🔍 So Sánh Tư Thế Ngay';
  } else {
    if (desc) desc.textContent = 'Tải video bài thi lên và xác nhận nộp bài để hệ thống tự động trích xuất dữ liệu tư thế học sinh, sau đó nhấn nút bên dưới để so sánh.';
    const runBtn = document.getElementById('btnRunComparePose');
    if (runBtn) runBtn.textContent = '🔍 Trích Xuất & So Sánh Ngay';
  }
}

// ---- JOINT FRAME MODAL ----
// Ánh xạ tên khớp → gợi ý khắc phục
const JOINT_TIPS = {
  left_shoulder: 'Giữ vai trái ngang bằng với vai phải, không nhô lên hoặc co lại. Tập các bài giãn cơ vai trước khi luyện tập.',
  right_shoulder: 'Giữ vai phải thẳng và cân bằng với vai trái. Chú ý không nghiêng người sang phải khi thực hiện động tác.',
  left_elbow: 'Giữ khuỷu tay trái đúng góc theo quy định. Luyện tập trước gương để kiểm tra biên độ tay.',
  right_elbow: 'Giữ khuỷu tay phải đúng góc theo quy định. Đảm bảo tay vung đúng nhịp với bước chân.',
  left_hip: 'Giữ hông trái cân bằng, không xoay hoặc nghiêng. Phần thân dưới cần ổn định khi di chuyển.',
  right_hip: 'Giữ hông phải thẳng và song song với hông trái. Chú ý không vặn hông khi bước.',
  left_knee: 'Đầu gối trái cần nâng đúng độ cao quy định. Không co hoặc duỗi quá mức khi bước.',
  right_knee: 'Đầu gối phải cần nâng đúng độ cao quy định. Giữ nhịp đều giữa hai chân.',
};

// Lưu dữ liệu scores để dùng trong modal frame
let _lastCompareScores = null;
let _lastEvaluation = null;

// Bảng dịch các cụm từ tiếng Anh thường gặp từ AI → tiếng Việt
// Thứ tự: cụ thể → tổng quát (tránh match sai)
const _VI_PHRASES = [
  // ── Lỗi góc / angle error ──────────────────────────────────────────
  [/angle error:\s*([\d.]+)\s*degrees?\s*\(standard\)/gi, 'lỗi góc: $1° (so với chuẩn)'],
  [/angle error:\s*([\d.]+)\s*degrees?/gi, 'lỗi góc: $1°'],
  [/bending angle is too large/gi, 'góc cong quá lớn'],
  [/angled too far forward/gi, 'góc về phía trước quá nhiều'],
  [/angled too far back(?:ward)?/gi, 'góc về phía sau quá nhiều'],
  [/angled incorrectly/gi, 'góc độ chưa đúng'],
  [/bending too much/gi, 'cong quá mức'],
  [/not straight/gi, 'chưa thẳng'],
  // ── Vấn đề đầu gối ─────────────────────────────────────────────────
  [/genu valgum\s*\(bowed knees?\)/gi, 'đầu gối vòng kiềng (cong vào trong)'],
  [/genu valgum\s*\(bowed knee\)/gi, 'đầu gối vòng kiềng (cong vào trong)'],
  [/genu valgum/gi, 'đầu gối vòng kiềng'],
  [/genu varum/gi, 'đầu gối cong ra ngoài'],
  [/keep the knee(?: joint)? straight/gi, 'giữ thẳng khớp gối'],
  // ── Khắc phục vai ──────────────────────────────────────────────────
  [/align (?:the )?left shoulder with the standard posture\.?/gi, 'căn vai trái theo đúng tư thế chuẩn'],
  [/align (?:the )?right shoulder with the standard posture\.?/gi, 'căn vai phải theo đúng tư thế chuẩn'],
  [/align shoulder with (?:the )?torso(?: for better posture)?\.?/gi, 'căn vai thẳng với thân để có tư thế tốt hơn'],
  [/align shoulder with body(?: centerline)?/gi, 'căn vai thẳng với thân người'],
  [/align shoulder with hips? and torso/gi, 'căn vai thẳng với hông và thân'],
  // ── Khắc phục gối ──────────────────────────────────────────────────
  [/align the knee directly over the ankle and hip,?\s*avoid excessive inward bending of the knee\.?/gi, 'giữ đầu gối thẳng hàng với mắt cá chân và hông, tránh cong vào trong quá mức'],
  [/straighten the left knee to match the (?:model'?s?|standard) posture\.?/gi, 'duỗi thẳng gối trái theo đúng tư thế chuẩn'],
  [/straighten the right knee to match the (?:model'?s?|standard) posture\.?/gi, 'duỗi thẳng gối phải theo đúng tư thế chuẩn'],
  [/straighten the left knee/gi, 'duỗi thẳng gối trái'],
  [/straighten the right knee/gi, 'duỗi thẳng gối phải'],
  [/straighten (?:the )?knee/gi, 'duỗi thẳng đầu gối'],
  // ── Hông / khuỷu / chung ───────────────────────────────────────────
  [/keep (?:the )?hips? level/gi, 'giữ hông ngang bằng'],
  [/rotate (?:the )?hip/gi, 'xoay hông'],
  [/extend (?:the )?elbow/gi, 'duỗi thẳng khuỷu tay'],
  [/bend (?:the )?elbow/gi, 'cong khuỷu tay'],
  [/maintain (?:proper )?posture/gi, 'duy trì tư thế đúng'],
  [/correct (?:your )?posture/gi, 'chỉnh lại tư thế'],
  [/for better posture/gi, 'để có tư thế tốt hơn'],
  [/with the standard posture/gi, 'theo tư thế chuẩn'],
  [/with standard/gi, 'so với chuẩn'],
  // ── Tên khớp (snake_case → tiếng Việt) ────────────────────────────
  [/left_shoulder/gi, 'Vai trái'],
  [/right_shoulder/gi, 'Vai phải'],
  [/left_elbow/gi, 'Khuỷu trái'],
  [/right_elbow/gi, 'Khuỷu phải'],
  [/left_hip/gi, 'Hông trái'],
  [/right_hip/gi, 'Hông phải'],
  [/left_knee/gi, 'Gối trái'],
  [/right_knee/gi, 'Gối phải'],
];

function _translateToVi(text) {
  if (!text) return text;
  let result = String(text);
  for (const [pattern, replacement] of _VI_PHRASES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}



function _renderComparePoseResult(data) {
  // Lưu lại để dùng trong joint frame modal
  _lastCompareScores = data?.scores || null;
  _lastEvaluation = data?.evaluation || null;

  _setCposeState('result');

  const scores = data?.scores || {};
  const evaluation = data?.evaluation || {};

  const scoreRounded = Math.round(scores.overall || 0);
  const scoreClass = scoreRounded >= 75 ? 'good' : scoreRounded >= 50 ? 'medium' : 'bad';
  const scoreLabel = scoreRounded >= 75 ? '✅ Tư thế tốt' : scoreRounded >= 50 ? '⚠️ Cần cải thiện' : '❌ Tư thế lệch nhiều';

  let maxDiff = 0;
  let maxDiffJoint = '';
  let totalDiff = 0;
  let count = 0;

  const JOINTS = Object.keys(JOINT_NAMES_VI);

  JOINTS.forEach(joint => {
    const s = scores[joint] ?? 100;
    const diff = 45 * (1 - s / 100);
    totalDiff += diff;
    count++;
    if (diff > maxDiff) {
      maxDiff = diff;
      maxDiffJoint = joint;
    }
  });

  const avgDiff = count > 0 ? totalDiff / count : 0;

  // ---- Cập nhật banner ----
  const scoreEl = document.getElementById('cpose-overall-score');
  scoreEl.textContent = scoreRounded + '%';
  scoreEl.className = 'cpose-score-value ' + scoreClass;
  document.getElementById('cpose-score-level').textContent = scoreLabel;
  document.getElementById('cpose-frames-count').textContent = state.studentPoseData?.total_frames || state.studentPoseData?.frames?.length || '—';
  document.getElementById('cpose-avg-diff').textContent = avgDiff.toFixed(1) + '°';
  document.getElementById('cpose-max-diff').textContent = maxDiff.toFixed(1) + '°';

  // ---- Khớp cards (có thể click) ----
  const grid = document.getElementById('cpose-joints-grid');
  grid.innerHTML = '';
  JOINTS.forEach(joint => {
    const s = scores[joint] ?? 100;
    const avg = 45 * (1 - s / 100);
    const cls = _diffClass(avg);
    const barPct = s; // score từ 0-100 chính là %
    const card = document.createElement('div');
    card.className = 'cpose-joint-card';
    card.title = `Khớp ${JOINT_NAMES_VI[joint] || joint}`;
    card.innerHTML =
      '<div class="cpose-joint-name">' + (JOINT_NAMES_VI[joint] || joint) + '</div>' +
      '<div class="cpose-joint-diff ' + cls + '">' + avg.toFixed(1) + '°</div>' +
      '<div class="cpose-joint-bar-wrap"><div class="cpose-joint-bar ' + cls + '" style="width:' + barPct.toFixed(1) + '%"></div></div>' +
      '<div class="cpose-joint-label">Độ lệch TB</div>';

    grid.appendChild(card);
  });

  // ---- Ẩn bảng chi tiết frame vì API mới không trả về ----
  const frameTableWrap = document.querySelector('.cpose-frames-table-wrap');
  if (frameTableWrap) {
    frameTableWrap.style.display = 'none';
    const titleNode = frameTableWrap.previousElementSibling;
    if (titleNode && titleNode.classList.contains('cpose-section-title')) {
      titleNode.style.display = 'none';
    }
  }

  // ---- Nhận xét tổng thể bằng AI ----
  const feedbackBox = document.getElementById('cpose-feedback-box');
  const feedbackEl = document.getElementById('cpose-feedback-text');

  if (evaluation && (evaluation.comment || evaluation.suggestions?.length > 0)) {
    let html = '';
    if (evaluation.comment) {
      html += '<div style="margin-bottom:8px"><strong>Nhận xét:</strong> ' + evaluation.comment + '</div>';
    }
    if (evaluation.strengths?.length > 0) {
      html += '<div style="margin-bottom:8px; color:var(--green)"><strong>Điểm mạnh:</strong><ul style="margin:4px 0 0 20px">';
      evaluation.strengths.forEach(s => html += '<li>' + s + '</li>');
      html += '</ul></div>';
    }
    if (evaluation.suggestions?.length > 0) {
      html += '<div style="color:var(--orange)"><strong>Cần cải thiện:</strong><ul style="margin:4px 0 0 20px">';
      evaluation.suggestions.forEach(s => {
        const jointName = JOINT_NAMES_VI[s.joint] || s.joint;
        html += '<li style="margin-bottom:4px"><b>' + jointName + '</b>: ' + s.issue + '<br/><i style="color:#666">→ Fix: ' + s.fix + '</i></li>';
      });
      html += '</ul></div>';
    }
    feedbackEl.innerHTML = html;
    feedbackBox.style.display = 'flex';
  } else {
    // Tự sinh nhận xét dựa trên điểm
    let autoFeedback = '';
    if (scoreRounded >= 80) {
      autoFeedback = 'Học sinh thực hiện động tác khá chuẩn, độ lệch góc khớp trung bình thấp. Tiếp tục duy trì và luyện tập để hoàn thiện hơn.';
    } else if (scoreRounded >= 60) {
      autoFeedback = 'Tư thế học sinh cơ bản đúng nhưng một số khớp còn lệch đáng kể. Hãy chú ý các khớp có màu vàng/đỏ và luyện tập thêm.';
    } else {
      autoFeedback = 'Học sinh cần cải thiện nhiều về tư thế. Độ lệch góc khớp còn cao, đặc biệt ở các khớp có màu đỏ. Cần xem lại video mẫu và luyện tập kỹ hơn.';
    }
    if (maxDiffJoint) autoFeedback += ' Khớp sai lệch nhiều nhất: ' + (JOINT_NAMES_VI[maxDiffJoint] || maxDiffJoint) + ' (' + maxDiff.toFixed(1) + '°).';
    feedbackEl.textContent = autoFeedback;
    feedbackBox.style.display = 'flex';
  }

  // ---- Biểu đồ góc khớp ----
  const chartsGrid = document.getElementById('cpose-charts-grid');
  const chartsTitle = document.getElementById('cpose-charts-title');
  if (chartsGrid && chartsTitle) {
    chartsGrid.innerHTML = '';
    if (window._cposeChartInstances) {
      window._cposeChartInstances.forEach(c => c.destroy());
    }
    window._cposeChartInstances = [];

    if (data.charts && Object.keys(data.charts).length > 0) {
      chartsTitle.style.display = 'block';
      Object.keys(data.charts).forEach(jointKey => {
        const chartData = data.charts[jointKey];
        if (!chartData || !chartData.standard || !chartData.student) return;

        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'cpose-chart-card';
        chartWrapper.innerHTML = '<div class="cpose-chart-title">' + (chartData.label || JOINT_NAMES_VI[jointKey]) + '</div>' +
          '<div style="position: relative; height: 200px; width: 100%;">' +
          '<canvas id="chart-' + jointKey + '"></canvas>' +
          '</div>';
        chartsGrid.appendChild(chartWrapper);

        const ctx = document.getElementById('chart-' + jointKey).getContext('2d');
        const chart = new Chart(ctx, {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: 'Chuẩn',
                data: chartData.standard.labels.map((l, i) => ({ x: l, y: chartData.standard.values[i] })),
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                borderWidth: 2,
                showLine: true,
                pointRadius: 0,
                pointHitRadius: 10
              },
              {
                label: 'Học sinh',
                data: chartData.student.labels.map((l, i) => ({ x: l, y: chartData.student.values[i] })),
                borderColor: '#DC143C',
                backgroundColor: 'rgba(220, 20, 60, 0.1)',
                borderWidth: 2,
                borderDash: [5, 5],
                showLine: true,
                pointRadius: 3,
                pointHitRadius: 10
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            onClick: (e, elements, chart) => {
              if (elements.length > 0) {
                const firstPoint = elements[0];
                const datasetIndex = firstPoint.datasetIndex;
                const index = firstPoint.index;
                const pointData = chart.data.datasets[datasetIndex].data[index];
                const time = pointData.x;
                const s = scores[jointKey] ?? 100;
                const avgDiff = 45 * (1 - s / 100);
                openJointFrameModal(jointKey, s, avgDiff, scores, time);
              }
            },
            onHover: (e, elements) => {
              e.native.target.style.cursor = elements.length ? 'pointer' : 'default';
            },
            scales: {
              x: { type: 'linear', title: { display: true, text: 'Thời gian (s)' } },
              y: { title: { display: true, text: 'Góc (°)' }, suggestedMin: 0, suggestedMax: 180 }
            },
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } }
          }
        });
        window._cposeChartInstances.push(chart);
      });
    } else {
      chartsTitle.style.display = 'none';
    }
  }
}

// ---- OPEN JOINT FRAME MODAL ----
async function openJointFrameModal(jointKey, score, avgDiff, allScores, targetTime = null) {
  const modal = document.getElementById('joint-frame-modal');
  const loading = document.getElementById('jfm-loading');
  const compareRow = document.getElementById('jfm-compare-row');
  const noVideo = document.getElementById('jfm-no-video');
  const diffDetail = document.getElementById('jfm-diff-detail');
  const suggestion = document.getElementById('jfm-suggestion');

  // Reset state
  loading.style.display = 'none';
  compareRow.style.display = 'none';
  noVideo.style.display = 'none';
  diffDetail.style.display = 'none';
  suggestion.style.display = 'none';

  // Tiêu đề modal
  const jointNameVi = JOINT_NAMES_VI[jointKey] || jointKey;
  document.getElementById('joint-frame-modal-title').textContent = '🦴 Chi Tiết Frame – ' + jointNameVi;

  // Banner info khớp
  const cls = _diffClass(avgDiff);
  const clsLabel = cls === 'good' ? '✅ Tốt' : cls === 'medium' ? '⚠️ Cần cải thiện' : '❌ Lệch nhiều';
  document.getElementById('jfm-joint-info').innerHTML =
    '<div class="jfm-joint-name">🦴 ' + jointNameVi + '</div>' +
    '<div class="jfm-joint-score-chip ' + cls + '">' + clsLabel + ' — ' + avgDiff.toFixed(1) + '° sai lệch TB</div>' +
    '<div class="jfm-joint-desc">Điểm tương đồng: ' + Math.round(score) + '%</div>';

  modal.style.display = 'flex';

  // Hiện loading
  loading.style.display = 'flex';

  const studentFrames = state.studentPoseData?.frames || [];

  let bestStudentFrame = null;
  let bestStudentFrameIdx = 0;
  let bestStudentTime = targetTime;

  // Tìm frame sinh viên gần nhất với targetTime
  if (targetTime !== null && studentFrames.length > 0) {
    let minDiff = Infinity;
    for (let i = 0; i < studentFrames.length; i++) {
      const t = studentFrames[i]?.timestamp ?? studentFrames[i]?.time ?? (i / 30);
      const diff = Math.abs(t - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        bestStudentFrameIdx = i;
        bestStudentFrame = studentFrames[i];
      }
    }
    bestStudentTime = bestStudentFrame?.timestamp ?? bestStudentFrame?.time ?? (bestStudentFrameIdx / 30);
  } else if (studentFrames.length > 0) {
    // Fallback: Lấy frame ở giữa video nếu không có targetTime
    bestStudentFrameIdx = Math.floor(studentFrames.length * 0.4);
    bestStudentFrame = studentFrames[bestStudentFrameIdx];
    bestStudentTime = bestStudentFrame?.timestamp ?? bestStudentFrame?.time ?? (bestStudentFrameIdx / 30);
  }

  // Tìm frame chuẩn gần nhất với targetTime
  const standardFrames = state.standardPoseData?.frames || [];
  let bestStandardFrame = null;
  let bestStandardTime = 0;

  if (standardFrames.length > 0) {
    if (targetTime !== null) {
      let minDiff = Infinity;
      for (let i = 0; i < standardFrames.length; i++) {
        const t = standardFrames[i]?.timestamp ?? standardFrames[i]?.time ?? (i / 30);
        const diff = Math.abs(t - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          bestStandardFrame = standardFrames[i];
          bestStandardTime = t;
        }
      }
    } else {
      const stdIdx = bestStudentFrameIdx < standardFrames.length ? bestStudentFrameIdx : Math.floor(standardFrames.length * 0.4);
      bestStandardFrame = standardFrames[stdIdx];
      bestStandardTime = bestStandardFrame?.timestamp ?? bestStandardFrame?.time ?? (stdIdx / 30);
    }
  }

  // Hiển thị lại đầy đủ 2 cột và divider
  const divider = document.querySelector('.jfm-vs-divider');
  const stdPanel = document.querySelector('.jfm-frame-panel:last-child');
  if (divider) divider.style.display = 'flex';
  if (stdPanel) stdPanel.style.display = 'flex';
  if (compareRow) compareRow.style.gridTemplateColumns = '';

  // Trích xuất frame từ video bài thi
  const vid = document.getElementById('main-video-player');
  const hasVideo = vid && vid.src && vid.readyState >= 1;

  loading.style.display = 'none';

  if (!hasVideo && studentFrames.length === 0) {
    noVideo.style.display = 'flex';
    _renderJointDiffDetail(allScores, jointKey);
    _renderJointSuggestion(jointKey, avgDiff);
    return;
  }

  compareRow.style.display = 'grid';

  // Vẽ canvas sinh viên
  const studentCanvas = document.getElementById('jfm-student-canvas');
  const studentTimeBadge = document.getElementById('jfm-student-time-badge');
  const studentDesc = document.getElementById('jfm-student-desc');

  if (hasVideo) {
    await _drawVideoFrameToCanvas(vid, studentCanvas, bestStudentTime || state.currentTime, jointKey, bestStudentFrame, '#ef4444');
    studentTimeBadge.textContent = '⏱ t=' + formatTime(Math.round(bestStudentTime || state.currentTime));
    studentDesc.textContent = state.currentStudent?.name ? '📹 ' + state.currentStudent.name : '📹 Bài thi sinh viên';
  } else {
    // Vẽ skeleton từ data frame
    _drawSkeletonFrameToCanvas(studentCanvas, bestStudentFrame, '#ef4444', jointKey);
    studentTimeBadge.textContent = '⏱ t=' + formatTime(Math.round(bestStudentTime));
    studentDesc.textContent = '📹 Bài thi sinh viên (skeleton)';
  }

  // Vẽ canvas chuẩn
  const standardCanvas = document.getElementById('jfm-standard-canvas');
  const standardTimeBadge = document.getElementById('jfm-standard-time-badge');
  const standardDesc = document.getElementById('jfm-standard-desc');

  const gradingExam = JSON.parse(sessionStorage.getItem('gradingExam') || '{}');
  const standardVideoUrl = gradingExam.sampleVideoUrl || (gradingExam.videos && gradingExam.videos[0]?.url) || null;

  if (bestStandardFrame) {
    if (standardVideoUrl) {
      let stdVid = document.getElementById('standard-video-player');
      if (!stdVid) {
        stdVid = document.createElement('video');
        stdVid.id = 'standard-video-player';
        stdVid.crossOrigin = 'anonymous';
        stdVid.style.display = 'none';
        document.body.appendChild(stdVid);
      }

      const drawStdVideo = async () => {
        await _drawVideoFrameToCanvas(stdVid, standardCanvas, bestStandardTime, jointKey, bestStandardFrame, '#16a34a');
      };

      if (stdVid.src !== standardVideoUrl) {
        stdVid.src = standardVideoUrl;
        stdVid.load();
      }

      if (stdVid.readyState >= 1) {
        await drawStdVideo();
      } else {
        // Show loading state briefly
        _drawPlaceholderCanvas(standardCanvas, 'Đang tải video mẫu...', '#16a34a');
        await new Promise(resolve => {
          const onLoaded = async () => {
            stdVid.removeEventListener('loadedmetadata', onLoaded);
            await drawStdVideo();
            resolve();
          };
          stdVid.addEventListener('loadedmetadata', onLoaded);
          setTimeout(() => {
            stdVid.removeEventListener('loadedmetadata', onLoaded);
            _drawSkeletonFrameToCanvas(standardCanvas, bestStandardFrame, '#16a34a', jointKey);
            resolve();
          }, 4000);
        });
      }
    } else {
      _drawSkeletonFrameToCanvas(standardCanvas, bestStandardFrame, '#16a34a', jointKey);
    }

    standardTimeBadge.textContent = '⏱ t=' + formatTime(Math.round(bestStandardTime));
    standardDesc.textContent = '✅ Frame chuẩn (tham chiếu)';
  } else if (standardFrames.length === 0) {
    // Không có standard frame data – hiển thị thông báo
    _drawPlaceholderCanvas(standardCanvas, '✅ Chưa có dữ liệu\nframe chuẩn', '#16a34a');
    standardTimeBadge.textContent = '';
    standardDesc.textContent = '✅ Frame chuẩn (chưa có dữ liệu chi tiết)';
  }

  // Hiển thị diff detail và suggestion
  _renderJointDiffDetail(allScores, jointKey);
  _renderJointSuggestion(jointKey, avgDiff);
}

function closeJointFrameModal(e) {
  if (e && e.target !== document.getElementById('joint-frame-modal')) return;
  document.getElementById('joint-frame-modal').style.display = 'none';
}

// Vẽ frame từ video element vào canvas + overlay skeleton
async function _drawVideoFrameToCanvas(vid, canvas, seekTime, highlightJoint, frameData, skeletonColor) {
  return new Promise(resolve => {
    const W = 480, H = 270;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Tua video đến thời điểm cần xem
    const prevTime = vid.currentTime;
    const wasPaused = vid.paused;

    function draw() {
      try {
        ctx.drawImage(vid, 0, 0, W, H);
      } catch (e) {
        // CORS hoặc không vẽ được → vẽ nền tối
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = 'bold 14px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('📹 Frame bài thi', W / 2, H / 2 - 10);
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText('(Không thể hiển thị do CORS)', W / 2, H / 2 + 14);
      }

      // Vẽ skeleton overlay nếu có data
      if (frameData) {
        _drawSkeletonOverlay(ctx, frameData, W, H, skeletonColor, highlightJoint);
      } else {
        // Vẽ chỉ highlight khung cho khớp nếu không có frameData
        ctx.strokeStyle = skeletonColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(10, 10, W - 20, H - 20);
        ctx.setLineDash([]);
      }

      // Không tua lại prevTime để video "nằm ở frame đó" giúp người dùng xem chi tiết
      if (!wasPaused) {
        vid.play().catch(() => { });
      }

      // Đồng bộ state để UI (thanh progress, thời gian) cập nhật đúng với frame hiện tại
      if (typeof window.state !== 'undefined') {
        window.state.currentTime = seekTime;
        if (typeof updateTimeDisplay === 'function') updateTimeDisplay();
        if (typeof updateProgressBar === 'function') updateProgressBar();
      }

      resolve();
    }

    if (Math.abs(vid.currentTime - seekTime) < 0.5) {
      // Không cần tua
      draw();
    } else {
      vid.pause();
      vid.currentTime = Math.max(0, seekTime);
      const onSeeked = () => {
        vid.removeEventListener('seeked', onSeeked);
        draw();
      };
      vid.addEventListener('seeked', onSeeked);
      // Timeout dự phòng sau 2s
      setTimeout(() => {
        vid.removeEventListener('seeked', onSeeked);
        draw();
      }, 2000);
    }
  });
}

// Vẽ skeleton từ frame data lên canvas (không cần video)
function _drawSkeletonFrameToCanvas(canvas, frameData, color, highlightJoint) {
  const W = 480, H = 270;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Nền tối
  ctx.fillStyle = 'linear-gradient(135deg, #0a0f1e, #0c1a2e)';
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, W, H);

  // Lưới nền nhẹ
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  if (frameData) {
    _drawSkeletonOverlay(ctx, frameData, W, H, color, highlightJoint);
  } else {
    // Placeholder text
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦴 Skeleton', W / 2, H / 2 - 8);
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillText('(Chưa có dữ liệu frame)', W / 2, H / 2 + 14);
  }
}

// Vẽ canvas placeholder
function _drawPlaceholderCanvas(canvas, text, color) {
  const W = 480, H = 270;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = color || '#16a34a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = 'bold 14px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, H / 2 - (lines.length - 1) * 10 + i * 22);
  });
}

// Ánh xạ tên khớp → keypoint index (theo chuẩn MediaPipe/MoveNet pose 17 keypoints)
const JOINT_KP_IDX = {
  left_shoulder: 5,
  right_shoulder: 6,
  left_elbow: 7,
  right_elbow: 8,
  left_hip: 11,
  right_hip: 12,
  left_knee: 13,
  right_knee: 14,
};

// Các cạnh skeleton để vẽ
const POSE_CONNECTIONS = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],    // arms
  [5, 11], [6, 12], [11, 12],              // torso
  [11, 13], [13, 15], [12, 14], [14, 16],   // legs
  [0, 1], [0, 2], [1, 3], [2, 4],           // face
];

// Vẽ skeleton overlay lên ctx từ frameData
function _drawSkeletonOverlay(ctx, frameData, W, H, color, highlightJoint) {
  if (!frameData) return;

  // Tìm kps (keypoints) từ các thuộc tính phổ biến
  let kps = frameData.keypoints || frameData.joints || frameData.landmarks || frameData.pose || frameData.poseLandmarks || null;
  if (!kps && Array.isArray(frameData)) kps = frameData;
  if (!kps && typeof frameData === 'object') {
    // Thử tìm bất kỳ mảng nào có vẻ là tọa độ (ít nhất 10 phần tử)
    for (const k in frameData) {
      if (Array.isArray(frameData[k]) && frameData[k].length >= 10) {
        kps = frameData[k];
        break;
      }
    }
  }

  if (!kps) {
    // Có thể frameData chính là một object dictionary chứa tọa độ (VD: {"left_shoulder": {x, y}, ...})
    kps = frameData;
  }

  // Normalize keypoints thành [{x, y, score}] để phù hợp với POSE_CONNECTIONS (chuẩn MoveNet 17 keypoints)
  const normalized = [];

  // Khởi tạo mảng trống 33 phần tử để đảm bảo index đúng nếu dùng object dictionary
  for (let i = 0; i < 33; i++) {
    normalized.push({ x: 0, y: 0, score: 0 });
  }

  if (Array.isArray(kps)) {
    if (kps.length > 0 && Array.isArray(kps[0])) {
      // Dạng [[y, x, score], ...] (MoveNet raw output)
      kps.forEach((kp, i) => {
        if (i < 33) normalized[i] = { y: kp[0], x: kp[1], score: kp[2] ?? 1 };
      });
    } else {
      // Dạng [{x, y, score}, ...]
      kps.forEach((kp, i) => {
        if (i < 33) {
          normalized[i] = {
            x: kp.x ?? kp.px ?? 0,
            y: kp.y ?? kp.py ?? 0,
            score: kp.score ?? kp.confidence ?? kp.visibility ?? 1
          };
        }
      });
    }
  } else if (typeof kps === 'object') {
    // Dạng dictionary mapping tên khớp -> tọa độ
    for (const [key, kp] of Object.entries(kps)) {
      if (!kp || typeof kp !== 'object') continue;

      let idx = -1;
      if (!isNaN(parseInt(key))) {
        idx = parseInt(key);
      } else if (JOINT_KP_IDX[key] !== undefined) {
        idx = JOINT_KP_IDX[key];
      } else {
        // Fallback mapping cho MediaPipe / MoveNet names
        const keymap = {
          'nose': 0, 'left_eye_inner': 1, 'left_eye': 2, 'left_eye_outer': 3,
          'right_eye_inner': 4, 'right_eye': 5, 'right_eye_outer': 6,
          'left_ear': 7, 'right_ear': 8, 'mouth_left': 9, 'mouth_right': 10,
          'left_shoulder': 5, 'right_shoulder': 6, 'left_elbow': 7, 'right_elbow': 8,
          'left_wrist': 9, 'right_wrist': 10, 'left_hip': 11, 'right_hip': 12,
          'left_knee': 13, 'right_knee': 14, 'left_ankle': 15, 'right_ankle': 16
        };
        if (keymap[key] !== undefined) idx = keymap[key];
      }

      if (idx >= 0 && idx < 33) {
        normalized[idx] = {
          x: kp.x ?? kp.px ?? 0,
          y: kp.y ?? kp.py ?? 0,
          score: kp.score ?? kp.confidence ?? kp.visibility ?? 1
        };
      }
    }
  }

  // Bỏ qua nếu không có keypoints hợp lệ
  const validKps = normalized.filter(k => k.score > 0.1);
  if (validKps.length === 0) {
    return;
  }

  // Xác định bounding box để scale
  const xs = validKps.map(k => k.x);
  const ys = validKps.map(k => k.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const margin = 40;
  function toCanvas(kp) {
    // Nếu tọa độ đã trong [0,1]
    let px, py;
    if (maxX <= 1.01 && maxY <= 1.01 && minX >= -0.01 && minY >= -0.01) {
      px = margin + kp.x * (W - margin * 2);
      py = margin + kp.y * (H - margin * 2);
    } else {
      // Tọa độ pixel → normalize
      px = margin + ((kp.x - minX) / rangeX) * (W - margin * 2);
      py = margin + ((kp.y - minY) / rangeY) * (H - margin * 2);
    }
    return [px, py];
  }

  // Vẽ connections
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  POSE_CONNECTIONS.forEach(([a, b]) => {
    const kpA = normalized[a], kpB = normalized[b];
    if (!kpA || !kpB || kpA.score < 0.2 || kpB.score < 0.2) return;
    const [ax, ay] = toCanvas(kpA);
    const [bx, by] = toCanvas(kpB);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = color;
    ctx.stroke();
  });

  // Vẽ keypoints
  const highlightIdx = JOINT_KP_IDX[highlightJoint] ?? -1;
  normalized.forEach((kp, idx) => {
    if (kp.score < 0.2) return;
    const [px, py] = toCanvas(kp);
    const isHighlight = idx === highlightIdx;
    const r = isHighlight ? 7 : 4;
    ctx.globalAlpha = isHighlight ? 1 : 0.8;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = isHighlight ? '#fff' : color;
    ctx.fill();
    if (isHighlight) {
      // Vòng ngoài nhấn mạnh
      ctx.beginPath();
      ctx.arc(px, py, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

// Hiển thị sai lệch từng khớp trong modal
function _renderJointDiffDetail(allScores, highlightJoint) {
  if (!allScores) return;
  const diffDetail = document.getElementById('jfm-diff-detail');
  const diffList = document.getElementById('jfm-diff-list');
  diffList.innerHTML = '';

  const JOINTS = Object.keys(JOINT_NAMES_VI);
  JOINTS.forEach(joint => {
    const s = allScores[joint] ?? 100;
    const diff = 45 * (1 - s / 100);
    const cls = _diffClass(diff);
    const isHighlight = joint === highlightJoint;
    const barPct = Math.min(100, (diff / 45) * 100);

    const item = document.createElement('div');
    item.className = 'jfm-diff-item';
    item.style.fontWeight = isHighlight ? '700' : '';
    item.style.opacity = isHighlight ? '1' : '0.75';
    item.innerHTML =
      '<div class="jfm-diff-joint-name">' + (JOINT_NAMES_VI[joint] || joint) + (isHighlight ? ' ◀' : '') + '</div>' +
      '<div class="jfm-diff-bar-wrap"><div class="jfm-diff-bar ' + cls + '" style="width:' + barPct.toFixed(1) + '%"></div></div>' +
      '<div class="jfm-diff-value ' + cls + '">' + diff.toFixed(1) + '°</div>';
    diffList.appendChild(item);
  });

  diffDetail.style.display = 'block';
}

// Hiển thị gợi ý khắc phục
function _renderJointSuggestion(jointKey, avgDiff) {
  const suggestion = document.getElementById('jfm-suggestion');
  const suggestionText = document.getElementById('jfm-suggestion-text');

  // Lấy gợi ý từ evaluation nếu có
  let tipText = JOINT_TIPS[jointKey] || 'Luyện tập thêm để cải thiện khớp này.';

  if (_lastEvaluation?.suggestions?.length > 0) {
    const evalSuggestion = _lastEvaluation.suggestions.find(s =>
      s.joint && s.joint.toLowerCase().includes(JOINT_NAMES_VI[jointKey]?.toLowerCase().split(' ')[0] || '')
    );
    if (evalSuggestion) {
      tipText = evalSuggestion.issue + '\n→ Khắc phục: ' + evalSuggestion.fix;
    }
  }

  const cls = _diffClass(avgDiff);
  if (cls === 'good') {
    suggestion.style.display = 'none';
    return;
  }

  suggestionText.innerHTML = tipText.replace('\n→', '<br/><strong>→</strong>');
  suggestion.style.display = 'flex';
}



// ---- TOAST ----
let toastTimer = null;
function showToast(msg, isError = false) {
  let el = document.querySelector('.toast');
  if (el) el.remove();
  if (toastTimer) clearTimeout(toastTimer);

  el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);

  toastTimer = setTimeout(() => { if (el) el.remove(); }, 2800);
}