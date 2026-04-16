/* =============================================
   forgot-password.js – Quên Mật Khẩu
   ============================================= */

function handleForgotPassword(event) {
  event.preventDefault();

  const studentId = document.getElementById('student-id-forgot').value.trim();

  if (!studentId) {
    showError('Vui lòng nhập mã sinh viên!');
    return;
  }

  if (studentId.length < 3) {
    showError('Mã sinh viên phải có ít nhất 3 ký tự!');
    return;
  }

  // Giả lập gửi yêu cầu
  processForgotPassword(studentId);
}

function processForgotPassword(studentId) {
  showSuccess(`Mật khẩu mới đã được gửi tới email của ${studentId}. Vui lòng kiểm tra hộp thư!`);

  // Quay lại trang đăng nhập sau 2 giây
  setTimeout(() => {
    window.location.href = '/index.html';
  }, 2000);
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

  setTimeout(() => {
    errorEl.classList.remove('show');
  }, 5000);
}

function showSuccess(message) {
  alert(message);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('student-id-forgot').focus();
});
