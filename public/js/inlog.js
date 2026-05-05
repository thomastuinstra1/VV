document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('Password');
  const eyeIcon = document.getElementById('eyeIcon');

  const form = document.getElementById('loginForm');
  const twoFaForm = document.getElementById('twoFaForm');
  const backToLogin = document.getElementById('backToLogin');

  let pendingUserId = null;

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    eyeIcon.src = isPassword ? './images/eye-off.svg' : './images/eye.svg';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('login').value.trim();
    const Password = document.getElementById('Password').value;

    try {
      const response = await fetchWithSpinner('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login, Password })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || 'Er is iets misgegaan', 'error');
        return;
      }

      if (data.requires2FA) {
        pendingUserId = data.userId;
        form.style.display = 'none';
        twoFaForm.style.display = 'block';
        return;
      }

      showToast(`Welkom ${data.Name}!`, 'success');
      window.location.href = 'index.html';
    } catch (error) {
      console.error(error);
      showToast('Er is iets misgegaan', 'error');
    }
  });

  twoFaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = document.getElementById('twoFaCode').value.trim();
    const trustDevice = document.getElementById('trustDevice').checked;

    try {
      const response = await fetchWithSpinner('/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: pendingUserId,
          token,
          trustDevice
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || 'Ongeldige 2FA-code', 'error');
        return;
      }

      showToast('Succesvol ingelogd', 'success');
      window.location.href = 'index.html';
    } catch (error) {
      console.error(error);
      showToast('Er is iets misgegaan', 'error');
    }
  });

  backToLogin.addEventListener('click', () => {
    pendingUserId = null;
    twoFaForm.style.display = 'none';
    form.style.display = 'block';
    document.getElementById('twoFaCode').value = '';
  });

  // ── 2FA recovery modal ──
  const open2faBtn = document.getElementById('open2faRecoveryModal');
  const modal2fa = document.getElementById('twoFaRecoveryModal');
  const close2faBtn = document.getElementById('close2faModal');
  const send2faBtn = document.getElementById('send2faRecoveryBtn');
  const feedback2fa = document.getElementById('twoFaRecoveryFeedback');

  open2faBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal2fa.style.display = 'flex';
  });

  close2faBtn.addEventListener('click', () => {
    modal2fa.style.display = 'none';
  });

  modal2fa.addEventListener('click', (e) => {
    if (e.target === modal2fa) modal2fa.style.display = 'none';
  });

  send2faBtn.addEventListener('click', async () => {
    const email = document.getElementById('recoveryEmail').value.trim();

    if (!email) {
      showToast('Vul een e-mailadres in', 'error');
      return;
    }

    const res = await fetchWithSpinner('/2fa/recovery/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    feedback2fa.textContent = data.message;
    feedback2fa.style.display = 'block';
    send2faBtn.style.display = 'none';
  });

  // ── Wachtwoord vergeten modal ──
  const openBtn = document.getElementById('openForgotModal');
  const modal = document.getElementById('forgotModal');
  const closeBtn = document.getElementById('closeModal');
  const sendBtn = document.getElementById('sendResetBtn');
  const feedback = document.getElementById('resetFeedback');

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  sendBtn.addEventListener('click', async () => {
    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
      showToast('Vul een e-mailadres in.', 'error');
      return;
    }

    const res = await fetchWithSpinner('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    feedback.textContent = data.message;
    feedback.style.display = 'block';
    sendBtn.style.display = 'none';
  });
});