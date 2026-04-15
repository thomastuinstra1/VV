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

        document.getElementById("profileAvatar").src = account.Profielfoto || '/images/default-avatar.jpg';
        document.getElementById("profileAvatar").alt = `Profielfoto van ${account.Name}`;
        document.getElementById("profileName").textContent = account.Name || "Onbekend";
        document.getElementById("profileEmail").textContent = account.E_mail || "—";
        document.getElementById("profilePostcode").textContent = account.Postcode || "—";
        document.title = `${account.Name} - Gereedschapspunt`;

    } catch (err) {
        console.error(err);
        showToast("Fout bij ophalen profiel", "error");
    }
});