// ===== SELECT STUDENT PAGE LOGIC =====

// Check if user is logged in and class is selected
function checkSessionStatus() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const selectedClass = JSON.parse(localStorage.getItem('selectedClass'));
  
  if (!currentUser || !selectedClass) {
    window.location.href = '/pages/home.html';
    return null;
  }
  
  return { currentUser, selectedClass };
}

// Generate sample students for the class
function generateStudents(classId, count) {
  const firstNames = ['Nguyễn', 'Trần', 'Phạm', 'Hoàng', 'Lê', 'Võ', 'Bùi', 'Đặng', 'Vũ', 'Tô'];
  const lastNames = ['Công', 'Minh', 'Hà', 'Tùng', 'Dương', 'Anh', 'Tiến', 'Cường', 'Khoa', 'An', 'Thành', 'Quân', 'Huy', 'Nhân', 'Tài'];
  
  const students = [];
  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;
    const studentId = `${classId}-${String(i).padStart(3, '0')}`;
    
    students.push({
      studentId: studentId,
      name: fullName,
      classId: classId,
      status: 'active'
    });
  }
  
  return students;
}

// Get students for the selected class
function getClassStudents(classId, studentCount) {
  const storageKey = `students_${classId}`;
  const stored = localStorage.getItem(storageKey);
  
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Generate and save sample students
  const students = generateStudents(classId, studentCount);
  localStorage.setItem(storageKey, JSON.stringify(students));
  return students;
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
    const initials = student.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    return `
      <div class="student-item" onclick="showGradingModeModal('${student.studentId}', '${student.name}')">
        <div class="student-avatar">${initials}</div>
        <div class="student-info">
          <div class="student-name">${student.name}</div>
          <div class="student-meta">Mã: ${student.studentId}</div>
        </div>
        <button class="student-action" onclick="showGradingModeModal('${student.studentId}', '${student.name}'); event.stopPropagation();">
          Chấm điểm
        </button>
      </div>
    `;
  }).join('');
  
  studentsList.style.display = 'flex';
  emptyState.style.display = 'none';
}

// Filter students based on search
function filterStudents(searchTerm, allStudents) {
  if (!searchTerm.trim()) {
    return allStudents;
  }
  
  const term = searchTerm.toLowerCase();
  return allStudents.filter(student => 
    student.name.toLowerCase().includes(term) ||
    student.studentId.toLowerCase().includes(term)
  );
}

// Show grading mode modal
function showGradingModeModal(studentId, studentName) {
  const selectedClass = JSON.parse(localStorage.getItem('selectedClass'));
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
  
  localStorage.setItem('selectedStudent', JSON.stringify(studentData));
  localStorage.setItem('gradingMode', mode);
  
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
  localStorage.removeItem('currentUser');
  localStorage.removeItem('selectedClass');
  localStorage.removeItem('selectedClassId');
  localStorage.removeItem('selectedStudent');
  window.location.href = '/index.html';
}

function goBack() {
  window.location.href = '/pages/home.html';
}

// Initialize page
function initializePage() {
  const session = checkSessionStatus();
  const { selectedClass } = session;
  
  // Set class info
  document.getElementById('className').textContent = selectedClass.className;
  document.getElementById('classSubject').textContent = selectedClass.subject;
  document.getElementById('totalStudents').textContent = selectedClass.studentCount;
  document.getElementById('classYear').textContent = selectedClass.year;
  
  // Load students
  const allStudents = getClassStudents(selectedClass.classId, selectedClass.studentCount);
  renderStudents(allStudents);
  
  // Setup search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    const filtered = filterStudents(searchTerm, allStudents);
    renderStudents(filtered);
  });
  
  // Setup buttons
  document.getElementById('btnBack').addEventListener('click', goBack);
  document.getElementById('btnLogout').addEventListener('click', handleLogout);
  
  // Setup modal close functionality
  const modal = document.getElementById('gradingModeModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeGradingModeModal();
    }
  });
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeGradingModeModal();
    }
  });
  
  // Auto-focus search input
  searchInput.focus();
}

// Run when page loads
document.addEventListener('DOMContentLoaded', initializePage);
