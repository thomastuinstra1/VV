// ── State ──────────────────────────────────────────────────────────────────
let allUitleningen = [];
let allGereedschap = [];
let filteredHist = [];
let histPage = 1;
const PER_PAGE = 10;
const MONTHS = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// ── Boot ───────────────────────────────────────────────────────────────────
(async function init() {
  setTimestamp();
  await loadData();
  buildDashboard();
  renderGereedschap(allGereedschap);
  filteredHist = [...allUitleningen];
  renderHistorie(filteredHist, histPage);
})();

// ── Data laden ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [uRes, gRes] = await Promise.all([
      fetchWithSpinner('/dashboard/uitleningen'),
      fetchWithSpinner('/dashboard/gereedschap'),
    ]);

    if (!uRes || !gRes) throw new Error('Geen response van server');
    if (uRes.status === 401 || gRes.status === 401) {
      window.location.href = '/inlog.html';
      return;
    }
    if (!uRes.ok || !gRes.ok) throw new Error('Fout bij laden dashboarddata');

    allUitleningen = await uRes.json();
    allGereedschap = await gRes.json();
  } catch (err) {
    showToast('Fout bij laden data', 'error');
    console.error(err);
  }
}

// ── Dashboard opbouwen ─────────────────────────────────────────────────────
function buildDashboard() {
  const actief = allUitleningen.filter((u) => u.Status === 'accepted');
  const verlaat = allGereedschap.filter((g) => g.status === 'Te laat').length;
  const beschikbaar = allGereedschap.filter((g) => g.status === 'Beschikbaar').length;

  document.getElementById('stat-actief').textContent = actief.length;
  document.getElementById('stat-beschikbaar').textContent = beschikbaar;
  document.getElementById('stat-verlaat').textContent = verlaat;
  document.getElementById('stat-totaal').textContent = allUitleningen.length;

  renderBarChart();
  renderDonut();
  renderActief(actief);
}

// ── Staafgrafiek ───────────────────────────────────────────────────────────
function renderBarChart() {
  const counts = new Array(12).fill(0);
  const year = new Date().getFullYear();

  allUitleningen.forEach((u) => {
    if (!u.StartDatum) return;
    const d = new Date(u.StartDatum);
    if (d.getFullYear() === year) counts[d.getMonth()]++;
  });

  const max = Math.max(...counts, 1);

  document.getElementById('bar-chart').innerHTML = counts
    .map(
      (v, i) => `
      <div class="bar-wrap">
        <div class="bar" style="height:${Math.round((v / max) * 110)}px">
          ${v > 0 ? `<span class="bar-val">${v}</span>` : ''}
        </div>
        <span class="bar-label">${MONTHS[i]}</span>
      </div>
    `
    )
    .join('');
}

// ── Donut-chart ────────────────────────────────────────────────────────────
function renderDonut() {
  const avail = allGereedschap.filter((g) => g.status === 'Beschikbaar').length;
  const uit = allGereedschap.filter((g) => g.status === 'Uitgeleend').length;
  const wacht = allGereedschap.filter((g) => g.status === 'Ingeleverd?').length;
  const telaat = allGereedschap.filter((g) => g.status === 'Te laat').length;
  const total = avail + uit + wacht + telaat || 1;

  const segments = [
    { label: 'Beschikbaar', count: avail, color: '#166534' },
    { label: 'Uitgeleend', count: uit, color: '#c2410c' },
    { label: 'Ingeleverd?', count: wacht, color: '#b45309' },
    { label: 'Te laat', count: telaat, color: '#b91c1c' },
  ];

  const cx = 60;
  const cy = 60;
  const r = 44;
  const stroke = 18;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  let paths = '';

  for (const seg of segments) {
    if (!seg.count) continue;
    const len = (seg.count / total) * circ;

    paths += `
      <circle
        cx="${cx}"
        cy="${cy}"
        r="${r}"
        fill="none"
        stroke="${seg.color}"
        stroke-width="${stroke}"
        stroke-dasharray="${len} ${circ - len}"
        stroke-dashoffset="${-(offset - circ * 0.25)}"
      />
    `;

    offset += len;
  }

  document.getElementById('donut-svg').innerHTML =
    paths +
    `
      <text
        x="${cx}"
        y="${cy + 2}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="'DM Mono', monospace"
        font-size="18"
        font-weight="500"
        fill="currentColor"
      >${total}</text>
    `;

  document.getElementById('donut-legend').innerHTML = segments
    .filter((s) => s.count > 0)
    .map(
      (s) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${s.color}"></div>
        <span class="legend-name">${s.label}</span>
        <span class="legend-count">${s.count}</span>
      </div>
    `
    )
    .join('');
}

// ── Actieve uitleningen tabel ──────────────────────────────────────────────
function renderActief(rows) {
  const tbody = document.getElementById('tbody-actief');

  if (!rows.length) {
    tbody.innerHTML = emptyRow(6, 'Geen actieve uitleningen');
    return;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  tbody.innerHTML = rows
    .map((u) => {
      const start = u.StartDatum ? new Date(u.StartDatum) : null;
      const eind = u.EindDatum ? new Date(u.EindDatum) : null;

      let typeLabel;
      if (start && eind) {
        if (now > eind) {
          typeLabel = 'Verlopen';
        } else if (start <= now && eind >= now) {
          typeLabel = 'Bezig';
        } else {
          typeLabel = 'Komend';
        }
      } else {
        typeLabel = 'Komend';
      }
      const name = u.lenerNaam || `Account #${u.Account_id}`;

      return `
        <tr>
          <td>
            <div class="tool-name">
              ${u.gereedschapNaam || `ID ${u.Gereedschap_id}`}
              <small>#${u.Uitleen_id}</small>
            </div>
          </td>
          <td>
            <div class="borrower-cell">
              <div class="avatar">${initials(name)}</div>
              ${name}
            </div>
          </td>
          <td class="mono muted">${fmtDate(u.StartDatum)}</td>
          <td class="mono muted">${fmtDate(u.EindDatum)}</td>
          <td class="mono muted">${u.BorgBedrag != null ? '€' + Number(u.BorgBedrag).toFixed(2) : '—'}</td>
          <td>${badge(typeLabel)}</td>
        </tr>
      `;
    })
    .join('');
}

function filterActief() {
  const s = document.getElementById('filter-actief-status').value;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const rows = allUitleningen.filter((u) => {
    if (u.Status !== 'accepted') return false;
    if (!s) return true;

    const start = u.StartDatum ? new Date(u.StartDatum) : null;
    const eind = u.EindDatum ? new Date(u.EindDatum) : null;

    if (s === 'Bezig') return start && eind && start <= now && eind >= now;
    if (s === 'Komend') return start && start > now;
    if (s === 'Verlopen') return eind && now > eind;
    return false;
  });

  renderActief(rows);
}
window.filterActief = filterActief;

// ── Gereedschapspagina ─────────────────────────────────────────────────────
function renderGereedschap(data) {
  const empty = document.getElementById('geenGereedschap');
  if (empty) empty.hidden = data.length > 0;

  document.getElementById('tool-grid-view').innerHTML = data.length
    ? data
        .map((g) => {
          const cls = statusClass(g.status);
          const imgHtml = g.Afbeelding
            ? `<img class="tile-img" src="${g.Afbeelding}" alt="${g.Naam}">`
            : `<div class="tile-img-placeholder">Geen foto</div>`;

          return `
            <div class="tool-tile ${cls}" onclick="openGmModal(${g.Gereedschap_id})">
              ${imgHtml}
              <div class="tile-name">${g.Naam}</div>
              ${badge(g.status)}
              ${renderTileInfo(g)}
              ${renderInleverKnoppen(g)}
            </div>
          `;
        })
        .join('')
    : '<p style="color:var(--text-muted);font-family:\'DM Mono\',monospace;font-size:13px">Geen resultaten</p>';

  document.getElementById('tbody-tools-table').innerHTML = data.length
    ? data
        .map((g) => {
          const lener = g.lenerNaam || '—';

          return `
            <tr style="cursor:pointer" onclick="openGmModal(${g.Gereedschap_id})">
              <td><div class="tool-name">${g.Naam}</div></td>
              <td class="mono muted">€${Number(g.BorgBedrag ?? 0).toFixed(2)}</td>
              <td class="mono muted">${g.Begindatum ? fmtDate(g.Begindatum) : '—'}</td>
              <td class="mono muted">${g.Einddatum ? fmtDate(g.Einddatum) : '—'}</td>
              <td>${badge(g.status)}</td>
              <td onclick="event.stopPropagation()">
                <div class="inlever-actions">
                  <button class="btn-inlever op-tijd" onclick="openGmModal(${g.Gereedschap_id})">Bewerken</button>
                  <button class="btn-inlever te-laat" onclick="gmVerwijderDirect(${g.Gereedschap_id})">Verwijderen</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('')
    : emptyRow(6, 'Geen resultaten');
}

async function openGmModal(id) {
  try {
    const [toolRes, allCatRes, toolCatRes] = await Promise.all([
      fetchWithSpinner(`/gereedschap?id=${id}`),
      fetchWithSpinner('/categorieen'),
      fetchWithSpinner(`/gereedschap/${id}/categorieen`),
    ]);

    if (!toolRes || !allCatRes || !toolCatRes) throw new Error('Geen response');
    if (!toolRes.ok || !allCatRes.ok || !toolCatRes.ok) throw new Error('Laden mislukt');

    const toolData = await toolRes.json();
    const allCatData = await allCatRes.json();
    const toolCatData = await toolCatRes.json();

    const tool = toolData[0];
    if (!tool) return;

    huidigGmId = tool.Gereedschap_id;

    const geselecteerd = toolCatData.map((c) => c.Categorie_id);

    document.getElementById('gm-id').value = tool.Gereedschap_id;
    document.getElementById('gm-naam').value = tool.Naam || '';
    document.getElementById('gm-beschrijving').value = tool.Beschrijving || '';
    document.getElementById('gm-borg').value = tool.BorgBedrag || '';
    document.getElementById('gm-begindatum').value = tool.Begindatum ? tool.Begindatum.split('T')[0] : '';
    document.getElementById('gm-einddatum').value = tool.Einddatum ? tool.Einddatum.split('T')[0] : '';

    document.getElementById('gm-img-wrap').innerHTML = tool.Afbeelding
      ? `<img src="${tool.Afbeelding}" alt="${tool.Naam}">`
      : `<div class="gm-no-img">Geen afbeelding</div>`;

    const MULTI_SELECT_GROEPEN = ['Materiaal'];
    const parents = allCatData.filter((c) => c.Parent_id === null);
    const children = allCatData.filter((c) => c.Parent_id !== null);
    const catGrid = document.getElementById('gm-categorieen');
    catGrid.innerHTML = '';

    for (const parent of parents) {
      const kids = children.filter((c) => c.Parent_id === parent.Categorie_id);
      if (!kids.length) continue;

      const isMulti = MULTI_SELECT_GROEPEN.includes(parent.Naam);
      const inputType = isMulti ? 'checkbox' : 'radio';
      const groupName = `cat-groep-${parent.Categorie_id}`;

      const titel = document.createElement('div');
      titel.className = 'gm-cat-groep-titel';
      titel.textContent = parent.Naam;
      catGrid.appendChild(titel);

      for (const cat of kids) {
        const isChecked = geselecteerd.includes(cat.Categorie_id);
        const lbl = document.createElement('label');
        lbl.className = 'gm-cat-label' + (isChecked ? ' checked' : '');
        lbl.innerHTML = `
          <input type="${inputType}" name="${groupName}" value="${cat.Categorie_id}" ${isChecked ? 'checked' : ''}>
          ${cat.Naam}
        `;

        lbl.querySelector('input').addEventListener('change', (e) => {
          if (!isMulti) {
            catGrid.querySelectorAll(`input[name="${groupName}"]`).forEach((inp) => {
              inp.closest('label').classList.toggle('checked', inp.checked);
            });
          } else {
            lbl.classList.toggle('checked', e.target.checked);
          }
        });

        catGrid.appendChild(lbl);
      }
    }

    document.getElementById('gm-overlay').hidden = false;
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error(err);
    showToast('Fout bij laden gereedschap', 'error');
  }
}
window.openGmModal = openGmModal;

function sluitGmModal() {
  document.getElementById('gm-overlay').hidden = true;
  document.body.style.overflow = '';
  document.getElementById('gm-afbeelding').value = '';
}
window.sluitGmModal = sluitGmModal;

async function gmOpslaan() {
  const id = document.getElementById('gm-id').value;
  const data = {
    Naam: document.getElementById('gm-naam').value,
    Beschrijving: document.getElementById('gm-beschrijving').value,
    BorgBedrag: document.getElementById('gm-borg').value || null,
    Begindatum: document.getElementById('gm-begindatum').value || null,
    Einddatum: document.getElementById('gm-einddatum').value || null,
    categorieen: Array.from(document.querySelectorAll('#gm-categorieen input:checked')).map((cb) => parseInt(cb.value)),
  };

  try {
    const res = await fetchWithSpinner(`/gereedschap/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res || !res.ok) throw new Error('Opslaan mislukt');

    const fileInput = document.getElementById('gm-afbeelding');
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('afbeelding', fileInput.files[0]);

      const imgRes = await fetchWithSpinner(`/gereedschap/${id}/afbeelding`, {
        method: 'POST',
        body: formData
      });

      if (!imgRes || !imgRes.ok) throw new Error('Afbeelding upload mislukt');
    }

    showToast('Opgeslagen', 'success');
    sluitGmModal();
    await loadData();
    buildDashboard();
    filterTools();
    filterHistorie();
  } catch (err) {
    console.error(err);
    showToast('Fout bij opslaan', 'error');
  }
}
window.gmOpslaan = gmOpslaan;

async function gmVerwijder() {
  const id = document.getElementById('gm-id').value;
  if (!confirm('Weet je zeker dat je dit gereedschap wilt verwijderen?')) return;

  try {
    const res = await fetchWithSpinner(`/gereedschap/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) throw new Error('Verwijderen mislukt');

    showToast('Verwijderd', 'success');
    sluitGmModal();
    await loadData();
    buildDashboard();
    filterTools();
    filterHistorie();
  } catch (err) {
    console.error(err);
    showToast('Fout bij verwijderen', 'error');
  }
}
window.gmVerwijder = gmVerwijder;

async function gmVerwijderDirect(id) {
  if (!confirm('Weet je zeker dat je dit gereedschap wilt verwijderen?')) return;

  try {
    const res = await fetchWithSpinner(`/gereedschap/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) throw new Error('Verwijderen mislukt');

    if (huidigGmId === id) sluitGmModal();

    showToast('Verwijderd', 'success');
    await loadData();
    buildDashboard();
    filterTools();
    filterHistorie();
  } catch (err) {
    console.error(err);
    showToast('Fout bij verwijderen', 'error');
  }
}
window.gmVerwijderDirect = gmVerwijderDirect;

document.getElementById('gm-overlay')?.addEventListener('click', function (e) {
  if (e.target === this) sluitGmModal();
});

// ── Hulp: info onder badge in tegel ───────────────────────────────────────
function renderTileInfo(g) {
  if (g.status === 'Beschikbaar') return '';
  const lener = g.lenerNaam || 'Onbekend';
  const datumTxt = g.eindDatum ? `t/m ${fmtDate(g.eindDatum)}` : '';
  return `<div class="tile-meta">${lener}${datumTxt ? `<br>${datumTxt}` : ''}</div>`;
}

// ── Hulp: inlever-knoppen renderen ────────────────────────────────────────
function renderInleverKnoppen(g) {
  if (g.status === 'Ingeleverd?' && g.activeUitleenId) {
    return `
      <div class="inlever-actions" onclick="event.stopPropagation()">
        <button class="btn-inlever op-tijd"
          onclick="markeerIngeleverd(${g.activeUitleenId}, 'ingeleverd_op_tijd', this)">
          ✓ Op tijd
        </button>
        <button class="btn-inlever te-laat"
          onclick="markeerIngeleverd(${g.activeUitleenId}, 'te_laat', this)">
          ✗ Te laat
        </button>
      </div>
    `;
  }

  if (g.status === 'Te laat' && g.activeUitleenId) {
    return `
      <div class="inlever-actions" onclick="event.stopPropagation()">
        <button class="btn-inlever op-tijd"
          onclick="markeerIngeleverd(${g.activeUitleenId}, 'ingeleverd_te_laat', this)">
          ✓ Is ingeleverd
        </button>
      </div>
    `;
  }

  return '';
}

// ── Inlevering markeren via API ────────────────────────────────────────────
async function markeerIngeleverd(uitleenId, status, btn) {
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await fetchWithSpinner(`/uitleen/${uitleenId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res || !res.ok) throw new Error('Status bijwerken mislukt');

    const label = status === 'ingeleverd_op_tijd' ? 'Op tijd ingeleverd' : 'Te laat ingeleverd';
    showToast(label, 'success');

    await loadData();
    buildDashboard();
    filterTools();
    filterHistorie();
  } catch (err) {
    console.error(err);
    showToast('Fout bij bijwerken status', 'error');
    btn.disabled = false;
    btn.textContent = status === 'ingeleverd_op_tijd' ? '✓ Op tijd' : '✗ Te laat';
  }
}
window.markeerIngeleverd = markeerIngeleverd;

function filterTools() {
  const q = (document.getElementById('search-tools')?.value || '').toLowerCase();
  const s = document.getElementById('filter-tools-status')?.value || '';

  const rows = allGereedschap.filter((g) => {
    return (!q || g.Naam.toLowerCase().includes(q)) && (!s || g.status === s);
  });

  renderGereedschap(rows);
}
window.filterTools = filterTools;

// ── Geschiedenis ───────────────────────────────────────────────────────────
function renderHistorie(data, page) {
  const start = (page - 1) * PER_PAGE;
  const slice = data.slice(start, start + PER_PAGE);
  const tbody = document.getElementById('tbody-hist');

  if (!slice.length) {
    tbody.innerHTML = emptyRow(7, 'Geen resultaten');
  } else {
    tbody.innerHTML = slice
      .map((u) => {
        const name = u.lenerNaam || `Account #${u.Account_id}`;
        return `
          <tr>
            <td class="mono muted">#${u.Uitleen_id}</td>
            <td><div class="tool-name">${u.gereedschapNaam || `ID ${u.Gereedschap_id}`}</div></td>
            <td>
              <div class="borrower-cell">
                <div class="avatar">${initials(name)}</div>
                ${name}
              </div>
            </td>
            <td class="mono muted">${fmtDate(u.StartDatum)}</td>
            <td class="mono muted">${fmtDate(u.EindDatum)}</td>
            <td class="mono muted">${u.BorgBedrag != null ? '€' + Number(u.BorgBedrag).toFixed(2) : '—'}</td>
            <td>${badge(u.Status)}</td>
          </tr>
        `;
      })
      .join('');
  }

  const totalPages = Math.ceil(data.length / PER_PAGE);

  document.getElementById('pagination-hist').innerHTML = `
    <span>${data.length} uitleningen · pagina ${page} van ${Math.max(totalPages, 1)}</span>
    <div class="pagination-btns">
      ${Array.from(
        { length: totalPages },
        (_, i) =>
          `<button class="page-btn ${i + 1 === page ? 'active' : ''}" onclick="goPage(${i + 1})">${i + 1}</button>`
      ).join('')}
    </div>
  `;
}

function filterHistorie() {
  const q = (document.getElementById('search-hist')?.value || '').toLowerCase();
  const s = document.getElementById('filter-hist')?.value || '';

  filteredHist = allUitleningen.filter((u) => {
    const name = (u.lenerNaam || '').toLowerCase();
    const tool = (u.gereedschapNaam || '').toLowerCase();

    return (
      (!q || name.includes(q) || tool.includes(q) || String(u.Uitleen_id).includes(q)) &&
      (!s || u.Status === s)
    );
  });

  histPage = 1;
  renderHistorie(filteredHist, histPage);
}
window.filterHistorie = filterHistorie;

function goPage(p) {
  histPage = p;
  renderHistorie(filteredHist, histPage);
}
window.goPage = goPage;

// ── Navigatie ──────────────────────────────────────────────────────────────
function showPage(name, clickedButton = null) {
  ['dashboard', 'gereedschap', 'geschiedenis'].forEach((p) => {
    document.getElementById('page-' + p).style.display = p === name ? '' : 'none';
  });

  document.querySelectorAll('.dashboard-tab').forEach((btn) => {
    btn.classList.remove('active');
  });

  if (clickedButton) {
    clickedButton.classList.add('active');
  } else {
    const map = { dashboard: 0, gereedschap: 1, geschiedenis: 2 };
    const tabs = document.querySelectorAll('.dashboard-tab');
    if (tabs[map[name]]) tabs[map[name]].classList.add('active');
  }

  if (name === 'gereedschap') renderGereedschap(allGereedschap);

  if (name === 'geschiedenis') {
    filteredHist = [...allUitleningen];
    histPage = 1;
    renderHistorie(filteredHist, histPage);
  }
}
window.showPage = showPage;

function setToolView(view, btn) {
  document.querySelectorAll('.tab-bar .tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tool-grid-view').style.display = view === 'grid' ? '' : 'none';
  document.getElementById('tool-table-view').style.display = view === 'table' ? '' : 'none';
}
window.setToolView = setToolView;

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d)
    ? '—'
    : d.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
}

function formatDate(v) {
  return fmtDate(v);
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function statusClass(s) {
  return (
    {
      Beschikbaar: 'beschikbaar',
      Uitgeleend: 'uitgeleend',
      'Ingeleverd?': 'ingeleverd-vraag',
      'Te laat': 'te-laat',
    }[s] || 'beschikbaar'
  );
}

function badge(status) {
  const map = {
    pending: { cls: 'uitgeleend', label: 'In afwachting' },
    accepted: { cls: 'teruggegeven', label: 'Geaccepteerd' },
    rejected: { cls: 'te-laat', label: 'Geweigerd' },
    ingeleverd_op_tijd: { cls: 'teruggegeven', label: 'Op tijd ingelev.' },
    ingeleverd_te_laat: { cls: 'te-laat', label: 'Te laat ingelev.' },
    Beschikbaar: { cls: 'beschikbaar', label: 'Beschikbaar' },
    Uitgeleend: { cls: 'uitgeleend', label: 'Uitgeleend' },
    'Ingeleverd?': { cls: 'ingeleverd-vraag', label: 'Ingeleverd?' },
    'Te laat': { cls: 'te-laat', label: 'Te laat' },
    Teruggegeven: { cls: 'teruggegeven', label: 'Teruggegeven' },
    Bezig: { cls: 'uitgeleend', label: 'Bezig' },
    Komend: { cls: 'beschikbaar', label: 'Komend' },
    Verlopen: { cls: 'te-laat', label: 'Verlopen' },
  };

  const s = map[status] || { cls: 'teruggegeven', label: status || '—' };
  return `<span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:2rem;color:#6b7280;font-family:'DM Mono',monospace;font-size:12px">${msg}</td></tr>`;
}

function setTimestamp() {
  const el = document.getElementById('ts');
  if (el) {
    el.textContent = new Date().toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}