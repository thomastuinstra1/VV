// Preview direct bij selecteren
document.getElementById('afbeelding-input').addEventListener('change', () => {
    const file = document.getElementById('afbeelding-input').files[0];
    if (!file) return;

    const preview = document.getElementById('gereedschap-preview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
});

// Afbeelding uploaden
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
        document.getElementById('afbeelding-url').value = data.url;
        alert('Afbeelding geüpload!');
    } else {
        alert(data.error || 'Er is iets misgegaan bij het uploaden');
    }
});

// Form submit
document.getElementById("toolForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  if (!data.Afbeelding) {
    return alert('Upload eerst een afbeelding');
  }

  const categorieen = Array.from(
    document.querySelectorAll('input[name="Categorieen"]:checked')
  ).map(cb => parseInt(cb.value));

  data.categorieen = categorieen;

  const res = await fetch("/gereedschap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  alert(result.message);
});