document.addEventListener('DOMContentLoaded', () => {
    
// ── Wachtwoord tonen/verbergen ──
const toggleBtn = document.getElementById('togglePassword');
const passwordInput = document.getElementById('Password');
const eyeIcon = document.getElementById('eyeIcon');

toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.src = isPassword ? './images/eye-off.svg' : './images/eye.svg';
  toggleBtn.setAttribute('aria-label', isPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen');
});
    // ── Login form ──
    const form = document.getElementById('loginForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const login = document.getElementById('login').value;
        const Password = document.getElementById('Password').value;

        if (!login || !Password) {
            showToast('Vul alle velden in', 'error');
            return;
        }

        try {
            const response = await fetchWithSpinner('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ login, Password })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(`Welkom ${data.Name}!`, 'success');
                window.location.href = 'index.html';
            } else {
                showToast(data.message || 'Er is iets misgegaan', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Er is iets misgegaan', 'error');
        }
    });

    // ── Wachtwoord vergeten modal ──
    const openBtn  = document.getElementById('openForgotModal');
    const modal    = document.getElementById('forgotModal');
    const closeBtn = document.getElementById('closeModal');
    const sendBtn  = document.getElementById('sendResetBtn');
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
        if (!email) { showToast('Vul een e-mailadres in.', 'error'); return; }

        sendBtn.disabled = true;
        sendBtn.textContent = 'Versturen...';

        try {
            const res = await fetchWithSpinner('/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            feedback.textContent = data.message;
            feedback.style.display = 'block';
            sendBtn.style.display = 'none';
        } catch {
            showToast('Er is iets misgegaan. Probeer het opnieuw.', 'error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Verstuur link';
        }
    });

});