document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/mijn-chats');
        if (res.status === 401) {
            window.location.href = 'inlog.html';
            return;
        }

        const partners = await res.json();
        const lijst = document.getElementById('chats-lijst');

        if (!partners.length) {
            lijst.innerHTML = '<p>Je hebt nog geen chats.</p>';
            return;
        }

        partners.forEach(partner => {
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${partner.Afbeelding || '/images/default.jpg'}" alt="${partner.Name}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <a href="chat.html?partner=${partner.Account_id}">${partner.Name}</a>
            `;
            lijst.appendChild(li);
        });

    } catch (err) {
        console.error(err);
    }
});