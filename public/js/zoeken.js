const params = new URLSearchParams(window.location.search);
const zoekterm = params.get("search")?.trim() || "";

// Zoekterm tonen in de header
document.getElementById("zoektermLabel").textContent = zoekterm;

// Header zoekbalk voorinvullen
const headerInput = document.getElementById("headerSearchInput");
if (headerInput) headerInput.value = zoekterm;

// Opnieuw zoeken via de header
const headerForm = document.getElementById("headerSearchForm");
if (headerForm) {
    headerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = headerInput.value.trim();
        if (!input) return;
        window.location.href = `/zoeken.html?search=${encodeURIComponent(input)}`;
    });
}

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

// -----------------------
// FILTERS
// -----------------------
async function loadFilters() {
    const container = document.getElementById("filterGroups");
    if (!container) return;

    try {
        const res = await fetch("/categorieen");
        const cats = await res.json();
        if (!Array.isArray(cats)) return;

        const parents = cats.filter(c => c.Parent_id === null);
        const children = cats.filter(c => c.Parent_id !== null);

        container.innerHTML = "";

        for (const parent of parents) {
            const groep = document.createElement("div");
            groep.classList.add("filter-group");

            const title = document.createElement("div");
            title.classList.add("filter-group-title");
            title.textContent = parent.Naam;
            groep.appendChild(title);

            for (const cat of children.filter(c => c.Parent_id === parent.Categorie_id)) {
                const label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = cat.Categorie_id;
                checkbox.id = `cat-${cat.Categorie_id}`;
                checkbox.addEventListener("change", applyFilters);

                label.setAttribute("for", `cat-${cat.Categorie_id}`);
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(cat.Naam));
                groep.appendChild(label);
            }

            container.appendChild(groep);
        }
    } catch (err) {
        console.error(err);
    }
}

async function applyFilters() {
    const checkboxes = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);

    const params = new URLSearchParams();
    params.set("search", zoekterm);
    if (ids.length > 0) params.set("categorieen", ids.join(","));

    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) resetBtn.hidden = ids.length === 0;

    const badge = document.getElementById("filterBadge");
    if (badge) {
        badge.hidden = ids.length === 0;
        badge.textContent = ids.length;
    }

    const grid = document.getElementById("gereedschapGrid");
    grid.innerHTML = '<p class="laden-tekst">Laden...</p>';

    try {
        const res = await fetch(`/gereedschap?${params.toString()}`);
        const items = await res.json();
        document.getElementById("countGereedschap").textContent = `(${items.length})`;

        if (!items.length) {
            grid.innerHTML = `<p class="geen-resultaten">Geen resultaten gevonden.</p>`;
            return;
        }

        grid.innerHTML = items.map(item => `
            <a href="gereedschap.html?id=${item.Gereedschap_id}" class="tool-card">
                <div class="tool-img-wrapper">
                    <img src="${item.Afbeelding || './images/placeholder.png'}" alt="${item.Naam}" onerror="this.src='./images/placeholder.png'" />
                </div>
                <div class="tool-info">
                    <h3>${item.Naam}</h3>
                    <p class="tool-locatie">📍 ${item.eigenaar?.Name || "Onbekend"}</p>
                    ${item.BorgBedrag ? `<p class="tool-prijs">Borg: €${item.BorgBedrag}</p>` : ""}
                </div>
            </a>
        `).join("");
    } catch (err) {
        grid.innerHTML = `<p class="fout-melding">Kon resultaten niet laden.</p>`;
    }
}

function resetFilters() {
    document.querySelectorAll('#filterGroups input[type="checkbox"]').forEach(cb => cb.checked = false);
    applyFilters();
}

function toggleFilterPanel() {
    const panel = document.getElementById("filterPanel");
    const overlay = document.getElementById("filterOverlay");
    const btn = document.getElementById("filterToggle");
    const isOpen = panel.classList.toggle("open");
    overlay.classList.toggle("show", isOpen);
    btn.setAttribute("aria-expanded", isOpen);
}

// Filters laden bij opstarten
loadFilters();