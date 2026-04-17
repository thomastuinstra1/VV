document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch('/auth-status');
  const { ingelogd } = await res.json();

  document.querySelectorAll("[data-auth='true']").forEach((el) => {
    el.style.display = ingelogd ? "" : "none";
  });

  document.querySelectorAll("[data-guest='true']").forEach((el) => {
    el.style.display = ingelogd ? "none" : "";
  });
  // NIEUW: profielfoto ophalen
  if (ingelogd) {
    const meRes = await fetch('/me');
    if (meRes.ok) {
      const gebruiker = await meRes.json();
      updateNavAvatar(gebruiker);
    }
  }
});