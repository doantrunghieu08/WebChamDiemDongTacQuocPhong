/* =============================================
   login.js – Chấm Điểm Bài Tập Đi Đều - Login
   ============================================= */

// ---- LOGIN HANDLER ----
async function handleLogin(event) {
  event.preventDefault();

  const loginIdentifier = document.getElementById('student-id').value.trim();
  const password = document.getElementById('password').value.trim();

  // Validation
  if (!loginIdentifier) {
    showError('Vui lòng nhập tên đăng nhập!');
    return;
  }

  if (!password) {
    showError('Vui lòng nhập mật khẩu!');
    return;
  }

  if (loginIdentifier.length < 3) {
    showError('Tên đăng nhập phải có ít nhất 3 ký tự!');
    return;
  }

  if (password.length < 6) {
    showError('Mật khẩu phải có ít nhất 6 ký tự!');
    return;
  }

  try {
    const userData = await AuthService.login(loginIdentifier, password);
    performLogin(userData);
  } catch (err) {
    const msg = err?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!';
    showFailureModal(msg);
  }
}

function getRedirectByRole(role) {
  switch ((role || '').toString().toUpperCase().replace('ROLE_', '')) {
    case 'ADMIN':
      return '/pages/admin.html';
    case 'TEACHER':
      return '/pages/home.html';
    case 'STUDENT':
      return '/pages/home.html';
    default:
      return '/pages/home.html';
  }
}

function performLogin(userData) {
  if (userData.requirePasswordChange) {
    showSuccess('Vui lòng đổi mật khẩu trước khi tiếp tục!', '/pages/change-password.html');
    return;
  }
  // Role may be in userData or in sessionStorage (fallback when /auth/me not available)
  const role = userData?.role || sessionStorage.getItem('currentUserRole') || '';
  const redirectPath = getRedirectByRole(role);
  const displayName = (userData && (userData.fullName || userData.username)) || JSON.parse(sessionStorage.getItem('currentUser') || 'null')?.fullName || 'Người dùng';
  showSuccess(`Đăng nhập thành công! Xin chào ${displayName}`, redirectPath);
}


function showSuccess(message, redirectPath) {
  const modal = document.getElementById('resultModal');
  const successIcon = document.getElementById('successIcon');
  const failureIcon = document.getElementById('failureIcon');
  const resultMessage = document.getElementById('resultMessage');
  const closeBtn = document.getElementById('closeModalBtn');

  successIcon.style.display = 'block';
  failureIcon.style.display = 'none';
  resultMessage.textContent = message;
  closeBtn.style.display = 'none';
  modal.classList.add('show');

  setTimeout(() => {
    closeModal();
    window.location.href = redirectPath || '/pages/home.html';
  }, 2500);
}

function showError(message) {
  const form = document.querySelector('.login-form');
  let errorEl = form.querySelector('.error-message');

  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    form.insertBefore(errorEl, form.firstChild);
  }

  errorEl.textContent = message;
  errorEl.classList.add('show');

  // Ẩn thông báo lỗi sau 5 giây
  setTimeout(() => {
    errorEl.classList.remove('show');
  }, 5000);
}

function showFailureModal(message) {
  const modal = document.getElementById('resultModal');
  const successIcon = document.getElementById('successIcon');
  const failureIcon = document.getElementById('failureIcon');
  const resultMessage = document.getElementById('resultMessage');
  const closeBtn = document.getElementById('closeModalBtn');

  // Reset modal
  successIcon.style.display = 'none';
  failureIcon.style.display = 'block';
  resultMessage.textContent = message;
  closeBtn.style.display = 'block';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('resultModal');
  modal.classList.remove('show');
}

// ---- ENTER KEY SUPPORT ----
document.addEventListener('DOMContentLoaded', () => {
  // Không cần keypress handler riêng — browser tự submit form khi nhấn Enter trong input.
  // Có handler riêng sẽ gây double-submit (gọi handleLogin 2 lần).

  // Auto-focus vào field ID
  document.getElementById('student-id').focus();

  // Close modal button
  const closeBtn = document.getElementById('closeModalBtn');
  closeBtn.addEventListener('click', closeModal);

  // Hiện toast đăng xuất thành công nếu được chuyển hướng từ logout
  if (sessionStorage.getItem('logoutSuccess')) {
    sessionStorage.removeItem('logoutSuccess');
    const form = document.querySelector('.login-form');
    const toast = document.createElement('div');
    toast.className = 'success-toast show';
    toast.innerHTML = '<i class="fas fa-circle-check"></i><span>Đăng xuất thành công!</span>';
    form.insertBefore(toast, form.firstChild);
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  // Hiện toast phiên hết hạn nếu bị chuyển về do refresh token không hợp lệ
  if (sessionStorage.getItem('sessionExpired')) {
    sessionStorage.removeItem('sessionExpired');
    const form = document.querySelector('.login-form');
    const toast = document.createElement('div');
    toast.className = 'error-toast show';
    toast.innerHTML = '<i class="fas fa-circle-exclamation"></i><span>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</span>';
    form.insertBefore(toast, form.firstChild);
    setTimeout(() => toast.classList.remove('show'), 5000);
  }
});
