const params = new URLSearchParams(window.location.search);
const zoekterm = params.get("search")?.trim() || "";

// Zoekterm tonen in de header
document.getElementById("zoektermLabel").textContent = zoekterm;

// Header zoekbalk voorinvullen
const headerInput = document.getElementById("headerSearchInput");
if (headerInput) headerInput.value = zoekterm;

// Opnieuw zoeken via de header
document.getElementById("headerSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = headerInput.value.trim();
    if (!input) return;
    window.location.href = `/zoeken.html?search=${encodeURIComponent(input)}`;
});

// -----------------------
// TABS
// -----------------------
function switchTab(tab) {
    const isGereedschap = tab === "gereedschap";

    document.getElementById("panelGereedschap").hidden = !isGereedschap;
    document.getElementById("panelProfielen").hidden = isGereedschap;

    document.getElementById("tabGereedschap").classList.toggle("active", isGereedschap);
    document.getElementById("tabProfielen").classList.toggle("active", !isGereedschap);
}

// -----------------------
// GEREEDSCHAP OPHALEN
// -----------------------
async function fetchGereedschap(zoekterm) {
    const grid = document.getElementById("gereedschapGrid");

    try {
        const res = await fetch(`/gereedschap?search=${encodeURIComponent(zoekterm)}`);
        if (!res.ok) throw new Error("Fout bij ophalen gereedschap");

        const items = await res.json();

        document.getElementById("countGereedschap").textContent = `(${items.length})`;

        if (items.length === 0) {
            grid.innerHTML = `<p class="geen-resultaten">Geen gereedschap gevonden voor "<strong>${zoekterm}</strong>".</p>`;
            return;
        }

        grid.innerHTML = items.map(item => `
            <a href="gereedschap.html?id=${item.Gereedschap_id}" class="tool-card">
                <div class="tool-img-wrapper">
                    <img
                        src="${item.Afbeelding || './images/placeholder.png'}"
                        alt="${item.Naam}"
                        onerror="this.src='./images/placeholder.png'"
                    />
                </div>
                <div class="tool-info">
                    <h3>${item.Naam}</h3>
                    <p class="tool-locatie">📍 ${item.eigenaar?.Name || "Onbekend"}</p>
                    ${item.BorgBedrag ? `<p class="tool-prijs">Borg: €${item.BorgBedrag}</p>` : ""}
                </div>
            </a>
        `).join("");

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<p class="fout-melding">Kon gereedschap niet laden. Probeer het later opnieuw.</p>`;
    }
}

// -----------------------
// PROFIELEN OPHALEN
// -----------------------
async function fetchProfielen(zoekterm) {
    const grid = document.getElementById("profielenGrid");

    try {
        const res = await fetch(`/accounts/zoeken?q=${encodeURIComponent(zoekterm)}`);
        if (!res.ok) throw new Error("Fout bij ophalen profielen");

        const profielen = await res.json();

        document.getElementById("countProfielen").textContent = `(${profielen.length})`;

        if (profielen.length === 0) {
            grid.innerHTML = `<p class="geen-resultaten">Geen profielen gevonden voor "<strong>${zoekterm}</strong>".</p>`;
            return;
        }

        grid.innerHTML = profielen.map(p => `
            <a href="profiel.html?id=${p.Account_id}" class="profiel-card">
                <div class="profiel-avatar">
                    ${p.Afbeelding
                        ? `<img src="${p.Afbeelding}" alt="${p.Name}" onerror="this.style.display='none'" />`
                        : `<span class="avatar-initiaal">${p.Name?.charAt(0).toUpperCase() || "?"}</span>`
                    }
                </div>
                <div class="profiel-info">
                    <strong>${p.Name}</strong>
                    <span>📍 ${p.Postcode || "Onbekend"}</span>
                </div>
            </a>
        `).join("");

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<p class="fout-melding">Kon profielen niet laden. Probeer het later opnieuw.</p>`;
    }
}

// -----------------------
// OPSTARTEN
// -----------------------
if (zoekterm) {
    fetchGereedschap(zoekterm);
    fetchProfielen(zoekterm);
} else {
    document.getElementById("gereedschapGrid").innerHTML = `<p class="geen-resultaten">Voer een zoekterm in om te beginnen.</p>`;
    document.getElementById("profielenGrid").innerHTML = `<p class="geen-resultaten">Voer een zoekterm in om te beginnen.</p>`;
}