// ===== GRADING MODE PAGE LOGIC =====

// Check if user is logged in and student is selected
function checkSessionStatus() {
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
  const selectedStudent = JSON.parse(sessionStorage.getItem('selectedStudent'));
  
  if (!currentUser || !selectedStudent) {
    window.location.href = '/pages/home.html';
    return null;
  }
  
  return { currentUser, selectedStudent };
}

// Render student info
function renderStudentInfo(selectedStudent) {
  document.getElementById('studentName').textContent = selectedStudent.name;
  document.getElementById('studentClass').textContent = `${selectedStudent.className} - ${selectedStudent.subject}`;
}

// Select grading mode and go to grading page
function selectMode(mode) {
  // Store selected mode in sessionStorage
  sessionStorage.setItem('gradingMode', mode);
  
  // Redirect to chamdiem.html
  window.location.href = '/pages/chamdiem.html';
}

function handleLogout() {
  document.getElementById('logoutModal').style.display = 'flex';
}

function closeLogoutModal() {
  document.getElementById('logoutModal').style.display = 'none';
}

function confirmLogout() {
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('selectedClass');
  sessionStorage.removeItem('selectedClassId');
  sessionStorage.removeItem('selectedStudent');
  sessionStorage.removeItem('gradingMode');
  window.location.href = '/index.html';
}

function goBack() {
  window.location.href = '/pages/select-student.html';
}

// Initialize page
function initializePage() {
  const session = checkSessionStatus();
  const { selectedStudent } = session;
  
  // Render student info
  renderStudentInfo(selectedStudent);
  
  // Setup back button
  document.getElementById('btnBack').addEventListener('click', goBack);
}

// Run when page loads
document.addEventListener('DOMContentLoaded', initializePage);
