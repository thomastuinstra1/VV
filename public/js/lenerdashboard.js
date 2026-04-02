// ── State ──────────────────────────────────────────────────────────────────
let allLeningen  = [];
let filteredHist = [];
let histPage     = 1;
const PER_PAGE   = 10;
const MONTHS     = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

// ── Boot ───────────────────────────────────────────────────────────────────
(async function init() {
  setTimestamp();
  await loadData();
  buildDashboard();
})();

// ── Data laden ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    // /mijn-leningen geeft de leningen terug waarbij de ingelogde user de Lener is
    // Verwacht velden: Uitleen_id, Status, StartDatum, EindDatum, BorgBedrag,
    //                  Gereedschap_id, gereedschapNaam, eigenaarNaam, Afbeelding, Chat_id
    const data = await fetchWithSpinner('/mijn-leningen').then(r => r.json());
    allLeningen = Array.isArray(data) ? data : [];
  } catch (err) {
    showToast('Fout bij laden data', 'error');
    console.error(err);
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function buildDashboard() {
  const now  = new Date(); now.setHours(0,0,0,0);
  const soon = new Date(now); soon.setDate(soon.getDate() + 3);

  const actief = allLeningen.filter(u => u.Status === 'accepted');
  const telaat = allLeningen.filter(u =>
    u.Status === 'te_laat' ||
    (u.Status === 'accepted' && u.EindDatum && new Date(u.EindDatum) < now)
  );
  const bijna = actief.filter(u => {
    if (!u.EindDatum) return false;
    const eind = new Date(u.EindDatum);
    return eind >= now && eind <= soon;
  });
  const borgTotaal = actief.reduce((s, u) => s + (Number(u.BorgBedrag) || 0), 0);

  document.getElementById('stat-actief').textContent = actief.length;
  document.getElementById('stat-bijna').textContent  = bijna.length;
  document.getElementById('stat-telaat').textContent = telaat.length;

  renderActiveCards(actief, now, 'active-cards');
  renderTimeline(actief, now);
  renderBorgOverzicht(actief);
}

// ── Lening cards ──────────────────────────────────────────────────────────
function cardHtml(u, now) {
  const eind     = u.EindDatum ? new Date(u.EindDatum) : null;
  const diffDays = eind ? Math.ceil((eind - now) / 86400000) : null;
  const cardCls  = !eind ? '' : diffDays < 0 ? 'te-laat-card' : diffDays <= 3 ? 'bijna-card' : '';
  const cdCls    = !eind ? '' : diffDays < 0 ? 'overdue' : diffDays <= 3 ? 'soon' : 'ok';
  const cdTxt    = !eind       ? '—'
                 : diffDays < 0 ? `${Math.abs(diffDays)}d te laat`
                 : diffDays === 0 ? 'Vandaag!'
                 : `${diffDays}d over`;
  const imgHtml  = u.Afbeelding
    ? `<img class="lening-card-img" src="${u.Afbeelding}" alt="">`
    : `<div class="lening-card-img-placeholder">Geen foto</div>`;
  const eigenaar = u.eigenaarNaam || 'Onbekend';
  const chatHref = u.Chat_id
    ? `/chat.html?partner=${u.eigenaarId}&tool=${u.Gereedschap_id}`
    : '#';

  return `<div class="lening-card ${cardCls}">
    ${imgHtml}
    <div class="lening-card-body">
      <div class="lening-card-name">${u.gereedschapNaam || `Gereedschap #${u.Gereedschap_id}`}</div>
      <div class="lening-card-owner">👤 ${eigenaar}</div>
      <div class="lening-card-meta">
        <div><div class="lening-meta-item">Startdatum</div><div class="lening-meta-val">${fmtDate(u.StartDatum)}</div></div>
        <div><div class="lening-meta-item">Inleveren</div><div class="lening-meta-val">${fmtDate(u.EindDatum)}</div></div>
        <div><div class="lening-meta-item">Borg</div><div class="lening-meta-val">${u.BorgBedrag != null ? '€'+Number(u.BorgBedrag).toFixed(2) : '—'}</div></div>
        <div><div class="lening-meta-item">Nog</div><div class="lening-meta-val"><span class="countdown ${cdCls}">${cdTxt}</span></div></div>
      </div>
    </div>
    <div class="lening-card-footer">
      ${badge(u.Status)}
      <a class="btn-chat" href="${chatHref}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Chat
      </a>
    </div>
  </div>`;
}

function renderActiveCards(items, now, containerId) {
  const el = document.getElementById(containerId);
  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Geen actieve leningen</div></div>`;
    return;
  }
  el.innerHTML = items.map(u => cardHtml(u, now)).join('');
}

// ── Inleverschema ─────────────────────────────────────────────────────────
function renderTimeline(items, now) {
  const tl = document.getElementById('timeline');
  const sorted = [...items].filter(u => u.EindDatum).sort((a,b) => new Date(a.EindDatum) - new Date(b.EindDatum));
  if (!sorted.length) {
    tl.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Geen aankomende deadlines</div></div>`;
    return;
  }
  tl.innerHTML = sorted.map(u => {
    const eind  = new Date(u.EindDatum);
    const diff  = Math.ceil((eind - now) / 86400000);
    const cls   = diff < 0 ? 'overdue' : diff <= 3 ? 'soon' : 'ok';
    const label = diff < 0  ? `${Math.abs(diff)}d te laat`
                : diff === 0 ? 'Vandaag'
                : diff === 1 ? 'Morgen'
                : `${diff} dagen`;
    return `<div class="timeline-item">
      <div class="tl-date">${fmtDateShort(u.EindDatum)}</div>
      <div class="tl-body">
        <div class="tl-name">${u.gereedschapNaam || `Gereedschap #${u.Gereedschap_id}`}</div>
        <div class="tl-sub">Bij: ${u.eigenaarNaam || 'Onbekend'}</div>
      </div>
      <span class="deadline-pill ${cls}">${label}</span>
    </div>`;
  }).join('');
}

// ── Borg overzicht ────────────────────────────────────────────────────────
function renderBorgOverzicht(items) {
  const el = document.getElementById('borg-overzicht');
  const metBorg = items.filter(u => Number(u.BorgBedrag) > 0);
  if (!metBorg.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">Geen openstaande borg</div></div>`;
    return;
  }
  el.innerHTML = metBorg.map(u => `
    <div class="borg-row">
      <div>
        <div class="borg-tool">${u.gereedschapNaam || `ID ${u.Gereedschap_id}`}</div>
        <div class="borg-owner">Eigenaar: ${u.eigenaarNaam || 'Onbekend'}</div>
      </div>
      <div class="borg-amount">€${Number(u.BorgBedrag).toFixed(2)}</div>
    </div>`).join('');
}

// ── Mijn leningen pagina ──────────────────────────────────────────────────
function renderLeningen(data) {
  const now = new Date(); now.setHours(0,0,0,0);
  const cardsEl = document.getElementById('lening-cards-view');
  if (!data.length) {
    cardsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">Geen resultaten</div></div>`;
  } else {
    cardsEl.innerHTML = data.map(u => cardHtml(u, now)).join('');
  }

  document.getElementById('tbody-leningen').innerHTML = data.length
    ? data.map(u => `<tr>
        <td><div class="tool-name">${u.gereedschapNaam || `ID ${u.Gereedschap_id}`}<small>#${u.Uitleen_id}</small></div></td>
        <td class="mono muted">${u.eigenaarNaam || '—'}</td>
        <td class="mono muted">${fmtDate(u.StartDatum)}</td>
        <td class="mono muted">${fmtDate(u.EindDatum)}</td>
        <td class="mono muted">${u.BorgBedrag != null ? '€'+Number(u.BorgBedrag).toFixed(2) : '—'}</td>
        <td>${badge(u.Status)}</td>
        <td><a class="btn-chat" href="${u.Chat_id ? `/chat.html?partner=${u.eigenaarId}&tool=${u.Gereedschap_id}` : '#'}" style="font-size:10px;padding:4px 9px">Chat</a></td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-subtle);font-family:var(--font-mono);font-size:12px">Geen resultaten</td></tr>`;
}

function filterLeningen() {
  const q = document.getElementById('search-leningen').value.toLowerCase();
  const s = document.getElementById('filter-leningen').value;
  const active = ['pending','accepted','te_laat'];
  const rows = allLeningen.filter(u =>
    active.includes(u.Status)
    && (!q || (u.gereedschapNaam||'').toLowerCase().includes(q))
    && (!s || u.Status === s)
  );
  renderLeningen(rows);
}

function setLeningView(view, btn) {
  document.querySelectorAll('#page-leningen .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('lening-cards-view').style.display  = view === 'cards' ? '' : 'none';
  document.getElementById('lening-table-view').style.display  = view === 'table' ? '' : 'none';
}

// ── Geschiedenis ──────────────────────────────────────────────────────────
function renderHistorie(data, page) {
  const start = (page - 1) * PER_PAGE;
  const slice = data.slice(start, start + PER_PAGE);
  const tbody = document.getElementById('tbody-hist');
  tbody.innerHTML = slice.length
    ? slice.map(u => `<tr>
        <td class="mono muted">#${u.Uitleen_id}</td>
        <td><div class="tool-name">${u.gereedschapNaam || `ID ${u.Gereedschap_id}`}</div></td>
        <td class="mono muted">${u.eigenaarNaam || '—'}</td>
        <td class="mono muted">${fmtDate(u.StartDatum)}</td>
        <td class="mono muted">${fmtDate(u.EindDatum)}</td>
        <td class="mono muted">${u.BorgBedrag != null ? '€'+Number(u.BorgBedrag).toFixed(2) : '—'}</td>
        <td>${badge(u.Status)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-subtle);font-family:var(--font-mono);font-size:12px">Geen resultaten</td></tr>`;

  const totalPages = Math.ceil(data.length / PER_PAGE);
  document.getElementById('pagination-hist').innerHTML = `
    <span>${data.length} leningen · pagina ${page} van ${Math.max(totalPages,1)}</span>
    <div class="pagination-btns">
      ${Array.from({length:totalPages},(_,i)=>`<button class="page-btn ${i+1===page?'active':''}" onclick="goPage(${i+1})">${i+1}</button>`).join('')}
    </div>`;
}

function filterHistorie() {
  const q = document.getElementById('search-hist').value.toLowerCase();
  const s = document.getElementById('filter-hist').value;
  filteredHist = allLeningen.filter(u => {
    const name     = (u.gereedschapNaam || '').toLowerCase();
    const eigenaar = (u.eigenaarNaam || '').toLowerCase();
    return (!q || name.includes(q) || eigenaar.includes(q) || String(u.Uitleen_id).includes(q))
        && (!s || u.Status === s);
  });
  histPage = 1;
  renderHistorie(filteredHist, histPage);
}

function goPage(p) { histPage = p; renderHistorie(filteredHist, p); }

// ── Navigatie ─────────────────────────────────────────────────────────────
function showPage(name) {
  ['dashboard', 'leningen', 'geschiedenis'].forEach((p) => {
    document.getElementById('page-' + p).style.display = p === name ? '' : 'none';
  });

  document.querySelectorAll('.dashboard-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['dashboard', 'leningen', 'geschiedenis'][i] === name);
  });

  if (name === 'leningen') {
    const active = allLeningen.filter((u) => ['pending', 'accepted', 'te_laat'].includes(u.Status));
    renderLeningen(active);
  }

  if (name === 'geschiedenis') {
    filteredHist = [...allLeningen];
    histPage = 1;
    renderHistorie(filteredHist, histPage);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('nl-NL', {day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtDateShort(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function badge(status) {
  const map = {
    'pending':            {cls:'pending',      label:'In afwachting'},
    'accepted':           {cls:'uitgeleend',   label:'Actief'},
    'rejected':           {cls:'te-laat',      label:'Geweigerd'},
    'te_laat':            {cls:'te-laat',      label:'Te laat'},
    'ingeleverd_op_tijd': {cls:'beschikbaar',  label:'Op tijd terug'},
    'ingeleverd_te_laat': {cls:'te-laat',      label:'Te laat terug'},
    'Teruggegeven':       {cls:'teruggegeven', label:'Teruggegeven'},
  };
  const s = map[status] || {cls:'teruggegeven', label: status || '—'};
  return `<span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>`;
}

function setTimestamp() {
  const el = document.getElementById('ts');
  if (el) el.textContent = new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

function showToast(msg, type = 'info', ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  setTimeout(() => el.classList.remove('show'), ms);
}