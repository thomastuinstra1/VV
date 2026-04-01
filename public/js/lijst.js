let currentUserCoords = null;

function getSearchFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") || "";
}

// -----------------------
// HULPFUNCTIES VOOR TOOLS
// -----------------------
async function fetchAndDisplay(url) {
  const container = document.getElementById("toolsContainer");
  if (!container) return;

  try {
    const response = await fetch(url);
    const tools = await response.json();
    displayTools(tools);
    updateToolCount(tools.length);
  } catch (err) {
    console.error("Fout bij laden tools:", err);
    container.innerHTML = "<p>Er ging iets mis.</p>";
  }
}

function displayTools(tools) {
  const container = document.getElementById("toolsContainer");
  container.innerHTML = "";

  if (!tools || tools.length === 0) {
    container.innerHTML = "<p>Geen gereedschap beschikbaar.</p>";
    return;
  }

  tools.forEach((tool) => {
    const card = document.createElement("div");
    card.classList.add("tool-card");

    const imageUrl = tool.Afbeelding?.trim() || "../images/placeholder.jpg";

    let afstandText = "";

    if (currentUserCoords && tool.Account?.lat && tool.Account?.lon) {
        const afstand = haversine(
          currentUserCoords.lat,
          currentUserCoords.lon,
          tool.Account.lat,
          tool.Account.lon
        );

        afstandText = `<div class="tool-distance">${afstand.toFixed(1)} km</div>`;
    }

    card.innerHTML = `
      <img src="${imageUrl}" alt="${tool.Naam}">
      <div class="tool-card-content">
        <h3>${tool.Naam}</h3>
        <p>${tool.Beschrijving || ""}</p>
        <div class="tool-price">€${tool.BorgBedrag || 0} borg</div>
        ${afstandText}
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `/gereedschap.html?id=${tool.Gereedschap_id}`;
    });

    container.appendChild(card);
  });
}

function updateToolCount(count) {
  const countEl = document.getElementById("toolCount");
  if (countEl) countEl.textContent = `${count} items gevonden`;
}

// -----------------------
// FILTERS
// -----------------------
async function loadFilters() {
  const container = document.getElementById("filterGroups");
  if (!container) return;

  try {
    const res = await fetch("/categorieen");
    const categorieen = await res.json();

    const parents = categorieen.filter(c => c.Parent_id === null);
    const children = categorieen.filter(c => c.Parent_id !== null);

    container.innerHTML = "";
    parents.forEach((parent) => {
      const groepEl = document.createElement("div");
      groepEl.classList.add("filter-group");

      const title = document.createElement("div");
      title.classList.add("filter-group-title");
      title.textContent = parent.Naam;
      groepEl.appendChild(title);

      const opties = children.filter(c => c.Parent_id === parent.Categorie_id);
      opties.forEach((cat) => {
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
      });

      container.appendChild(groepEl);
    });
  } catch (err) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:.85rem">Filters niet beschikbaar.</p>';
  }
}

function buildFilterParams() {
  const checkboxes = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');
  const ids = Array.from(checkboxes).map(cb => cb.value);
  const params = new URLSearchParams();
  if (ids.length > 0) params.set('categorieen', ids.join(','));

  const searchVal = document.getElementById("searchInput")?.value.trim();
  if (searchVal) params.set('search', searchVal);

  return params;
}

async function applyFilters() {
  updateActiveFilterChips();
  updateFilterBadge();
  const params = buildFilterParams();
  await fetchAndDisplay(`/gereedschap?${params.toString()}`);
}

function updateActiveFilterChips() {
  const container = document.getElementById('activeFilters');
  const checked = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');

  if (!container) return;

  if (checked.length === 0) {
    container.hidden = true;
    container.innerHTML = '';
    document.getElementById('resetBtn').hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = '';
  document.getElementById('resetBtn').hidden = false;

  checked.forEach(cb => {
    const chip = document.createElement('button');
    chip.classList.add('filter-chip');
    chip.innerHTML = `${cb.dataset.naam} <span>×</span>`;
    chip.addEventListener('click', () => {
      cb.checked = false;
      applyFilters();
    });
    container.appendChild(chip);
  });
}

function updateFilterBadge() {
  const count = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked').length;
  const badge = document.getElementById('filterBadge');
  if (badge) {
    badge.textContent = count;
    badge.hidden = count === 0;
  }
}

function resetFilters() {
  document.querySelectorAll('#filterGroups input[type="checkbox"]').forEach(cb => cb.checked = false);
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = '';
  applyFilters();
}

function toggleFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const overlay = document.getElementById('filterOverlay');
  const btn = document.getElementById('filterToggle');
  if (!panel || !overlay || !btn) return;

  const isOpen = panel.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
  btn.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

// -----------------------
// LIVE SEARCH
// -----------------------
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", applyFilters); // live update terwijl je typt
}

// -----------------------
// NEW ADS SLIDER
// -----------------------
async function loadNewAds() {
  const track = document.getElementById("newAdsTrack");
  if (!track) return;

  try {
    const res = await fetch("/gereedschap");
    const tools = await res.json();

    if (!tools || tools.length === 0) {
      track.innerHTML = "<p>Geen gereedschap gevonden.</p>";
      return;
    }

    const nieuwsteTools = tools.slice(0, 6);
    const sliderTools = [...nieuwsteTools, ...nieuwsteTools];

    track.innerHTML = sliderTools.map((tool) => {
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

  } catch (error) {
    console.error("Fout bij laden slider:", error);
    track.innerHTML = "<p>Advertenties laden mislukt.</p>";
  }
}

async function loadCurrentUser() {
  try {
    const res = await fetch("/me");
    const user = await res.json();

    currentUserCoords = {
      lat: user.lat,
      lon: user.lon
    };
  } catch (err) {
    console.error("Fout bij laden gebruiker:", err);
  }
}

// -----------------------
// INIT
// -----------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentUser(); // 🔥 BELANGRIJK

  loadFilters();
  loadNewAds();

  const search = getSearchFromURL();

  let url = "/gereedschap";

  if (search) {
    url += `?search=${encodeURIComponent(search)}`;
  }

  fetchAndDisplay(url);
  const searchInput = document.getElementById("searchInput");
  if (searchInput && search) {
    searchInput.value = search;
  }
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}