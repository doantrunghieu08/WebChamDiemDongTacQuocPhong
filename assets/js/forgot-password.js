/* =============================================
   forgot-password.js – HACTECH 2026
   Nhập email → gửi mật khẩu → popup → về login
   ============================================= */

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('email-input')?.focus();
});

/* ---- EMAIL SUBMIT ---- */
async function handleEmailSubmit(event) {
  event.preventDefault();

  const emailInput = document.getElementById('email-input');
  const email = emailInput.value.trim();

  clearFieldError('email-error');

  if (!email) {
    setFieldError('email-error', 'Vui lòng nhập email.');
    emailInput.classList.add('is-error');
    return;
  }
  if (!validateEmail(email)) {
    setFieldError('email-error', 'Địa chỉ email không hợp lệ.');
    emailInput.classList.add('is-error');
    return;
  }

  emailInput.classList.remove('is-error');
  const submitBtn = document.getElementById('email-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.querySelector('span').textContent = 'Đang gửi...'; }

  try {
    if (typeof AuthService !== 'undefined' && AuthService.forgotPassword) {
      await AuthService.forgotPassword(email);
    }
    showFpModal('Mật khẩu mới đã được gửi vào email của bạn. Vui lòng kiểm tra hộp thư!');
  } catch (err) {
    const msg = err?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
    showFpModal(msg, true);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.querySelector('span').textContent = 'Gửi mật khẩu'; }
  }
}

/* ---- POPUP ---- */
function showFpModal(message, isError = false) {
  const modal = document.getElementById('fp-modal');
  const msgEl = document.getElementById('fp-modal-message');
  if (!modal || !msgEl) return;
  msgEl.textContent = message;
  modal.style.display = 'flex';
  // Nếu thành công, sau khi bấm OK sẽ về login (xử lý ở closeFpModal)
  modal._isSuccess = !isError;
}

function closeFpModal() {
  const modal = document.getElementById('fp-modal');
  if (!modal) return;
  modal.style.display = 'none';
  if (modal._isSuccess) {
    window.location.href = '../index.html';
  }
}

/* ---- Helpers ---- */
function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
