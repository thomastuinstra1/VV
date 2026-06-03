document.addEventListener('DOMContentLoaded', () => {

  // ── Wachtwoord tonen/verbergen ──
  document.getElementById('togglePassword').addEventListener('click', () => {
    const input = document.getElementById('Password');
    const icon = document.getElementById('eyeIcon');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    icon.src = isPassword ? './images/eye-off.svg' : './images/eye.svg';
  });

  document.getElementById('toggleConfirm').addEventListener('click', () => {
    const input = document.getElementById('confirm-password');
    const icon = document.getElementById('eyeIconConfirm');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    icon.src = isPassword ? './images/eye-off.svg' : './images/eye.svg';
  });

  // ── Live confirm-check ──
  const passwordInput = document.getElementById('Password');
  const confirmInput  = document.getElementById('confirm-password');
  const confirmError  = document.getElementById('confirm-error');

  confirmInput.addEventListener('input', () => {
    const mismatch = confirmInput.value.length > 0 && confirmInput.value !== passwordInput.value;
    confirmError.style.display = mismatch ? 'block' : 'none';
  });

  // ── Registratie formulier ──
  const form = document.getElementById('register-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const E_mail          = document.getElementById('E_mail').value;
    const Name            = document.getElementById('Name').value;
    const Password        = passwordInput.value;
    const confirmPassword = confirmInput.value;
    const Postcode        = document.getElementById('Postcode').value;

    if (Password !== confirmPassword) {
      confirmError.style.display = 'block';
      confirmInput.focus();
      return;
    }

    if (Password.length < 8 || !/[0-9]/.test(Password) || !/[A-Z]/.test(Password)) {
      showToast('Wachtwoord voldoet niet aan de eisen', 'error');
      passwordInput.focus();
      return;
    }

    const postcodeRegex = /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/;
    if (!postcodeRegex.test(Postcode)) {
      showToast('Vul een geldige postcode in (bijv. 1234 AB)', 'error');
      return;
    }

    try {
      const response = await fetchWithSpinner('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Name, E_mail, Password, Postcode })
      });

      if (!response) {
        showToast('Netwerkfout, probeer later opnieuw', 'error');
        return;
      }

      const data = await response.json();

      if (response.ok) {
        showToast('Account aangemaakt!', 'success');
        setTimeout(() => { window.location.href = 'inlog.html'; }, 2000);
      } else {
        showToast(data.message || 'Er is iets misgegaan', 'error');
      }

    } catch (error) {
      console.error(error);
      showToast('Serverfout, probeer later opnieuw', 'error');
    }
  });
});