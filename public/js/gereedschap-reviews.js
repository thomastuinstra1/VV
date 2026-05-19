
// js/gereedschap-reviews.js
// Voeg toe aan gereedschap.html: <script src="js/gereedschap-reviews.js"></script>
// Vereist: globaal.js geladen voor dit script

document.addEventListener("DOMContentLoaded", async () => {
  const params        = new URLSearchParams(window.location.search);
  const gereedschapId = params.get("id");
  if (!gereedschapId) return;

  // Ingelogde gebruiker ophalen
  let mijnId = null;
  try {
    const meRes = await fetch("/me");
    if (meRes.ok) {
      const me = await meRes.json();
      mijnId = me.Account_id ?? me.id ?? null;
    }
  } catch (_) {}

  await loadGereedschapReviews(gereedschapId, mijnId);

  if (mijnId) {
    await setupGereedschapReviewForm(gereedschapId, mijnId);
  }
});

// ─── Reviews laden & renderen ─────────────────────────────────────────────────
async function loadGereedschapReviews(gereedschapId, mijnId) {
  injectGereedschapReviewSection();

  const container    = document.getElementById("gereedschapReviewsList");
  const gemiddeldeEl = document.getElementById("gereedschapGemiddelde");
  const aantalEl     = document.getElementById("gereedschapAantal");
  const starsEl      = document.getElementById("gereedschapStarsGem");

  try {
    const res  = await fetch(`/gereedschap/${gereedschapId}/reviews`);
    if (!res.ok) throw new Error();
    const data = await res.json();

    // Gemiddelde & sterren
    if (data.gemiddelde) {
      if (gemiddeldeEl) gemiddeldeEl.textContent = data.gemiddelde.toFixed(1);
      if (aantalEl) aantalEl.textContent = `(${data.aantal} ${data.aantal === 1 ? "beoordeling" : "beoordelingen"})`;
      renderStarsReadonly(starsEl, data.gemiddelde);

      // Ook de sterren tonen bij de toolnaam bovenaan de pagina
      injectSummaryBadge(data.gemiddelde, data.aantal);
    } else {
      if (gemiddeldeEl) gemiddeldeEl.textContent = "–";
      if (aantalEl) aantalEl.textContent = "(nog geen beoordelingen)";
    }

    if (!data.reviews || data.reviews.length === 0) {
      container.innerHTML = `<p class="review-empty">Nog geen beoordelingen voor dit gereedschap.</p>`;
      return;
    }

    container.innerHTML = data.reviews.map((r) => renderGereedschapReviewCard(r, mijnId)).join("");
    attachGereedschapReviewActions(container, gereedschapId);
  } catch (_) {
    container.innerHTML = `<p class="review-empty">Beoordelingen konden niet worden geladen.</p>`;
  }
}

function renderGereedschapReviewCard(r, mijnId) {
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

function attachGereedschapReviewActions(container, gereedschapId) {
  container.addEventListener("click", async (e) => {
    if (e.target.closest(".btn-review-delete")) {
      const btn      = e.target.closest(".btn-review-delete");
      const reviewId = btn.dataset.reviewId;
      if (!confirm("Weet je zeker dat je deze beoordeling wilt verwijderen?")) return;

      try {
        const res  = await fetchWithSpinner(`/gereedschap/reviews/${reviewId}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Verwijderen mislukt", "error"); return; }
        showToast("Beoordeling verwijderd", "success");
        btn.closest(".review-card").remove();

        // Herlaad voor nieuw gemiddelde
        let mijnId = null;
        try { const me = await (await fetch("/me")).json(); mijnId = me.Account_id ?? me.id; } catch (_) {}
        document.getElementById("gereedschapReviewsSection")?.remove();
        await loadGereedschapReviews(gereedschapId, mijnId);
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
      openGereedschapInlineEdit(card, reviewId, huidigRating, huidigTekst, gereedschapId);
    }
  });
}

function openGereedschapInlineEdit(card, reviewId, huidigRating, huidigTekst, gereedschapId) {
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
      const res  = await fetchWithSpinner(`/gereedschap/reviews/${reviewId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ Tekst: tekst, Rating: selectedRating }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Bewerken mislukt", "error"); return; }

      showToast("Beoordeling bijgewerkt", "success");
      form.remove();
      let mijnId = null;
      try { const me = await (await fetch("/me")).json(); mijnId = me.Account_id ?? me.id; } catch (_) {}
      document.getElementById("gereedschapReviewsSection")?.remove();
      await loadGereedschapReviews(gereedschapId, mijnId);
    } catch (_) {
      showToast("Er is iets misgegaan", "error");
    }
  });

  card.appendChild(form);
}

// ─── Review formulier ─────────────────────────────────────────────────────────
async function setupGereedschapReviewForm(gereedschapId, mijnId) {
  try {
    const res = await fetch(`/gereedschap/${gereedschapId}/uitleen-te-reviewen`);
    if (!res.ok) return;
    const uitlenen = await res.json();
    if (!Array.isArray(uitlenen) || uitlenen.length === 0) return;

    injectGereedschapReviewForm(uitlenen, gereedschapId, mijnId);
  } catch (_) {}
}

function injectGereedschapReviewForm(uitlenen, gereedschapId, mijnId) {
  const section = document.getElementById("gereedschapReviewsSection");
  if (!section || document.getElementById("gereedschapReviewFormCard")) return;

  let selectedRating = 0;

  const formHtml = `
    <div class="review-form-card" id="gereedschapReviewFormCard">
      <h3 class="review-form-title">Beoordeel dit gereedschap</h3>

      ${uitlenen.length > 1 ? `
        <label class="review-form-label">Uitleen</label>
        <select class="review-form-select" id="gereedschapUitleenSelect">
          ${uitlenen.map((u) =>
            `<option value="${u.Uitleen_id}">Uitleen — ${new Date(u.EindDatum).toLocaleDateString("nl-NL")}</option>`
          ).join("")}
        </select>
      ` : `<input type="hidden" id="gereedschapUitleenSelect" value="${uitlenen[0].Uitleen_id}">`}

      <label class="review-form-label">Beoordeling</label>
      <div class="review-form-stars" id="gereedschapFormStars">
        ${[1,2,3,4,5].map((i) => `<span class="form-star" data-val="${i}">★</span>`).join("")}
      </div>

      <label class="review-form-label">Tekst <span class="review-form-optional">(optioneel)</span></label>
      <textarea class="review-form-textarea" id="gereedschapFormTekst" rows="4" placeholder="Hoe was het gereedschap?"></textarea>

      <button class="btn-review-submit" id="gereedschapFormSubmit">Beoordeling plaatsen</button>
    </div>
  `;

  section.insertAdjacentHTML("beforeend", formHtml);

  setupStarInteraction(
    document.getElementById("gereedschapFormStars"),
    (val) => { selectedRating = val; }
  );

  document.getElementById("gereedschapFormSubmit").addEventListener("click", async () => {
    const uitleenId = document.getElementById("gereedschapUitleenSelect").value;
    const tekst     = document.getElementById("gereedschapFormTekst").value.trim();

    if (!selectedRating) { showToast("Geef een sterrenbeoordeling op", "error"); return; }

    try {
      const res  = await fetchWithSpinner(`/gereedschap/${gereedschapId}/reviews`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ Uitleen_id: uitleenId, Tekst: tekst, Rating: selectedRating }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Plaatsen mislukt", "error"); return; }

      showToast("Beoordeling geplaatst! 🎉", "success");
      document.getElementById("gereedschapReviewFormCard")?.remove();

      document.getElementById("gereedschapReviewsSection")?.remove();
      await loadGereedschapReviews(gereedschapId, mijnId);
    } catch (_) {
      showToast("Er is iets misgegaan", "error");
    }
  });
}

// ─── DOM injectie ─────────────────────────────────────────────────────────────
function injectGereedschapReviewSection() {
  if (document.getElementById("gereedschapReviewsSection")) return;

  // Voeg de sectie toe na .tool-detail-section
  const detailSection = document.querySelector(".tool-detail-section");
  if (!detailSection) return;

  const section = document.createElement("section");
  section.id        = "gereedschapReviewsSection";
  section.className = "gereedschap-reviews-section";
  section.innerHTML = `
    <div class="container">
      <div class="gereedschap-reviews-inner">
        <div class="gereedschap-reviews-heading">
          <div>
            <p class="section-kicker">Beoordelingen</p>
            <h2>Wat leners zeggen</h2>
          </div>
          <div class="review-summary">
            <div id="gereedschapStarsGem" class="review-summary-stars"></div>
            <span id="gereedschapGemiddelde" class="review-summary-score">–</span>
            <span id="gereedschapAantal" class="review-summary-count"></span>
          </div>
        </div>
        <div id="gereedschapReviewsList" class="reviews-list"></div>
      </div>
    </div>
  `;

  detailSection.insertAdjacentElement("afterend", section);
}

// Klein sterren-badge naast de toolnaam bovenaan
function injectSummaryBadge(gemiddelde, aantal) {
  if (document.getElementById("toolRatingBadge")) return;
  const toolName = document.getElementById("toolName");
  if (!toolName) return;

  const badge = document.createElement("div");
  badge.id        = "toolRatingBadge";
  badge.className = "tool-rating-badge";
  badge.innerHTML = `
    <span class="tool-rating-stars">${renderStarsHtml(Math.round(gemiddelde))}</span>
    <span class="tool-rating-score">${gemiddelde.toFixed(1)}</span>
    <a href="#gereedschapReviewsSection" class="tool-rating-count">(${aantal} ${aantal === 1 ? "beoordeling" : "beoordelingen"})</a>
  `;

  toolName.insertAdjacentElement("afterend", badge);
}

// ─── Gedeelde helpers (ook gebruikt in reviews.js — geen dubbele declaraties) ──

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
  el.innerHTML = renderStarsHtml(Math.round(rating));
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}