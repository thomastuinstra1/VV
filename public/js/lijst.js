  async function loadNewAds() {
    const track = document.getElementById("newAdsTrack");
    if (!track) return;

    try {
      const res = await fetch("/gereedschap");
      const tools = await res.json();

      if (!tools || tools.length === 0) {
        track.innerHTML = "<p>Geen gereedschap gevonden.</p>";
        return;
      }

      // selecteer de nieuwste 6 tools
      const nieuwsteTools = tools.slice(0, 6);

      // duplicate voor oneindige scroll
      const sliderTools = [...nieuwsteTools, ...nieuwsteTools];

      // voeg items toe aan de slider-track
      track.innerHTML = sliderTools
        .map((tool) => {
          const afbeelding =
            tool.Afbeelding && tool.Afbeelding.trim() !== ""
              ? tool.Afbeelding
              : "../images/placeholder.jpg";

          const titel = tool.Naam || "Gereedschap";
          const beschrijving =
            tool.Beschrijving || "Nieuw geplaatst op Gereedschapspunt.";

          return `
                    <article class="ad-card">
                        <img src="${afbeelding}" alt="${titel}" class="ad-image">
                        <div class="ad-content">
                            <span class="ad-label">Nieuw</span>
                            <h3>${titel}</h3>
                            <p>${beschrijving}</p>
                        </div>
                    </article>
                `;
        })
        .join("");
    } catch (error) {
      console.error("Fout bij laden slider:", error);
      track.innerHTML = "<p>Advertenties laden mislukt.</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", loadNewAds);