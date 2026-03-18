document.addEventListener("DOMContentLoaded", function () {
    laadMijnGereedschap();
});

// ─── Gereedschap ophalen ───────────────────────────────────
async function laadMijnGereedschap() {
    try {
        const res = await fetch('/mijn-gereedschap');
        if (res.status === 401) {
            window.location.href = '/inlog.html';
            return;
        }
        const tools = await res.json();
        toonGereedschap(tools);
    } catch (err) {
        console.error('Fout bij laden:', err);
    }
}

function toonGereedschap(tools) {
    const lijst = document.getElementById('gereedschapLijst');
    const geen = document.getElementById('geenGereedschap');

    lijst.innerHTML = '';

    if (!tools.length) {
        geen.hidden = false;
        return;
    }

    tools.forEach(tool => {
        const kaart = document.createElement('div');
        kaart.classList.add('mijn-kaart');

        const imageUrl = tool.Afbeelding || '/images/default.jpg';

        kaart.innerHTML = `
            <div class="mijn-kaart-img">
                <img src="${imageUrl}" alt="${tool.Naam}">
            </div>
            <div class="mijn-kaart-content">
                <h3>${tool.Naam}</h3>
                <p>${tool.Beschrijving || 'Geen beschrijving'}</p>
                <span class="borg-badge">€${tool.BorgBedrag || 0} borg</span>
            </div>
            <div class="mijn-kaart-acties">
                <button class="btn-bewerk" onclick="openModal(${tool.Gereedschap_id})">✏ Bewerken</button>
            </div>
        `;

        lijst.appendChild(kaart);
    });
}

// ─── Modal openen ──────────────────────────────────────────
async function openModal(id) {
    try {
        // Laad gereedschap details
        const [toolRes, catRes] = await Promise.all([
            fetch(`/gereedschap?id=${id}`),
            fetch('/categorieen')
        ]);
        const tools = await toolRes.json();
        const tool = tools[0];
        const alleCats = await catRes.json();

        if (!tool) return;

        // Vul formulier in
        document.getElementById('bewerkId').value = tool.Gereedschap_id;
        document.getElementById('bewerkNaam').value = tool.Naam || '';
        document.getElementById('bewerkBeschrijving').value = tool.Beschrijving || '';
        document.getElementById('bewerkBorg').value = tool.BorgBedrag || '';
        document.getElementById('bewerkBegindatum').value = tool.Begindatum ? tool.Begindatum.split('T')[0] : '';
        document.getElementById('bewerkEinddatum').value = tool.Einddatum ? tool.Einddatum.split('T')[0] : '';

        // Afbeelding preview
        const preview = document.getElementById('afbeeldingPreview');
        preview.innerHTML = tool.Afbeelding
            ? `<img src="${tool.Afbeelding}" alt="Huidige afbeelding">`
            : '<span>Geen afbeelding</span>';

        // Laad categorieën van dit gereedschap
        const toolCatRes = await fetch(`/gereedschap/${tool.Gereedschap_id}/categorieen`);
        const toolCats = await toolCatRes.json();
        const geselecteerdeIds = toolCats.map(c => c.Categorie_id);

        // Render categorie checkboxes
        renderCategorieCheckboxes(alleCats, geselecteerdeIds);

        // Toon modal
        document.getElementById('modalOverlay').hidden = false;
        document.body.style.overflow = 'hidden';

    } catch (err) {
        console.error('Fout bij openen modal:', err);
    }
}

function renderCategorieCheckboxes(alleCats, geselecteerdeIds) {
    const container = document.getElementById('bewerkCategorieen');
    container.innerHTML = '';

    const parents = alleCats.filter(c => c.Parent_id === null);
    const children = alleCats.filter(c => c.Parent_id !== null);

    for (const parent of parents) {
        const groep = document.createElement('div');
        groep.classList.add('cat-groep');

        const titel = document.createElement('div');
        titel.classList.add('cat-groep-titel');
        titel.textContent = parent.Naam;
        groep.appendChild(titel);

        const opties = children.filter(c => c.Parent_id === parent.Categorie_id);
        for (const cat of opties) {
            const label = document.createElement('label');
            label.classList.add('cat-optie');

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = cat.Categorie_id;
            cb.checked = geselecteerdeIds.includes(cat.Categorie_id);

            label.appendChild(cb);
            label.appendChild(document.createTextNode(cat.Naam));
            groep.appendChild(label);
        }

        container.appendChild(groep);
    }
}

// ─── Modal sluiten ─────────────────────────────────────────
window.sluitModal = function () {
    document.getElementById('modalOverlay').hidden = true;
    document.body.style.overflow = '';
};

// Sluiten via overlay klik
document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target === this) sluitModal();
});

// ─── Formulier opslaan ─────────────────────────────────────
document.getElementById('bewerkForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const id = document.getElementById('bewerkId').value;

    // 1. Sla tekstvelden op
    const data = {
        Naam: document.getElementById('bewerkNaam').value,
        Beschrijving: document.getElementById('bewerkBeschrijving').value,
        BorgBedrag: document.getElementById('bewerkBorg').value || null,
        Begindatum: document.getElementById('bewerkBegindatum').value || null,
        Einddatum: document.getElementById('bewerkEinddatum').value || null,
        categorieen: Array.from(
            document.querySelectorAll('#bewerkCategorieen input[type="checkbox"]:checked')
        ).map(cb => parseInt(cb.value))
    };

    try {
        const res = await fetch(`/gereedschap/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error('Opslaan mislukt');

        // 2. Upload nieuwe afbeelding als die geselecteerd is
        const afbeeldingInput = document.getElementById('bewerkAfbeelding');
        if (afbeeldingInput.files.length > 0) {
            const formData = new FormData();
            formData.append('afbeelding', afbeeldingInput.files[0]);
            await fetch(`/gereedschap/${id}/afbeelding`, {
                method: 'POST',
                body: formData
            });
        }

        sluitModal();
        laadMijnGereedschap();

    } catch (err) {
        console.error('Fout bij opslaan:', err);
        alert('Er ging iets mis bij het opslaan.');
    }
});

window.openModal = openModal;