let CURRENT_USER_ID;

// Huidige gebruiker ophalen
async function getCurrentUserId() {
  try {
    const res = await fetchWithSpinner('/me');
    if (!res.ok) throw new Error('Kon gebruiker niet ophalen');
    const user = await res.json();
    CURRENT_USER_ID = user.Account_id;
  } catch (err) {
    console.error(err);
  }
}

// Alle gebruikers ophalen (behalve jezelf)
async function loadUsers() {
  try {
    const res = await fetchWithSpinner('/Account');
    if (!res.ok) throw new Error('Kon gebruikers niet ophalen');
    const users = await res.json();

    const list = document.getElementById('users-list');
    list.innerHTML = '';

    users.forEach(user => {
      if (user.Account_id === CURRENT_USER_ID) return; // sla jezelf over

      const li = document.createElement('li');
      li.textContent = `${user.Name} (${user.E_mail})`;
      li.addEventListener('click', () => {
        // Redirect naar chatpagina met partner ID
        window.location.href = `chat.html?partner=${user.Account_id}`;
      });
      list.appendChild(li);
    });

  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await getCurrentUserId();
  await loadUsers();
});