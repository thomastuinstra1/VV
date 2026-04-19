document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetchWithSpinner('/mijn-chats');

    if (res.status === 401) {
      window.location.href = 'inlog.html';
      return;
    }

    const chats = await res.json();
    const lijst = document.getElementById('chats-lijst');

    if (!chats.length) {
      lijst.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">Nog geen chats</div>
          <div class="empty-text">Je hebt nog geen gesprekken gestart.</div>
        </div>
      `;
      return;
    }

    lijst.innerHTML = '';

    chats.forEach(chat => {
      const item = document.createElement('div');
      item.className = 'chat-item';

      const chatLink = `chat.html?partner=${chat.Account_id}&tool=${chat.Gereedschap_id}`;
      const afbeelding = chat.Afbeelding || '/images/default.jpg';
      const naam = chat.Name || 'Onbekende gebruiker';
      const gereedschapNaam = chat.Gereedschap_naam || 'Geen gereedschap';
      const tijd = formatChatTime(chat.Laatst_bijgewerkt || chat.updated_at || chat.created_at);

      item.innerHTML = `
        <div class="chat-left">
          <div class="chat-avatar-wrap">
            <img src="${afbeelding}" alt="${naam}" class="chat-avatar">
          </div>

          <div class="chat-info">
            <div class="chat-name">${escapeHtml(naam)}</div>
            <div class="chat-last">${escapeHtml(gereedschapNaam)}</div>
          </div>
        </div>

        <div class="chat-right">
          <div class="chat-meta">${tijd}</div>
          <button class="chat-delete-btn" type="button" aria-label="Verwijder chat">🗑️</button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.chat-delete-btn')) return;
        window.location.href = chatLink;
      });

      const deleteBtn = item.querySelector('.chat-delete-btn');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await verwijderChat(chat.Chat_id, item);
      });

      lijst.appendChild(item);
    });

  } catch (err) {
    console.error(err);
    const lijst = document.getElementById('chats-lijst');
    lijst.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Er ging iets mis</div>
        <div class="empty-text">De chats konden niet worden geladen.</div>
      </div>
    `;
  }
});

async function verwijderChat(chatId, itemElement) {
  if (!confirm('Weet je zeker dat je deze chat wilt verwijderen?')) return;

  try {
    const res = await fetchWithSpinner(`/chat/${chatId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Verwijderen mislukt');

    itemElement.remove();

    const lijst = document.getElementById('chats-lijst');
    if (!lijst.children.length) {
      lijst.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">Nog geen chats</div>
          <div class="empty-text">Je hebt nog geen gesprekken gestart.</div>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
    showToast('Er is iets misgegaan bij het verwijderen.', 'error');
  }
}

function formatChatTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (match) => {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return escapeMap[match];
  });
}