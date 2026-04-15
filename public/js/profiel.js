document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const accountId = params.get('id');

    if (!accountId) {
        showToast("Geen gebruiker opgegeven", "error");
        return;
    }

    try {
        const res = await fetchWithSpinner(`/account/${accountId}/profiel`);
        const account = await res.json();

        if (!account || account.error) {
            showToast("Gebruiker niet gevonden", "error");
            return;
        }

        document.getElementById("profileAvatar").src = account.Afbeelding || `https://ui-avatars.com/api/?name=${account.Name}&background=random`;
        document.getElementById("profileAvatar").alt = `Profielfoto van ${account.Name}`;
        document.getElementById("profileName").textContent = account.Name || "Onbekend";
        document.getElementById("profileEmail").textContent = account.E_mail || "—";
        document.getElementById("profilePostcode").textContent = account.Postcode || "—";
        document.title = `${account.Name} - Gereedschapspunt`;

    } catch (err) {
        console.error(err);
        showToast("Fout bij ophalen profiel", "error");
    }

    const meRes = await fetch('/me');
if (meRes.ok) {
    const me = await meRes.json();
    if (me.id !== parseInt(accountId)) {
        document.getElementById('profileActions').style.display = 'block';
    }
}

document.getElementById('reportBtn').addEventListener('click', () => {
    document.getElementById('reportModal').style.display = 'flex';
});

document.getElementById('reportCancel').addEventListener('click', () => {
    document.getElementById('reportModal').style.display = 'none';
});

document.getElementById('reportSubmit').addEventListener('click', async () => {
    const reden = document.getElementById('reportReden').value.trim();

    if (!reden) {
        showToast("Vul een reden in", "error");
        return;
    }

    try {
        const res = await fetchWithSpinner(`/account/${accountId}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Reden: reden })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || "Rapporteren mislukt", "error");
            return;
        }

        showToast("Rapport ingediend!", "success");
        document.getElementById('reportModal').style.display = 'none';
        document.getElementById('reportReden').value = '';
    } catch (err) {
        console.error(err);
        showToast("Er is iets misgegaan", "error");
    }
});    
});

