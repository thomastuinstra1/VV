const token = new URLSearchParams(window.location.search).get('token');
const loginBox = document.querySelector('.login-box');
const resetBtn = document.getElementById('resetBtn');
const msg = document.getElementById('resetMsg');

if (!token) {
  loginBox.innerHTML = '<p style="color:red;">Ongeldige of verlopen link.</p>';
} else {
  resetBtn.addEventListener('click', async () => {
    const password = document.getElementById('newPassword').value;
    const confirm  = document.getElementById('confirmPassword').value;

    if (password.length < 8) {
      msg.style.color = 'red';
      msg.textContent = 'Wachtwoord moet minimaal 8 tekens zijn.';
      return;
    }
    if (password !== confirm) {
      msg.style.color = 'red';
      msg.textContent = 'Wachtwoorden komen niet overeen.';
      return;
    }

    try {
      const res = await fetchWithSpinner('/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      if (!res) {
        msg.style.color = 'red';
        msg.textContent = 'Er is iets misgegaan. Probeer het opnieuw.';
        return;
      }

      msg.style.color = res.success ? 'green' : 'red';
      msg.textContent = res.success
        ? res.message + ' Je wordt doorgestuurd...'
        : res.error || 'Wachtwoord kon niet worden gereset.';

      if (res.success) setTimeout(() => window.location.href = 'inlog.html', 2500);

    } catch (err) {
      console.error(err);
      msg.style.color = 'red';
      msg.textContent = 'Serverfout. Probeer later opnieuw.';
    }
  });
}