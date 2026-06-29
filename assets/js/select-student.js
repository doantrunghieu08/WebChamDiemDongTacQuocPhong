// ===== SELECT STUDENT PAGE LOGIC =====

// ---- Pagination state ----
const PAGE_SIZE = 10;
let currentPage = 0;
let totalPages = 1;
let totalElements = 0;
let currentSearch = '';
let currentClassId = '';

// Check if user is logged in and class is selected
function checkSessionStatus() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const selectedClass = JSON.parse(sessionStorage.getItem('selectedClass'));
  
  if (!currentUser || !selectedClass) {
    window.location.href = '/pages/home.html';
    return null;
  }
  
  return { currentUser, selectedClass };
}

// Build base host from config
function getBaseHost() {
  const adminBase = API_CONFIG?.ADMIN_BASE_URL || '';
  return (adminBase.split('/admin')[0]) ||
    (API_CONFIG?.BASE_URL?.split('/public')[0]) ||
    `${location.protocol}//${location.host}`;
}

// Fetch a page of students from server (returns { students, totalPages, totalElements })
async function fetchStudentsPage(classId, page, size, keyword) {
  if (!classId) return null;
  const baseHost = getBaseHost();
  let url;
  if (keyword && keyword.trim()) {
    url = `${baseHost}/public/classes/${encodeURIComponent(classId)}/search?keyword=${encodeURIComponent(keyword.trim())}&page=${page}&size=${size}`;
  } else {
    url = `${baseHost}/classes/api/${encodeURIComponent(classId)}?page=${page}&size=${size}`;
  }
  const headers = { Accept: 'application/json' };
  try {
    let res = await fetch(url, { headers, credentials: 'include' });
    if (res.status === 401 && typeof ApiClient?._refreshToken === 'function') {
      const refreshed = await ApiClient._refreshToken();
      if (refreshed) res = await fetch(url, { headers, credentials: 'include' });
    }
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json) return null;

    // API trả về { code, data: { content: [...], totalPages, totalElements } }
    const pageData = json?.data;
    const rawList = Array.isArray(pageData?.content) ? pageData.content
                  : Array.isArray(pageData) ? pageData
                  : Array.isArray(json?.content) ? json.content
                  : null;
    if (!rawList) return null;

    const students = rawList.map((s, i) => ({
      studentId: s.id || s.code || s.studentId || `${classId}-${String(i + 1).padStart(3, '0')}`,
      name: s.fullName || s.name || '',
      avatarImage: s.avatarImage || null,
      classId: classId,
    }));

    return {
      students,
      totalPages: pageData?.totalPages ?? 1,
      totalElements: pageData?.totalElements ?? students.length,
      currentPage: pageData?.pageable?.pageNumber ?? page,
    };
  } catch (err) {
    console.error('fetchStudentsPage error', err);
    return null;
  }
}

// Render students list
function renderStudents(students) {
  const studentsList = document.getElementById('studentsList');
  const emptyState = document.getElementById('emptyState');
  
  if (!students || students.length === 0) {
    studentsList.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  studentsList.innerHTML = students.map(student => {
    const safeName = student.name.replace(/'/g, "\\'");
    const safeId = student.studentId.replace(/'/g, "\\'");
    let avatarHtml;
    if (student.avatarImage) {
      avatarHtml = `<img class="student-avatar student-avatar-img" src="${student.avatarImage}" alt="${student.name}" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=\'student-avatar student-avatar-fallback\'><i class=\'fas fa-user\'></i></div>')">`;
    } else {
      avatarHtml = `<div class="student-avatar student-avatar-fallback"><i class="fas fa-user"></i></div>`;
    }
    return `
      <div class="student-item" onclick="showGradingModeModal('${safeId}', '${safeName}')">
        ${avatarHtml}
        <div class="student-info">
          <div class="student-name">${student.name}</div>
          <div class="student-meta">Mã: ${student.studentId}</div>
        </div>
        <button class="student-action" onclick="showGradingModeModal('${safeId}', '${safeName}'); event.stopPropagation();">
          Chấm điểm
        </button>
      </div>
    `;
  }).join('');
  
  studentsList.style.display = 'flex';
  emptyState.style.display = 'none';
}

function getInitials(name) {
  return (name || '')
    .split(' ')
    .filter(w => w)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Render pagination controls
function renderPagination() {
  const container = document.getElementById('paginationContainer');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const prevDisabled = currentPage === 0 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages - 1 ? 'disabled' : '';

  let pageButtons = '';
  const maxVisible = 5;
  let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages - 1, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(0, end - maxVisible + 1);

  for (let i = start; i <= end; i++) {
    const active = i === currentPage ? 'pagination-active' : '';
    pageButtons += `<button class="pagination-btn ${active}" onclick="goToPage(${i})">${i + 1}</button>`;
  }

  container.innerHTML = `
    <div class="pagination-info">
      Hiển thị ${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, totalElements)} / ${totalElements} sinh viên
    </div>
    <div class="pagination-controls">
      <button class="pagination-btn pagination-nav" onclick="goToPage(${currentPage - 1})" ${prevDisabled}>&#8249;</button>
      ${pageButtons}
      <button class="pagination-btn pagination-nav" onclick="goToPage(${currentPage + 1})" ${nextDisabled}>&#8250;</button>
    </div>
  `;
}

// Navigate to a page
async function goToPage(page) {
  if (page < 0 || page >= totalPages) return;
  currentPage = page;
  await loadStudents();
}

// Load students for current page & search
async function loadStudents() {
  const result = await fetchStudentsPage(currentClassId, currentPage, PAGE_SIZE, currentSearch);
  if (result) {
    totalPages = result.totalPages;
    totalElements = result.totalElements;
    renderStudents(result.students);
  } else {
    renderStudents([]);
  }
  renderPagination();
}

// Debounce helper
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Show grading mode modal
function showGradingModeModal(studentId, studentName) {
  const selectedClass = JSON.parse(sessionStorage.getItem('selectedClass'));
  const modal = document.getElementById('gradingModeModal');
  
  // Store current student data for selection
  window.currentSelectStudent = {
    studentId: studentId,
    name: studentName,
    classId: selectedClass.classId,
    className: selectedClass.className,
    subject: selectedClass.subject
  };
  
  // Update modal info
  document.getElementById('modalStudentInfo').textContent = 
    `Chấm điểm cho: ${studentName} - ${selectedClass.className}`;
  
  // Show modal
  modal.classList.add('show');
}

// Close grading mode modal
function closeGradingModeModal() {
  const modal = document.getElementById('gradingModeModal');
  modal.classList.remove('show');
}

function selectMode(mode) {
  const studentData = window.currentSelectStudent;
  
  sessionStorage.setItem('selectedStudent', JSON.stringify(studentData));
  sessionStorage.setItem('gradingMode', mode);
  
  closeGradingModeModal();
  window.location.href = '/pages/chamdiem.html';
}

// Select a student and go to grading page (legacy - can be removed)
function selectStudent(studentId, studentName) {
  showGradingModeModal(studentId, studentName);
}

// Handle logout
function handleLogout() {
  document.getElementById('logoutModal').style.display = 'flex';
}

function closeLogoutModal() {
  document.getElementById('logoutModal').style.display = 'none';
}

function confirmLogout() {
  AuthService.logout();
}

function goBack() {
  window.location.href = '/pages/home.html';
}

// Initialize page
async function initializePage() {
  const session = checkSessionStatus();
  const { selectedClass } = session;

  currentClassId = selectedClass.classId;
  currentPage = 0;
  currentSearch = '';

  // Set class info
  document.getElementById('className').textContent = selectedClass.className;
  document.getElementById('classSubject').textContent = selectedClass.subject;
  document.getElementById('totalStudents').textContent = selectedClass.studentCount;
  document.getElementById('classYear').textContent = selectedClass.year;

  // Load first page
  await loadStudents();

  // Setup search with debounce (server-side)
  const searchInput = document.getElementById('searchInput');
  const debouncedSearch = debounce(async (term) => {
    currentSearch = term;
    currentPage = 0;
    await loadStudents();
  }, 400);

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  // Setup buttons
  document.getElementById('btnBack').addEventListener('click', goBack);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);

  // Setup modal close functionality
  const modal = document.getElementById('gradingModeModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeGradingModeModal();
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGradingModeModal();
  });

  // Auto-focus search input
  searchInput.focus();
}

// Run when page loads
document.addEventListener('DOMContentLoaded', initializePage);
