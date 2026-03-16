// Afbeelding uploaden (zelfde methode als accountinstellingen)
document.getElementById('upload-btn').addEventListener('click', async () => {
    const file = document.getElementById('afbeelding-input').files[0];
    if (!file) return alert('Selecteer eerst een afbeelding');
 
    const formData = new FormData();
    formData.append('afbeelding', file);
 
    const response = await fetch('/account/afbeelding', {
        method: 'POST',
        body: formData
    });
 
    const data = await response.json();
    if (response.ok) {
        // URL opslaan in het verborgen veld zodat het meegestuurd wordt bij submit
        document.getElementById('afbeelding-url').value = data.url;
 
        // Preview tonen
        const preview = document.getElementById('gereedschap-preview');
        preview.src = data.url;
        preview.style.display = 'block';
 
        alert('Afbeelding geüpload!');
    } else {
        alert(data.error || 'Er is iets misgegaan bij het uploaden');
    }
});

// Categorieën ophalen en dropdown vullen
async function laadCategorieen() {
  try {
    const res = await fetch('/categorieen');
    const categorieen = await res.json();

    const select = document.getElementById('categorieSelect');
    categorieen.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.Categorie_id; // Prisma geeft veld zo terug
      option.textContent = cat.Naam;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Categorieën ophalen mislukt', err);
  }
}

// Form submit
document.getElementById("toolForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  const res = await fetch("/gereedschap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message);
  console.log(result);
});

// Categorieën direct bij laden pagina ophalen
laadCategorieen();