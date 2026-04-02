let mijnTools = [];
let historieData = [];
let actieveData = [];
let toolView = 'grid';
let huidigGmId = null;

/* -------------------- */
/* INIT */
/* -------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    setTimestamp();
    await laadDashboardData();
    await laadMijnGereedschap();
    await laadHistorie();
});

/* -------------------- */
/* PAGE SWITCHING */
/* -------------------- */
window.showPage = function(page, btn) {
    document.getElementById('page-dashboard').style.display = page === 'dashboard' ? 'block' : 'none';
    document.getElementById('page-gereedschap').style.display = page === 'gereedschap' ? 'block' : 'none';
    document.getElementById('page-geschiedenis').style.display = page === 'geschiedenis' ? 'block' : 'none';

    document.querySelectorAll('.dashboard-tab').forEach(tab => tab.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

function setTimestamp() {
    const ts = document.getElementById('ts');
    if (!ts) return;

    const now = new Date();
    ts.textContent = `Bijgewerkt: ${now.toLocaleString('nl-NL')}`;
}

/* -------------------- */
/* DASHBOARD */
/* -------------------- */
async function laadDashboardData() {
    try {
        const res = await fetchWithSpinner('/uitlenerdashboard');
        if (!res || res.status === 401) {
            window.location.href = '/inlog.html';
            return;
        }
        if (!res.ok) throw new Error('Dashboard laden mislukt');

        const data = await res.json();
        console.log('dashboard data:', data);

        const stats = data.stats || data;

        actieveData = data.actieveUitleeningen || data.actieveUitleeningen || data.actiefItems || [];
        renderStats(stats);
        renderActieveTabel(actieveData);
        renderBarChart(data.perMaand || []);
        renderDonut(data.statusVerdeling || {});
    } catch (err) {
        console.error('Fout bij dashboard laden:', err);
    }
}

function renderStats(stats) {
    const actief = stats.actief ?? stats.Actief ?? 0;
    const beschikbaar = stats.beschikbaar ?? stats.Beschikbaar ?? 0;
    const teLaat = stats.teLaat ?? stats.verlaat ?? stats.TeLaat ?? 0;
    const totaal = stats.totaal ?? stats.Totaal ?? 0;

    document.getElementById('stat-actief').textContent = actief;
    document.getElementById('stat-beschikbaar').textContent = beschikbaar;
    document.getElementById('stat-verlaat').textContent = teLaat;
    document.getElementById('stat-totaal').textContent = totaal;
}

function renderActieveTabel(items) {
    const tbody = document.getElementById('tbody-actief');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!items.length) {
        tbody.innerHTML = `<tr class="loading-row"><td colspan="6">Geen actieve uitleningen</td></tr>`;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.type = getActiefType(item);

        tr.innerHTML = `
            <td>
                <div class="tool-name">
                    ${item.Gereedschap_naam || item.Naam || 'Onbekend'}
                </div>
            </td>
            <td>${item.LenerNaam || item.NaamLener || '-'}</td>
            <td>${formatDate(item.StartDatum)}</td>
            <td>${formatDate(item.EindDatum)}</td>
            <td class="mono">€${Number(item.BorgBedrag || 0).toFixed(2)}</td>
            <td>${getActiefType(item)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function getActiefType(item) {
    const now = new Date();
    const start = item.StartDatum ? new Date(item.StartDatum) : null;

    if (start && start > now) return 'Komend';
    return 'Bezig';
}

window.filterActief = function() {
    const value = document.getElementById('filter-actief-status')?.value || '';
    const rows = document.querySelectorAll('#tbody-actief tr');

    rows.forEach(row => {
        if (!value || row.dataset.type === value || row.classList.contains('loading-row')) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

function renderBarChart(perMaand) {
    const container = document.getElementById('bar-chart');
    if (!container) return;

    container.innerHTML = '';

    if (!perMaand.length) {
        container.innerHTML = '<div class="muted">Geen data</div>';
        return;
    }

    const max = Math.max(...perMaand.map(x => x.aantal || 0), 1);

    perMaand.forEach(item => {
        const wrap = document.createElement('div');
        wrap.className = 'bar-wrap';

        const height = Math.max(8, ((item.aantal || 0) / max) * 140);

        wrap.innerHTML = `
            <div class="bar-val">${item.aantal || 0}</div>
            <div class="bar" style="height:${height}px;"></div>
            <div class="bar-label">${item.maand || '-'}</div>
        `;

        container.appendChild(wrap);
    });
}

function renderDonut(statusVerdeling) {
    const svg = document.getElementById('donut-svg');
    const legend = document.getElementById('donut-legend');
    if (!svg || !legend) return;

    svg.innerHTML = '';
    legend.innerHTML = '';

    const entries = Object.entries(statusVerdeling);
    if (!entries.length) {
        legend.innerHTML = '<div class="muted">Geen data</div>';
        return;
    }

    const colors = ['#c2410c', '#166534', '#1e3a8a', '#b45309', '#b91c1c'];
    const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

    let currentAngle = -90;
    const cx = 60;
    const cy = 60;
    const r = 42;

    entries.forEach(([name, value], index) => {
        const amount = Number(value || 0);
        const sliceAngle = total ? (amount / total) * 360 : 0;
        const endAngle = currentAngle + sliceAngle;

        const path = describeArc(cx, cy, r, currentAngle, endAngle);
        const color = colors[index % colors.length];

        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', path);
        el.setAttribute('fill', 'none');
        el.setAttribute('stroke', color);
        el.setAttribute('stroke-width', '16');
        el.setAttribute('stroke-linecap', 'butt');
        svg.appendChild(el);

        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <span class="legend-dot" style="background:${color}"></span>
            <span class="legend-name">${name}</span>
            <span class="legend-count">${amount}</span>
        `;
        legend.appendChild(legendItem);

        currentAngle = endAngle;
    });
}

function polarToCartesian(cx, cy, r, angleDeg) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
        x: cx + (r * Math.cos(angleRad)),
        y: cy + (r * Math.sin(angleRad))
    };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
        'M', start.x, start.y,
        'A', r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
}

/* -------------------- */
/* GEREEDSCHAP */
/* -------------------- */
async function laadMijnGereedschap() {
    try {
        const res = await fetchWithSpinner('/mijn-gereedschap');
        if (!res || res.status === 401) {
            window.location.href = '/inlog.html';
            return;
        }
        if (!res.ok) throw new Error('Mijn gereedschap laden mislukt');

        mijnTools = await res.json();
        renderMijnGereedschap();
    } catch (err) {
        console.error('Fout bij laden mijn gereedschap:', err);
    }
}

function renderMijnGereedschap() {
    const grid = document.getElementById('tool-grid-view');
    const tableBody = document.getElementById('tbody-tools-table');
    const empty = document.getElementById('geenGereedschap');

    if (!grid || !tableBody || !empty) return;

    grid.innerHTML = '';
    tableBody.innerHTML = '';

    if (!mijnTools.length) {
        empty.hidden = false;
        return;
    }

    empty.hidden = true;

    const filtered = getFilteredTools();

    if (!filtered.length) {
        grid.innerHTML = `<div class="muted">Geen resultaten</div>`;
        tableBody.innerHTML = `<tr class="loading-row"><td colspan="6">Geen resultaten</td></tr>`;
        return;
    }

    filtered.forEach(tool => {
        const status = getToolStatus(tool);
        const imageUrl = tool.Afbeelding || '/images/default.jpg';

        const card = document.createElement('div');
        card.className = `tool-tile ${normalizeStatusClass(status)}`;
        card.dataset.name = (tool.Naam || '').toLowerCase();
        card.dataset.status = status;

        card.innerHTML = `
            <img src="${imageUrl}" alt="${tool.Naam}" class="tile-img" />
            <div class="tile-name">${tool.Naam}</div>
            <span class="badge ${normalizeStatusClass(status)}">
                <span class="badge-dot"></span>${status}
            </span>
            <div class="tile-meta">
                <div>€${Number(tool.BorgBedrag || 0).toFixed(2)} borg</div>
                <div>Vanaf: ${formatDate(tool.Begindatum)}</div>
                <div>Tot: ${formatDate(tool.Einddatum)}</div>
            </div>
            <div class="inlever-actions">
                <button class="btn-inlever op-tijd" onclick="openGmModal(${tool.Gereedschap_id})">Bewerken</button>
                <button class="btn-inlever te-laat" onclick="gmVerwijderDirect(${tool.Gereedschap_id})">Verwijderen</button>
            </div>
        `;
        grid.appendChild(card);

        const tr = document.createElement('tr');
        tr.dataset.name = (tool.Naam || '').toLowerCase();
        tr.dataset.status = status;

        tr.innerHTML = `
            <td>${tool.Naam || '-'}</td>
            <td class="mono">€${Number(tool.BorgBedrag || 0).toFixed(2)}</td>
            <td>${formatDate(tool.Begindatum)}</td>
            <td>${formatDate(tool.Einddatum)}</td>
            <td>
                <span class="badge ${normalizeStatusClass(status)}">
                    <span class="badge-dot"></span>${status}
                </span>
            </td>
            <td>
                <div class="inlever-actions">
                    <button class="btn-inlever op-tijd" onclick="openGmModal(${tool.Gereedschap_id})">Bewerken</button>
                    <button class="btn-inlever te-laat" onclick="gmVerwijderDirect(${tool.Gereedschap_id})">Verwijderen</button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function getFilteredTools() {
    const search = (document.getElementById('search-tools')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('filter-tools-status')?.value || '';

    return mijnTools.filter(tool => {
        const nameMatch = (tool.Naam || '').toLowerCase().includes(search);
        const status = getToolStatus(tool);
        const statusMatch = !statusFilter || status === statusFilter;

        return nameMatch && statusMatch;
    });
}

function getToolStatus(tool) {
    const now = new Date();
    const begin = tool.Begindatum ? new Date(tool.Begindatum) : null;
    const eind = tool.Einddatum ? new Date(tool.Einddatum) : null;

    if (eind && eind < now) return 'Te laat';
    if (begin && begin > now) return 'Uitgeleend';
    return 'Beschikbaar';
}

function normalizeStatusClass(status) {
    return status
        .toLowerCase()
        .replace(/\?/g, '')
        .replace(/\s+/g, '-');
}

window.filterTools = function() {
    renderMijnGereedschap();
};

window.setToolView = function(view, btn) {
    toolView = view;

    const grid = document.getElementById('tool-grid-view');
    const table = document.getElementById('tool-table-view');

    if (grid) grid.style.display = view === 'grid' ? 'grid' : 'none';
    if (table) table.style.display = view === 'table' ? 'block' : 'none';

    document.querySelectorAll('.tab-bar .tab').forEach(tab => tab.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

/* -------------------- */
/* MODAL */
/* -------------------- */
window.openGmModal = async function(id) {
    try {
        huidigGmId = id;

        const [toolRes, catRes] = await Promise.all([
            fetchWithSpinner(`/gereedschap?id=${id}`),
            fetchWithSpinner('/categorieen')
        ]);

        if (!toolRes || !catRes || !toolRes.ok || !catRes.ok) {
            throw new Error('Modal data laden mislukt');
        }

        const tools = await toolRes.json();
        const tool = tools[0];
        const alleCats = await catRes.json();

        if (!tool) return;

        document.getElementById('gm-id').value = tool.Gereedschap_id;
        document.getElementById('gm-naam').value = tool.Naam || '';
        document.getElementById('gm-beschrijving').value = tool.Beschrijving || '';
        document.getElementById('gm-borg').value = tool.BorgBedrag || '';
        document.getElementById('gm-begindatum').value = tool.Begindatum ? tool.Begindatum.split('T')[0] : '';
        document.getElementById('gm-einddatum').value = tool.Einddatum ? tool.Einddatum.split('T')[0] : '';

        const imgWrap = document.getElementById('gm-img-wrap');
        imgWrap.innerHTML = tool.Afbeelding
            ? `<img src="${tool.Afbeelding}" alt="Huidige afbeelding">`
            : `<div class="gm-no-img">Geen afbeelding</div>`;

        const toolCatRes = await fetchWithSpinner(`/gereedschap/${tool.Gereedschap_id}/categorieen`);
        const toolCats = toolCatRes && toolCatRes.ok ? await toolCatRes.json() : [];
        const geselecteerdeIds = toolCats.map(c => c.Categorie_id);

        renderGmCategorieen(alleCats, geselecteerdeIds);

        document.getElementById('gm-overlay').hidden = false;
        document.body.style.overflow = 'hidden';
    } catch (err) {
        console.error('Fout bij openen modal:', err);
        showToast('Kon gereedschap niet laden.', 'error');
    }
};

function renderGmCategorieen(alleCats, geselecteerdeIds) {
    const container = document.getElementById('gm-categorieen');
    if (!container) return;

    container.innerHTML = '';

    alleCats.forEach(cat => {
        const label = document.createElement('label');
        label.className = 'gm-cat-label';
        if (geselecteerdeIds.includes(cat.Categorie_id)) label.classList.add('checked');

        label.innerHTML = `
            <input type="checkbox" value="${cat.Categorie_id}" ${geselecteerdeIds.includes(cat.Categorie_id) ? 'checked' : ''}>
            <span>${cat.Naam}</span>
        `;

        const input = label.querySelector('input');
        input.addEventListener('change', () => {
            label.classList.toggle('checked', input.checked);
        });

        container.appendChild(label);
    });
}

window.sluitGmModal = function() {
    document.getElementById('gm-overlay').hidden = true;
    document.body.style.overflow = '';
};

document.getElementById('gm-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) sluitGmModal();
});

window.gmOpslaan = async function() {
    const id = document.getElementById('gm-id').value;

    const data = {
        Naam: document.getElementById('gm-naam').value,
        Beschrijving: document.getElementById('gm-beschrijving').value,
        BorgBedrag: document.getElementById('gm-borg').value || null,
        Begindatum: document.getElementById('gm-begindatum').value || null,
        Einddatum: document.getElementById('gm-einddatum').value || null,
        categorieen: Array.from(
            document.querySelectorAll('#gm-categorieen input[type="checkbox"]:checked')
        ).map(cb => parseInt(cb.value))
    };

    try {
        const res = await fetchWithSpinner(`/gereedschap/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res || !res.ok) throw new Error('Opslaan mislukt');

        const afbeeldingInput = document.getElementById('gm-afbeelding');
        if (afbeeldingInput.files.length > 0) {
            const formData = new FormData();
            formData.append('afbeelding', afbeeldingInput.files[0]);

            const imgRes = await fetchWithSpinner(`/gereedschap/${id}/afbeelding`, {
                method: 'POST',
                body: formData
            });

            if (!imgRes || !imgRes.ok) {
                throw new Error('Afbeelding uploaden mislukt');
            }
        }

        sluitGmModal();
        await laadMijnGereedschap();
        showToast('Gereedschap opgeslagen.', 'success');
    } catch (err) {
        console.error('Fout bij opslaan:', err);
        showToast('Er ging iets mis bij het opslaan.', 'error');
    }
};

window.gmVerwijder = async function() {
    if (!huidigGmId) return;
    await gmVerwijderDirect(huidigGmId);
};

window.gmVerwijderDirect = async function(id) {
    if (!confirm('Weet je zeker dat je dit gereedschap wilt verwijderen?')) return;

    try {
        const res = await fetchWithSpinner(`/gereedschap/${id}`, { method: 'DELETE' });
        if (!res || !res.ok) throw new Error('Verwijderen mislukt');

        if (huidigGmId === id) {
            sluitGmModal();
        }

        await laadMijnGereedschap();
        showToast('Gereedschap verwijderd.', 'success');
    } catch (err) {
        console.error('Fout bij verwijderen:', err);
        showToast('Er ging iets mis bij het verwijderen.', 'error');
    }
};

/* -------------------- */
/* HISTORIE */
/* -------------------- */
async function laadHistorie() {
    try {
        const res = await fetchWithSpinner('/uitlenerdashboard/geschiedenis');
        if (!res || !res.ok) {
            document.getElementById('tbody-hist').innerHTML = `<tr class="loading-row"><td colspan="7">Geen geschiedenis beschikbaar</td></tr>`;
            return;
        }

        historieData = await res.json();
        renderHistorie(historieData);
    } catch (err) {
        console.error('Fout bij historie laden:', err);
    }
}

function renderHistorie(items) {
    const tbody = document.getElementById('tbody-hist');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!items.length) {
        tbody.innerHTML = `<tr class="loading-row"><td colspan="7">Geen resultaten</td></tr>`;
        return;
    }

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.dataset.status = item.Status || '';

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.Gereedschap_naam || item.Naam || '-'}</td>
            <td>${item.LenerNaam || item.NaamLener || '-'}</td>
            <td>${formatDate(item.StartDatum)}</td>
            <td>${formatDate(item.EindDatum)}</td>
            <td class="mono">€${Number(item.BorgBedrag || 0).toFixed(2)}</td>
            <td>${item.Status || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterHistorie = function() {
    const q = (document.getElementById('search-hist')?.value || '').toLowerCase().trim();
    const status = document.getElementById('filter-hist')?.value || '';

    const filtered = historieData.filter(item => {
        const text = `${item.Gereedschap_naam || ''} ${item.Naam || ''} ${item.LenerNaam || ''} ${item.NaamLener || ''}`.toLowerCase();
        const textMatch = text.includes(q);
        const statusMatch = !status || item.Status === status;
        return textMatch && statusMatch;
    });

    renderHistorie(filtered);
};

/* -------------------- */
/* HELPERS */
/* -------------------- */
function formatDate(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('nl-NL');
}