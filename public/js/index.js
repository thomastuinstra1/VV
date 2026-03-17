document.addEventListener("DOMContentLoaded", function () {
    async function searchTools() {
        const input = document.getElementById("searchInput").value.trim();

        if (input === "") {
            alert("Vul een zoekterm in!");
            return;
        }

        try {
            const response = await fetch(`/gereedschap?search=${encodeURIComponent(input)}`);
            const results = await response.json();
            displayResults(results);
        } catch (err) {
            console.error(err);
            document.getElementById("results").innerHTML = "<p>Er ging iets mis met zoeken.</p>";
        }
    }

    window.searchTools = searchTools;

    document.getElementById("searchInput").addEventListener("keyup", function (e) {
        if (e.key === "Enter") searchTools();
    });

    loadTools();
});

async function loadTools() {
    try {
        const response = await fetch("/gereedschap");
        const tools = await response.json();
        displayTools(tools);
    } catch (err) {
        console.error("Fout bij laden tools:", err);
    }
}

function displayTools(tools) {
    const container = document.getElementById("toolsContainer");
    container.innerHTML = "";

    if (!tools.length) {
        container.innerHTML = "<p>Geen gereedschap beschikbaar.</p>";
        return;
    }

    tools.forEach(tool => {
        const card = document.createElement("div");
        card.classList.add("tool-card");

        const imageUrl = tool.Afbeelding || '/images/default.jpg';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${tool.Naam}">
            <div class="tool-card-content">
                <h3>${tool.Naam}</h3>
                <p>${tool.Beschrijving || ''}</p>
                <div class="tool-price">€${tool.BorgBedrag || 0} borg</div>
            </div>
        `;

        card.addEventListener("click", () => {
            window.location.href = `/tool.html?id=${tool.Gereedschap_id}`;
        });

        container.appendChild(card);
    });
}

function displayResults(results) {
    const container = document.getElementById("results");
    container.innerHTML = "";

    if (!results.length) {
        container.innerHTML = "<p>Geen resultaten gevonden.</p>";
        return;
    }

    results.forEach(tool => {
        const div = document.createElement("div");
        div.innerHTML = `
            <h3>${tool.Naam}</h3>
            <p>${tool.Beschrijving || ''}</p>
        `;
        container.appendChild(div);
    });
}