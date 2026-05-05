document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('twoFaResetForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const password = document.getElementById('password').value;

    if (!token) {
      showToast('Herstel-token ontbreekt', 'error');
      return;
    }

    const res = await fetchWithSpinner('/2fa/recovery/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    const data = await res.json();

    if (res.ok) {
      showToast('2FA is hersteld. Log opnieuw in en stel 2FA opnieuw in.', 'success');
      setTimeout(() => {
        window.location.href = 'inlog.html';
      }, 2000);
    } else {
      showToast(data.message || 'Herstel mislukt', 'error');
    }
  });
});