let isLoading = false;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (match) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[match];
  });
}

async function loadNewAds() {
  if (isLoading) return;
  isLoading = true;

  console.log('loadNewAds gestart');

  const track = document.getElementById('newAdsTrack');
  if (!track) {
    isLoading = false;
    return;
  }

  try {
    const res = await fetch('/gereedschappen/nieuw', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const ads = await res.json();
    const latestAds = Array.isArray(ads) ? ads.slice(0, 10) : [];

    if (latestAds.length === 0) {
      track.innerHTML = '<p>Er zijn nog geen advertenties.</p>';
      return;
    }

    const doubledAds = [...latestAds, ...latestAds];

    track.classList.remove('is-loaded');
    console.log('is-loaded verwijderd, classes:', track.className);

    track.innerHTML = doubledAds.map((ad) => {
      const id = encodeURIComponent(ad.Gereedschap_id);
      const titel = escapeHtml(ad.Naam || ad.Titel || 'Gereedschap');
      const beschrijving = escapeHtml(ad.Beschrijving || 'Bekijk deze advertentie');
      const plaats = escapeHtml(ad.eigenaar?.Name || 'Nieuw');
      const afbeelding = ad.Afbeelding || '/images/default-tool.jpg';

      return `
        <a class="ad-card" href="gereedschap.html?id=${id}">
          <img class="ad-image" src="${afbeelding}" alt="${titel}">
          <div class="ad-content">
            <span class="ad-label">${plaats}</span>
            <h3>${titel}</h3>
            <p>${beschrijving}</p>
          </div>
        </a>
      `;
    }).join('');

    const images = track.querySelectorAll('img');
    const total = images.length;
    console.log('Aantal afbeeldingen:', total);

    if (total === 0) {
      track.classList.add('is-loaded');
      return;
    }

    let loaded = 0;
    images.forEach((img) => {
      const done = () => {
        loaded++;
        console.log(`Afbeelding ${loaded}/${total} geladen`);
        if (loaded >= total) {
          console.log('Alle afbeeldingen geladen, animatie starten...');
          requestAnimationFrame(() => {
            track.classList.add('is-loaded');
            console.log('Classes op track:', track.className);
          });
        }
      };
      if (img.complete) {
        done();
      } else {
        img.addEventListener('load', done);
        img.addEventListener('error', done);
      }
    });

  } catch (err) {
    console.error('Slider ads laden mislukt:', err);
    track.innerHTML = '<p>Kon advertenties niet laden.</p>';
  } finally {
    isLoading = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadNewAds();
  setInterval(loadNewAds, 30000);
});