document.addEventListener('DOMContentLoaded', async () => {

document.getElementById('logout-btn').addEventListener('click', async () => {
    const response = await fetch('/logout', { method: 'POST' });
    if (response.ok) {
        window.location.href = 'inlog.html';
    } else {
        alert('Er is iets misgegaan bij het uitloggen');
    }
});
    
    // Huidige gegevens ophalen en invullen
    try {
        const response = await fetch('/me');
        if (!response.ok) {
            alert('Je bent niet ingelogd');
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
            alert('Wachtwoorden komen niet overeen');
            return;
        }

        const body = {};
        if (Name) body.Name = Name;
        if (E_mail) body.E_mail = E_mail;
        if (Postcode) body.Postcode = Postcode;
        if (Password) body.Password = Password;
        if (BSN !== '') body.BSN = BSN;

        try {
            const response = await fetch('/account', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                alert('Gegevens opgeslagen!');
            } else {
                alert(data.message || 'Er is iets misgegaan');
            }
        } catch (error) {
            console.error(error);
            alert('Er is iets misgegaan');
        }
    });
});



// Preview direct bij selecteren
document.getElementById('afbeelding-input').addEventListener('change', () => {
    const file = document.getElementById('afbeelding-input').files[0];
    if (!file) return;

    const preview = document.getElementById('profielfoto');
    preview.src = URL.createObjectURL(file);
});

// Upload naar server
document.getElementById('upload-btn').addEventListener('click', async () => {
    const file = document.getElementById('afbeelding-input').files[0];
    if (!file) return alert('Selecteer eerst een afbeelding');

    const formData = new FormData();
    formData.append('afbeelding', file);

    const response = await fetch('/account/afbeelding', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (response.ok) {
        document.getElementById('profielfoto').src = data.url;
        alert('Profielfoto opgeslagen!');
    } else {
        alert(data.error || 'Er is iets misgegaan');
    }
});