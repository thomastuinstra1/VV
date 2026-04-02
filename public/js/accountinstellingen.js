document.addEventListener('DOMContentLoaded', async () => {

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
        document.getElementById('BSN').value = data.BSN || '';

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
        const BSN = document.getElementById('BSN').value.trim();

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
        if (BSN !== '') body.BSN = BSN;

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
});
