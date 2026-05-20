// js/review-rapport.js
// Laad dit vóór reviews.js en gereedschap-reviews.js
// Voeg toe aan profiel.html, eigenprofiel.html en gereedschap.html:
// <script src="js/review-rapport.js"></script>

// ─── Rapport modal ────────────────────────────────────────────────────────────
(function () {
  // Injecteer modal eenmalig in de DOM
  function injectRapportModal() {
    if (document.getElementById("reviewRapportModal")) return;

    const modal = document.createElement("div");
    modal.id        = "reviewRapportModal";
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

  function closeRapportModal() {
    const modal = document.getElementById("reviewRapportModal");
    if (modal) {
      modal.style.display = "none";
      modal.dataset.reviewId   = "";
      modal.dataset.reviewType = "";
      const reden = document.getElementById("reviewRapportReden");
      if (reden) reden.value = "";
    }
  }

  function openRapportModal(reviewId, reviewType) {
    injectRapportModal();
    const modal = document.getElementById("reviewRapportModal");
    modal.dataset.reviewId   = reviewId;
    modal.dataset.reviewType = reviewType;
    modal.style.display      = "flex";

    // Bind submit eenmalig
    const submitBtn = document.getElementById("reviewRapportSubmit");
    const newBtn    = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);

    newBtn.addEventListener("click", async () => {
      const reden = document.getElementById("reviewRapportReden").value.trim();
      const type  = modal.dataset.reviewType;
      const id    = modal.dataset.reviewId;

      const url = type === 'gereedschap'
        ? `/gereedschap/reviews/${id}/report`
        : `/reviews/${id}/report`;

      try {
        const res  = await fetchWithSpinner(url, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ reden }),
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

  // Globaal beschikbaar maken
  window.openReviewRapportModal = openRapportModal;
})();