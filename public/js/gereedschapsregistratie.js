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
// 🖱️ MAX 1 CHECKBOX PER GROEP
// ==============================
document.querySelectorAll('input[type="checkbox"][data-group]').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) {
      const group = cb.dataset.group;
      document.querySelectorAll(`input[type="checkbox"][data-group="${group}"]`)
        .forEach(other => {
          if (other !== cb) other.checked = false;
        });
    }
  });
});

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

  if (!file) return showMelding('Selecteer eerst een afbeelding');

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
  clearErrors();

  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  // ==============================
  // ✅ CATEGORIEËN PER GROEP OPHALEN
  // ==============================
  const groups = ["Type","Materiaal","Werkwijze","Gewicht","Staat"];
  let categorieen = [];

  groups.forEach(group => {
    const selected = document.querySelector(`input[name="${group}"]:checked`);
    if(selected) categorieen.push(parseInt(selected.value));
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

  if (data.Begindatum > data.Einddatum) {
    showMelding("Begindatum mag niet na einddatum liggen");
    return;
  }

  if (!data.BorgBedrag) {
    showMelding("Borg bedrag is verplicht");
    form.BorgBedrag.classList.add("error");
    return;
  }

  if (categorieen.length !== groups.length) {
    showMelding("Selecteer één optie per groep (Type, Materiaal, Werkwijze, Gewicht, Staat)");
    return;
  }

  if (!data.Afbeelding) {
    showMelding("Upload eerst een afbeelding");
    return;
  }

  data.categorieen = categorieen;

  // ==============================
  // 📡 VERZEND NAAR SERVER
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
      document.getElementById("gereedschap-preview").style.display = "none";
    } else {
      showMelding(result.message || "Er ging iets mis");
    }
  } catch (error) {
    showMelding("Server fout bij opslaan");
  }
});