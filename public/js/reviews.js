// js/reviews.js
// Voeg toe aan profiel.html: <script src="js/reviews.js"></script>
// Vereist: globaal.js (fetchWithSpinner, showToast)

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const accountId = params.get("id");
  if (!accountId) return;

  await loadReviews(accountId);
  await setupReviewForm(accountId);
});

// ─── Laad en render alle reviews ─────────────────────────────────────────────
async function loadReviews(accountId) {
  injectReviewSection();

  const container = document.getElementById("reviewsList");
  const gemiddeldeEl = document.getElementById("reviewGemiddelde");
  const aantalEl = document.getElementById("reviewAantal");
  if (!container) return;

  try {
    const res = await fetch(`/account/${accountId}/reviews`);
    if (!res.ok) throw new Error();

    const reviews = await res.json();

    // Huidige gebruiker ophalen (voor bewerk/verwijder knoppen)
    let mijnId = null;
    try {
      const meRes = await fetch("/me");
      if (meRes.ok) {
        const me = await meRes.json();
        mijnId = me.Account_id ?? me.id ?? null;
      }
    } catch (_) {}

    // Gemiddelde berekenen
    if (reviews.length > 0) {
      const gem = reviews.reduce((s, r) => s + (r.Rating ?? 0), 0) / reviews.length;
      if (gemiddeldeEl) gemiddeldeEl.textContent = gem.toFixed(1);
      if (aantalEl) aantalEl.textContent = `(${reviews.length} ${reviews.length === 1 ? "review" : "reviews"})`;
      renderStarsReadonly(document.getElementById("reviewStarsGem"), gem);
    } else {
      if (gemiddeldeEl) gemiddeldeEl.textContent = "–";
      if (aantalEl) aantalEl.textContent = "(nog geen reviews)";
    }

    if (reviews.length === 0) {
      container.innerHTML = `<p class="review-empty">Nog geen reviews voor deze gebruiker.</p>`;
      return;
    }

    container.innerHTML = reviews.map((r) => renderReviewCard(r, mijnId)).join("");
    attachReviewActions(container, accountId);
  } catch (err) {
    container.innerHTML = `<p class="review-empty">Reviews konden niet worden geladen.</p>`;
  }
}

function renderReviewCard(r, mijnId) {
  const isOwn = mijnId && Number(mijnId) === Number(r.Auteur_id);
  const datum = r.Datum ? new Date(r.Datum).toLocaleDateString("nl-NL") : "";
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

// ─── Acties: bewerken & verwijderen ──────────────────────────────────────────
function attachReviewActions(container, accountId) {
  container.addEventListener("click", async (e) => {
    // Verwijderen
    if (e.target.closest(".btn-review-delete")) {
      const btn = e.target.closest(".btn-review-delete");
      const reviewId = btn.dataset.reviewId;
      if (!confirm("Weet je zeker dat je deze review wilt verwijderen?")) return;

      try {
        const res = await fetchWithSpinner(`/reviews/${reviewId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Verwijderen mislukt", "error"); return; }
        showToast("Review verwijderd", "success");
        btn.closest(".review-card").remove();
        refreshGemiddelde(container, accountId);
      } catch (_) {
        showToast("Er is iets misgegaan", "error");
      }
    }

    // Bewerken — open inline edit
    if (e.target.closest(".btn-review-edit")) {
      const btn = e.target.closest(".btn-review-edit");
      const card = btn.closest(".review-card");
      const reviewId = btn.dataset.reviewId;
      const huidigRating = parseInt(btn.dataset.rating) || 0;
      const huidigTekst = btn.dataset.tekst || "";
      openInlineEdit(card, reviewId, huidigRating, huidigTekst, accountId);
    }
  });
}

function openInlineEdit(card, reviewId, huidigRating, huidigTekst, accountId) {
  // Verwijder bestaande edit form als die er al is
  const bestaandForm = card.querySelector(".review-edit-form");
  if (bestaandForm) { bestaandForm.remove(); return; }

  let selectedRating = huidigRating;

  const form = document.createElement("div");
  form.className = "review-edit-form";
  form.innerHTML = `
    <div class="review-form-stars" data-selected="${huidigRating}">
      ${[1,2,3,4,5].map((i) =>
        `<span class="form-star ${i <= huidigRating ? "form-star-active" : ""}" data-val="${i}">★</span>`
      ).join("")}
    </div>
    <textarea class="review-edit-textarea" rows="3" placeholder="Schrijf je review...">${huidigTekst}</textarea>
    <div class="review-edit-actions">
      <button class="btn-edit-cancel">Annuleren</button>
      <button class="btn-edit-save">Opslaan</button>
    </div>
  `;

  // Sterren interactie
  const starsEl = form.querySelector(".review-form-stars");
  starsEl.querySelectorAll(".form-star").forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.val);
      starsEl.querySelectorAll(".form-star").forEach((s) =>
        s.classList.toggle("form-star-active", parseInt(s.dataset.val) <= selectedRating)
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

  form.querySelector(".btn-edit-cancel").addEventListener("click", () => form.remove());

  form.querySelector(".btn-edit-save").addEventListener("click", async () => {
    const tekst = form.querySelector(".review-edit-textarea").value.trim();
    if (!selectedRating) { showToast("Geef een beoordeling op", "error"); return; }

    try {
      const res = await fetchWithSpinner(`/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Tekst: tekst, Rating: selectedRating }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Bewerken mislukt", "error"); return; }

      showToast("Review bijgewerkt", "success");
      form.remove();
      // Herlaad de reviews sectie
      loadReviews(accountId);
    } catch (_) {
      showToast("Er is iets misgegaan", "error");
    }
  });

  card.appendChild(form);
}

async function refreshGemiddelde(container, accountId) {
  const cards = container.querySelectorAll(".review-card");
  const gemiddeldeEl = document.getElementById("reviewGemiddelde");
  const aantalEl = document.getElementById("reviewAantal");
  if (cards.length === 0) {
    if (gemiddeldeEl) gemiddeldeEl.textContent = "–";
    if (aantalEl) aantalEl.textContent = "(nog geen reviews)";
    renderStarsReadonly(document.getElementById("reviewStarsGem"), 0);
  }
}

// ─── Review formulier (voor ingelogde leners) ────────────────────────────────
async function setupReviewForm(accountId) {
  // Haal afgeronde uitlenen op waarbij de ingelogde gebruiker de lener is
  // en de verhuurdersAccount_id == accountId, zonder bestaande review
  try {
    const meRes = await fetch("/me");
    if (!meRes.ok) return; // Niet ingelogd → geen formulier tonen
    const me = await meRes.json();
    const mijnId = me.Account_id ?? me.id;

    if (Number(mijnId) === Number(accountId)) return; // Eigen profiel → niet tonen

    // Haal uitgelende items op van deze verhuurder aan mij
    const res = await fetch(`/uitlenen/te-reviewen?verhuurder=${accountId}`);
    if (!res.ok) return;

    const uitlenen = await res.json();
    if (!Array.isArray(uitlenen) || uitlenen.length === 0) return;

    injectReviewForm(uitlenen, accountId);
  } catch (_) {
    // Niet ingelogd of geen uitlenen → stil falen
  }
}

function injectReviewForm(uitlenen, accountId) {
  const section = document.getElementById("reviewsSection");
  if (!section) return;

  let selectedRating = 0;

  const formHtml = `
    <div class="review-form-card" id="reviewFormCard">
      <h3 class="review-form-title">Schrijf een review</h3>

      <label class="review-form-label">Uitleen</label>
      <select id="reviewUitleenSelect" class="review-form-select">
        ${uitlenen.map((u) =>
          `<option value="${u.Uitleen_id}">${escapeHtml(u.gereedschapNaam || `Uitleen #${u.Uitleen_id}`)} — ${new Date(u.EindDatum).toLocaleDateString("nl-NL")}</option>`
        ).join("")}
      </select>

      <label class="review-form-label">Beoordeling</label>
      <div class="review-form-stars" id="reviewFormStars">
        ${[1,2,3,4,5].map((i) => `<span class="form-star" data-val="${i}">★</span>`).join("")}
      </div>

      <label class="review-form-label">Tekst <span class="review-form-optional">(optioneel)</span></label>
      <textarea id="reviewFormTekst" class="review-form-textarea" rows="4" placeholder="Deel je ervaring met deze uitlener..."></textarea>

      <button id="reviewFormSubmit" class="btn-review-submit">Review plaatsen</button>
    </div>
  `;

  section.insertAdjacentHTML("beforeend", formHtml);

  // Sterren interactie
  const starsEl = document.getElementById("reviewFormStars");
  starsEl.querySelectorAll(".form-star").forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.val);
      starsEl.querySelectorAll(".form-star").forEach((s) =>
        s.classList.toggle("form-star-active", parseInt(s.dataset.val) <= selectedRating)
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

  document.getElementById("reviewFormSubmit").addEventListener("click", async () => {
    const uitleenId = document.getElementById("reviewUitleenSelect").value;
    const tekst = document.getElementById("reviewFormTekst").value.trim();

    if (!selectedRating) { showToast("Geef een sterrenbeoordeling op", "error"); return; }

    const selectedUitleen = uitlenen.find((u) => String(u.Uitleen_id) === String(uitleenId));

    try {
      const res = await fetchWithSpinner("/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Uitleen_id: uitleenId,
          Ontvanger_id: accountId,
          Tekst: tekst,
          Rating: selectedRating,
        }),
      });

      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Plaatsen mislukt", "error"); return; }

      showToast("Review geplaatst! 🎉", "success");

      // Verberg het formulier na plaatsen
      document.getElementById("reviewFormCard")?.remove();

      // Herlaad reviews
      loadReviews(accountId);
    } catch (_) {
      showToast("Er is iets misgegaan", "error");
    }
  });
}

// ─── Injecteer de reviews sectie in de DOM ───────────────────────────────────
function injectReviewSection() {
  if (document.getElementById("reviewsSection")) return;

  const shell = document.querySelector(".profile-shell");
  if (!shell) return;

  const section = document.createElement("section");
  section.id = "reviewsSection";
  section.className = "profile-listings-card reviews-section";
  section.innerHTML = `
    <div class="section-heading profile-section-heading">
      <div>
        <p class="section-kicker">Beoordelingen</p>
        <h2>Reviews</h2>
      </div>
      <div class="review-summary">
        <div id="reviewStarsGem" class="review-summary-stars"></div>
        <span id="reviewGemiddelde" class="review-summary-score">–</span>
        <span id="reviewAantal" class="review-summary-count"></span>
      </div>
    </div>
    <div id="reviewsList" class="reviews-list"></div>
  `;

  shell.appendChild(section);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}