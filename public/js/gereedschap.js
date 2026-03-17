document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const toolId = params.get('id');

    if (!toolId) {
        alert("Geen gereedschap geselecteerd");
        return;
    }

    try {
        const res = await fetch(`/gereedschap?id=${toolId}`);
        const tools = await res.json();

        if (!tools || tools.length === 0) {
            alert("Gereedschap niet gevonden");
            return;
        }

        const tool = tools[0]; // omdat we 1 item verwachten

        // Afbeelding
        document.getElementById("toolImage").src = tool.Afbeelding || '/images/default.jpg';
        document.getElementById("toolImage").alt = tool.Naam;

        // Naam
        document.getElementById("toolName").textContent = tool.Naam || "Onbekend gereedschap";

        // Beschrijving
        document.getElementById("toolDescription").textContent = tool.Beschrijving || "";

        // Borg
        document.getElementById("toolBorg").textContent = `Borg: €${tool.BorgBedrag || 0}`;

        // Beschikbaarheid
        const start = tool.Begindatum ? new Date(tool.Begindatum).toLocaleDateString() : "--";
        const end = tool.Einddatum ? new Date(tool.Einddatum).toLocaleDateString() : "--";
        document.getElementById("startDate").textContent = start;
        document.getElementById("endDate").textContent = end;

        // Reserveer knop
        document.getElementById("reserveBtn").addEventListener("click", () => {
            alert(`Je hebt ${tool.Naam} gereserveerd! (Demo)`); // later koppelen aan backend
        });

    } catch (err) {
        console.error(err);
        alert("Fout bij ophalen gereedschap");
    }
});