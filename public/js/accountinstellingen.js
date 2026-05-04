document.addEventListener('DOMContentLoaded', async () => {

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


document.getElementById('logout-btn').addEventListener('click', async () => {
    const response = await fetchWithSpinner('/logout', { method: 'POST' });
    if (response.ok) {
        window.location.href = 'inlog.html';
    } else {
        showToast('Er is iets misgegaan bij het uitloggen', 'error');
    }
});
    
    // Huidige gegevens ophalen en invullen
    try {
        const response = await fetchWithSpinner('/me');
        if (!response.ok) {
            showToast('Je bent niet ingelogd', 'error');
            window.location.href = 'inlog.html';
            return;
        }
        const data = await response.json();
        if (data.Afbeelding) {
            document.getElementById('profielfoto').src = data.Afbeelding;
        }
        document.getElementById('Name').value = data.Name || '';
        document.getElementById('E_mail').value = data.E_mail || '';
        document.getElementById('Postcode').value = data.Postcode || '';

    } catch (error) {
        console.error(error);
    }

    // Formulier opslaan
    const form = document.getElementById('settings-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const Name = document.getElementById('Name').value;
        const E_mail = document.getElementById('E_mail').value;
        const Postcode = document.getElementById('Postcode').value;
        const Password = document.getElementById('Password').value;
        const confirmPassword = document.getElementById('confirm-password').value;


        const postcodeRegex = /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/;
        if (Postcode && !postcodeRegex.test(Postcode)) {
            showToast('Vul een geldige postcode in (bijv. 1234 AB)', 'error');
            return;
        }

        if (Password && Password !== confirmPassword) {
            showToast('Wachtwoorden komen niet overeen', 'error');
            return;
        }

        if (Password && (Password.length < 6 || !Password.match(/[0-9]/) || !Password.match(/[A-Z]/))) {
            showToast('Wachtwoord moet minimaal 6 tekens bevatten, een cijfer en een hoofdletter', 'error');
            return;
        }

        const body = {};
        if (Name) body.Name = Name;
        if (E_mail) body.E_mail = E_mail;
        if (Postcode) body.Postcode = Postcode;
        if (Password) body.Password = Password;


        // ✅ afbeelding toevoegen
        const afbeeldingUrl = document.getElementById('afbeelding-url').value;
        if (afbeeldingUrl) {
          body.Afbeelding = afbeeldingUrl;
        }

        try {
            const response = await fetchWithSpinner('/account', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('Gegevens opgeslagen!', 'success');
            } else {
                showToast(data.message || 'Er is iets misgegaan', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Er is iets misgegaan', 'error');
        }
    });

    // ==============================
    // 🖼️ AFBEELDING SELECT + AUTO UPLOAD
    // ==============================
    document.getElementById('afbeelding-input').addEventListener('change', async () => {
        const file = document.getElementById('afbeelding-input').files[0];
        if (!file) return;

        // Preview
        const preview = document.getElementById('profielfoto');
        preview.src = URL.createObjectURL(file);

        const formData = new FormData();
        formData.append('afbeelding', file);

        try {
            const response = await fetchWithSpinner('/account/afbeelding', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                // 🔥 BELANGRIJK
                document.getElementById('afbeelding-url').value = data.url;

                preview.src = data.url;
                showToast('Profielfoto opgeslagen!', 'success');
            } else {
                showToast(data.error || 'Upload mislukt', 'error');
            }

        } catch (err) {
            showToast('Server fout bij upload', 'error');
        }
    });
    // ── 2FA inschakelen ──
const setup2faBtn = document.getElementById('setup2faBtn');
const enable2faBtn = document.getElementById('enable2faBtn');
const twoFaSetupBox = document.getElementById('twoFaSetupBox');
const twoFaQrCode = document.getElementById('twoFaQrCode');
const twoFaSetupCode = document.getElementById('twoFaSetupCode');

setup2faBtn.addEventListener('click', async () => {
  try {
    const response = await fetchWithSpinner('/2fa/setup', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || '2FA setup mislukt', 'error');
      return;
    }

    twoFaQrCode.src = data.qrCodeUrl;
    twoFaSetupBox.style.display = 'block';

    showToast('Scan de QR-code met je authenticator app', 'success');

  } catch (error) {
    console.error(error);
    showToast('Er is iets misgegaan bij 2FA setup', 'error');
  }
});

enable2faBtn.addEventListener('click', async () => {
  const token = twoFaSetupCode.value.trim();

  if (!token) {
    showToast('Vul je 2FA-code in', 'error');
    return;
  }

  try {
    const response = await fetchWithSpinner('/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Ongeldige 2FA-code', 'error');
      return;
    }

    showToast('2FA is ingeschakeld!', 'success');

    twoFaSetupBox.style.display = 'none';
    setup2faBtn.textContent = '2FA is ingeschakeld';
    setup2faBtn.disabled = true;

  } catch (error) {
    console.error(error);
    showToast('Er is iets misgegaan bij 2FA inschakelen', 'error');
  }
});
});
