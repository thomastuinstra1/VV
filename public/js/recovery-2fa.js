document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('twoFaRecoveryForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showToast('Vul alle velden in', 'error');
      return;
    }

    try {
      const res = await fetchWithSpinner('/2fa/recovery/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Als je gegevens kloppen, is er een herstel-link verzonden.', 'success');
      } else {
        showToast(data.message || 'Herstel aanvragen mislukt', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Er is iets misgegaan', 'error');
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('twoFaRecoveryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('recoveryEmail').value.trim();
    const password = document.getElementById('recoveryPassword').value;

    const res = await fetchWithSpinner('/2fa/recovery/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    showToast(data.message || 'Controleer je e-mail', res.ok ? 'success' : 'error');
  });
});
});