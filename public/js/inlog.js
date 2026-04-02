document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm'); // ← correct

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const login = document.getElementById('login').value;
        const Password = document.getElementById('Password').value;

        if (!login || !Password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        // Verstuur naar server
        try {
            const response = await fetchWithSpinner('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // ← toevoegen
                body: JSON.stringify({ login, Password })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(`Welkom ${data.Name}!`, 'success');
                window.location.href = 'index.html'; // stuur door na index
            } else {
                showToast(data.message || 'Er is iets misgegaan', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Er is iets misgegaan', 'error');
        }
    });
});

// ── Wachtwoord vergeten modal ──
const openBtn   = document.getElementById('openForgotModal');
const modal     = document.getElementById('forgotModal');
const closeBtn  = document.getElementById('closeModal');
const sendBtn   = document.getElementById('sendResetBtn');
const feedback  = document.getElementById('resetFeedback');

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