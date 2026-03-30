document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/mijn-chats');
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
            `;
            lijst.appendChild(li);
        });

    } catch (err) {
        console.error(err);
    }
});