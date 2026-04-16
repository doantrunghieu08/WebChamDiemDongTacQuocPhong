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

function syncCurrentExamScores(nextOfficialScore) {
  if (!currentExam?.classId || !currentExam?.studentCode || !currentExam?.id) {
    return;
  }

  const scores = JSON.parse(localStorage.getItem('examScores') || '{}');
  const officialKey = `${currentExam.classId}_${currentExam.studentCode}_${currentExam.id}_official`;
  scores[officialKey] = nextOfficialScore;
  localStorage.setItem('examScores', JSON.stringify(scores));

  currentExam.officialScore = nextOfficialScore;
  localStorage.setItem('selectedExamDetail', JSON.stringify(currentExam));
}

function getExamSpecificSampleTemplate() {
  const templates = {
    'di-deu': {
      gradedAt: '2026-04-14T09:15:00',
      history: [
        {
          id: 'sample-frame-1',
          frameTs: 18,
          video: 1,
          total: -1.0,
          errors: [
            {
              id: 1,
              name: 'Sai nhịp tay',
              score: -0.5,
              note: 'Tay đánh chưa đều, chậm hơn nhịp bước ở đoạn đầu.'
            },
            {
              id: 4,
              name: 'Mắt không nhìn thẳng',
              score: -0.5,
              note: 'Ánh nhìn bị lệch xuống dưới khi thực hiện động tác.'
            }
          ]
        },
        {
          id: 'sample-frame-2',
          frameTs: 42,
          video: 1,
          total: -1.0,
          errors: [
            {
              id: 3,
              name: 'Dáng người gù',
              score: -1.0,
              note: 'Lưng chưa giữ thẳng khi chuyển nhịp, làm sai tư thế tổng thể.'
            }
          ]
        }
      ]
    },
    'ban-sung': {
      gradedAt: '2026-04-14T10:05:00',
      history: [
        {
          id: 'sample-frame-1',
          frameTs: 12,
          video: 1,
          total: -1.5,
          errors: [
            {
              id: 5,
              name: 'Tay không đúng tư thế',
              score: -0.5,
              note: 'Tay giữ súng chưa đúng vị trí chuẩn khi vào tư thế ngắm.'
            },
            {
              id: 4,
              name: 'Mắt không nhìn thẳng',
              score: -0.5,
              note: 'Mắt chưa căn đúng đường ngắm về mục tiêu.'
            },
            {
              id: 2,
              name: 'Bàn chân không vuông',
              score: -0.5,
              note: 'Bước chân mở chưa đúng góc, làm mất thăng bằng tư thế bắn.'
            }
          ]
        },
        {
          id: 'sample-frame-2',
          frameTs: 36,
          video: 2,
          total: -1.0,
          errors: [
            {
              id: 3,
              name: 'Dáng người gù',
              score: -1.0,
              note: 'Vai và lưng bị khom khi giữ súng, chưa đúng tư thế ổn định.'
            }
          ]
        }
      ]
    },
    'vo-thuat': {
      gradedAt: '2026-04-14T11:20:00',
      history: [
        {
          id: 'sample-frame-1',
          frameTs: 20,
          video: 1,
          total: -1.0,
          errors: [
            {
              id: 2,
              name: 'Bàn chân không vuông',
              score: -0.5,
              note: 'Trụ chân chưa chắc, mũi chân xoay sai hướng ở động tác chuyển thế.'
            },
            {
              id: 5,
              name: 'Tay không đúng tư thế',
              score: -0.5,
              note: 'Tay ra đòn chưa đủ biên độ theo yêu cầu của bài quyền.'
            }
          ]
        },
        {
          id: 'sample-frame-2',
          frameTs: 51,
          video: 1,
          total: -0.5,
          errors: [
            {
              id: 4,
              name: 'Mắt không nhìn thẳng',
              score: -0.5,
              note: 'Hướng nhìn chưa bám theo mục tiêu ở cuối động tác.'
            }
          ]
        }
      ]
    },
    'the-duc': {
      gradedAt: '2026-04-14T13:10:00',
      history: [
        {
          id: 'sample-frame-1',
          frameTs: 15,
          video: 1,
          total: -0.5,
          errors: [
            {
              id: 1,
              name: 'Sai nhịp tay',
              score: -0.5,
              note: 'Nhịp nâng tay chưa trùng với nhịp bài thể dục mẫu.'
            }
          ]
        },
        {
          id: 'sample-frame-2',
          frameTs: 34,
          video: 1,
          total: -1.0,
          errors: [
            {
              id: 3,
              name: 'Dáng người gù',
              score: -0.5,
              note: 'Thân người chưa giữ thẳng ở động tác cúi và bật lên.'
            },
            {
              id: 5,
              name: 'Tay không đúng tư thế',
              score: -0.5,
              note: 'Biên độ mở tay chưa đạt chuẩn ở nhịp giữa bài.'
            }
          ]
        }
      ]
    },
    'chay-vu-trang': {
      gradedAt: '2026-04-14T14:00:00',
      history: [
        {
          id: 'sample-frame-1',
          frameTs: 22,
          video: 1,
          total: -1.0,
          errors: [
            {
              id: 2,
              name: 'Bàn chân không vuông',
              score: -0.5,
              note: 'Bước tiếp đất chưa chắc, hướng bàn chân lệch khi chạy mang vũ trang.'
            },
            {
              id: 1,
              name: 'Sai nhịp tay',
              score: -0.5,
              note: 'Nhịp đánh tay chưa đều với tốc độ chạy.'
            }
          ]
        },
        {
          id: 'sample-frame-2',
          frameTs: 48,
          video: 2,
          total: -0.5,
          errors: [
            {
              id: 3,
              name: 'Dáng người gù',
              score: -0.5,
              note: 'Tư thế thân trên đổ quá nhiều về trước, chưa đúng kỹ thuật.'
            }
          ]
        }
      ]
    }
  };

  return templates[currentExam?.id] || {
    gradedAt: '2026-04-14T09:15:00',
    history: [
      {
        id: 'sample-frame-1',
        frameTs: 18,
        video: 1,
        total: -0.5,
        errors: [
          {
            id: 5,
            name: 'Tay không đúng tư thế',
            score: -0.5,
            note: `Tư thế thực hiện của bài ${currentExam?.name || 'này'} chưa đúng ở giai đoạn đầu.`
          }
        ]
      },
      {
        id: 'sample-frame-2',
        frameTs: 40,
        video: 1,
        total: -0.5,
        errors: [
          {
            id: 4,
            name: 'Mắt không nhìn thẳng',
            score: -0.5,
            note: 'Hướng nhìn chưa ổn định ở đoạn giữa bài thi.'
          }
        ]
      }
    ]
  };
}

function ensureSampleGradingData() {
  if (!currentExam?.classId || !currentExam?.studentCode || !currentExam?.id) {
    return;
  }

  const existingRecords = getAllGradingHistoryRecords();
  const currentRecord = existingRecords.find(record => record.classId === currentExam.classId
    && record.studentCode === currentExam.studentCode
    && record.examId === currentExam.id);

  if (currentRecord && !currentRecord.isSample) {
    return;
  }

  const sampleTemplate = getExamSpecificSampleTemplate();
  const submittedAt = new Date(sampleTemplate.gradedAt);
  const sampleHistory = sampleTemplate.history;

  const totalDeductions = sampleHistory.reduce((sum, frame) => sum + (Number(frame.total) || 0), 0);
  const finalScore = Math.max(0, 10 + totalDeductions);
  const sampleRecord = {
    id: `sample-grading-${currentExam.classId}-${currentExam.studentCode}-${currentExam.id}`,
    isSample: true,
    teacherId: 'GV001',
    teacherName: 'Nguyễn Văn A',
    classId: currentExam.classId,
    className: currentExam.className || 'Lớp Quân sự 1',
    studentCode: currentExam.studentCode,
    studentName: currentExam.studentName || 'Nguyễn Văn An',
    examId: currentExam.id,
    examName: currentExam.name || 'Bài thi',
    gradingMode: 'official',
    timestamp: submittedAt.toLocaleString('vi-VN'),
    timestampIso: submittedAt.toISOString(),
    finalScore,
    totalDeductions,
    totalFrames: sampleHistory.length,
    history: sampleHistory,
    videoStorageKey: getVideoStorageKey()
  };

  const filteredRecords = existingRecords.filter(record => !(record.classId === currentExam.classId
    && record.studentCode === currentExam.studentCode
    && record.examId === currentExam.id
    && record.isSample));

  saveAllGradingHistoryRecords([sampleRecord, ...filteredRecords]);
  syncCurrentExamScores(finalScore);
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
function initPage() {
  currentExam = JSON.parse(localStorage.getItem('selectedExamDetail') || 'null');
  if (!currentExam) {
    window.location.href = '/pages/home.html';
    return;
  }

  ensureSampleGradingData();
  loadUploadedVideos();
  renderExamInfo();
  renderReferenceVideos().catch(() => {
    showToast('Không thể tải video mẫu để phát trực tiếp.');
  });
  renderScores();
  renderGradingDetails();
  renderVideoList();
  setupUploadHandlers();
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
    .filter(record => record.classId === currentExam.classId
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

function renderGradingDetails() {
  const container = document.getElementById('edGradingDetailCard');
  if (!container) return;

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

// ---- VIDEO STORAGE (localStorage) ----
function getVideoStorageKey() {
  return 'examVideos_' + (currentExam.classId || '1') + '_' + currentExam.studentCode + '_' + currentExam.id;
}

function loadUploadedVideos() {
  const stored = localStorage.getItem(getVideoStorageKey());
  uploadedVideos = stored ? JSON.parse(stored) : [];
}

function saveUploadedVideos() {
  localStorage.setItem(getVideoStorageKey(), JSON.stringify(uploadedVideos));
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
  const isSubmitted = localStorage.getItem(getVideoStorageKey() + '_submitted') === 'true';
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

  const isSubmitted = localStorage.getItem(getVideoStorageKey() + '_submitted') === 'true';
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
    simulateUpload(file);
    remaining--;
  });
}

function simulateUpload(file) {
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

  // Simulate progress
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15 + 5;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      onUploadComplete(file, itemId);
    }
    const fill = document.getElementById(itemId + '-fill');
    const percent = document.getElementById(itemId + '-percent');
    if (fill) fill.style.width = progress + '%';
    if (percent) percent.textContent = Math.round(progress) + '%';
  }, 200);
}

function onUploadComplete(file, itemId) {
  const percentEl = document.getElementById(itemId + '-percent');
  if (percentEl) {
    percentEl.textContent = '✓';
    percentEl.classList.add('ed-progress-done');
  }

  // Create blob URL for preview
  const blobUrl = URL.createObjectURL(file);

  const videoRecord = {
    name: file.name,
    size: file.size,
    type: file.type,
    blobUrl: blobUrl,
    thumbnailUrl: blobUrl,
    uploadTime: new Date().toLocaleString('vi-VN'),
  };

  uploadedVideos.push(videoRecord);
  saveUploadedVideos();
  renderVideoList();
  showToast('Tải video "' + file.name + '" thành công!');

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

  // Revoke blob URL
  if (video.blobUrl) {
    URL.revokeObjectURL(video.blobUrl);
  }

  uploadedVideos.splice(idx, 1);
  saveUploadedVideos();
  renderVideoList();
  showToast('Đã xóa video');
}

// ---- NAVIGATION ----
function goBack() {
  window.location.href = '/pages/home.html';
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

function submitVideos() {
  if (isSubmissionClosed()) {
    closeConfirmModal();
    showToast('Đã hết thời gian nộp bài, không thể nộp bài.');
    return;
  }

  closeConfirmModal();
  localStorage.setItem(getVideoStorageKey() + '_submitted', 'true');
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
