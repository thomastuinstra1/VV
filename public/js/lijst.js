// -----------------------
// GLOBALS
// -----------------------
let currentUserCoords = null;
let maxDistance = 50; // standaard 50 km

// -----------------------
// URL SEARCH
// -----------------------
function getSearchFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("search") || "";
}

// -----------------------
// FETCH + DISPLAY
// -----------------------
async function fetchAndDisplay(url) {
  const container = document.getElementById("toolsContainer");
  if (!container) return;

  try {
    const response = await fetchWithSpinner(url);
    let tools = await response.json();

    // 👉 voeg afstand toe aan elk tool object
    tools = tools.map(tool => {
      let afstand = null;

      if (
        currentUserCoords &&
        tool.Account?.lat != null &&
        tool.Account?.lon != null
      ) {
        afstand = haversine(
          currentUserCoords.lat,
          currentUserCoords.lon,
          tool.Account.lat,
          tool.Account.lon
        );
      }

      return { ...tool, afstand };
    });

    // 👉 filter op afstand
    tools = tools.filter(tool => {
      if (tool.afstand == null) return true;
      if (maxDistance == null) return true;
      return tool.afstand <= maxDistance;
    });

    // 👉 sorteer op afstand (dichtbij eerst)
    tools.sort((a, b) => {
      if (a.afstand == null) return 1;
      if (b.afstand == null) return -1;
      return a.afstand - b.afstand;
    });

    displayTools(tools);
    updateToolCount(tools.length);

  } catch (err) {
    console.error("Fout bij laden tools:", err);
    container.innerHTML = "<p>Er ging iets mis.</p>";
  }
}

// -----------------------
// TOOL COUNT
// -----------------------
function updateToolCount(count) {
  const countEl = document.getElementById("toolCount");
  if (countEl) countEl.textContent = `${count} items gevonden`;
}

// -----------------------
// FILTERS LADEN
// -----------------------
async function loadFilters() {
  const container = document.getElementById("filterGroups");
  if (!container) return;

  try {
    const res = await fetchWithSpinner("/categorieen");
    const categorieen = await res.json();

    const parents = categorieen.filter(c => c.Parent_id === null);
    const children = categorieen.filter(c => c.Parent_id !== null);

    container.innerHTML = "";

    // 👉 afstand filter toevoegen
    const afstandGroup = document.createElement("div");
    afstandGroup.classList.add("filter-group");

    afstandGroup.innerHTML = `
      <div class="filter-group-title">Afstand</div>
      <input type="range" id="distanceFilter" min="1" max="50" value="50">
      <span id="distanceValue">50 km</span>
    `;

    container.appendChild(afstandGroup);

    parents.forEach(parent => {
      const groepEl = document.createElement("div");
      groepEl.classList.add("filter-group");

      const title = document.createElement("div");
      title.classList.add("filter-group-title");
      title.textContent = parent.Naam;
      groepEl.appendChild(title);

      const opties = children.filter(c => c.Parent_id === parent.Categorie_id);

      opties.forEach(cat => {
        const label = document.createElement("label");
        label.classList.add("filter-option");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = cat.Categorie_id;
        checkbox.dataset.naam = cat.Naam;
        checkbox.id = `cat-${cat.Categorie_id}`;
        checkbox.addEventListener("change", applyFilters);

        label.setAttribute("for", checkbox.id);
        label.appendChild(checkbox);

        const span = document.createElement("span");
        span.textContent = cat.Naam;
        label.appendChild(span);

        groepEl.appendChild(label);
      });

      container.appendChild(groepEl);
    });

    // 👉 afstand slider event
    const distanceInput = document.getElementById("distanceFilter");
    const distanceValue = document.getElementById("distanceValue");

    if (distanceInput) {
      distanceInput.addEventListener("input", () => {
        maxDistance = Number(distanceInput.value);
        distanceValue.textContent = `${maxDistance} km`;
        applyFilters();
      });
    }

  } catch (err) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:.85rem">Filters niet beschikbaar.</p>';
  }
}

// -----------------------
// DISPLAY TOOLS
// -----------------------
function displayTools(tools) {
  const container = document.getElementById("toolsContainer");
  container.innerHTML = "";

  if (!tools || tools.length === 0) {
    container.innerHTML = "<p>Geen gereedschap beschikbaar.</p>";
    return;
  }

  tools.forEach(tool => {
    const card = document.createElement("div");
    card.classList.add("tool-card");

    const imageUrl = tool.Afbeelding?.trim() || "../images/placeholder.jpg";

    const afstandText = tool.afstand != null
      ? `<div class="tool-distance">${tool.afstand.toFixed(1)} km</div>`
      : "";

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

// -----------------------
// FILTER PARAMS
// -----------------------
function buildFilterParams() {
  const checkboxes = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');
  const ids = Array.from(checkboxes).map(cb => cb.value);

  const params = new URLSearchParams();

  if (ids.length > 0) {
    params.set('categorieen', ids.join(','));
  }

  const searchVal = document.getElementById("searchInput")?.value.trim();
  if (searchVal) {
    params.set('search', searchVal);
  }

  return params;
}

// -----------------------
// APPLY FILTERS
// -----------------------
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

// -----------------------
// HAVERSINE
// -----------------------
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

// -----------------------
// USER LOCATION
// -----------------------
async function loadCurrentUser() {
  try {
    const res = await fetchWithSpinner("/me");
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
// FILTER PANEL TOGGLE
// -----------------------
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
// INIT
// -----------------------
document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentUser();

  await loadFilters();

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

