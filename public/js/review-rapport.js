// js/review-rapport.js

(function () {

  // ─── Haal ingelogde gebruiker op via /me ──────────────────────────────────
  async function getIngelogdeGebruiker() {
    try {
      const res = await fetch('/me');
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // ─── Modal injecteren ─────────────────────────────────────────────────────
  function injectRapportModal() {
    if (document.getElementById("reviewRapportModal")) return;

    const modal = document.createElement("div");
    modal.id = "reviewRapportModal";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>Review rapporteren</h2>
          <button class="modal-close" id="reviewRapportClose" aria-label="Sluiten">&times;</button>
        </div>
        <p class="modal-text">Waarom wil je deze review rapporteren?</p>
        <textarea id="reviewRapportReden" rows="4" placeholder="Beschrijf het probleem (optioneel)..."></textarea>
        <div class="modal-actions">
          <button class="btn-cancel" id="reviewRapportCancel">Annuleren</button>
          <button class="btn-submit" id="reviewRapportSubmit">Verstuur rapport</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeRapportModal();
    });
    document.getElementById("reviewRapportClose").addEventListener("click", closeRapportModal);
    document.getElementById("reviewRapportCancel").addEventListener("click", closeRapportModal);
  }

  // ─── Modal sluiten ────────────────────────────────────────────────────────
  function closeRapportModal() {
    const modal = document.getElementById("reviewRapportModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.dataset.reviewId = "";
    modal.dataset.reviewType = "";
    const reden = document.getElementById("reviewRapportReden");
    if (reden) reden.value = "";
  }

  // ─── Modal openen (met checks) ────────────────────────────────────────────
  async function openRapportModal(reviewId, reviewType, reviewAuteurId) {

    // 1. Ingelogd?
    const gebruiker = await getIngelogdeGebruiker();
    if (!gebruiker) {
      showToast("Je moet ingelogd zijn om te rapporteren", "error");
      return;
    }

    // 2. Eigen review?
    if (reviewAuteurId && String(reviewAuteurId) === String(gebruiker.id)) {
      showToast("Je kunt je eigen review niet rapporteren", "error");
      return;
    }

    // 3. Al gerapporteerd + 4. Interactie gehad → server-side check
    try {
      const url = reviewType === "gereedschap"
        ? `/gereedschap/reviews/${reviewId}/mag-rapporteren`
        : `/reviews/${reviewId}/mag-rapporteren`;

      const res = await fetchWithSpinner(url, { method: "GET" });

      if (!res || !res.ok) {
        showToast("Kon niet controleren of je mag rapporteren", "error");
        return;
      }

      const data = await res.json();

      if (!data.magRapporteren) {
        showToast(data.reden || "Je kunt deze review niet rapporteren", "error");
        return;
      }
    } catch (_) {
      showToast("Er is iets misgegaan bij de controle", "error");
      return;
    }

    // ── Alle checks geslaagd → modal tonen ──
    injectRapportModal();

    const modal = document.getElementById("reviewRapportModal");
    modal.dataset.reviewId = reviewId;
    modal.dataset.reviewType = reviewType;
    modal.style.display = "flex";

    // Submit knop opnieuw binden (voorkomt dubbele listeners)
    const submitBtn = document.getElementById("reviewRapportSubmit");
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);

    newBtn.addEventListener("click", async () => {
      const reden = document.getElementById("reviewRapportReden").value.trim();
      const type = modal.dataset.reviewType;
      const id = modal.dataset.reviewId;

      const url = type === "gereedschap"
        ? `/gereedschap/reviews/${id}/report`
        : `/reviews/${id}/report`;

      try {
        const res = await fetchWithSpinner(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reden }),
        });
        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || "Rapporteren mislukt", "error");
          return;
        }

        showToast("Review gerapporteerd", "success");
        closeRapportModal();
      } catch (_) {
        showToast("Er is iets misgegaan", "error");
      }
    });
  }

  // ─── Globaal beschikbaar maken ────────────────────────────────────────────
  window.openReviewRapportModal = openRapportModal;

})();