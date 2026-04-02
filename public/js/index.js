// -----------------------
// GLOBALE VARIABELEN
// -----------------------
const MONTHS = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

// -----------------------
// DOMContentLoaded INIT
// -----------------------
document.addEventListener("DOMContentLoaded", () => {
    loadFilters();
    loadNewAds();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("keyup", function (e) {
            if (e.key === "Enter") searchTools();
        });
    }
});

// -----------------------
// SPINNER & TOAST
// -----------------------
function showSpinner(show = true) {
    const spinner = document.getElementById('globalSpinner');
    if (!spinner) return;
    spinner.style.display = show ? 'flex' : 'none';
}

function showToast(msg, type = 'info', ms = 3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `show ${type}`;
    setTimeout(() => el.classList.remove('show'), ms);
}

// -----------------------
// FETCH MET SPINNER
// -----------------------
async function fetchWithSpinner(url, options) {
    showSpinner(true);
    try {
        const res = await fetch(url, options);
        return res;
    } catch (err) {
        console.error(err);
        showToast("Er is een netwerkfout opgetreden.", "error");
        throw err;
    } finally {
        showSpinner(false);
    }
}

// -----------------------
// ZOEKFUNCTIE
// -----------------------
async function searchTools() {
    const inputEl = document.getElementById("searchInput");
    if (!inputEl) return;

    const input = inputEl.value.trim();
    if (input === "") {
        showToast("Vul een zoekterm in!", "error");
        return;
    }

    window.location.href = `/lijst.html?search=${encodeURIComponent(input)}`;
}

// -----------------------
// RESULTATEN TONEN
// -----------------------
function displayResults(results) {
    const container = document.getElementById("toolsContainer");
    if (!container) return;

    container.innerHTML = "";

    if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = "<p>Geen resultaten gevonden.</p>";
        return;
    }

    results.forEach(tool => {
        const card = document.createElement("div");
        card.classList.add("tool-card");

        const imageUrl = tool.Afbeelding || "/images/default.jpg";

        card.innerHTML = `
            <img src="${imageUrl}" alt="${tool.Naam}">
            <div class="tool-card-content">
                <h3>${tool.Naam}</h3>
                <p>${tool.Beschrijving || ""}</p>
                <div class="tool-price">€${tool.BorgBedrag || 0} borg</div>
            </div>
        `;

        card.addEventListener("click", () => {
            window.location.href = `/gereedschap.html?id=${tool.Gereedschap_id}`;
        });

        container.appendChild(card);
    });
}

// -----------------------
// FILTERS LADEN
// -----------------------
async function loadFilters() {
    const container = document.getElementById("filterGroups");
    if (!container) return;

    showSpinner(true);
    try {
        const res = await fetchWithSpinner("/categorieen");
        const cats = await res.json();
        if (!Array.isArray(cats)) throw new Error("Categorieën zijn geen array");
        renderFilters(cats);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:#9ca3af;font-size:.85rem">Filters niet beschikbaar.</p>';
        showToast("Filters konden niet geladen worden.", "error");
    } finally {
        showSpinner(false);
    }
}

function renderFilters(categorieen) {
    const container = document.getElementById("filterGroups");
    if (!container) return;

    const parents = categorieen.filter(c => c.Parent_id === null);
    const children = categorieen.filter(c => c.Parent_id !== null);

    container.innerHTML = "";

    for (const parent of parents) {
        const groepEl = document.createElement("div");
        groepEl.classList.add("filter-group");

        const title = document.createElement("div");
        title.classList.add("filter-group-title");
        title.textContent = parent.Naam;
        groepEl.appendChild(title);

        const opties = children.filter(c => c.Parent_id === parent.Categorie_id);

        for (const cat of opties) {
            const label = document.createElement("label");
            label.classList.add("filter-option");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = cat.Categorie_id;
            checkbox.dataset.naam = cat.Naam;
            checkbox.id = `cat-${cat.Categorie_id}`;
            checkbox.addEventListener("change", applyFilters);

            label.setAttribute("for", `cat-${cat.Categorie_id}`);
            label.appendChild(checkbox);

            const span = document.createElement("span");
            span.textContent = cat.Naam;
            label.appendChild(span);

            groepEl.appendChild(label);
        }

        container.appendChild(groepEl);
    }
}

// -----------------------
// FILTERS TOEPASSEN
// -----------------------
function buildFilterParams() {
    const checkboxes = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);

    const params = new URLSearchParams();
    if (ids.length > 0) params.set("categorieen", ids.join(","));

    const searchInput = document.getElementById("searchInput")?.value.trim();
    if (searchInput) params.set("search", searchInput);

    return params;
}

async function applyFilters() {
    const container = document.getElementById("toolsContainer");
    if (!container) return;

    const params = buildFilterParams();
    showSpinner(true);
    try {
        const res = await fetchWithSpinner(`/gereedschap?${params.toString()}`);
        const tools = await res.json();
        displayResults(Array.isArray(tools) ? tools : []);
    } catch (err) {
        console.error(err);
        showToast("Gereedschap kon niet geladen worden.", "error");
    } finally {
        showSpinner(false);
    }
}

// -----------------------
// SLIDER (Nieuwste Gereedschap)
// -----------------------
async function loadNewAds() {
    const track = document.getElementById("newAdsTrack");
    if (!track) return;

    showSpinner(true);
    try {
        const res = await fetchWithSpinner("/gereedschap");
        const tools = await res.json();

        if (!Array.isArray(tools) || tools.length === 0) {
            track.innerHTML = "<p>Geen gereedschap gevonden.</p>";
            showToast("Geen nieuwe advertenties beschikbaar.", "info");
            return;
        }

        const nieuwsteTools = tools.slice(0, 6);
        const sliderTools = [...nieuwsteTools, ...nieuwsteTools];

        track.innerHTML = sliderTools.map(tool => {
            const afbeelding = tool.Afbeelding?.trim() || "../images/placeholder.jpg";
            const titel = tool.Naam || "Gereedschap";
            const beschrijving = tool.Beschrijving || "Nieuw geplaatst op Gereedschapspunt.";

            return `
                <article class="ad-card">
                    <img src="${afbeelding}" alt="${titel}" class="ad-image">
                    <div class="ad-content">
                        <span class="ad-label">Nieuw</span>
                        <h3>${titel}</h3>
                        <p>${beschrijving}</p>
                    </div>
                </article>
            `;
        }).join("");

    } catch (err) {
        console.error("Fout bij laden slider:", err);
        track.innerHTML = "<p>Advertenties laden mislukt.</p>";
        showToast("Slider laden mislukt.", "error");
    } finally {
        showSpinner(false);
    }
}

// -----------------------
// NODIG VOOR HTML ONCLICK
// -----------------------
window.searchTools = searchTools;
window.applyFilters = applyFilters;