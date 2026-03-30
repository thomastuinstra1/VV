// ── State ──────────────────────────────────────────────────────────────────
let allUitleningen = [];   // ruwe data van /dashboard/uitleningen
let allGereedschap = [];   // ruwe data van /dashboard/gereedschap
let filteredHist   = [];
let histPage       = 1;
const PER_PAGE     = 10;
const MONTHS       = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

// ── Boot ───────────────────────────────────────────────────────────────────
(async function init() {
  setTimestamp();
  await loadData();
  buildDashboard();
})();

// ── Data laden ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [u, g] = await Promise.all([
      fetch('/dashboard/uitleningen').then(r => r.json()),
      fetch('/dashboard/gereedschap').then(r => r.json()),
    ]);
    allUitleningen = u;
    allGereedschap = g;
  } catch (err) {
    toast('Fout bij laden data');
    console.error(err);
  }
}

// ── Dashboard opbouwen ─────────────────────────────────────────────────────
function buildDashboard() {
  const actief      = allUitleningen.filter(u => u.Status === 'Uitgeleend' || u.Status === 'Te laat');
  const beschikbaar = allGereedschap.filter(g => g.status === 'Beschikbaar').length;
  const verlaat     = allUitleningen.filter(u => u.Status === 'Te laat').length;

  document.getElementById('stat-actief').textContent     = actief.length;
  document.getElementById('stat-beschikbaar').textContent = beschikbaar;
  document.getElementById('stat-verlaat').textContent    = verlaat;
  document.getElementById('stat-totaal').textContent     = allUitleningen.length;

  renderBarChart();
  renderDonut();
  renderActief(actief);
}

// ── Staafgrafiek ───────────────────────────────────────────────────────────
function renderBarChart() {
  // Tel uitleningen per maand op basis van StartDatum
  const counts = new Array(12).fill(0);
  const year   = new Date().getFullYear();
  allUitleningen.forEach(u => {
    if (!u.StartDatum) return;
    const d = new Date(u.StartDatum);
    if (d.getFullYear() === year) counts[d.getMonth()]++;
  });

  const max = Math.max(...counts, 1);
  document.getElementById('bar-chart').innerHTML = counts.map((v, i) => `
    <div class="bar-wrap">
      <div class="bar" style="height:${Math.round((v / max) * 110)}px">
        ${v > 0 ? `<span class="bar-val">${v}</span>` : ''}
      </div>
      <span class="bar-label">${MONTHS[i]}</span>
    </div>
  `).join('');
}

// ── Donut-chart ────────────────────────────────────────────────────────────
function renderDonut() {
  const avail  = allGereedschap.filter(g => g.status === 'Beschikbaar').length;
  const uit    = allGereedschap.filter(g => g.status === 'Uitgeleend' || g.status === 'Te laat').length;
  const total  = avail + uit || 1;

  const segments = [
    { label: 'Beschikbaar', count: avail, color: '#3b6d11' },
    { label: 'Uitgeleend',  count: uit,   color: '#d85a30' },
  ];

  const cx = 60, cy = 60, r = 44, stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let paths  = '';

  for (const seg of segments) {
    if (!seg.count) continue;
    const len = (seg.count / total) * circ;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="${stroke}"
      stroke-dasharray="${len} ${circ - len}"
      stroke-dashoffset="${-(offset - circ * 0.25)}" />`;
    offset += len;
  }

  document.getElementById('donut-svg').innerHTML = paths +
    `<text x="${cx}" y="${cy + 2}" text-anchor="middle" dominant-baseline="middle"
      font-family="'DM Mono',monospace" font-size="18" font-weight="500"
      fill="currentColor">${total}</text>`;

  document.getElementById('donut-legend').innerHTML = segments.map(s => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${s.color}"></div>
      <span class="legend-name">${s.label}</span>
      <span class="legend-count">${s.count}</span>
    </div>
  `).join('');
}

// ── Actieve uitleningen tabel ──────────────────────────────────────────────
function renderActief(rows) {
  const tbody = document.getElementById('tbody-actief');
  if (!rows.length) {
    tbody.innerHTML = emptyRow(6, 'Geen actieve uitleningen');
    return;
  }
  tbody.innerHTML = rows.map(u => {
    const isLate   = u.Status === 'Te laat';
    const daysLate = isLate ? Math.ceil((Date.now() - new Date(u.EindDatum)) / 86400000) : 0;
    const name     = u.lenerNaam || `Account #${u.Account_id}`;
    return `<tr>
      <td><div class="tool-name">${u.gereedschapNaam || `ID ${u.Gereedschap_id}`}
        <small>#${u.Uitleen_id}</small></div></td>
      <td>
        <div class="borrower-cell">
          <div class="avatar">${initials(name)}</div>
          ${name}
        </div>
      </td>
      <td class="mono muted">${fmtDate(u.StartDatum)}</td>
      <td class="mono muted">
        ${fmtDate(u.EindDatum)}
        ${isLate ? `<div class="overdue-days">+${daysLate} dag${daysLate > 1 ? 'en' : ''}</div>` : ''}
      </td>
      <td class="mono muted">${u.BorgBedrag != null ? '€' + Number(u.BorgBedrag).toFixed(2) : '—'}</td>
      <td>${badge(u.Status)}</td>
    </tr>`;
  }).join('');
}

// ── Filter: actief ─────────────────────────────────────────────────────────
function filterActief() {
  const q = document.getElementById('search-actief').value.toLowerCase();
  const s = document.getElementById('filter-actief-status').value;
  const rows = allUitleningen.filter(u => {
    const isActive = u.Status === 'Uitgeleend' || u.Status === 'Te laat';
    const name     = (u.lenerNaam || '').toLowerCase();
    const tool     = (u.gereedschapNaam || '').toLowerCase();
    return isActive
      && (!q || name.includes(q) || tool.includes(q))
      && (!s || u.Status === s);
  });
  renderActief(rows);
}

// ── Gereedschapspagina ─────────────────────────────────────────────────────
function renderGereedschap(data) {
  // Tegel-weergave
  document.getElementById('tool-grid-view').innerHTML = data.length
    ? data.map(g => {
        const cls  = statusClass(g.status);
        const actU = allUitleningen.find(u =>
          u.Gereedschap_id === g.Gereedschap_id &&
          (u.Status === 'Uitgeleend' || u.Status === 'Te laat')
        );
        return `<div class="tool-tile ${cls}">
          <div class="tile-name">${g.Naam}</div>
          ${badge(g.status)}
          ${actU ? `<div class="tile-meta">${actU.lenerNaam || 'Onbekend'}<br>t/m ${fmtDate(actU.EindDatum)}</div>` : ''}
        </div>`;
      }).join('')
    : '<p style="color:var(--text-subtle);font-family:var(--font-mono);font-size:13px">Geen resultaten</p>';

  // Tabel-weergave
  document.getElementById('tbody-tools-table').innerHTML = data.length
    ? data.map(g => {
        const actU = allUitleningen.find(u =>
          u.Gereedschap_id === g.Gereedschap_id &&
          (u.Status === 'Uitgeleend' || u.Status === 'Te laat')
        );
        const lener = actU ? (actU.lenerNaam || `Account #${actU.Account_id}`) : '—';
        return `<tr>
          <td><div class="tool-name">${g.Naam}</div></td>
          <td class="mono muted">${lener}</td>
          <td class="mono muted">${actU ? fmtDate(actU.StartDatum) : '—'}</td>
          <td class="mono muted">${actU ? fmtDate(actU.EindDatum) : '—'}</td>
          <td class="mono muted">${actU && actU.BorgBedrag != null ? '€' + Number(actU.BorgBedrag).toFixed(2) : '—'}</td>
          <td>${badge(g.status)}</td>
        </tr>`;
      }).join('')
    : emptyRow(7, 'Geen resultaten');
}

function filterTools() {
  const q = document.getElementById('search-tools').value.toLowerCase();
  const s = document.getElementById('filter-tools-status').value;
  const rows = allGereedschap.filter(g => {
    return (!q || g.Naam.toLowerCase().includes(q))
        && (!s || g.status === s);
  });
  renderGereedschap(rows);
}

// ── Geschiedenis ───────────────────────────────────────────────────────────
function renderHistorie(data, page) {
  const start = (page - 1) * PER_PAGE;
  const slice = data.slice(start, start + PER_PAGE);
  const tbody = document.getElementById('tbody-hist');

  if (!slice.length) {
    tbody.innerHTML = emptyRow(9, 'Geen resultaten');
  } else {
    tbody.innerHTML = slice.map(u => {
      const name = u.lenerNaam || `Account #${u.Account_id}`;
      return `<tr>
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
      </tr>`;
    }).join('');
  }

  // Paginering
  const totalPages = Math.ceil(data.length / PER_PAGE);
  document.getElementById('pagination-hist').innerHTML = `
    <span>${data.length} uitleningen · pagina ${page} van ${Math.max(totalPages, 1)}</span>
    <div class="pagination-btns">
      ${Array.from({ length: totalPages }, (_, i) =>
        `<button class="page-btn ${i + 1 === page ? 'active' : ''}" onclick="goPage(${i + 1})">${i + 1}</button>`
      ).join('')}
    </div>
  `;
}

function filterHistorie() {
  const q = document.getElementById('search-hist').value.toLowerCase();
  const s = document.getElementById('filter-hist').value;
  filteredHist = allUitleningen.filter(u => {
    const name = (u.lenerNaam || '').toLowerCase();
    const tool = (u.gereedschapNaam || '').toLowerCase();
    return (!q || name.includes(q) || tool.includes(q) || String(u.Uitleen_id).includes(q))
        && (!s || u.Status === s);
  });
  histPage = 1;
  renderHistorie(filteredHist, histPage);
}

function goPage(p) {
  histPage = p;
  renderHistorie(filteredHist, histPage);
}

// ── Navigatie ──────────────────────────────────────────────────────────────
function showPage(name) {
  ['dashboard', 'gereedschap', 'geschiedenis'].forEach(p => {
    document.getElementById('page-' + p).style.display = p === name ? '' : 'none';
  });
  document.querySelectorAll('header nav button').forEach((btn, i) => {
    btn.classList.toggle('active', ['dashboard', 'gereedschap', 'geschiedenis'][i] === name);
  });

  if (name === 'gereedschap') renderGereedschap(allGereedschap);
  if (name === 'geschiedenis') {
    filteredHist = [...allUitleningen];
    renderHistorie(filteredHist, histPage);
  }
}

function setToolView(view, btn) {
  document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tool-grid-view').style.display  = view === 'grid'  ? '' : 'none';
  document.getElementById('tool-table-view').style.display = view === 'table' ? '' : 'none';
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function statusClass(s) {
  return { 'Beschikbaar': 'beschikbaar', 'Uitgeleend': 'uitgeleend', 'Te laat': 'te-laat' }[s] || 'beschikbaar';
}

function badge(status) {
  const map = {
    'Beschikbaar':  'beschikbaar',
    'Uitgeleend':   'uitgeleend',
    'Te laat':      'te-laat',
    'Teruggegeven': 'teruggegeven',
  };
  const cls = map[status] || 'teruggegeven';
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${status || '—'}</span>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:2rem;color:var(--text-subtle);font-family:var(--font-mono);font-size:12px">${msg}</td></tr>`;
}

function setTimestamp() {
  const el = document.getElementById('ts');
  if (el) el.textContent = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function toast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}