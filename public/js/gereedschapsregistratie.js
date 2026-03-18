// ===== MAX 1 CHECKBOX PER GROEP =====
document.querySelectorAll('input[type="checkbox"][data-group]').forEach(cb => {
  cb.addEventListener('change', () => {
    if(cb.checked){
      const group = cb.dataset.group;
      document.querySelectorAll(`input[type="checkbox"][data-group="${group}"]`)
        .forEach(other => { if(other!==cb) other.checked=false; });
    }
  });
});

// ===== AFBEELDING PREVIEW =====
document.getElementById('afbeelding-input').addEventListener('change', () => {
  const file = document.getElementById('afbeelding-input').files[0];
  if(!file) return;
  const preview = document.getElementById('gereedschap-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
});

// ===== AFBEELDING UPLOAD =====
document.getElementById('upload-btn').addEventListener('click', async () => {
  const file = document.getElementById('afbeelding-input').files[0];
  if(!file){ alert('Selecteer eerst een afbeelding'); return; }

  const formData = new FormData();
  formData.append('afbeelding', file);

  try{
    const res = await fetch('/account/afbeelding', {
      method:'POST',
      body:formData,
      credentials:'include' // indien sessie-cookie nodig
    });
    const data = await res.json();
    if(res.ok){
      document.getElementById('afbeelding-url').value = data.url;
      alert('Afbeelding geüpload!');
    }else{
      alert(data.error||'Upload mislukt');
    }
  }catch(err){
    alert('Server fout bij upload');
  }
});

// ===== FORM SUBMIT =====
document.getElementById("toolForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  const groups = ["Type","Materiaal","Werkwijze","Gewicht","Staat"];
  let categorieen=[];
  groups.forEach(group=>{
    const selected = document.querySelector(`input[name="${group}"]:checked`);
    if(selected) categorieen.push(parseInt(selected.value));
  });

  // ===== VALIDATIE =====
  if(!data.Naam || !data.Beschrijving || !data.Begindatum || !data.Einddatum || !data.BorgBedrag || !data.Afbeelding){
    alert("Vul alle verplichte velden in"); return;
  }
  if(data.Begindatum>data.Einddatum){ alert("Begindatum mag niet na einddatum liggen"); return; }
  if(categorieen.length!==groups.length){ alert("Selecteer één optie per groep"); return; }

  data.categorieen = categorieen;

  try{
    const res = await fetch("/gereedschap",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(data)
    });
    const result = await res.json();
    if(res.ok){ alert("Gereedschap succesvol toegevoegd!"); form.reset(); document.getElementById('gereedschap-preview').style.display='none'; }
    else{ alert(result.message||"Er ging iets mis"); }
  }catch(err){
    alert("Server fout bij opslaan");
  }
});