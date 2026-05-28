/* =============================================
   exam-detail.js – Student Exam Detail & Video Upload
   ============================================= */

let currentExam = null;
let uploadedVideos = [];
let pendingDeleteVideoIndex = null;
let referenceVideos = [];
let referenceVideoObjectUrls = [];
const SAMPLE_VIDEO_DB_NAME = 'hactech-sample-video-db';
const SAMPLE_VIDEO_STORE = 'examSampleVideos';
const SAMPLE_VIDEO_DB_VERSION = 1;
let sampleVideoDbPromise = null;

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

function releaseReferenceVideoObjectUrls() {
  referenceVideoObjectUrls.forEach(url => URL.revokeObjectURL(url));
  referenceVideoObjectUrls = [];
}

async function resolveSampleVideoSource(video) {
  if (video?.storageKey) {
    const blob = await getSampleVideoBlob(video.storageKey);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      referenceVideoObjectUrls.push(objectUrl);
      return objectUrl;
    }
  }

  return video?.url || video?.blobUrl || video?.src || '';
}

function getAllGradingHistoryRecords() {
  return JSON.parse(localStorage.getItem('gradingHistoryRecords') || '[]');
}

function saveAllGradingHistoryRecords(records) {
  localStorage.setItem('gradingHistoryRecords', JSON.stringify(records));
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

function isSubmissionClosed() {
  if (!currentExam?.submissionDeadline) return false;
  const timestamp = new Date(currentExam.submissionDeadline).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() > timestamp;
}

// ---- INITIALIZATION ----
function purgeSampleRecords() {
  const all = JSON.parse(localStorage.getItem('gradingHistoryRecords') || '[]');
  const cleaned = all.filter(r => !r.isSample);
  if (cleaned.length !== all.length) {
    localStorage.setItem('gradingHistoryRecords', JSON.stringify(cleaned));
  }

  // Clear exam scores that were written by sample data functions
  if (currentExam?.classId && currentExam?.studentCode && currentExam?.id) {
    const scores = JSON.parse(sessionStorage.getItem('examScores') || '{}');
    const prefix = `${currentExam.classId}_${currentExam.studentCode}_${currentExam.id}_`;
    const keys = Object.keys(scores).filter(k => k.startsWith(prefix));
    if (keys.length) {
      keys.forEach(k => delete scores[k]);
      sessionStorage.setItem('examScores', JSON.stringify(scores));
    }
  }
}

function initPage() {
  currentExam = JSON.parse(sessionStorage.getItem('selectedExamDetail') || 'null');
  if (!currentExam) {
    window.location.href = '/pages/home.html';
    return;
  }

  purgeSampleRecords();
  loadUploadedVideos();
  renderExamInfo();
  renderReferenceVideos().catch(() => {
    showToast('Không thể tải video mẫu để phát trực tiếp.');
  });
  renderScores();
  renderGradingDetails(); // async — tự xử lý
  renderVideoList();
  setupUploadHandlers();

  // Ưu tiên khôi phục từ sessionStorage nếu còn (cùng tab)
  const savedStatus = sessionStorage.getItem(getVideoStorageKey() + '_status');
  const isSubmitted = sessionStorage.getItem(getVideoStorageKey() + '_submitted') === 'true';
  if (isSubmitted) {
    renderSubmittedBadge();
  } else if (savedStatus === 'DRAFT') {
    renderDraftBadge();
  }

  // Luôn gọi API để đồng bộ trạng thái thực từ server (xử lý trường hợp sessionStorage bị xóa)
  fetchAndRestoreSubmissionStatus();

  // Đồng bộ điểm từ server (async, cập nhật lại nếu có)
  fetchAndUpdateScores();
}

// ---- EXAM INFO ----
function renderExamInfo() {
  const container = document.getElementById('edExamInfo');
  if (!container || !currentExam) return;

  const title = document.getElementById('edTopbarTitle');
  if (title) title.textContent = currentExam.name;

  const submissionClosed = isSubmissionClosed();
  container.innerHTML = `
    <div class="ed-exam-icon-large">${currentExam.icon || '📝'}</div>
    <div class="ed-exam-details">
      <div class="ed-exam-title">${currentExam.name}</div>
      <div class="ed-exam-description">${currentExam.description || ''}</div>
      <div class="ed-exam-meta-row">
        <div class="ed-exam-meta-item">
          <i class="fas fa-school"></i>
          <span>${currentExam.className || 'Lớp Quân sự 1'}</span>
        </div>
        <div class="ed-exam-meta-item">
          <i class="fas fa-user"></i>
          <span>${currentExam.studentName || ''}</span>
        </div>
        <div class="ed-exam-meta-item">
          <i class="fas fa-id-badge"></i>
          <span>${currentExam.studentCode || ''}</span>
        </div>
        <div class="ed-exam-meta-item">
          <i class="fas fa-photo-film"></i>
          <span>${Array.isArray(currentExam.videos) ? currentExam.videos.length : 0} video mẫu</span>
        </div>
      </div>
      <div class="ed-deadline-panel ${submissionClosed ? 'closed' : 'open'}">
        <div class="ed-deadline-status">${submissionClosed ? 'Đã hết thời gian nộp bài' : 'Đang mở nộp bài'}</div>
        <div class="ed-deadline-list">
          <span><i class="fas fa-hourglass-end"></i> Hạn nộp: ${formatDeadline(currentExam.submissionDeadline)}</span>
          <span><i class="fas fa-user-clock"></i> Hạn chấm: ${formatDeadline(currentExam.gradingDeadline)}</span>
        </div>
      </div>
    </div>
  `;
}

function getSampleVideoSource(video) {
  return video?._resolvedSource || video?.url || video?.blobUrl || video?.src || '';
}

async function renderReferenceVideos() {
  const container = document.getElementById('edReferenceVideoList');
  const description = document.getElementById('edReferenceDescription');
  if (!container || !description || !currentExam) return;

  const rawVideos = Array.isArray(currentExam.videos) ? currentExam.videos : [];
  description.textContent = rawVideos.length > 0
    ? `Bài thi này đang có ${rawVideos.length} video mẫu để tham khảo trước khi sinh viên quay và nộp bài.`
    : 'Bài thi này hiện chưa có video mẫu tham khảo.';

  if (rawVideos.length === 0) {
    referenceVideos = [];
    releaseReferenceVideoObjectUrls();
    container.innerHTML = `
      <div class="ed-reference-empty">
        <i class="fas fa-film"></i>
        <span>Chưa có video mẫu cho bài thi này.</span>
      </div>
    `;
    return;
  }

  releaseReferenceVideoObjectUrls();
  const sampleVideos = await Promise.all(rawVideos.map(async video => ({
    ...video,
    _resolvedSource: await resolveSampleVideoSource(video)
  })));
  referenceVideos = sampleVideos;

  container.innerHTML = sampleVideos.map((video, index) => {
    const source = getSampleVideoSource(video);
    const hasPlayableSource = Boolean(source);
    return `
      <div class="ed-reference-video-card ${hasPlayableSource ? 'playable' : 'info-only'}">
        <button type="button" class="ed-reference-preview" onclick="openReferenceVideo(${index})">
          ${hasPlayableSource
            ? `<video src="${source}" muted preload="metadata"></video><span class="ed-reference-play"><i class="fas fa-play"></i></span>`
            : `<span class="ed-reference-placeholder-icon"><i class="fas fa-circle-play"></i></span><span class="ed-reference-placeholder-text">Video mẫu tham khảo</span>`}
        </button>
        <div class="ed-reference-content">
          <div class="ed-reference-title">${video.name || `Video mẫu ${index + 1}`}</div>
          <div class="ed-reference-file"><i class="fas fa-file-video"></i><span>${video.file || 'Chưa có tên tệp'}</span></div>
          <div class="ed-reference-note">${hasPlayableSource ? 'Có thể xem trực tiếp video mẫu.' : 'Hiện hệ thống đang lưu thông tin video mẫu, chưa có file phát trực tiếp trong kho dữ liệu.'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- SCORES ----
function renderScores() {
  const container = document.getElementById('edScoresCard');
  if (!container || !currentExam) return;

  const practice = currentExam.practiceScore;
  const official = currentExam.officialScore;

  container.innerHTML = `
    <div class="ed-scores-title"><i class="fas fa-star"></i> Điểm số</div>
    <div class="ed-scores-grid">
      <div class="ed-score-item ${practice !== null && practice !== undefined ? 'practice' : 'no-score'}">
        <div class="ed-score-label">Luyện tập</div>
        <div class="ed-score-number">${practice !== null && practice !== undefined ? practice : 'Chưa có'}</div>
      </div>
      <div class="ed-score-item ${official !== null && official !== undefined ? 'official' : 'no-score'}">
        <div class="ed-score-label">Chính thức</div>
        <div class="ed-score-number">${official !== null && official !== undefined ? official : 'Chưa có'}</div>
      </div>
    </div>
  `;
}

function getStudentGradingRecords() {
  if (!currentExam?.classId || !currentExam?.studentCode || !currentExam?.id) {
    return [];
  }

  const records = JSON.parse(localStorage.getItem('gradingHistoryRecords') || '[]');
  return records
    .filter(record => !record.isSample
      && record.classId === currentExam.classId
      && record.studentCode === currentExam.studentCode
      && record.examId === currentExam.id)
    .sort((left, right) => {
      const leftTime = new Date(left.timestampIso || left.timestamp || 0).getTime();
      const rightTime = new Date(right.timestampIso || right.timestamp || 0).getTime();
      return rightTime - leftTime;
    });
}

function getLatestGradingRecordsByMode() {
  const grouped = {};
  getStudentGradingRecords().forEach(record => {
    if (!grouped[record.gradingMode]) {
      grouped[record.gradingMode] = record;
    }
  });
  return Object.values(grouped);
}

function formatFrameTimestamp(frameTs) {
  const totalSeconds = Math.max(0, Number(frameTs) || 0);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatGradingModeLabel(mode) {
  return mode === 'official' ? 'Chấm lấy điểm' : 'Chấm luyện tập';
}

function formatDeduction(value) {
  return Math.abs(Number(value) || 0).toFixed(1);
}

function getFramePreviewSource(frame) {
  return frame?.image || frame?.thumbnailUrl || frame?.frameImage || '';
}

function formatSecondsToTimestamp(seconds) {
  const s = Math.floor(Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

async function renderGradingDetails() {
  const container = document.getElementById('edGradingDetailCard');
  if (!container) return;

  // Xác định role
  const _currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const _role = ((sessionStorage.getItem('currentUserRole') || _currentUser?.role || '')).toLowerCase().replace('role_', '');
  const isStudent = _role === 'student';

  // ---- STUDENT VIEW: chỉ hiển thị chế độ chấm OFFICIAL ----
  if (isStudent) {
    if (!currentExam?.submissionId) {
      container.innerHTML = `
        <div class="ed-section-title">
          <i class="fas fa-list-check"></i> Chi tiết chấm bài chính thức
        </div>
        <div class="ed-grading-empty">
          <i class="fas fa-clipboard-list"></i>
          <span>Chưa có kết quả chấm chính thức cho bài thi này.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ed-section-title">
        <i class="fas fa-list-check"></i> Chi tiết chấm bài chính thức
      </div>
      <div class="ed-grading-description">Đang tải kết quả chấm chính thức...</div>
    `;

    try {
      // Bước 1: kiểm tra xem currentExam đã có officialSessionId chưa
      // (có thể được spread từ STUDENT_MY_EXAM response qua openExamDetail)
      let officialSessionId = currentExam.officialSessionId
        ?? currentExam.idOfficialGradingSession
        ?? currentExam.officialGradingSessionId
        ?? currentExam.idOfficialSession
        ?? null;

      // Bước 2: nếu chưa có, gọi grade-board (public) để tìm session ID
      if (!officialSessionId) {
        const rawGradeBoard = await ExamsService.getGradeBoard(currentExam.submissionId);
        // Trường hợp A: mảng entries phân chia theo gradingMode (mỗi entry = 1 session)
        const officialByMode = Array.isArray(rawGradeBoard)
          ? rawGradeBoard.find(e => (e.gradingMode || '').toUpperCase() === 'OFFICIAL')
          : null;
        if (officialByMode) {
          officialSessionId = officialByMode.id
            ?? officialByMode.idGradingSession
            ?? officialByMode.gradingSessionId
            ?? null;
        }
        // Trường hợp B: 1 entry chứa cả 2 chế độ, có field officialSessionId riêng
        if (!officialSessionId && Array.isArray(rawGradeBoard) && rawGradeBoard.length > 0) {
          const single = rawGradeBoard[0];
          officialSessionId = single.officialSessionId
            ?? single.idOfficialGradingSession
            ?? single.officialGradingSessionId
            ?? null;
        }
      }

      if (!officialSessionId) {
        console.warn('[renderGradingDetails] Không tìm được officialSessionId. currentExam:', JSON.stringify(currentExam));
        container.innerHTML = `
          <div class="ed-section-title">
            <i class="fas fa-list-check"></i> Chi tiết chấm bài chính thức
          </div>
          <div class="ed-grading-empty">
            <i class="fas fa-clipboard-list"></i>
            <span>Chưa có kết quả chấm chính thức cho bài thi này.</span>
          </div>
        `;
        return;
      }
      console.log('[renderGradingDetails] officialSessionId =', officialSessionId);

      const errors = await ExamsService.getGradingErrorDetail(String(officialSessionId), 'OFFICIAL');
      if (!errors || errors.length === 0) {
        container.innerHTML = `
          <div class="ed-section-title">
            <i class="fas fa-list-check"></i> Chi tiết chấm bài chính thức
          </div>
          <div class="ed-grading-empty">
            <i class="fas fa-clipboard-list"></i>
            <span>Không có lỗi nào được ghi nhận trong phiên chấm chính thức.</span>
          </div>
        `;
        return;
      }

      const totalDeduction = errors.reduce((sum, e) => sum + (Number(e.deduction) || 0), 0);
      container.innerHTML = `
        <div class="ed-section-title">
          <i class="fas fa-list-check"></i> Chi tiết chấm bài chính thức
        </div>
        <div class="ed-grading-description">
          Tổng cộng <strong>${errors.length}</strong> lỗi được ghi nhận, trừ tổng <strong>${formatDeduction(totalDeduction)} điểm</strong>.
        </div>
        <div class="ed-grading-record-list">
          <div class="ed-grading-record">
            <div class="ed-grading-frame-list">
              ${errors.map((err, index) => `
                <div class="ed-grading-frame-item">
                  <div class="ed-grading-frame-layout">
                    <div class="ed-grading-frame-preview ${err.frameImageUrl ? 'has-image' : 'is-placeholder'}">
                      ${err.frameImageUrl
                        ? `<img src="${err.frameImageUrl}" alt="Bằng chứng lỗi ${index + 1}">`
                        : `<div class="ed-grading-frame-placeholder-icon"><i class="fas fa-video"></i></div><div class="ed-grading-frame-placeholder-text">Khung hình ${index + 1}</div>`}
                      <div class="ed-grading-frame-badge">${formatSecondsToTimestamp(err.frameTimeSeconds)}</div>
                    </div>
                    <div class="ed-grading-frame-main">
                      <div class="ed-grading-frame-top">
                        <div class="ed-grading-frame-heading">Lỗi ${index + 1}</div>
                        <div class="ed-grading-frame-meta">
                          <span><i class="fas fa-clock"></i> ${formatSecondsToTimestamp(err.frameTimeSeconds)}</span>
                          <span><i class="fas fa-minus-circle"></i> Trừ ${formatDeduction(err.deduction)} điểm</span>
                        </div>
                      </div>
                      <div class="ed-grading-error-list">
                        <div class="ed-grading-error-item">
                          <div class="ed-grading-error-main">
                            <div class="ed-grading-error-name">${err.errorName}</div>
                            <div class="ed-grading-error-note">${err.errorDescription || 'Không có mô tả.'}</div>
                          </div>
                          <div class="ed-grading-error-score">-${formatDeduction(err.deduction)}đ</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('[renderGradingDetails student]', err);
      container.innerHTML = `
        <div class="ed-section-title">
          <i class="fas fa-list-check"></i> Chi tiết chấm bài chính thức
        </div>
        <div class="ed-grading-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Không thể tải chi tiết chấm. Vui lòng thử lại.</span>
        </div>
      `;
    }
    return;
  }

  // ---- TEACHER/OTHER VIEW: logic cũ ----
  const urlParams = new URLSearchParams(window.location.search);
  const _sessionFromStorage = JSON.parse(sessionStorage.getItem('gradingSession') || 'null');
  const _records = getStudentGradingRecords();
  const _recordWithSession = _records.find(r => r.gradingSessionId);
  let idSession = urlParams.get('idSession')
    || (_sessionFromStorage?.id ? String(_sessionFromStorage.id) : null)
    || (_recordWithSession?.gradingSessionId ? String(_recordWithSession.gradingSessionId) : null)
    || null;

  let _rawMode = urlParams.get('gradingMode')
    || _sessionFromStorage?.gradingMode
    || _recordWithSession?.gradingMode
    || null;

  const gradingMode = (_rawMode || 'PRACTICE').toUpperCase() === 'OFFICIAL' ? 'OFFICIAL' : 'PRACTICE';

  if (idSession) {
    container.innerHTML = `
      <div class="ed-section-title">
        <i class="fas fa-list-check"></i> Chi tiết lỗi chấm bài
      </div>
      <div class="ed-grading-description">Đang tải chi tiết lỗi...</div>
    `;
    try {
      const errors = await ExamsService.getGradingErrorDetail(idSession, gradingMode);
      if (!errors || errors.length === 0) {
        container.innerHTML = `
          <div class="ed-section-title">
            <i class="fas fa-list-check"></i> Chi tiết lỗi chấm bài
          </div>
          <div class="ed-grading-empty">
            <i class="fas fa-clipboard-list"></i>
            <span>Không có lỗi nào được ghi nhận trong phiên chấm này.</span>
          </div>
        `;
        return;
      }
      const totalDeduction = errors.reduce((sum, e) => sum + (Number(e.deduction) || 0), 0);
      container.innerHTML = `
        <div class="ed-section-title">
          <i class="fas fa-list-check"></i> Chi tiết lỗi chấm bài
        </div>
        <div class="ed-grading-description">
          Phiên chấm #${idSession} — Tổng cộng <strong>${errors.length}</strong> lỗi được ghi nhận, trừ tổng <strong>${formatDeduction(totalDeduction)} điểm</strong>.
        </div>
        <div class="ed-grading-record-list">
          <div class="ed-grading-record">
            <div class="ed-grading-frame-list">
              ${errors.map((err, index) => `
                <div class="ed-grading-frame-item">
                  <div class="ed-grading-frame-layout">
                    <div class="ed-grading-frame-preview ${err.frameImageUrl ? 'has-image' : 'is-placeholder'}">
                      ${err.frameImageUrl
                        ? `<img src="${err.frameImageUrl}" alt="Bằng chứng lỗi ${index + 1}">`
                        : `<div class="ed-grading-frame-placeholder-icon"><i class="fas fa-video"></i></div><div class="ed-grading-frame-placeholder-text">Khung hình ${index + 1}</div>`}
                      <div class="ed-grading-frame-badge">${formatSecondsToTimestamp(err.frameTimeSeconds)}</div>
                    </div>
                    <div class="ed-grading-frame-main">
                      <div class="ed-grading-frame-top">
                        <div class="ed-grading-frame-heading">Lỗi ${index + 1}</div>
                        <div class="ed-grading-frame-meta">
                          <span><i class="fas fa-clock"></i> ${formatSecondsToTimestamp(err.frameTimeSeconds)}</span>
                          <span><i class="fas fa-minus-circle"></i> Trừ ${formatDeduction(err.deduction)} điểm</span>
                        </div>
                      </div>
                      <div class="ed-grading-error-list">
                        <div class="ed-grading-error-item">
                          <div class="ed-grading-error-main">
                            <div class="ed-grading-error-name">${err.errorName}</div>
                            <div class="ed-grading-error-note">${err.errorDescription || 'Không có mô tả.'}</div>
                          </div>
                          <div class="ed-grading-error-score">-${formatDeduction(err.deduction)}đ</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('[renderGradingDetails] Lỗi khi tải chi tiết lỗi từ API:', err);
      container.innerHTML = `
        <div class="ed-section-title">
          <i class="fas fa-list-check"></i> Chi tiết lỗi chấm bài
        </div>
        <div class="ed-grading-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Không thể tải chi tiết lỗi. Vui lòng thử lại.</span>
        </div>
      `;
    }
    return;
  }

  // Fallback: dùng dữ liệu local (sessionStorage)
  const gradingRecords = getLatestGradingRecordsByMode();
  if (gradingRecords.length === 0) {
    container.innerHTML = `
      <div class="ed-section-title">
        <i class="fas fa-list-check"></i> Chi tiết chấm bài
      </div>
      <div class="ed-grading-empty">
        <i class="fas fa-clipboard-list"></i>
        <span>Chưa có dữ liệu chấm chi tiết cho bài thi này.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="ed-section-title">
      <i class="fas fa-list-check"></i> Chi tiết chấm bài
    </div>
    <div class="ed-grading-description">Sinh viên có thể xem lại từng lỗi bị ghi nhận, thời điểm xuất hiện trong video và số điểm bị trừ ở mỗi khung hình.</div>
    <div class="ed-grading-record-list">
      ${gradingRecords.map(record => `
        <div class="ed-grading-record">
          <div class="ed-grading-record-header">
            <div>
              <div class="ed-grading-record-title">${formatGradingModeLabel(record.gradingMode)}</div>
              <div class="ed-grading-record-time">Thời gian chấm: ${record.timestamp || 'Chưa cập nhật'}</div>
            </div>
            <div class="ed-grading-record-summary">
              <span><strong>${Number(record.finalScore || 0).toFixed(1)}/10</strong> điểm</span>
              <span>Tổng trừ ${formatDeduction(record.totalDeductions)} điểm</span>
            </div>
          </div>
          <div class="ed-grading-frame-list">
            ${Array.isArray(record.history) && record.history.length > 0
              ? record.history.map((frame, index) => `
                <div class="ed-grading-frame-item">
                  <div class="ed-grading-frame-layout">
                    <div class="ed-grading-frame-preview ${getFramePreviewSource(frame) ? 'has-image' : 'is-placeholder'}">
                      ${getFramePreviewSource(frame)
                        ? `<img src="${getFramePreviewSource(frame)}" alt="Khung hình ${index + 1}">`
                        : `<div class="ed-grading-frame-placeholder-icon"><i class="fas fa-video"></i></div><div class="ed-grading-frame-placeholder-text">Khung hình ${index + 1}</div>`}
                      <div class="ed-grading-frame-badge">${formatFrameTimestamp(frame.frameTs)}</div>
                    </div>
                    <div class="ed-grading-frame-main">
                      <div class="ed-grading-frame-top">
                        <div class="ed-grading-frame-heading">Khung hình ${index + 1}</div>
                        <div class="ed-grading-frame-meta">
                          <span><i class="fas fa-video"></i> Video ${frame.video || 1}</span>
                          <span><i class="fas fa-clock"></i> ${formatFrameTimestamp(frame.frameTs)}</span>
                          <span><i class="fas fa-minus-circle"></i> Trừ ${formatDeduction(frame.total)} điểm</span>
                        </div>
                      </div>
                      <div class="ed-grading-error-list">
                        ${(frame.errors || []).map(error => `
                          <div class="ed-grading-error-item">
                            <div class="ed-grading-error-main">
                              <div class="ed-grading-error-name">${error.name}</div>
                              <div class="ed-grading-error-note">${error.note || 'Không có ghi chú bổ sung.'}</div>
                            </div>
                            <div class="ed-grading-error-score">-${formatDeduction(error.score)}đ</div>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                </div>
              `).join('')
              : '<div class="ed-grading-empty-inline">Bài chấm này chưa có chi tiết frame lỗi.</div>'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ---- VIDEO STORAGE (sessionStorage) ----
function getVideoStorageKey() {
  return 'examVideos_' + (currentExam.classId || '1') + '_' + currentExam.studentCode + '_' + currentExam.id;
}

function loadUploadedVideos() {
  const stored = sessionStorage.getItem(getVideoStorageKey());
  uploadedVideos = stored ? JSON.parse(stored) : [];
}

function saveUploadedVideos() {
  sessionStorage.setItem(getVideoStorageKey(), JSON.stringify(uploadedVideos));
}

// ---- RENDER VIDEO LIST ----
function renderVideoList() {
  const container = document.getElementById('edVideoList');
  if (!container) return;

  if (uploadedVideos.length === 0) {
    container.innerHTML = `
      <div class="ed-video-empty">
        <i class="fas fa-film"></i>
        Chưa có video nào được tải lên
      </div>
    `;
    updateUploadAreaVisibility();
    return;
  }

  container.innerHTML = uploadedVideos.map((video, idx) => `
    <div class="ed-video-item" data-idx="${idx}">
      <div class="ed-video-thumb" onclick="playVideo(${idx})">
        ${video.thumbnailUrl ? `<video src="${video.blobUrl}" muted preload="metadata"></video>` : ''}
        <div class="ed-thumb-play"><i class="fas fa-play"></i></div>
      </div>
      <div class="ed-video-info">
        <div class="ed-video-name" title="${video.name}">${video.name}</div>
        <div class="ed-video-meta">
          <span><i class="fas fa-hdd"></i> ${formatFileSize(video.size)}</span>
          <span><i class="fas fa-clock"></i> ${video.uploadTime}</span>
        </div>
      </div>
      <span class="ed-video-status uploaded"><i class="fas fa-check"></i> Đã tải lên</span>
      <div class="ed-video-actions">
        <button class="ed-btn-play-video" onclick="playVideo(${idx})" title="Xem video">
          <i class="fas fa-play"></i>
        </button>
        <button class="ed-btn-delete-video" onclick="deleteVideo(${idx})" title="Xóa video">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  updateUploadAreaVisibility();
}

function updateUploadAreaVisibility() {
  const uploadArea = document.getElementById('edUploadArea');
  const submitArea = document.getElementById('edSubmitArea');
  const isSubmitted = sessionStorage.getItem(getVideoStorageKey() + '_submitted') === 'true';
  const submissionClosed = isSubmissionClosed();

  renderDeadlineNotice();

  if (uploadArea) {
    uploadArea.style.display = (uploadedVideos.length >= 2 || isSubmitted || submissionClosed) ? 'none' : '';
  }
  if (submitArea) {
    if (isSubmitted || submissionClosed) {
      submitArea.style.display = 'none';
      if (isSubmitted) {
        renderSubmittedBadge();
      }
    } else {
      submitArea.style.display = uploadedVideos.length > 0 ? '' : 'none';
    }
  }

  if (isSubmitted || submissionClosed) {
    document.querySelectorAll('.ed-btn-delete-video').forEach(btn => btn.style.display = 'none');
  }
}

function renderDeadlineNotice() {
  const section = document.querySelector('.ed-upload-section');
  if (!section) return;

  let notice = document.getElementById('edDeadlineNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'edDeadlineNotice';
    notice.className = 'ed-deadline-notice';
    const title = section.querySelector('.ed-section-title');
    if (title) {
      title.insertAdjacentElement('afterend', notice);
    } else {
      section.prepend(notice);
    }
  }

  const isSubmitted = sessionStorage.getItem(getVideoStorageKey() + '_submitted') === 'true';
  const submissionClosed = isSubmissionClosed();
  notice.className = `ed-deadline-notice ${submissionClosed ? 'closed' : 'open'}`;

  if (submissionClosed) {
    notice.innerHTML = `<i class="fas fa-lock"></i><span>${isSubmitted ? 'Bài thi đã nộp và đã hết hạn nộp bài.' : 'Đã hết thời gian nộp bài. Bạn không thể tải lên, xóa hoặc nộp thêm video.'}</span>`;
  } else if (!currentExam?.submissionDeadline) {
    notice.innerHTML = `<i class="fas fa-clock"></i><span>Bài thi hiện chưa đặt hạn nộp. Bạn vẫn có thể tải video và nộp bài.</span>`;
  } else {
    notice.innerHTML = `<i class="fas fa-clock"></i><span>Bạn có thể nộp bài đến ${formatDeadline(currentExam?.submissionDeadline)}.</span>`;
  }
}

function renderSubmittedBadge() {
  removeDraftBadge();
  const existing = document.getElementById('edSubmittedBadge');
  if (existing) return;
  const section = document.querySelector('.ed-upload-section');
  if (!section) return;
  const badge = document.createElement('div');
  badge.id = 'edSubmittedBadge';
  badge.className = 'ed-submitted-badge';
  badge.innerHTML = `<div class="ed-badge-content"><i class="fas fa-check-circle"></i> Đã nộp bài thành công</div>`;
  section.appendChild(badge);
}

function renderDraftBadge() {
  const isSubmitted = sessionStorage.getItem(getVideoStorageKey() + '_submitted') === 'true';
  if (isSubmitted) return;
  let badge = document.getElementById('edDraftBadge');
  if (badge) return;
  const section = document.querySelector('.ed-upload-section');
  if (!section) return;
  badge = document.createElement('div');
  badge.id = 'edDraftBadge';
  badge.className = 'ed-draft-badge';
  badge.innerHTML = `<div class="ed-badge-content"><i class="fas fa-save"></i> Đã lưu nháp (DRAFT)</div>`;
  section.appendChild(badge);
}

function removeDraftBadge() {
  const badge = document.getElementById('edDraftBadge');
  if (badge) badge.remove();
}

// ---- UPLOAD HANDLERS ----
function setupUploadHandlers() {
  const dropzone = document.getElementById('edDropzone');
  const fileInput = document.getElementById('edFileInput');

  if (!dropzone || !fileInput) return;

  // Click dropzone to browse
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('.ed-btn-browse')) return; // button has its own handler
    fileInput.click();
  });

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) {
      handleFiles(files);
    } else {
      showToast('Vui lòng chọn file video (MP4, AVI, MOV, MKV)');
    }
  });

  // File input change
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    if (files.length > 0) {
      handleFiles(files);
    }
    fileInput.value = '';
  });
}

function handleFiles(files) {
  if (isSubmissionClosed()) {
    showToast('Đã hết thời gian nộp bài, không thể tải thêm video.');
    return;
  }

  const maxSize = 500 * 1024 * 1024; // 500MB
  const maxVideos = 2;
  let remaining = maxVideos - uploadedVideos.length;

  if (remaining <= 0) {
    showToast('Đã đạt giới hạn 2 video. Xóa video cũ để tải lên video mới.');
    return;
  }

  files.forEach(file => {
    if (remaining <= 0) {
      showToast('Chỉ được tải tối đa 2 video');
      return;
    }
    if (file.size > maxSize) {
      showToast(`File "${file.name}" vượt quá 500MB`);
      return;
    }
    if (!file.type.startsWith('video/')) {
      showToast(`File "${file.name}" không phải video`);
      return;
    }
    uploadFileToServer(file);
    remaining--;
  });
}

async function uploadFileToServer(file) {
  const progressList = document.getElementById('edProgressList');
  if (progressList) progressList.style.display = '';

  const itemId = 'upload-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  const progressHTML = `
    <div class="ed-progress-item" id="${itemId}">
      <div class="ed-progress-icon"><i class="fas fa-video"></i></div>
      <div class="ed-progress-info">
        <div class="ed-progress-name">${file.name}</div>
        <div class="ed-progress-bar">
          <div class="ed-progress-fill" id="${itemId}-fill" style="width: 0%"></div>
        </div>
      </div>
      <div class="ed-progress-percent" id="${itemId}-percent">0%</div>
    </div>
  `;
  progressList.insertAdjacentHTML('beforeend', progressHTML);

  const getEl = (suffix) => document.getElementById(itemId + suffix);

  // Animate progress to 90% while waiting for server
  let progress = 0;
  const animInterval = setInterval(() => {
    if (progress < 90) {
      progress += Math.random() * 8 + 3;
      if (progress > 90) progress = 90;
      const fill = getEl('-fill');
      const pct = getEl('-percent');
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.round(progress) + '%';
    }
  }, 300);

  try {
    const formData = new FormData();
    const removeDiacritics = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    formData.append('file', file);
    formData.append('studentName', removeDiacritics(currentExam?.studentName || ''));
    formData.append('examTitle', removeDiacritics(currentExam?.name || ''));

    const uploadCsrf = (typeof _getCsrfToken === 'function') ? _getCsrfToken() : null;
    const uploadHeaders = {};
    if (uploadCsrf) uploadHeaders['X-XSRF-TOKEN'] = uploadCsrf;

    const response = await fetch('http://103.75.182.246:8080/public/upload-student-exam', {
      method: 'POST',
      headers: uploadHeaders,
      credentials: 'include',
      body: formData
    });

    clearInterval(animInterval);

    if (!response.ok) {
      throw new Error('Upload thất bại: ' + response.status);
    }

    const json = await response.json();
    if (json.code !== 200) {
      throw new Error(json.message || 'Upload thất bại');
    }

    const fill = getEl('-fill');
    const pct = getEl('-percent');
    if (fill) fill.style.width = '100%';
    if (pct) {
      pct.textContent = '✓';
      pct.classList.add('ed-progress-done');
    }

    onUploadComplete(file, itemId, json.data.url);
  } catch (err) {
    clearInterval(animInterval);
    const fill = getEl('-fill');
    const pct = getEl('-percent');
    if (fill) fill.style.width = '0%';
    if (pct) {
      pct.textContent = '✗';
      pct.style.color = '#ef4444';
    }
    showToast('Tải lên thất bại: ' + (err.message || 'Lỗi không xác định'));
    setTimeout(() => {
      const item = document.getElementById(itemId);
      if (item) item.remove();
      const list = document.getElementById('edProgressList');
      if (list && list.children.length === 0) list.style.display = 'none';
    }, 2000);
  }
}

function onUploadComplete(file, itemId, serverUrl) {
  const percentEl = document.getElementById(itemId + '-percent');
  if (percentEl) {
    percentEl.textContent = '✓';
    percentEl.classList.add('ed-progress-done');
  }

  const videoRecord = {
    name: file.name,
    size: file.size,
    type: file.type,
    serverUrl: serverUrl,
    blobUrl: serverUrl,
    thumbnailUrl: serverUrl,
    uploadTime: new Date().toLocaleString('vi-VN'),
  };

  uploadedVideos.push(videoRecord);
  saveUploadedVideos();
  renderVideoList();
  showToast('Tải video "' + file.name + '" thành công!');

  // Lưu tạm (DRAFT) lên server sau mỗi lần upload video
  callSubmissionApi('DRAFT').then(result => {
    if (result) {
      sessionStorage.setItem(getVideoStorageKey() + '_status', 'DRAFT');
      renderDraftBadge();
    }
  }).catch(err => console.warn('DRAFT submission error', err));

  // Remove progress item after delay
  setTimeout(() => {
    const item = document.getElementById(itemId);
    if (item) item.remove();
    const progressList = document.getElementById('edProgressList');
    if (progressList && progressList.children.length === 0) {
      progressList.style.display = 'none';
    }
  }, 1500);
}

// ---- VIDEO PLAYBACK ----
function playVideo(idx) {
  const video = uploadedVideos[idx];
  if (!video) return;

  const modal = document.getElementById('edVideoModal');
  const player = document.getElementById('edModalPlayer');
  const title = document.getElementById('edModalVideoTitle');

  if (!modal || !player) return;

  title.textContent = video.name;
  player.src = video.blobUrl;
  modal.style.display = 'flex';

  player.play().catch(() => {});
}

function openReferenceVideo(idx) {
  const sampleVideos = referenceVideos.length > 0
    ? referenceVideos
    : (Array.isArray(currentExam?.videos) ? currentExam.videos : []);
  const video = sampleVideos[idx];
  if (!video) return;

  const source = getSampleVideoSource(video);
  if (!source) {
    showToast('Video mẫu hiện chỉ có thông tin tham khảo, chưa có file phát trực tiếp trong hệ thống.');
    return;
  }

  const modal = document.getElementById('edVideoModal');
  const player = document.getElementById('edModalPlayer');
  const title = document.getElementById('edModalVideoTitle');

  if (!modal || !player || !title) return;

  title.textContent = video.name || 'Video mẫu tham khảo';
  player.src = source;
  modal.style.display = 'flex';
  player.play().catch(() => {});
}

function closeVideoModal() {
  const modal = document.getElementById('edVideoModal');
  const player = document.getElementById('edModalPlayer');
  if (modal) modal.style.display = 'none';
  if (player) {
    player.pause();
    player.src = '';
  }
}

// ---- DELETE VIDEO ----
function deleteVideo(idx) {
  const video = uploadedVideos[idx];
  if (!video) return;
  if (isSubmissionClosed()) {
    showToast('Đã hết thời gian nộp bài, không thể xóa video.');
    return;
  }
  const modal = document.getElementById('edDeleteModal');
  const nameEl = document.getElementById('edDeleteVideoName');
  pendingDeleteVideoIndex = idx;
  if (nameEl) {
    nameEl.textContent = video.name;
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeDeleteModal() {
  const modal = document.getElementById('edDeleteModal');
  if (modal) {
    modal.style.display = 'none';
  }
  pendingDeleteVideoIndex = null;
}

function confirmDeleteVideo() {
  if (pendingDeleteVideoIndex === null || pendingDeleteVideoIndex === undefined) {
    closeDeleteModal();
    return;
  }

  if (isSubmissionClosed()) {
    closeDeleteModal();
    showToast('Đã hết thời gian nộp bài, không thể xóa video.');
    return;
  }

  const idx = pendingDeleteVideoIndex;
  const video = uploadedVideos[idx];
  closeDeleteModal();
  if (!video) return;

  uploadedVideos.splice(idx, 1);
  saveUploadedVideos();
  renderVideoList();
  showToast('Đã xóa video');
}

// ---- NAVIGATION ----
function goBack() {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const role = ((sessionStorage.getItem('currentUserRole') || currentUser?.role || '')).toLowerCase().replace('role_', '');
  if (role === 'student') {
    sessionStorage.setItem('homeActiveTab', 'st-exams');
  }
  window.history.length > 1 ? window.history.back() : (window.location.href = '/pages/home.html');
}

// ---- TOAST ----
function showToast(msg) {
  const toast = document.getElementById('edToast');
  const msgEl = document.getElementById('edToastMsg');
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// ---- UTILS ----
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ---- FETCH SUBMISSION STATUS FROM SERVER ----
async function fetchAndUpdateScores() {
  if (!currentExam) return;

  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const studentId = currentExam?.studentCode
    || currentUser?.studentId
    || currentUser?.id
    || currentUser?.username
    || '';
  if (!studentId) return;

  try {
    // Lấy submissionId từ bài nộp
    const subUrl = API_CONFIG.ENDPOINTS.STUDENT_SUBMISSIONS_BY_STUDENT(studentId);
    const subResponse = await fetch(subUrl, { credentials: 'include' });
    if (!subResponse.ok) return;
    const subJson = await subResponse.json().catch(() => null);
    const subList = Array.isArray(subJson?.data) ? subJson.data : [];
    const classExamId = currentExam?.classExamId ?? currentExam?.id;
    const submission = subList.find(item => String(item.idClassExam) === String(classExamId));
    if (!submission) return;

    const submissionId = submission.id ?? submission.submissionId;
    if (submissionId == null) return;

    // Lấy điểm theo submissionId
    const scoreUrl = API_CONFIG.ENDPOINTS.STUDENT_MY_EXAM(studentId);
    const scoreResponse = await fetch(scoreUrl, { credentials: 'include' });
    if (!scoreResponse.ok) return;
    const scoreJson = await scoreResponse.json().catch(() => null);
    const scoreList = Array.isArray(scoreJson?.data) ? scoreJson.data : [];
    const scoreEntry = scoreList.find(e => String(e.submissionId) === String(submissionId));
    if (!scoreEntry) return;

    // Cập nhật currentExam và re-render nếu điểm thay đổi
    const newPractice = scoreEntry.practiceScore ?? null;
    const newOfficial = scoreEntry.officialScore ?? null;
    if (newPractice !== currentExam.practiceScore || newOfficial !== currentExam.officialScore) {
      currentExam.practiceScore = newPractice;
      currentExam.practiceStatus = scoreEntry.practiceStatus ?? null;
      currentExam.officialScore = newOfficial;
      currentExam.officialStatus = scoreEntry.officialStatus ?? null;
      currentExam.submissionId = submissionId;
      sessionStorage.setItem('selectedExamDetail', JSON.stringify(currentExam));
      renderScores();
    }
  } catch (err) {
    console.warn('fetchAndUpdateScores error', err);
  }
}

async function fetchAndRestoreSubmissionStatus() {
  if (!currentExam) return;

  const classExamId = currentExam?.classExamId ?? currentExam?.id;
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  const studentId = currentExam?.studentCode
    || currentUser?.studentId
    || currentUser?.id
    || currentUser?.username
    || '';

  if (!classExamId || !studentId) return;

  const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.STUDENT_SUBMISSIONS_BY_STUDENT)
    ? API_CONFIG.ENDPOINTS.STUDENT_SUBMISSIONS_BY_STUDENT(studentId)
    : `http://103.75.182.246:8080/student/submission/${encodeURIComponent(studentId)}`;

  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return;

    const json = await response.json().catch(() => null);
    const list = Array.isArray(json?.data) ? json.data : [];

    // Tìm bài nộp khớp với classExamId hiện tại
    const submission = list.find(item => String(item.idClassExam) === String(classExamId));
    if (!submission) return;

    const status = submission.status;
    const storageKey = getVideoStorageKey();

    // Khôi phục danh sách video từ server nếu sessionStorage không có
    const storedVideos = sessionStorage.getItem(storageKey);
    if (!storedVideos || JSON.parse(storedVideos).length === 0) {
      const restoredVideos = [];
      if (submission.videoUrl1) {
        restoredVideos.push({
          name: 'Video 1',
          size: submission.fileSizeBytes1 || 0,
          type: 'video/mp4',
          serverUrl: submission.videoUrl1,
          blobUrl: submission.videoUrl1,
          thumbnailUrl: submission.videoUrl1,
          uploadTime: '',
        });
      }
      if (submission.videoUrl2) {
        restoredVideos.push({
          name: 'Video 2',
          size: submission.fileSizeBytes2 || 0,
          type: 'video/mp4',
          serverUrl: submission.videoUrl2,
          blobUrl: submission.videoUrl2,
          thumbnailUrl: submission.videoUrl2,
          uploadTime: '',
        });
      }
      if (restoredVideos.length > 0) {
        uploadedVideos = restoredVideos;
        saveUploadedVideos();
        renderVideoList();
      }
    }

    if (status === 'SUBMITTED') {
      sessionStorage.setItem(storageKey + '_submitted', 'true');
      sessionStorage.setItem(storageKey + '_status', 'SUBMITTED');
      renderSubmittedBadge();
      updateUploadAreaVisibility();
    } else if (status === 'DRAFT') {
      sessionStorage.setItem(storageKey + '_status', 'DRAFT');
      renderDraftBadge();
      updateUploadAreaVisibility();
    }
  } catch (err) {
    console.warn('fetchAndRestoreSubmissionStatus error', err);
  }
}

// ---- SUBMISSION API ----
function buildSubmissionPayload(status) {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');
  // idStudent: ưu tiên studentCode lưu trong currentExam (set bởi openExamDetail),
  // fallback về currentUser.studentId / id / username
  const idStudent = currentExam?.studentCode
    || currentUser?.studentId
    || currentUser?.id
    || currentUser?.username
    || '';
  // classExamId là ID của bản ghi class_exam (item.id), khác với examType id (currentExam.id)
  const idClassExam = currentExam?.classExamId ?? currentExam?.id;

  const video1 = uploadedVideos[0] || null;
  const video2 = uploadedVideos[1] || null;

  return {
    idClassExam: idClassExam,
    idStudent: String(idStudent),
    videoUrl1: video1?.serverUrl || null,
    fileSizeBytes1: video1?.size || null,
    videoUrl2: video2?.serverUrl || null,
    fileSizeBytes2: video2?.size || null,
    status: status
  };
}

async function callSubmissionApi(status) {
  const payload = buildSubmissionPayload(status);
  const url = (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENDPOINTS.STUDENT_SUBMISSION)
    ? API_CONFIG.ENDPOINTS.STUDENT_SUBMISSION
    : 'http://103.75.182.246:8080/student/submission';

  try {
    let studentDataStr = null;
    const aiVideoUrl = payload.videoUrl1 || payload.videoUrl2;
    if (aiVideoUrl) {
      showToast('Đang trích xuất dữ liệu khung xương, vui lòng đợi...');
      try {
        const aiRes = await fetch('https://stung-ceremony-charity.ngrok-free.dev/api/ai/extract-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: aiVideoUrl })
        });
        const aiJson = await aiRes.json();
        if (aiJson?.status === 'success' && aiJson?.studentData) {
          studentDataStr = JSON.stringify(aiJson.studentData);
          showToast('Trích xuất dữ liệu thành công!');
        } else {
          showToast('Trích xuất dữ liệu không thành công.');
        }
      } catch (aiErr) {
        console.warn('Lỗi trích xuất khung xương:', aiErr);
        showToast('Lỗi khi trích xuất dữ liệu khung xương.');
      }
    }
    payload.studentData = studentDataStr;

    const csrfToken = (typeof _getCsrfToken === 'function') ? _getCsrfToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('callSubmissionApi error', response.status, json);
      return null;
    }

    // Lưu submission id để tham chiếu sau này
    if (json?.data?.id) {
      sessionStorage.setItem(getVideoStorageKey() + '_submissionId', String(json.data.id));
    }

    return json;
  } catch (err) {
    console.error('callSubmissionApi fetch error', err);
    return null;
  }
}

// ---- SUBMIT ----
function confirmSubmit() {
  if (isSubmissionClosed()) {
    showToast('Đã hết thời gian nộp bài, không thể nộp bài.');
    return;
  }

  if (uploadedVideos.length === 0) {
    showToast('Vui lòng tải lên ít nhất 1 video trước khi nộp');
    return;
  }
  const modal = document.getElementById('edConfirmModal');
  const countEl = document.getElementById('edConfirmCount');
  const examEl = document.getElementById('edConfirmExam');
  if (countEl) countEl.textContent = uploadedVideos.length;
  if (examEl) examEl.textContent = currentExam.name;
  if (modal) modal.style.display = 'flex';
}

function closeConfirmModal() {
  const modal = document.getElementById('edConfirmModal');
  if (modal) modal.style.display = 'none';
}

async function submitVideos() {
  if (isSubmissionClosed()) {
    closeConfirmModal();
    showToast('Đã hết thời gian nộp bài, không thể nộp bài.');
    return;
  }

  closeConfirmModal();

  // Disable button to prevent double-submit
  const btnConfirm = document.querySelector('#edConfirmModal .ed-btn-confirm');
  if (btnConfirm) btnConfirm.disabled = true;

  const result = await callSubmissionApi('SUBMITTED');

  if (btnConfirm) btnConfirm.disabled = false;

  if (!result) {
    showToast('Nộp bài thất bại, vui lòng thử lại.');
    return;
  }

  sessionStorage.setItem(getVideoStorageKey() + '_submitted', 'true');
  updateUploadAreaVisibility();
  showToast('Nộp bài thành công!');
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.id === 'edVideoModal') {
    closeVideoModal();
  }
  if (e.target.id === 'edConfirmModal') {
    closeConfirmModal();
  }
  if (e.target.id === 'edDeleteModal') {
    closeDeleteModal();
  }
});

// ESC to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeVideoModal();
    closeConfirmModal();
    closeDeleteModal();
  }
});

window.addEventListener('beforeunload', releaseReferenceVideoObjectUrls);

document.addEventListener('DOMContentLoaded', initPage);
