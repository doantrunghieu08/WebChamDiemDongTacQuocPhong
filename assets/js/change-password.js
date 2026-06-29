/* =============================================
   change-password.js – HACTECH 2026
   Đổi mật khẩu bắt buộc sau lần đăng nhập đầu
   ============================================= */

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('old-password')?.focus();

  // Toggle show/hide password
  document.querySelectorAll('.fp-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isText = target.type === 'text';
      target.type = isText ? 'password' : 'text';
      btn.querySelector('.eye-show').style.display = isText ? 'block' : 'none';
      btn.querySelector('.eye-hide').style.display = isText ? 'none' : 'block';
    });
  });

  document.getElementById('new-password')?.addEventListener('input', () => {
    updateStrengthBar(document.getElementById('new-password').value);
    updatePasswordMatch();
  });

  document.getElementById('confirm-password')?.addEventListener('input', updatePasswordMatch);
});

/* ---- SUBMIT ---- */
async function handleChangePasswordSubmit(event) {
  event.preventDefault();

  const oldPass     = document.getElementById('old-password').value;
  const newPass     = document.getElementById('new-password').value;
  const confirmPass = document.getElementById('confirm-password').value;

  clearFieldError('old-error');
  clearFieldError('confirm-error');
  let valid = true;

  if (!oldPass) {
    setFieldError('old-error', 'Vui lòng nhập mật khẩu hiện tại.');
    document.getElementById('old-password').classList.add('is-error');
    valid = false;
  }
  if (!newPass || newPass.length < 6) {
    document.getElementById('new-password').classList.add('is-error');
    if (!newPass) showFormError('Vui lòng điền đầy đủ các trường.');
    else showFormError('Mật khẩu mới phải có ít nhất 6 ký tự.');
    valid = false;
  }
  if (newPass !== confirmPass) {
    setFieldError('confirm-error', 'Mật khẩu xác nhận không khớp.');
    document.getElementById('confirm-password').classList.add('is-error');
    valid = false;
  }
  if (!valid) return;

  const submitBtn = document.getElementById('change-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.querySelector('span').textContent = 'Đang lưu...'; }

  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const username = currentUser?.username || currentUser?.id || null;
    if (!username) {
      showFormError('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.querySelector('span').textContent = 'Đổi mật khẩu'; }
      return;
    }

    await AuthService.changePassword(username, oldPass, newPass);

    TokenManager.clearTokens();
    localStorage.removeItem('currentUser');

    document.getElementById('cp-modal').style.display = 'flex';
  } catch (err) {
    const msg = err?.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
    showFormError(msg);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.querySelector('span').textContent = 'Đổi mật khẩu'; }
  }
}

function redirectToLogin() {
  window.location.href = '../index.html';
}

/* ---- Realtime validations ---- */
function updatePasswordMatch() {
  const newVal     = document.getElementById('new-password')?.value || '';
  const confirmVal = document.getElementById('confirm-password')?.value || '';
  const submitBtn  = document.getElementById('change-submit');
  const confirmEl  = document.getElementById('confirm-password');

  if (!confirmVal) {
    clearFieldError('confirm-error');
    if (confirmEl) confirmEl.classList.remove('is-error', 'is-ok');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  if (newVal !== confirmVal) {
    setFieldError('confirm-error', 'Mật khẩu xác nhận không khớp.');
    if (confirmEl) { confirmEl.classList.add('is-error'); confirmEl.classList.remove('is-ok'); }
    if (submitBtn) submitBtn.disabled = true;
  } else {
    clearFieldError('confirm-error');
    if (confirmEl) { confirmEl.classList.add('is-ok'); confirmEl.classList.remove('is-error'); }
    if (submitBtn) submitBtn.disabled = false;
  }
}

function updateStrengthBar(password) {
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  if (!fill || !label) return;

  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: '#f87171',     text: 'Yếu' },
    { pct: '50%',  color: '#fb923c',     text: 'Trung bình' },
    { pct: '75%',  color: '#facc15',     text: 'Khá' },
    { pct: '90%',  color: '#4ade80',     text: 'Mạnh' },
    { pct: '100%', color: '#22c55e',     text: 'Rất mạnh' },
  ];

  const lvl = levels[Math.min(score, 5)];
  fill.style.width      = password.length ? lvl.pct   : '0%';
  fill.style.background = password.length ? lvl.color : 'transparent';
  label.textContent     = password.length ? lvl.text  : '';
  label.style.color     = lvl.color;
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
function showFormError(msg) {
  const form = document.getElementById('change-password-form');
  if (!form) return;
  let el = form.querySelector('.fp-form-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'fp-form-error';
    form.insertBefore(el, form.firstChild);
  }
  el.textContent = msg;
  setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
}
