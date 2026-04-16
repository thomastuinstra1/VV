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
    
// ── Registratie formulier ──

    const form = document.getElementById('register-form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const E_mail = document.getElementById("E_mail").value;
        const Name = document.getElementById("Name").value;
        const Password = document.getElementById("Password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const Postcode = document.getElementById("Postcode").value;

        if (Password !== confirmPassword) {
            showToast('Wachtwoorden komen niet overeen', 'error');
            return;
        }

        if (Password.length < 6 || !Password.match(/[0-9]/) || !Password.match(/[A-Z]/)) {
            showToast('Minimaal 6 tekens, 1 cijfer en 1 hoofdletter', 'error');
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
                setTimeout(() => {
                    window.location.href = 'inlog.html';
                }, 2000);
            } else {
                showToast(data.message || 'Er is iets misgegaan', 'error');
            }

        } catch (error) {
            console.error(error);
            showToast('Serverfout, probeer later opnieuw', 'error');
        }
    });
});