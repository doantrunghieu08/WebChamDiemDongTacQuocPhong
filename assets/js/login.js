/* =============================================
   login.js – Chấm Điểm Bài Tập Đi Đều - Login
   ============================================= */

// ---- LOGIN HANDLER ----
function handleLogin(event) {
  event.preventDefault();

  const loginIdentifier = document.getElementById('student-id').value.trim();
  const password = document.getElementById('password').value.trim();

  // Validation
  if (!loginIdentifier) {
    showError('Vui lòng nhập mã sinh viên!');
    return;
  }

  if (!password) {
    showError('Vui lòng nhập mật khẩu!');
    return;
  }

  if (loginIdentifier.length < 3) {
    showError('Mã sinh viên phải có ít nhất 3 ký tự!');
    return;
  }

  if (password.length < 6) {
    showError('Mật khẩu phải có ít nhất 6 ký tự!');
    return;
  }

  // Giả lập kiểm tra (trong thực tế sẽ gửi request tới server)
  const role = document.getElementById('user-role').value;
  const storedAccounts = JSON.parse(localStorage.getItem('adminAccounts') || '[]');
  const matchedAccount = Array.isArray(storedAccounts)
    ? storedAccounts.find(account => (
        account.id.toLowerCase() === loginIdentifier.toLowerCase() ||
        (account.username || '').toLowerCase() === loginIdentifier.toLowerCase()
      ) && account.role === role)
    : null;

  if (matchedAccount && matchedAccount.status === 'locked') {
    showFailureModal(`Tài khoản ${loginIdentifier} đang bị khóa. Vui lòng liên hệ quản trị viên.`);
    return;
  }

  if (matchedAccount && matchedAccount.password !== password) {
    showFailureModal('Sai mật khẩu. Vui lòng kiểm tra lại.');
    return;
  }

  // Cho phép đăng nhập với bất kỳ mã hợp lệ nào để demo; nếu tài khoản đã được admin tạo thì dùng đúng dữ liệu đó.
  performLogin(loginIdentifier, matchedAccount);
}

function performLogin(loginIdentifier, matchedAccount) {
  const role = document.getElementById('user-role').value;
  const redirectPath = role === 'admin' ? '/pages/admin.html' : '/pages/home.html';
  // Lưu thông tin người dùng vào localStorage
  const loginData = {
    campus: 'hanoi',
    studentId: matchedAccount?.id || loginIdentifier,
    username: matchedAccount?.username || loginIdentifier,
    name: matchedAccount?.name || (role === 'admin' ? 'Quản trị viên hệ thống' : loginIdentifier),
    role: role, // 'teacher' hoặc 'student'
    loginTime: new Date().toISOString(),
  };

  localStorage.setItem('currentUser', JSON.stringify(loginData));

  // Hiển thị thông báo thành công
  showSuccess(`Đăng nhập thành công! Xin chào ${matchedAccount?.name || loginIdentifier}`, redirectPath);
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
  const form = document.querySelector('.login-form');
  form.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      form.dispatchEvent(new Event('submit'));
    }
  });

  // Auto-focus vào field ID
  document.getElementById('student-id').focus();

  // Close modal button
  const closeBtn = document.getElementById('closeModalBtn');
  closeBtn.addEventListener('click', closeModal);

  // Cập nhật label khi đổi vai trò
  const roleSelect = document.getElementById('user-role');
  const idLabel = document.getElementById('id-label');
  const idInput = document.getElementById('student-id');
  const updateRoleLabel = () => {
    if (roleSelect.value === 'student') {
      idLabel.textContent = 'Mã Sinh Viên';
      idInput.placeholder = 'Nhập mã sinh viên...';
    } else if (roleSelect.value === 'admin') {
      idLabel.textContent = 'Mã Quản Trị';
      idInput.placeholder = 'Nhập mã quản trị...';
    } else {
      idLabel.textContent = 'Mã Giảng Viên';
      idInput.placeholder = 'Nhập mã giảng viên...';
    }
  };
  roleSelect.addEventListener('change', updateRoleLabel);
  updateRoleLabel();
});
