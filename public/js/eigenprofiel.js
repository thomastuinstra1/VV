// js/eigenprofiel.js
// Laadt het profiel van de ingelogde gebruiker zelf.
// reviews.js verwacht een ?id= parameter — die zetten we hier dynamisch.

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetchWithSpinner("/me");
    if (!res || !res.ok) {
      window.location.href = "inlog.html";
      return;
    }

    const me = await res.json();
    const accountId = me.Account_id ?? me.id;

    // reviews.js leest de id uit de URL — zet die dus eerst
    const url = new URL(window.location.href);
    if (!url.searchParams.get("id")) {
      url.searchParams.set("id", accountId);
      window.history.replaceState({}, "", url.toString());
    }

    // Profiel invullen
    const naam     = me.Name     || "Onbekend";
    const email    = me.E_mail   || "—";
    const postcode = me.Postcode || "—";

    document.getElementById("profileName").textContent     = naam;
    document.getElementById("profileEmail").textContent    = email;
    document.getElementById("profilePostcode").textContent = postcode;
    document.title = `Mijn profiel - Gereedschapspunt`;

    setProfileAvatar(naam, me.Afbeelding);
  } catch (err) {
    console.error(err);
    showToast("Fout bij ophalen profiel", "error");
  }
});

function setProfileAvatar(name, imageUrl) {
  const avatar   = document.getElementById("profileAvatar");
  const fallback = document.getElementById("profileAvatarFallback");
  if (!avatar || !fallback) return;

  const initial = (name || "?").trim().charAt(0).toUpperCase();

  if (imageUrl && imageUrl.trim() !== "") {
    avatar.src           = imageUrl;
    avatar.alt           = `Profielfoto van ${name}`;
    avatar.style.display = "block";
    fallback.style.display = "none";

    avatar.onerror = () => {
      avatar.style.display   = "none";
      fallback.style.display = "grid";
      fallback.textContent   = initial;
    };
  } else {
    avatar.style.display   = "none";
    fallback.style.display = "grid";
    fallback.textContent   = initial;
  }
}