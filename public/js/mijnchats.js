document.addEventListener('DOMContentLoaded', async () => {
  const lijst = document.getElementById('chats-lijst');

  try {
    const res = await fetchWithSpinner('/mijn-chats');

    if (res.status === 401) {
      window.location.href = 'inlog.html';
      return;
    }

    if (!res.ok) {
      throw new Error('Chats konden niet worden geladen.');
    }

    const chats = await res.json();

    if (!Array.isArray(chats) || chats.length === 0) {
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

      const chatLink = `chat.html?partner=${encodeURIComponent(chat.Account_id)}&tool=${encodeURIComponent(chat.Gereedschap_id)}`;
      const naam = (chat.Name || 'Onbekende gebruiker').trim();
      const initial = naam.charAt(0).toUpperCase() || '?';
      const gereedschapNaam = chat.Gereedschap_naam || 'Geen gereedschap';
      const tijd = formatChatTime(chat.Laatst_bijgewerkt || chat.updated_at || chat.created_at);

      const afbeelding = chat.Afbeelding && chat.Afbeelding.trim() !== ''
        ? chat.Afbeelding
        : null;

      const avatarHtml = afbeelding
        ? `<img src="${escapeHtml(afbeelding)}" alt="${escapeHtml(naam)}" class="chat-avatar" />`
        : `<div class="chat-avatar-fallback">${escapeHtml(initial)}</div>`;

      item.innerHTML = `
        <div class="chat-left">
          ${avatarHtml}

          <div class="chat-info">
            <div class="chat-name">${escapeHtml(naam)}</div>
            <div class="chat-last">${escapeHtml(gereedschapNaam)}</div>
          </div>
        </div>

        <div class="chat-right">
          <div class="chat-meta">${escapeHtml(tijd)}</div>
          <button class="chat-delete-btn" type="button" aria-label="Verwijder chat">🗑️</button>
        </div>
      `;

      const avatarImg = item.querySelector('.chat-avatar');
      if (avatarImg) {
        avatarImg.addEventListener('error', () => {
          avatarImg.outerHTML = `<div class="chat-avatar-fallback">${escapeHtml(initial)}</div>`;
        });
      }

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

    if (!res.ok) {
      throw new Error('Verwijderen mislukt');
    }

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