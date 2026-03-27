document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch('/auth-status');
  const { ingelogd } = await res.json();

  document.querySelectorAll("[data-auth='true']").forEach((el) => {
    el.style.display = ingelogd ? "" : "none";
  });
});