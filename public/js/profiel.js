document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const accountId = params.get("id");

  if (!accountId) {
    showToast("Geen gebruiker opgegeven", "error");
    return;
  }

  await loadProfile(accountId);
  await loadProfileActions(accountId);
  await loadUserListings(accountId);
  setupReportModal(accountId);
});

async function loadProfile(accountId) {
  try {
    const res = await fetchWithSpinner(`/account/${accountId}/profiel`);
    if (!res || !res.ok) {
      throw new Error("Kon profiel niet ophalen");
    }

    const account = await res.json();

    if (!account || account.error) {
      showToast("Gebruiker niet gevonden", "error");
      return;
    }

    const naam = account.Name || "Onbekend";
    const email = account.E_mail || "—";
    const postcode = account.Postcode || "—";

    document.getElementById("profileName").textContent = naam;
    document.getElementById("profileEmail").textContent = email;
    document.getElementById("profilePostcode").textContent = postcode;
    document.title = `${naam} - Gereedschapspunt`;

    setProfileAvatar(naam, account.Afbeelding);
  } catch (err) {
    console.error(err);
    showToast("Fout bij ophalen profiel", "error");
  }
}

async function loadProfileActions(accountId) {
  try {
    const meRes = await fetchWithSpinner("/me");
    if (!meRes || !meRes.ok) return;

    const me = await meRes.json();

    const myId = me.Account_id ?? me.id;
    if (Number(myId) !== Number(accountId)) {
      const actions = document.getElementById("profileActions");
      if (actions) actions.style.display = "flex";
    }
  } catch (err) {
    console.error("Kon huidige gebruiker niet ophalen:", err);
  }
}

function setProfileAvatar(name, imageUrl) {
  const avatar = document.getElementById("profileAvatar");
  const fallback = document.getElementById("profileAvatarFallback");

  if (!avatar || !fallback) return;

  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (imageUrl && imageUrl.trim() !== "") {
    avatar.src = imageUrl;
    avatar.alt = `Profielfoto van ${name}`;
    avatar.style.display = "block";
    fallback.style.display = "none";

    avatar.onerror = () => {
      avatar.style.display = "none";
      fallback.style.display = "grid";
      fallback.textContent = initial;
    };
  } else {
    avatar.style.display = "none";
    fallback.style.display = "grid";
    fallback.textContent = initial;
  }
}

async function loadUserListings(accountId) {
  const container = document.getElementById("userListings");
  if (!container) return;

  try {
    const res = await fetchWithSpinner(`/gereedschap/gebruiker/${accountId}`);
    if (!res || !res.ok) {
      throw new Error("Kon advertenties niet ophalen");
    }

    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧰</div>
          <div class="empty-title">Geen advertenties gevonden</div>
          <div class="empty-text">Deze gebruiker heeft momenteel geen gereedschap te huur staan.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const afbeelding = item.Afbeelding || "/images/default.jpg";
      const titel = escapeHtml(item.Naam || "Gereedschap");
      const beschrijving = escapeHtml(item.Beschrijving || "Bekijk deze advertentie");
      const borg = item.BorgBedrag ?? 0;
      const id = encodeURIComponent(item.Gereedschap_id);

      return `
        <a class="listing-card" href="gereedschap.html?id=${id}">
          <img class="listing-image" src="${afbeelding}" alt="${titel}">
          <div class="listing-content">
            <h3 class="listing-title">${titel}</h3>
            <p class="listing-desc">${beschrijving}</p>
            <div class="listing-meta">€${borg} borg</div>
          </div>
        </a>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Advertenties konden niet worden geladen</div>
        <div class="empty-text">Probeer het later opnieuw.</div>
      </div>
    `;
  }
}

function setupReportModal(accountId) {
  const reportBtn = document.getElementById("reportBtn");
  const reportModal = document.getElementById("reportModal");
  const reportCancel = document.getElementById("reportCancel");
  const reportCancelTop = document.getElementById("reportCancelTop");
  const reportSubmit = document.getElementById("reportSubmit");
  const reportReden = document.getElementById("reportReden");

  if (!reportBtn || !reportModal || !reportSubmit || !reportReden) return;

  reportBtn.addEventListener("click", () => {
    reportModal.style.display = "flex";
  });

  if (reportCancel) {
    reportCancel.addEventListener("click", () => {
      reportModal.style.display = "none";
    });
  }

  if (reportCancelTop) {
    reportCancelTop.addEventListener("click", () => {
      reportModal.style.display = "none";
    });
  }

  reportModal.addEventListener("click", (e) => {
    if (e.target === reportModal) {
      reportModal.style.display = "none";
    }
  });

  reportSubmit.addEventListener("click", async () => {
    const reden = reportReden.value.trim();

    if (!reden) {
      showToast("Vul een reden in", "error");
      return;
    }

    try {
      const res = await fetchWithSpinner(`/account/${accountId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Reden: reden })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Rapporteren mislukt", "error");
        return;
      }

      showToast("Rapport ingediend!", "success");
      reportModal.style.display = "none";
      reportReden.value = "";
    } catch (err) {
      console.error(err);
      showToast("Er is iets misgegaan", "error");
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    };
    return map[match];
  });
}