/* =============================================
   app.js – Chấm Điểm Bài Tập Đi Đều
   ============================================= */

// ---- LOAD GRADING MODE ----
function loadGradingMode() {
  const mode = localStorage.getItem('gradingMode') || 'practice';
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
  const selectedStudent = JSON.parse(localStorage.getItem('selectedStudent'));
  const selectedClass = JSON.parse(localStorage.getItem('selectedClass'));
  const gradingStudent = JSON.parse(localStorage.getItem('gradingStudent'));
  const gradingExam = JSON.parse(localStorage.getItem('gradingExam'));
  
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
  errorTypes: [
    { id: 1, name: 'Sai nhịp tay',          score: -1.0, note: 'Tay đánh không đều theo nhịp bước.' },
    { id: 2, name: 'Bàn chân không vuông',  score: -0.5, note: 'Mũi chân và hướng bàn chân chưa đúng quy định.' },
    { id: 3, name: 'Dáng người gù',         score: -1.0, note: 'Tư thế thân người không giữ được độ thẳng.' },
    { id: 4, name: 'Mắt không nhìn thẳng',  score: -0.5, note: 'Ánh nhìn chưa hướng thẳng về phía trước.' },
    { id: 5, name: 'Tay không đúng tư thế', score: -0.5, note: 'Biên độ và vị trí tay chưa đúng mẫu động tác.' },
  ],
  timerInterval: null,
  nextHistoryId: 1,
  currentStudent: null,
  gradingMode: 'practice', // 'practice' hoặc 'grading'
  gradingDeadline: '',
  gradingLocked: false,
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
  const selectedClass = JSON.parse(localStorage.getItem('selectedClass') || 'null');
  const gradingExam = JSON.parse(localStorage.getItem('gradingExam') || 'null');
  if (!selectedClass?.classId || !gradingExam?.id) return null;

  const all = JSON.parse(localStorage.getItem('classExams') || '{}');
  const assignments = Array.isArray(all[selectedClass.classId]) ? all[selectedClass.classId].map(normalizeClassExamAssignment) : [];
  const normalizedAssignments = JSON.stringify(assignments);
  if (JSON.stringify(all[selectedClass.classId] || []) !== normalizedAssignments) {
    all[selectedClass.classId] = assignments;
    localStorage.setItem('classExams', JSON.stringify(all));
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
  const assignment = getCurrentExamAssignment();
  state.gradingDeadline = assignment?.gradingDeadline || '';
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
  const stored = JSON.parse(localStorage.getItem('teacherErrorCatalog') || 'null');
  if (Array.isArray(stored)) {
    return stored;
  }

  const seed = getDefaultSharedErrorCatalog();
  localStorage.setItem('teacherErrorCatalog', JSON.stringify(seed));
  return seed;
}

function saveSharedErrorCatalog(errors) {
  localStorage.setItem('teacherErrorCatalog', JSON.stringify(errors));
}

function syncStateErrorTypesFromCatalog() {
  state.errorTypes = getSharedErrorCatalog().map(error => ({
    id: error.id,
    name: error.name,
    score: -(Number(error.deduction) || 0),
    note: error.note || error.description || ''
  }));
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadGradingMode();
  loadStudentInfo();
  loadGradingAvailability();
  syncStateErrorTypesFromCatalog();
  renderErrorTypeList();
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

// ---- TIMER / PLAYBACK ----
function togglePlay() {
  state.isPlaying = !state.isPlaying;
  const btn = document.getElementById('play-btn');
  if (state.isPlaying) {
    btn.innerHTML = '&#9646;&#9646;';
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
  } else {
    btn.innerHTML = '&#9654;';
    clearInterval(state.timerInterval);
  }
}

function seek(seconds) {
  state.currentTime = Math.max(0, Math.min(state.duration, state.currentTime + seconds));
  updateTimeDisplay();
  updateProgressBar();
}

function resetVideo() {
  state.currentTime = 0;
  if (state.isPlaying) togglePlay();
  updateTimeDisplay();
  updateProgressBar();
}

function seekByClick(e) {
  const bar  = document.getElementById('prog-bar');
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  state.currentTime = Math.round(ratio * state.duration);
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
  state.currentTime  = 0;
  if (state.isPlaying) togglePlay();
  document.getElementById('vid-index').textContent = String(n).padStart(2, '0');
  updateTimeDisplay();
  updateProgressBar();
  updateThumbActive();
  showToast('Đã chuyển sang Video 0' + n);
}

function updateTimeDisplay() {
  const ts = formatTime(state.currentTime);
  document.getElementById('current-time').textContent  = ts;
  document.getElementById('footer-time').textContent   = ts;
}

function updateProgressBar() {
  const pct = (state.currentTime / state.duration) * 100;
  document.getElementById('prog-fill').style.width = pct + '%';
  document.getElementById('prog-dot').style.left   = pct + '%';
}

function updateThumbActive() {
  document.getElementById('thumb-1').classList.toggle('active', state.currentVideo === 1);
  document.getElementById('thumb-2').classList.toggle('active', state.currentVideo === 2);
}

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return m + ':' + s;
}

// ---- CAPTURE FRAME ----
function captureFrame() {
  if (!ensureGradingAvailable('chụp lỗi')) return;

  state.capturedFrameTime = state.currentTime;
  state.assignedErrors    = [];
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
function finishGrading() {
  if (!ensureGradingAvailable('lưu frame chấm')) return;

  if (state.capturedFrameTime === null) {
    showToast('Chưa có frame nào được chụp!', true);
    return;
  }
  if (state.assignedErrors.length === 0) {
    showToast('Vui lòng gán ít nhất một lỗi!', true);
    return;
  }

  const total = state.assignedErrors.reduce((sum, e) => sum + e.score, 0);
  const record = {
    id:       state.nextHistoryId++,
    frameTs:  state.capturedFrameTime,
    errors:   [...state.assignedErrors],
    total:    total,
    video:    state.currentVideo,
  };
  state.history.push(record);
  renderHistoryTable();

  // Reset frame
  state.capturedFrameTime = null;
  state.assignedErrors    = [];
  document.getElementById('frame-badge').style.display         = 'none';
  document.getElementById('frame-badge-overlay').style.display = 'none';
  document.getElementById('err-tag-r').style.display           = 'none';
  document.getElementById('err-tag-a').style.display           = 'none';
  renderAssignedErrors();
  renderErrorTypeList();

  showToast('Đã lưu frame vào lịch sử chấm!');
}

// ---- SUBMIT EXAM SCORE ----
function submitExamScore() {
  if (!ensureGradingAvailable('hoàn thành bài thi')) return;

  const totalDeductions = state.history.reduce((sum, rec) => sum + rec.total, 0);
  const finalScore = Math.max(0, state.defaultScore + totalDeductions);
  const submittedAt = new Date();
  
  // Chuẩn bị dữ liệu để lưu
  const examData = {
    timestamp: submittedAt.toLocaleString('vi-VN'),
    defaultScore: state.defaultScore,
    totalDeductions: totalDeductions,
    finalScore: finalScore,
    totalFrames: state.history.length,
    history: state.history,
  };

  // Lưu vào localStorage
  localStorage.setItem('examGradingResult', JSON.stringify(examData));

  // Lưu điểm theo sinh viên + bài thi + chế độ
  const classId = JSON.parse(localStorage.getItem('selectedClass'))?.classId;
  const className = JSON.parse(localStorage.getItem('selectedClass'))?.className || '';
  const studentCode = state.currentStudent?.code || state.currentStudent?.studentId;
  const studentName = state.currentStudent ? state.currentStudent.name : 'Học sinh';
  const examId = state.currentStudent?.examId || JSON.parse(localStorage.getItem('gradingExam'))?.id;
  const examName = state.currentStudent && state.currentStudent.subject
    ? state.currentStudent.subject
    : 'Động tác Quốc phòng';
  const modeSuffix = state.gradingMode === 'official' ? '_official' : '_practice';
  if (classId && studentCode && examId) {
    const scores = JSON.parse(localStorage.getItem('examScores') || '{}');
    const key = `${classId}_${studentCode}_${examId}${modeSuffix}`;
    scores[key] = finalScore;
    localStorage.setItem('examScores', JSON.stringify(scores));

    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
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
  document.getElementById('success-modal').style.display = 'flex';
}

function closeSuccessModal(e) {
  if (e && e.target.id !== 'success-modal') return;
  document.getElementById('success-modal').style.display = 'none';
  // Quay về trang lớp đang chấm
  window.location.href = '/pages/class-detail.html';
}

function getBackNavigationTarget() {
  const selectedClass = JSON.parse(localStorage.getItem('selectedClass') || 'null');
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
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="color:var(--txt3)">' + (idx + 1) + '</td>' +
      '<td><div class="thumb-cell">V0' + rec.video + '</div></td>' +
      '<td>' + formatTime(rec.frameTs) + '</td>' +
      '<td style="word-break:break-word">' + errStr + '</td>' +
      '<td class="score-neg">' + rec.total.toFixed(1) + '</td>' +
      '<td class="history-actions">' +
        '<button type="button" class="adel" data-id="' + rec.id + '" aria-label="Xóa bản ghi">&times;</button>' +
      '</td>';
    tr.querySelector('.adel').addEventListener('click',  () => deleteRecord(rec.id));
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
  state.assignedErrors    = [...rec.errors];
  state.history = state.history.filter(r => r.id !== id);

  const ts = formatTime(rec.frameTs);
  document.getElementById('frame-badge').style.display         = 'block';
  document.getElementById('frame-time').textContent            = ts;
  document.getElementById('frame-badge-overlay').style.display = 'block';
  document.getElementById('overlay-frame-time').textContent    = ts;

  renderAssignedErrors();
  renderErrorTypeList();
  renderHistoryTable();
  updateVideoErrorTags();
  showToast('Đang chỉnh sửa frame tại ' + ts);
}

// ---- ADD NEW ERROR TYPE ----
function openAddErrorModal() {
  if (!ensureGradingAvailable('thêm lỗi mới')) return;

  document.getElementById('modal-backdrop').style.display = 'flex';
  document.getElementById('new-error-name').value  = '';
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

function addNewErrorType() {
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

  const newId = Math.max(...catalog.map(e => e.id || 0), 0) + 1;
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