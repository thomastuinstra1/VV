document.addEventListener('DOMContentLoaded', async () => {
const setup2faBtn = document.getElementById('setup2faBtn');
const disable2faBtn = document.getElementById('disable2faBtn');

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
    if (data.two_factor_enabled) {
  document.getElementById('setup2faBtn').style.display = 'none';
  document.getElementById('disable2faBtn').style.display = 'inline-block';
} else {
  document.getElementById('setup2faBtn').style.display = 'inline-block';
  document.getElementById('disable2faBtn').style.display = 'none';
}
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

    const afbeeldingUrl = document.getElementById('afbeelding-url').value;
    if (afbeeldingUrl) body.Afbeelding = afbeeldingUrl;

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

  // ── Afbeelding upload ──
  document.getElementById('afbeelding-input').addEventListener('change', async () => {
    const file = document.getElementById('afbeelding-input').files[0];
    if (!file) return;

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

 // ── 2FA ──

const twoFaSetupBox = document.getElementById('twoFaSetupBox');
const twoFaQrCode = document.getElementById('twoFaQrCode');
const manual2faCode = document.getElementById('manual2faCode');
const twoFaSetupCode = document.getElementById('twoFaSetupCode');
const enable2faBtn = document.getElementById('enable2faBtn');

const backupCodesBox = document.getElementById('backupCodesBox');
const backupCodesList = document.getElementById('backupCodesList');
const copyBackupCodesBtn = document.getElementById('copyBackupCodesBtn');

const disable2faBox = document.getElementById('disable2faBox');
const disable2faPassword = document.getElementById('disable2faPassword');
const disable2faCode = document.getElementById('disable2faCode');
const confirmDisable2faBtn = document.getElementById('confirmDisable2faBtn');

let backupCodesText = '';

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
    manual2faCode.textContent = data.manualCode || '';
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
    setup2faBtn.style.display = 'none';
    disable2faBtn.style.display = 'inline-block';

    if (data.backupCodes && Array.isArray(data.backupCodes)) {
      backupCodesText = data.backupCodes.join('\n');
      backupCodesList.textContent = backupCodesText;
      backupCodesBox.style.display = 'block';
    }
  } catch (error) {
    console.error(error);
    showToast('Er is iets misgegaan bij 2FA inschakelen', 'error');
  }
});

copyBackupCodesBtn.addEventListener('click', async () => {
  if (!backupCodesText) return;

  try {
    await navigator.clipboard.writeText(backupCodesText);
    showToast('Backup codes gekopieerd', 'success');
  } catch {
    showToast('Kopiëren mislukt', 'error');
  }
});

disable2faBtn.addEventListener('click', () => {
  disable2faBox.style.display = 'block';
});

confirmDisable2faBtn.addEventListener('click', async () => {
  const password = disable2faPassword.value.trim();
  const token = disable2faCode.value.trim();

  if (!password || !token) {
    showToast('Vul wachtwoord en 2FA-code in', 'error');
    return;
  }

  try {
    const response = await fetchWithSpinner('/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password, token })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || '2FA uitschakelen mislukt', 'error');
      return;
    }

    showToast('2FA uitgeschakeld', 'success');

    disable2faBox.style.display = 'none';
    disable2faBtn.style.display = 'none';
    setup2faBtn.style.display = 'inline-block';
    setup2faBtn.disabled = false;
    setup2faBtn.textContent = '2FA inschakelen';

    disable2faPassword.value = '';
    disable2faCode.value = '';
  } catch (error) {
    console.error(error);
    showToast('Er is iets misgegaan bij 2FA uitschakelen', 'error');
  }
});
}); // einde DOMContentLoaded