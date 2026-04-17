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
        const aantalRapporten = tool.eigenaar?.aantalRapporten || 0;

        chatKnop.addEventListener('click', (e) => {
            e.preventDefault();
            if (aantalRapporten >= 5) {
                document.getElementById('reportWarningModal').style.display = 'flex';
            } else {
                window.location.href = `chat.html?partner=${tool.Account_id}&tool=${tool.Gereedschap_id}`;
            }
        });

        document.getElementById('warningDoorgaan').addEventListener('click', () => {
            window.location.href = `chat.html?partner=${tool.Account_id}&tool=${tool.Gereedschap_id}`;
        });

        document.getElementById('warningAnnuleren').addEventListener('click', () => {
            document.getElementById('reportWarningModal').style.display = 'none';
        });
        
        // Eigenaar info
        const ownerName = document.getElementById("ownerName");
        const ownerAvatar = document.getElementById("ownerAvatar");

        ownerName.textContent = tool.eigenaar?.Name || "Onbekende eigenaar";

        ownerAvatar.src = tool.eigenaar?.Afbeelding || `https://ui-avatars.com/api/?name=${tool.eigenaar?.Name}&background=random`;
        ownerAvatar.alt = `Profielfoto van ${tool.eigenaar?.Name || 'eigenaar'}`;

        document.getElementById("ownerCard").addEventListener('click', () => {
            window.location.href = `profiel.html?id=${tool.Account_id}`;
        });

    } catch (err) {
        console.error(err);
        showToast("Fout bij ophalen gereedschap", "error");
    }
});