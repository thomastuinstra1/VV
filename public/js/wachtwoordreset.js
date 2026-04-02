const token = new URLSearchParams(window.location.search).get('token');
const loginBox = document.querySelector('.login-box');
const resetBtn = document.getElementById('resetBtn');

if (!token) {
  loginBox.innerHTML = '<p style="color:red;">Ongeldige of verlopen link.</p>';
} else {
  resetBtn.addEventListener('click', async () => {
    const password = document.getElementById('newPassword').value;
    const confirm  = document.getElementById('confirmPassword').value;

    if (password.length < 6) {
      showToast('Wachtwoord moet minimaal 6 tekens zijn.', 'error');
      return;
    }

    if (!password.match(/[0-9]/) || !password.match(/[A-Z]/)) {
      showToast('Wachtwoord moet een cijfer en een hoofdletter bevatten.', 'error');
      return;
    }

    if (password !== confirm) {
      showToast('Wachtwoorden komen niet overeen.', 'error');
      return;
    }

    try {
      const res = await fetchWithSpinner('/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      if (!res) {
        showToast('Er is iets misgegaan. Probeer het opnieuw.', 'error');
        return;
      }

      if (res.success) {
        showToast(res.message + ' Je wordt doorgestuurd...', 'success');
        setTimeout(() => window.location.href = 'inlog.html', 2500);
      } else {
        showToast(res.error || 'Wachtwoord kon niet worden gereset.', 'error');
      }

    } catch (err) {
      console.error(err);
      showToast('Serverfout. Probeer later opnieuw.', 'error');
    }
  });
}