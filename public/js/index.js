document.addEventListener("DOMContentLoaded", function () {
    loadFilters();
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

async function fetchAndDisplay(url) {
  try {
    const response = await fetch(url);
    const tools = await response.json();
    displayTools(tools);
  } catch (err) {
    console.error("Fout bij laden tools:", err);
    document.getElementById("toolsContainer").innerHTML = "<p>Er ging iets mis.</p>";
  }
}

async function loadTools() {
  await fetchAndDisplay('/gereedschap');
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
            window.location.href = `/gereedschap.html?id=${tool.Gereedschap_id}`;
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


async function loadFilters() {
  try {
    const res = await fetch('/categorieen');
    const cats = await res.json();
    renderFilters(cats);
  } catch (err) {
    document.getElementById('filterGroups').innerHTML = '<p style="color:#9ca3af;font-size:.85rem">Filters niet beschikbaar.</p>';
  }
}

function renderFilters(categorieen) {
  const parents = categorieen.filter(c => c.Parent_id === null);
  const children = categorieen.filter(c => c.Parent_id !== null);

  const container = document.getElementById('filterGroups');
  container.innerHTML = '';

  for (const parent of parents) {
    const groepEl = document.createElement('div');
    groepEl.classList.add('filter-group');

    const title = document.createElement('div');
    title.classList.add('filter-group-title');
    title.textContent = parent.Naam;
    groepEl.appendChild(title);

    const opties = children.filter(c => c.Parent_id === parent.Categorie_id);
    for (const cat of opties) {
      const label = document.createElement('label');
      label.classList.add('filter-option');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = cat.Categorie_id;
      checkbox.dataset.naam = cat.Naam;
      checkbox.id = `cat-${cat.Categorie_id}`;
      checkbox.addEventListener('change', applyFilters);

      label.setAttribute('for', `cat-${cat.Categorie_id}`);
      label.appendChild(checkbox);
      const span = document.createElement('span');
      span.textContent = cat.Naam;
      label.appendChild(span);
      groepEl.appendChild(label);
    }
    container.appendChild(groepEl);
  }
}

function buildFilterParams() {
  const checkboxes = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');
  const ids = Array.from(checkboxes).map(cb => cb.value);
  const params = new URLSearchParams();
  if (ids.length > 0) params.set('categorieen', ids.join(','));
  return params;
}

async function applyFilters() {
  const params = buildFilterParams();
  const searchVal = document.getElementById("searchInput").value.trim();
  if (searchVal) params.set('search', searchVal);
  updateActiveFilterChips();
  updateFilterBadge();
  await fetchAndDisplay(`/gereedschap?${params.toString()}`);
}

function updateActiveFilterChips() {
  const container = document.getElementById('activeFilters');
  const checked = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked');
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
    chip.addEventListener('click', () => { cb.checked = false; applyFilters(); });
    container.appendChild(chip);
  });
}

function updateFilterBadge() {
  const count = document.querySelectorAll('#filterGroups input[type="checkbox"]:checked').length;
  const badge = document.getElementById('filterBadge');
  badge.textContent = count;
  badge.hidden = count === 0;
}

window.resetFilters = function () {
  document.querySelectorAll('#filterGroups input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.getElementById("searchInput").value = '';
  updateActiveFilterChips();
  updateFilterBadge();
  loadTools();
};

window.toggleFilterPanel = function () {
  const panel = document.getElementById('filterPanel');
  const overlay = document.getElementById('filterOverlay');
  const btn = document.getElementById('filterToggle');
  const isOpen = panel.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
  btn.setAttribute('aria-expanded', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
};

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

      // selecteer de nieuwste 6 tools
      const nieuwsteTools = tools.slice(0, 6);

      // duplicate voor oneindige scroll
      const sliderTools = [...nieuwsteTools, ...nieuwsteTools];

      // voeg items toe aan de slider-track
      track.innerHTML = sliderTools
        .map((tool) => {
          const afbeelding =
            tool.Afbeelding && tool.Afbeelding.trim() !== ""
              ? tool.Afbeelding
              : "../images/placeholder.jpg";

          const titel = tool.Naam || "Gereedschap";
          const beschrijving =
            tool.Beschrijving || "Nieuw geplaatst op Gereedschapspunt.";

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
        })
        .join("");
    } catch (error) {
      console.error("Fout bij laden slider:", error);
      track.innerHTML = "<p>Advertenties laden mislukt.</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", loadNewAds);