// ==============================
// 🔔 MELDING TONEN OP PAGINA
// ==============================
function showMelding(text, kleur = "red") {
    const melding = document.getElementById("melding");
    if (!melding) return;
    melding.textContent = text;
    melding.style.color = kleur;
}

// ==============================
// Borg berekening
// ==============================
function berekenBorg(waarde, categorie) {
    if (isNaN(waarde) || waarde <= 0) return 25;

    const regels = {
        klein:  { min: 10,  max: 25,  percentage: 0.2 },
        middel: { min: 25,  max: 75,  percentage: 0.3 },
        groot:  { min: 75,  max: 200, percentage: 0.4 },
    };

    const r = regels[categorie] || regels.middel;

    let advies = waarde * r.percentage;

    if (advies < r.min) advies = r.min;
    if (advies > r.max) advies = r.max;

    return Math.round(advies);
}

const waardeInput = document.getElementById("Waarde");
const borgInput = document.getElementById("BorgBedrag");

if (waardeInput && borgInput) {

    borgInput.title = "Je kunt dit bedrag aanpassen";

    // 👇 USER OVERRIDE DETECT (belangrijk)
    borgInput.addEventListener("input", () => {
        borgInput.dataset.edited = borgInput.value ? "true" : "";
    });

    function updateBorg() {
        const waarde = Number(waardeInput.value);
        if (!waarde || isNaN(waarde)) return;

        const gekozen = document.querySelector('input[name="Grootte"]:checked');
        const categorie = gekozen ? gekozen.value : "middel";

        const regels = {
            klein:  { min: 10,  max: 25 },
            middel: { min: 25,  max: 75 },
            groot:  { min: 75,  max: 200 },
        };

        const r = regels[categorie];
        const aanbevolen = berekenBorg(waarde, categorie);

        borgInput.min = r.min;
        borgInput.max = r.max;

        // alleen auto invullen als user niet heeft getypt
        if (!borgInput.dataset.edited) {
            borgInput.value = aanbevolen;
        }

        borgInput.placeholder = `Advies €${aanbevolen} (min €${r.min}, max €${r.max})`;
    }

    waardeInput.addEventListener("input", updateBorg);

    document.querySelectorAll('input[name="Grootte"]').forEach(el => {
        el.addEventListener("change", () => {
            borgInput.dataset.edited = ""; // 👈 RESET OVERRIDE HIER
            updateBorg();
        });
    });

    updateBorg();
}

// ==============================
// ❌ ERROR CLEAR
// ==============================
function clearErrors() {
    document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
    showMelding("");
}

// ==============================
// 🗓️ DATUM VALIDATIE
// ==============================
const today = new Date().toISOString().split("T")[0];
const begindatumInput = document.querySelector('input[name="Begindatum"]');
const einddatumInput = document.querySelector('input[name="Einddatum"]');

if (begindatumInput && einddatumInput) {
    begindatumInput.setAttribute("min", today);
    einddatumInput.setAttribute("min", today);

    begindatumInput.addEventListener("change", () => {
        if (!begindatumInput.value) return;

        const d = new Date(begindatumInput.value);
        d.setDate(d.getDate() + 1);
        const minEind = d.toISOString().split("T")[0];

        einddatumInput.setAttribute("min", minEind);

        if (einddatumInput.value && einddatumInput.value < minEind) {
            einddatumInput.value = minEind;
        }
    });
}

// ==============================
// 🖱️ CHECKBOX GROEP LOGICA
// ==============================
document.querySelectorAll('input[data-group]').forEach(cb => {
    cb.addEventListener("change", () => {
        if (cb.checked && cb.dataset.group !== "Materiaal") {
            const group = cb.dataset.group;

            document.querySelectorAll(`input[data-group="${group}"]`)
                .forEach(other => {
                    if (other !== cb) other.checked = false;
                });
        }
    });
});

// ==============================
// 🖼️ IMAGE PREVIEW + UPLOAD
// ==============================
const imageInput = document.getElementById("afbeelding-input");
const preview = document.getElementById("gereedschap-preview");
const imageUrl = document.getElementById("afbeelding-url");

if (imageInput && preview) {

    imageInput.addEventListener("change", async () => {
        const file = imageInput.files[0];
        if (!file) return;

        preview.src = URL.createObjectURL(file);
        preview.style.display = "block";

        const formData = new FormData();
        formData.append("afbeelding", file);

        showMelding("Afbeelding uploaden...", "black");

        try {
            const res = await fetchWithSpinner("/upload/afbeelding", {
                method: "POST",
                body: formData,
                credentials: "include"
            });

            const data = await res.json();

            if (res.ok) {
                imageUrl.value = data.url;
                showMelding("Afbeelding geüpload", "green");
            } else {
                showMelding(data.error || "Upload mislukt");
            }
        } catch (err) {
            showMelding("Server fout bij upload");
        }
    });
}

// ==============================
// 📤 FORM SUBMIT
// ==============================
const form = document.getElementById("toolForm");

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearErrors();

        const data = Object.fromEntries(new FormData(form));

        const afbeeldingUrl = document.getElementById("afbeelding-url").value;

        if (!afbeeldingUrl) {
            showMelding("Upload eerst een afbeelding");
            return;
        }

        data.Afbeelding = afbeeldingUrl;

        const groepen = ["Type", "Werkwijze", "Grootte", "Staat"];
        let categorieen = [];

        groepen.forEach(group => {
            const selected = document.querySelector(`input[name="${group}"]:checked`);
            if (selected) categorieen.push(parseInt(selected.value));
        });

        document.querySelectorAll('input[name="Materiaal"]:checked')
            .forEach(cb => categorieen.push(parseInt(cb.value)));

        data.categorieen = categorieen;

        try {
            const res = await fetchWithSpinner("/gereedschap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                showMelding("Gereedschap toegevoegd!", "green");

                form.reset();

                if (preview) preview.style.display = "none";
                if (imageUrl) imageUrl.value = "";
                if (borgInput) {
                    borgInput.value = "";
                    borgInput.dataset.edited = "";
                }

                updateBorg();
            } else {
                showMelding(result.message || "Er ging iets mis");
            }

        } catch (err) {
            showMelding("Server fout bij opslaan");
        }
    });
}