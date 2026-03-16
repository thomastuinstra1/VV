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