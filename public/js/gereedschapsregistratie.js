// ==============================
// 🔔 MELDING TONEN OP PAGINA
// ==============================
function showMelding(text, kleur = "red") {
    const melding = document.getElementById("melding");
    melding.textContent = text;
    melding.style.color = kleur;
}

// ==============================
// ❌ RESET FOUTEN
// ==============================
function clearErrors() {
    document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
    showMelding("");
}

// ==============================
// 🗓️ DATUM VALIDATIE
// ==============================
const today = new Date().toISOString().split('T')[0];
const begindatumInput = document.querySelector('input[name="Begindatum"]');
const einddatumInput = document.querySelector('input[name="Einddatum"]');

begindatumInput.setAttribute('min', today);
einddatumInput.setAttribute('min', today);

begindatumInput.addEventListener('change', () => {
    if(begindatumInput.value){
        // Einddatum minimaal 1 dag na begindatum
        const begindatum = new Date(begindatumInput.value);
        begindatum.setDate(begindatum.getDate() + 1);
        const minEind = begindatum.toISOString().split('T')[0];

        einddatumInput.setAttribute('min', minEind);

        if(einddatumInput.value && einddatumInput.value < minEind){
            einddatumInput.value = minEind;
        }
    }
});

// ==============================
// 🖱️ MAX 1 CHECKBOX PER GROEP
// ==============================
document.querySelectorAll('input[data-group]').forEach(cb => {
    cb.addEventListener('change', () => {
        if (cb.checked && cb.dataset.group !== 'Materiaal') {
            const group = cb.dataset.group;
            document.querySelectorAll(`input[data-group="${group}"]`)
                .forEach(other => { if (other !== cb) other.checked = false; });
        }
    });
});

// ==============================
// 🖼️ AFBEELDING PREVIEW
// ==============================
document.getElementById('afbeelding-input').addEventListener('change', () => {
    const file = document.getElementById('afbeelding-input').files[0];
    if(!file) return;

    const preview = document.getElementById('gereedschap-preview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
});

// ==============================
// 🖼️ AFBEELDING SELECT + AUTO UPLOAD
// ==============================
document.getElementById('afbeelding-input').addEventListener('change', async () => {
    const fileInput = document.getElementById('afbeelding-input');
    const file = fileInput.files[0];
    if (!file) return;

    // Preview tonen
    const preview = document.getElementById('gereedschap-preview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';

    // Upload starten
    const formData = new FormData();
    formData.append('afbeelding', file);

    showMelding("Afbeelding uploaden...", "black");

    try {
        const res = await fetch('/upload/afbeelding', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('afbeelding-url').value = data.url;
            showMelding("Afbeelding succesvol geüpload!", "green");
        } else {
            showMelding(data.error || "Upload mislukt");
        }

    } catch (err) {
        showMelding("Server fout bij upload");
    }
});

// ==============================
// 📤 FORMULIER VERSTUREN
// ==============================
document.getElementById("toolForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const form = e.target;
    const data = Object.fromEntries(new FormData(form));

    // ✅ Afbeelding expliciet ophalen (BELANGRIJK)
    const afbeeldingUrl = document.getElementById('afbeelding-url').value;

    if (!afbeeldingUrl) {
        showMelding("Upload eerst een afbeelding");
        return;
    }

    data.Afbeelding = afbeeldingUrl;

    // ✅ Haal geselecteerde categorieën


    const groepen = ["Type", "Werkwijze", "Gewicht", "Staat"];
    let categorieen = [];

        // Eén selectie per groep
        groepen.forEach(group => {
            const selected = document.querySelector(`input[name="${group}"]:checked`);
            if (selected) categorieen.push(parseInt(selected.value));
    });

// Materiaal apart: meerdere mogelijk
document.querySelectorAll('input[name="Materiaal"]:checked').forEach(cb => {
    categorieen.push(parseInt(cb.value));
});

    // ==============================
    // 🔴 VALIDATIE
    // ==============================
    if (!data.Naam) {
        showMelding("Naam is verplicht");
        form.Naam.classList.add("error");
        return;
    }

    if (!data.Beschrijving) {
        showMelding("Beschrijving is verplicht");
        form.Beschrijving.classList.add("error");
        return;
    }

    if (!data.Begindatum || !data.Einddatum) {
        showMelding("Vul beide datums in");
        return;
    }

    if (new Date(data.Einddatum) <= new Date(data.Begindatum)) {
        showMelding("Einddatum moet minimaal 1 dag na begindatum liggen");
        form.Einddatum.classList.add("error");
        return;
    }

    if (!data.BorgBedrag) {
        showMelding("Borg bedrag is verplicht");
        form.BorgBedrag.classList.add("error");
        return;
    }

    const verplichtGroepen = ["Type", "Werkwijze", "Gewicht", "Staat"]; // Materiaal optioneel of meerdere
const alleVerplichtIngevuld = verplichtGroepen.every(group =>
    document.querySelector(`input[name="${group}"]:checked`)
);
if (!alleVerplichtIngevuld) {
    showMelding("Selecteer één optie per groep (behalve Materiaal mag meerdere)");
    return;
}

    data.categorieen = categorieen;

    // ==============================
    // 📡 DATA VERSTUREN NAAR SERVER
    // ==============================
    try {
        const res = await fetch("/gereedschap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (res.ok) {
            showMelding("Gereedschap succesvol toegevoegd!", "green");
            form.reset();

            document.getElementById('gereedschap-preview').style.display = 'none';
            document.getElementById('afbeelding-url').value = ""; // reset afbeelding

        } else {
            showMelding(result.message || "Er ging iets mis");
        }

    } catch (err) {
        showMelding("Server fout bij opslaan");
    }
});