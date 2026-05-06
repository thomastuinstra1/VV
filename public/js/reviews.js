// js/reviews.js
// Vereist: globaal.js (fetchWithSpinner, showToast)

document.addEventListener("DOMContentLoaded", async () => {
  const params    = new URLSearchParams(window.location.search);
  const accountId = params.get("id");
  if (!accountId) return;

  // Haal ingelogde gebruiker op — nodig voor formulieren en eigen-actie knoppen
  let mijnId = null;
  try {
    const meRes = await fetch("/me");
    if (meRes.ok) {
      const me = await meRes.json();
      mijnId = me.Account_id ?? me.id ?? null;
    }
  } catch (_) {}

  await loadVerhuurderReviews(accountId, mijnId);
  await loadLenerReviews(accountId, mijnId);

  // Formulier voor lener: alleen tonen als ingelogd en niet eigen profiel
  if (mijnId && Number(mijnId) !== Number(accountId)) {
    await setupVerhuurderReviewForm(accountId);  // lener beoordeelt verhuurder
    await setupLenerReviewForm(accountId, mijnId); // verhuurder beoordeelt lener
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIE 1 — VERHUURDER REVIEWS (leners beoordelen deze gebruiker als verhuurder)
// ═══════════════════════════════════════════════════════════════════════════════

async function loadVerhuurderReviews(accountId, mijnId) {
  injectSection(
    "verhuurderReviewsSection",
    "Beoordelingen als verhuurder",
    "Wat leners zeggen",
    "verhuurderReviewsList",
    "verhuurderStarsGem",
    "verhuurderGemiddelde",
    "verhuurderAantal"
  );

  const container   = document.getElementById("verhuurderReviewsList");
  const gemiddeldeEl = document.getElementById("verhuurderGemiddelde");
  const aantalEl    = document.getElementById("verhuurderAantal");

  try {
    const res     = await fetch(`/account/${accountId}/reviews`);
    if (!res.ok) throw new Error();
    const reviews = await res.json();

    renderGemiddelde(reviews, gemiddeldeEl, aantalEl, "verhuurderStarsGem");

    if (reviews.length === 0) {
      container.innerHTML = `<p class="review-empty">Nog geen beoordelingen als verhuurder.</p>`;
      return;
    }

    container.innerHTML = reviews.map((r) => renderReviewCard(r, mijnId)).join("");
    attachReviewActions(container, accountId);
  } catch (_) {
    container.innerHTML = `<p class="review-empty">Beoordelingen konden niet worden geladen.</p>`;
  }
}

async function setupVerhuurderReviewForm(accountId) {
  try {
    const res = await fetch(`/uitlenen/te-reviewen?verhuurder=${accountId}`);
    if (!res.ok) return;
    const uitlenen = await res.json();
    if (!Array.isArray(uitlenen) || uitlenen.length === 0) return;

    injectReviewForm(
      "verhuurderReviewsSection",
      "verhuurderReviewFormCard",
      uitlenen,
      accountId,
      "Schrijf een beoordeling als lener"
    );
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIE 2 — LENER REVIEWS (verhuurders beoordelen deze gebruiker als lener)
// ═══════════════════════════════════════════════════════════════════════════════

async function loadLenerReviews(accountId, mijnId) {
  injectSection(
    "lenerReviewsSection",
    "Beoordelingen als lener",
    "Wat verhuurders zeggen",
    "lenerReviewsList",
    "lenerStarsGem",
    "lenerGemiddelde",
    "lenerAantal"
  );

  const container    = document.getElementById("lenerReviewsList");
  const gemiddeldeEl = document.getElementById("lenerGemiddelde");
  const aantalEl     = document.getElementById("lenerAantal");

  try {
    const res     = await fetch(`/account/${accountId}/lener-reviews`);
    if (!res.ok) throw new Error();
    const reviews = await res.json();

    renderGemiddelde(reviews, gemiddeldeEl, aantalEl, "lenerStarsGem");

    if (reviews.length === 0) {
      container.innerHTML = `<p class="review-empty">Nog geen beoordelingen als lener.</p>`;
      return;
    }

    container.innerHTML = reviews.map((r) => renderReviewCard(r, mijnId)).join("");
    attachReviewActions(container, accountId);
  } catch (_) {
    container.innerHTML = `<p class="review-empty">Beoordelingen konden niet worden geladen.</p>`;
  }
}

async function setupLenerReviewForm(accountId, mijnId) {
  // Toon formulier alleen als ingelogde gebruiker verhuurder is van deze lener
  try {
    const res = await fetch(`/uitlenen/als-verhuurder-te-reviewen?lener=${accountId}`);
    if (!res.ok) return;
    const uitlenen = await res.json();
    if (!Array.isArray(uitlenen) || uitlenen.length === 0) return;

    injectReviewForm(
      "lenerReviewsSection",
      "lenerReviewFormCard",
      uitlenen,
      accountId,
      "Beoordeel deze lener"
    );
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEDEELDE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function injectSection(sectionId, kicker, heading, listId, starsId, gemiddeldeId, aantalId) {
  if (document.getElementById(sectionId)) return;

  const shell = document.querySelector(".profile-shell");
  if (!shell) return;

  const section = document.createElement("section");
  section.id        = sectionId;
  section.className = "profile-listings-card reviews-section";
  section.innerHTML = `
    <div class="section-heading profile-section-heading">
      <div>
        <p class="section-kicker">${kicker}</p>
        <h2>${heading}</h2>
      </div>
      <div class="review-summary">
        <div id="${starsId}" class="review-summary-stars"></div>
        <span id="${gemiddeldeId}" class="review-summary-score">–</span>
        <span id="${aantalId}" class="review-summary-count"></span>
      </div>
    </div>
    <div id="${listId}" class="reviews-list"></div>
  `;

  shell.appendChild(section);
}

function renderGemiddelde(reviews, gemiddeldeEl, aantalEl, starsElId) {
  if (reviews.length > 0) {
    const gem = reviews.reduce((s, r) => s + (r.Rating ?? 0), 0) / reviews.length;
    if (gemiddeldeEl) gemiddeldeEl.textContent = gem.toFixed(1);
    if (aantalEl) aantalEl.textContent = `(${reviews.length} ${reviews.length === 1 ? "beoordeling" : "beoordelingen"})`;
    renderStarsReadonly(document.getElementById(starsElId), gem);
  } else {
    if (gemiddeldeEl) gemiddeldeEl.textContent = "–";
    if (aantalEl) aantalEl.textContent = "(nog geen beoordelingen)";
  }
}

function renderReviewCard(r, mijnId) {
  const isOwn    = mijnId && Number(mijnId) === Number(r.Auteur_id);
  const datum    = r.Datum ? new Date(r.Datum).toLocaleDateString("nl-NL") : "";
  const initials = (r.auteurNaam || "?").trim().charAt(0).toUpperCase();
  const starsHtml = renderStarsHtml(r.Rating ?? 0);

  return `
    <div class="review-card" data-id="${r.Review_id}">
      <div class="review-header">
        <div class="review-avatar">
          ${r.auteurAfbeelding
            ? `<img src="${r.auteurAfbeelding}" alt="${escapeHtml(r.auteurNaam)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`
            : ""}
          <span class="review-avatar-initial" style="${r.auteurAfbeelding ? "display:none" : ""}">${initials}</span>
        </div>
        <div class="review-meta">
          <span class="review-auteur">${escapeHtml(r.auteurNaam)}</span>
          <span class="review-datum">${datum}</span>
        </div>
        <div class="review-stars">${starsHtml}</div>
      </div>
      ${r.Tekst ? `<p class="review-tekst">${escapeHtml(r.Tekst)}</p>` : ""}
      ${isOwn ? `
        <div class="review-own-actions">
          <button class="btn-review-edit" data-review-id="${r.Review_id}" data-rating="${r.Rating}" data-tekst="${escapeHtml(r.Tekst || "")}">✏️ Bewerken</button>
          <button class="btn-review-delete" data-review-id="${r.Review_id}">🗑️ Verwijderen</button>
        </div>
      ` : ""}
    </div>
  `;
}

function attachReviewActions(container, accountId) {
  container.addEventListener("click", async (e) => {
    if (e.target.closest(".btn-review-delete")) {
      const btn      = e.target.closest(".btn-review-delete");
      const reviewId = btn.dataset.reviewId;
      if (!confirm("Weet je zeker dat je deze beoordeling wilt verwijderen?")) return;

      try {
        const res  = await fetchWithSpinner(`/reviews/${reviewId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Verwijderen mislukt", "error"); return; }
        showToast("Beoordeling verwijderd", "success");
        btn.closest(".review-card").remove();
      } catch (_) {
        showToast("Er is iets misgegaan", "error");
      }
    }

    if (e.target.closest(".btn-review-edit")) {
      const btn          = e.target.closest(".btn-review-edit");
      const card         = btn.closest(".review-card");
      const reviewId     = btn.dataset.reviewId;
      const huidigRating = parseInt(btn.dataset.rating) || 0;
      const huidigTekst  = btn.dataset.tekst || "";
      openInlineEdit(card, reviewId, huidigRating, huidigTekst, accountId);
    }
  });
}

function openInlineEdit(card, reviewId, huidigRating, huidigTekst, accountId) {
  const bestaandForm = card.querySelector(".review-edit-form");
  if (bestaandForm) { bestaandForm.remove(); return; }

  let selectedRating = huidigRating;

  const form = document.createElement("div");
  form.className = "review-edit-form";
  form.innerHTML = `
    <div class="review-form-stars">
      ${[1,2,3,4,5].map((i) =>
        `<span class="form-star ${i <= huidigRating ? "form-star-active" : ""}" data-val="${i}">★</span>`
      ).join("")}
    </div>
    <textarea class="review-edit-textarea" rows="3" placeholder="Schrijf je beoordeling...">${huidigTekst}</textarea>
    <div class="review-edit-actions">
      <button class="btn-edit-cancel">Annuleren</button>
      <button class="btn-edit-save">Opslaan</button>
    </div>
  `;

  setupStarInteraction(form.querySelector(".review-form-stars"), (val) => { selectedRating = val; });

  form.querySelector(".btn-edit-cancel").addEventListener("click", () => form.remove());
  form.querySelector(".btn-edit-save").addEventListener("click", async () => {
    const tekst = form.querySelector(".review-edit-textarea").value.trim();
    if (!selectedRating) { showToast("Geef een beoordeling op", "error"); return; }

    try {
      const res  = await fetchWithSpinner(`/reviews/${reviewId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ Tekst: tekst, Rating: selectedRating }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Bewerken mislukt", "error"); return; }

      showToast("Beoordeling bijgewerkt", "success");
      form.remove();

      // Herlaad de juiste sectie
      const params    = new URLSearchParams(window.location.search);
      const accountId = params.get("id");
      let mijnId = null;
      try { const me = await (await fetch("/me")).json(); mijnId = me.Account_id ?? me.id; } catch (_) {}
      await loadVerhuurderReviews(accountId, mijnId);
      await loadLenerReviews(accountId, mijnId);
    } catch (_) {
      showToast("Er is iets misgegaan", "error");
    }
  });

  card.appendChild(form);
}

function injectReviewForm(sectionId, formId, uitlenen, ontvangerAccountId, titel) {
  const section = document.getElementById(sectionId);
  if (!section || document.getElementById(formId)) return;

  let selectedRating = 0;

  const formHtml = `
    <div class="review-form-card" id="${formId}">
      <h3 class="review-form-title">${titel}</h3>

      <label class="review-form-label">Uitleen</label>
      <select class="review-form-select review-uitleen-select">
        ${uitlenen.map((u) =>
          `<option value="${u.Uitleen_id}">${escapeHtml(u.gereedschapNaam || `Uitleen #${u.Uitleen_id}`)} — ${new Date(u.EindDatum).toLocaleDateString("nl-NL")}</option>`
        ).join("")}
      </select>

      <label class="review-form-label">Beoordeling</label>
      <div class="review-form-stars review-new-stars"></div>

      <label class="review-form-label">Tekst <span class="review-form-optional">(optioneel)</span></label>
      <textarea class="review-form-textarea review-new-tekst" rows="4" placeholder="Deel je ervaring..."></textarea>

      <button class="btn-review-submit review-new-submit">Beoordeling plaatsen</button>
    </div>
  `;

  section.insertAdjacentHTML("beforeend", formHtml);

  const formEl   = document.getElementById(formId);
  const starsEl  = formEl.querySelector(".review-new-stars");

  // Render lege sterren
  starsEl.innerHTML = [1,2,3,4,5].map((i) =>
    `<span class="form-star" data-val="${i}">★</span>`
  ).join("");

  setupStarInteraction(starsEl, (val) => { selectedRating = val; });

  formEl.querySelector(".review-new-submit").addEventListener("click", async () => {
    const uitleenId = formEl.querySelector(".review-uitleen-select").value;
    const tekst     = formEl.querySelector(".review-new-tekst").value.trim();

    if (!selectedRating) { showToast("Geef een sterrenbeoordeling op", "error"); return; }

    try {
      const res  = await fetchWithSpinner("/reviews", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          Uitleen_id:   uitleenId,
          Ontvanger_id: ontvangerAccountId,
          Tekst:        tekst,
          Rating:       selectedRating,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Plaatsen mislukt", "error"); return; }

      showToast("Beoordeling geplaatst! 🎉", "success");
      formEl.remove();

      // Herlaad beide secties
      const params    = new URLSearchParams(window.location.search);
      const accountId = params.get("id");
      let mijnId = null;
      try { const me = await (await fetch("/me")).json(); mijnId = me.Account_id ?? me.id; } catch (_) {}
      await loadVerhuurderReviews(accountId, mijnId);
      await loadLenerReviews(accountId, mijnId);
    } catch (_) {
      showToast("Er is iets misgegaan", "error");
    }
  });
}

// ─── Sterren interactie helper ────────────────────────────────────────────────
function setupStarInteraction(starsEl, onSelect) {
  starsEl.querySelectorAll(".form-star").forEach((star) => {
    star.addEventListener("click", () => {
      const val = parseInt(star.dataset.val);
      onSelect(val);
      starsEl.querySelectorAll(".form-star").forEach((s) =>
        s.classList.toggle("form-star-active", parseInt(s.dataset.val) <= val)
      );
    });
    star.addEventListener("mouseenter", () => {
      const val = parseInt(star.dataset.val);
      starsEl.querySelectorAll(".form-star").forEach((s) =>
        s.classList.toggle("form-star-hover", parseInt(s.dataset.val) <= val)
      );
    });
    star.addEventListener("mouseleave", () => {
      starsEl.querySelectorAll(".form-star").forEach((s) => s.classList.remove("form-star-hover"));
    });
  });
}

function renderStarsHtml(rating) {
  return [1, 2, 3, 4, 5].map((i) =>
    `<span class="star ${i <= rating ? "star-filled" : "star-empty"}">★</span>`
  ).join("");
}

function renderStarsReadonly(el, rating) {
  if (!el) return;
  el.innerHTML = [1, 2, 3, 4, 5].map((i) =>
    `<span class="star ${i <= Math.round(rating) ? "star-filled" : "star-empty"}">★</span>`
  ).join("");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}