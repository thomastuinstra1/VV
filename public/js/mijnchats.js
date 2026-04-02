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
            lijst.innerHTML = '<p>Je hebt nog geen chats.</p>';
            return;
        }

        chats.forEach(chat => {
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${chat.Afbeelding || '/images/default.jpg'}" alt="${chat.Name}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <a href="chat.html?partner=${chat.Account_id}&tool=${chat.Gereedschap_id}">${chat.Name}</a>
                <span class="gereedschap-naam">${chat.Gereedschap_naam || ''}</span>
                <button onclick="verwijderChat(${chat.Chat_id}, this)">🗑️</button>
            `;
            lijst.appendChild(li);
        });

    } catch (err) {
        console.error(err);
    }
});

window.verwijderChat = async function(chatId, btn) {
    if (!confirm('Weet je zeker dat je deze chat wilt verwijderen?')) return;

    try {
        const res = await fetchWithSpinner(`/chat/${chatId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Verwijderen mislukt');

        btn.closest('li').remove();

        const lijst = document.getElementById('chats-lijst');
        if (!lijst.children.length) {
            lijst.innerHTML = '<p>Je hebt nog geen chats.</p>';
        }
    } catch (err) {
        console.error(err);
        showToast('Er is iets misgegaan bij het verwijderen.', 'error');
    }
};