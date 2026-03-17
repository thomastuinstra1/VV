document.addEventListener("DOMContentLoaded", function () {

    function searchTools() {
        const input = document
            .getElementById("searchInput")
            .value
            .trim();

        if (input === "") {
            alert("Vul een zoekterm in!");
            return;
        }

        fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(input)}`)
            .then(response => response.json())
            .then(data => {
                console.log("Resultaten:", data);
                displayResults(data);
            })
            .catch(error => {
                console.error("Fout:", error);
                document.getElementById("results").innerHTML =
                    "<p>Er ging iets mis met zoeken.</p>";
            });
    }

    window.searchTools = searchTools;

    const searchInput = document.getElementById("searchInput");

    searchInput.addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            searchTools();
        }
    });

    // Tools laden bij start
    loadTools();
});

async function loadTools() {
    try {
        const response = await fetch("/gereedschap");
        const tools = await response.json();
        displayTools(tools);
    } catch (error) {
        console.error("Fout bij laden tools:", error);
    }
}

function displayTools(tools) {
    const container = document.getElementById("toolsContainer");
    container.innerHTML = "";

    if (tools.length === 0) {
        container.innerHTML = "<p>Geen gereedschap gevonden.</p>";
        return;
    }

    tools.forEach(tool => {
        const card = document.createElement("div");
        card.classList.add("tool-card");

        const imageUrl = tool.Afbeelding
            ? tool.Afbeelding
            : "/images/default.jpg";

        card.innerHTML = `
            <img src="${imageUrl}" alt="${tool.Naam}">
            <div class="tool-card-content">
                <h3>${tool.Naam || "Onbekend gereedschap"}</h3>
                <p>${tool.Beschrijving || ""}</p>
                <div class="tool-price">€${tool.BorgBedrag || 0} borg</div>
            </div>
        `;

        card.addEventListener("click", () => {
            window.location.href = `/tool.html?id=${tool.Gereedschap_id}`;
        });

        container.appendChild(card);
    });
}

function displayResults(tools) {
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";

    if (tools.length === 0) {
        resultsDiv.innerHTML = "<p>Geen resultaten gevonden</p>";
        return;
    }

    tools.forEach(tool => {
        const card = document.createElement("div");
        card.classList.add("tool-card");

        const imageUrl = tool.Afbeelding
            ? tool.Afbeelding
            : "/images/default.jpg";

        card.innerHTML = `
            <img src="${imageUrl}" alt="${tool.Naam}">
            <div class="tool-card-content">
                <h3>${tool.Naam || "Onbekend gereedschap"}</h3>
                <p>${tool.Beschrijving || ""}</p>
                <div class="tool-price">€${tool.BorgBedrag || 0} borg</div>
            </div>
        `;

        card.addEventListener("click", () => {
            window.location.href = `/tool.html?id=${tool.Gereedschap_id}`;
        });

        resultsDiv.appendChild(card);
    });
}