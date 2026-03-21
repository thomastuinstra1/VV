document.addEventListener("DOMContentLoaded", () => {
    laadAanvragen();
});

// ==============================
// 📥 Aanvragen ophalen
// ==============================
async function laadAanvragen() {
    try {
        const res = await fetch('/aanvragen');

        if (res.status === 401) {
            window.location.href = '/inlog.html';
            return;
        }

        const aanvragen = await res.json();
        toonAanvragen(aanvragen);

    } catch (err) {
        console.error("Fout:", err);
    }
}

// ==============================
// 📋 Tonen aanvragen
// ==============================
function toonAanvragen(aanvragen) {
    const lijst = document.getElementById("aanvragenLijst");
    const geen = document.getElementById("geenAanvragen");

    lijst.innerHTML = "";

    if (!aanvragen.length) {
        geen.hidden = false;
        return;
    }

    aanvragen.forEach(a => {
        const div = document.createElement("div");
        div.classList.add("aanvraag-kaart");

        div.innerHTML = `
            <h3>${a.Naam}</h3>
            <p>Aanvrager: ${a.GebruikerNaam}</p>
            <p>Van ${a.Begindatum} tot ${a.Einddatum}</p>

            <div class="acties">
                <button onclick="accepteer(${a.Aanvraag_id})" class="btn-accept">✅ Accepteren</button>
                <button onclick="weiger(${a.Aanvraag_id})" class="btn-weiger">❌ Weigeren</button>
            </div>
        `;

        lijst.appendChild(div);
    });
}

// ==============================
// ✅ Accepteren
// ==============================
async function accepteer(id) {
    if (!confirm("Weet je zeker dat je deze aanvraag wilt accepteren?")) return;

    try {
        const res = await fetch(`/aanvragen/${id}/accepteer`, {
            method: "POST"
        });

        if (!res.ok) throw new Error();

        showMelding("Aanvraag geaccepteerd!", "green");
        laadAanvragen();

    } catch {
        showMelding("Fout bij accepteren");
    }
}

// ==============================
// ❌ Weigeren
// ==============================
async function weiger(id) {
    if (!confirm("Weet je zeker dat je deze aanvraag wilt weigeren?")) return;

    try {
        const res = await fetch(`/aanvragen/${id}/weiger`, {
            method: "POST"
        });

        if (!res.ok) throw new Error();

        showMelding("Aanvraag geweigerd!", "green");
        laadAanvragen();

    } catch {
        showMelding("Fout bij weigeren");
    }
}

// ==============================
// 🔔 Melding (hergebruik jouw functie)
// ==============================
function showMelding(text, kleur = "red") {
    const melding = document.getElementById("melding");
    melding.textContent = text;
    melding.style.color = kleur;
}