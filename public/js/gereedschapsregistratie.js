// ==============================
// 🔔 MELDING TONEN
// ==============================
function showMelding(text, kleur = "red") {
  const melding = document.getElementById("melding");
  melding.style.color = kleur;
  melding.textContent = text;
}

// ==============================
// ❌ FOUTEN RESETTEN
// ==============================
function clearErrors() {
  document.querySelectorAll(".error").forEach(el => {
    el.classList.remove("error");
  });
}

// ==============================
// 🖼️ AFBEELDING PREVIEW
// ==============================
document.getElementById('afbeelding-input').addEventListener('change', () => {
  const fileInput = document.getElementById('afbeelding-input');
  const file = fileInput.files[0];

  if (!file) return;

  const preview = document.getElementById('gereedschap-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
});

// ==============================
// ⬆️ AFBEELDING UPLOADEN
// ==============================
document.getElementById('upload-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('afbeelding-input');
  const file = fileInput.files[0];

  if (!file) {
    return showMelding('Selecteer eerst een afbeelding');
  }

  const formData = new FormData();
  formData.append('afbeelding', file);

  try {
    const response = await fetch('/account/afbeelding', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('afbeelding-url').value = data.url;
      showMelding('Afbeelding geüpload!', 'green');
    } else {
      showMelding(data.error || 'Upload mislukt');
    }

  } catch (error) {
    showMelding('Server fout bij upload');
  }
});

// ==============================
// 📤 FORMULIER VERSTUREN
// ==============================
document.getElementById("toolForm").addEventListener("submit", async (e) => {
  e.preventDefault(); // voorkomt refresh

  clearErrors(); // reset rode randjes

  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  // geselecteerde categorieën ophalen
  const categorieCheckboxes = document.querySelectorAll('input[name="Categorieen"]:checked');
  const categorieen = Array.from(categorieCheckboxes).map(cb => parseInt(cb.value));

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

  if (data.Begindatum > data.Einddatum) {
    showMelding("Begindatum mag niet na einddatum liggen");
    return;
  }

  if (!data.BorgBedrag) {
    showMelding("Borg bedrag is verplicht");
    form.BorgBedrag.classList.add("error");
    return;
  }

  if (categorieen.length === 0) {
    showMelding("Selecteer minimaal één categorie");
    return;
  }

  if (!data.Afbeelding) {
    showMelding("Upload eerst een afbeelding");
    return;
  }

  // categorieën toevoegen aan data
  data.categorieen = categorieen;

  // ==============================
  // 📡 DATA VERSTUREN NAAR SERVER
  // ==============================
  try {
    const res = await fetch("/gereedschap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      showMelding("Gereedschap succesvol toegevoegd!", "green");

      form.reset();
      document.getElementById("gereedschap-preview").style.display = "none";

    } else {
      showMelding(result.message || "Er ging iets mis");
    }

  } catch (error) {
    showMelding("Server fout bij opslaan");
  }
});