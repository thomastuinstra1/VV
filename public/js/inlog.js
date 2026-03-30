document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const login = document.getElementById('login').value;
        const Password = document.getElementById('Password').value;

        if (!login || !Password) {
            alert('Please fill in all fields');
            return;
        }

        // Verstuur naar server
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // ← toevoegen
                body: JSON.stringify({ login, Password })
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Welkom ${data.Name}!`);
                window.location.href = 'index.html'; // stuur door na index
            } else {
                alert(data.message || 'Er is iets misgegaan');
            }
        } catch (error) {
            console.error(error);
            alert('Er is iets misgegaan');
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
  if (!email) { alert('Vul een e-mailadres in.'); return; }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Versturen...';

  try {
    const res = await fetch('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    feedback.textContent = data.message;
    feedback.style.display = 'block';
    sendBtn.style.display = 'none';
  } catch {
    alert('Er is iets misgegaan. Probeer het opnieuw.');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Verstuur link';
  }
});