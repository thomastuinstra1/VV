document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('id');

    if (!toolId) {
        showToast("Geen gereedschap geselecteerd", "error");
        return;
    }

    try {
        const res = await fetchWithSpinner(`/gereedschap?id=${toolId}`);
        const tools = await res.json();

        if (!tools || tools.length === 0) {
            showToast("Gereedschap niet gevonden", "error");
            return;
        }

        const tool = tools[0];

        document.getElementById("toolImage").src = tool.Afbeelding || '/images/default.jpg';
        document.getElementById("toolImage").alt = tool.Naam;
        document.getElementById("toolName").textContent = tool.Naam || "Onbekend gereedschap";
        document.getElementById("toolDescription").textContent = tool.Beschrijving || "";
        document.getElementById("toolBorg").textContent = `Borg: €${tool.BorgBedrag || 0}`;

        const start = tool.Begindatum ? new Date(tool.Begindatum).toLocaleDateString() : "--";
        const end = tool.Einddatum ? new Date(tool.Einddatum).toLocaleDateString() : "--";
        document.getElementById("startDate").textContent = start;
        document.getElementById("endDate").textContent = end;

        const chatKnop = document.getElementById('reserveBtn');
        chatKnop.href = `chat.html?partner=${tool.Account_id}&tool=${tool.Gereedschap_id}`;
        chatKnop.textContent = '💬 Chat met eigenaar';
        
        // Eigenaar info
        const ownerName = document.getElementById("ownerName");
        const ownerAvatar = document.getElementById("ownerAvatar");

        ownerName.textContent = tool.Account?.Name || "Onbekende eigenaar";
        ownerAvatar.src = tool.Account?.Afbeelding || '/images/default-avatar.jpg';
        ownerAvatar.alt = `Profielfoto van ${tool.Account?.Name || 'eigenaar'}`;

    } catch (err) {
        console.error(err);
        showToast("Fout bij ophalen gereedschap", "error");
    }
});