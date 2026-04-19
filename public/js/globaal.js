function showSpinner(show = true) {
  const spinner = document.getElementById('globalSpinner');
  if (!spinner) return;
  spinner.style.display = show ? 'flex' : 'none';
}

let activeRequests = 0;

async function fetchWithSpinner(url, options = {}, delay = 300) {
  let spinnerTimeout;
  activeRequests++;

  spinnerTimeout = setTimeout(() => {
    if (activeRequests > 0) {
      showSpinner(true);
    }
  }, delay);

  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    console.error(err);
    showToast('Er is een netwerkfout opgetreden.', 'error');
    return null;
  } finally {
    clearTimeout(spinnerTimeout);
    activeRequests--;
    if (activeRequests === 0) {
      showSpinner(false);
    }
  }
}

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove('success', 'error', 'info');
  toast.classList.add('show', type);

  setTimeout(() => {
    toast.classList.remove('show', type);
  }, duration);
}

function updateNavAvatar(gebruiker) {
  const avatar = document.getElementById('navAvatar');
  if (!avatar || !gebruiker) return;

  const naam = gebruiker.Name || 'Gebruiker';
  const afbeelding = gebruiker.Afbeelding && String(gebruiker.Afbeelding).trim() !== ''
    ? String(gebruiker.Afbeelding).trim()
    : null;

  const delen = naam.trim().split(' ').filter(Boolean);
  const initialen = delen.length > 1
    ? (delen[0][0] + delen[delen.length - 1][0]).toUpperCase()
    : (delen[0]?.substring(0, 2) || '?').toUpperCase();

  if (afbeelding) {
    avatar.innerHTML = `
      <img
        src="${afbeelding}"
        alt="Profielfoto"
        style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"
      />
    `;

    const img = avatar.querySelector('img');
    img.onerror = function () {
      avatar.innerHTML = `
        <span style="font-size:13px;font-weight:500;color:#534AB7;">
          ${initialen}
        </span>
      `;
    };
  } else {
    avatar.innerHTML = `
      <span style="font-size:13px;font-weight:500;color:#534AB7;">
        ${initialen}
      </span>
    `;
  }
}

function injectFloatingChatHTML() {
  if (document.getElementById('floating-chat-root')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="floating-chat-root" class="floating-chat hidden">
      <button id="floating-chat-toggle" class="floating-chat-toggle" type="button">
        💬
        <span id="floating-chat-count" class="floating-chat-count" style="display:none;">0</span>
      </button>

      <div id="floating-chat-window" class="floating-chat-window hidden">
        <div class="floating-chat-header">
          <span>Berichten</span>
          <button id="floating-chat-close" type="button">✕</button>
        </div>

        <div class="floating-chat-body">
          <div class="floating-chat-sidebar">
            <div id="floating-chat-contacts"></div>
          </div>

          <div class="floating-chat-main">
            <div id="floating-chat-messages" class="floating-chat-messages">
              <p class="floating-chat-placeholder">Kies een contact om te chatten</p>
            </div>

            <div class="floating-chat-input-area">
              <input
                type="text"
                id="floating-chat-input"
                placeholder="Typ een bericht..."
              />
              <button id="floating-chat-send" type="button">Verstuur</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
}

const MONTHS = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (match) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[match];
  });
}

async function searchTools() {
  const inputEl = document.getElementById('searchInput');
  if (!inputEl) return;

  const input = inputEl.value.trim();
  if (input === '') {
    showToast('Vul een zoekterm in!', 'error');
    return;
  }

  window.location.href = `/lijst.html?search=${encodeURIComponent(input)}`;
}

function displayResults(results) {
  const container = document.getElementById('toolsContainer');
  if (!container) return;

  container.innerHTML = '';

  if (!Array.isArray(results) || results.length === 0) {
    container.innerHTML = '<p>Geen resultaten gevonden.</p>';
    return;
  }

  results.forEach(tool => {
    const card = document.createElement('div');
    card.classList.add('tool-card');

    const imageUrl = tool.Afbeelding || '/images/default.jpg';

    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(tool.Naam || 'Gereedschap')}">
      <div class="tool-card-content">
        <h3>${escapeHtml(tool.Naam || 'Gereedschap')}</h3>
        <p>${escapeHtml(tool.Beschrijving || '')}</p>
        <div class="tool-price">€${tool.BorgBedrag || 0} borg</div>
      </div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `/gereedschap.html?id=${tool.Gereedschap_id}`;
    });

    container.appendChild(card);
  });
}

async function loadFilters() {
  const container = document.getElementById('filterGroups');
  if (!container) return;

  try {
    const res = await fetchWithSpinner('/categorieen');
    if (!res || !res.ok) throw new Error('Categorieën konden niet geladen worden');

    const cats = await res.json();
    if (!Array.isArray(cats)) throw new Error('Categorieën zijn geen array');

    renderFilters(cats);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p style="color:#9ca3af;font-size:.85rem">Filters niet beschikbaar.</p>';
    showToast('Filters konden niet geladen worden.', 'error');
  }
}

function renderFilters(categorieen) {
  const container = document.getElementById('filterGroups');
  if (!container) return;

  const parents = categorieen.filter(c => c.Parent_id === null);
  const children = categorieen.filter(c => c.Parent_id !== null);

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

  const searchInput = document.getElementById('searchInput')?.value.trim();
  if (searchInput) params.set('search', searchInput);

  return params;
}

async function applyFilters() {
  const container = document.getElementById('toolsContainer');
  if (!container) return;

  const params = buildFilterParams();

  try {
    const res = await fetchWithSpinner(`/gereedschap?${params.toString()}`);
    if (!res || !res.ok) throw new Error('Gereedschap kon niet geladen worden');

    const tools = await res.json();
    displayResults(Array.isArray(tools) ? tools : []);
  } catch (err) {
    console.error(err);
    showToast('Gereedschap kon niet geladen worden.', 'error');
  }
}

async function loadNewestAds() {
  const track = document.getElementById('newAdsTrack');
  if (!track) return;

  try {
    const res = await fetchWithSpinner('/gereedschappen/nieuw');
    if (!res || !res.ok) throw new Error('Kon nieuwste advertenties niet ophalen');

    const ads = await res.json();
    const latestAds = Array.isArray(ads) ? ads.slice(0, 10) : [];

    if (!latestAds.length) {
      track.innerHTML = '<p>Er zijn nog geen advertenties.</p>';
      return;
    }

    const renderSet = [...latestAds, ...latestAds];

    track.innerHTML = renderSet.map(ad => {
      const afbeelding = ad.Afbeelding || '/images/default-tool.jpg';
      const titel = escapeHtml(ad.Naam || ad.Titel || 'Gereedschap');
      const beschrijving = escapeHtml(ad.Beschrijving || 'Bekijk deze advertentie');
      const plaats = escapeHtml(ad.Plaats || '');
      const id = encodeURIComponent(ad.Gereedschap_id);

      return `
        <a class="ad-card" href="gereedschap.html?id=${id}">
          <img class="ad-image" src="${afbeelding}" alt="${titel}">
          <div class="ad-content">
            <span class="ad-label">${plaats || 'Nieuw'}</span>
            <h3>${titel}</h3>
            <p>${beschrijving}</p>
          </div>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    track.innerHTML = '<p>Kon advertenties niet laden.</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname.toLowerCase();

  if (!path.includes('inlog') && !path.includes('registre')) {
    injectFloatingChatHTML();
  }

  loadFilters();
  loadNewestAds();

  setInterval(loadNewestAds, 30000);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keyup', function (e) {
      if (e.key === 'Enter') searchTools();
    });
  }
});

window.searchTools = searchTools;
window.applyFilters = applyFilters;