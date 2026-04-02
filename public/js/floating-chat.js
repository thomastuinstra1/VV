let FC_CURRENT_USER_ID = null;
let FC_SELECTED_CHAT_ID = null;
let FC_SOCKET = null;
let FC_CHATS = [];

async function initFloatingChat() {
    const root = document.getElementById('floating-chat-root');
    const windowEl = document.getElementById('floating-chat-window');
    const toggle = document.getElementById('floating-chat-toggle');
    const closeBtn = document.getElementById('floating-chat-close');
    const sendBtn = document.getElementById('floating-chat-send');
    const input = document.getElementById('floating-chat-input');

    if (!root || !windowEl || !toggle || !closeBtn || !sendBtn || !input) return;

    try {
        const meRes = await fetchWithSpinner('/me');
        if (!meRes || meRes.status === 401 || !meRes.ok) {
            root.classList.add('hidden');
            return;
        }

        const me = await meRes.json();
        FC_CURRENT_USER_ID = me.Account_id;

        root.classList.remove('hidden');

        await loadFloatingChats();
        initFloatingSocket();

        toggle.addEventListener('click', () => {
            windowEl.classList.toggle('hidden');
        });

        closeBtn.addEventListener('click', () => {
            windowEl.classList.add('hidden');
        });

        sendBtn.addEventListener('click', sendFloatingMessage);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendFloatingMessage();
            }
        });
    } catch (err) {
        console.error('Floating chat init failed:', err);
        root.classList.add('hidden');
    }
}

async function loadFloatingChats() {
    try {
        const res = await fetchWithSpinner('/mijn-chats');
        if (!res || !res.ok) throw new Error('Chats laden mislukt');

        FC_CHATS = await res.json();
        renderFloatingChats(FC_CHATS);
        updateFloatingCounter(FC_CHATS);
    } catch (err) {
        console.error(err);
    }
}

function renderFloatingChats(chats) {
    const contacts = document.getElementById('floating-chat-contacts');
    if (!contacts) return;

    contacts.innerHTML = '';

    if (!chats.length) {
        contacts.innerHTML = `<p class="floating-chat-placeholder" style="padding:12px;">Nog geen chats</p>`;
        return;
    }

    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'floating-chat-contact' + (chat.Chat_id === FC_SELECTED_CHAT_ID ? ' active' : '');

        const unread = Number(chat.unreadCount || 0);

        item.innerHTML = `
            <div class="floating-chat-contact-name">${chat.Name || 'Onbekend'}</div>
            <div class="floating-chat-contact-last">${chat.Gereedschap_naam || ''}</div>
            ${unread > 0 ? `<span class="floating-chat-contact-badge">${unread}</span>` : ''}
        `;

        item.addEventListener('click', async () => {
            FC_SELECTED_CHAT_ID = chat.Chat_id;
            renderFloatingChats(FC_CHATS);

            await loadFloatingMessages(chat.Chat_id);

            if (FC_SOCKET) {
                FC_SOCKET.emit('join_chat', { chatId: chat.Chat_id });
            }
        });

        contacts.appendChild(item);
    });
}

function updateFloatingCounter(chats) {
    const countEl = document.getElementById('floating-chat-count');
    if (!countEl) return;

    const unreadTotal = chats.reduce((sum, chat) => sum + Number(chat.unreadCount || 0), 0);

    if (unreadTotal > 0) {
        countEl.style.display = 'flex';
        countEl.textContent = unreadTotal;
    } else {
        countEl.style.display = 'none';
        countEl.textContent = '0';
    }
}

async function loadFloatingMessages(chatId) {
    const messagesBox = document.getElementById('floating-chat-messages');
    if (!messagesBox) return;

    messagesBox.innerHTML = '';

    try {
        const res = await fetchWithSpinner(`/messages/chat/${chatId}`);
        if (!res || !res.ok) throw new Error('Berichten ophalen mislukt');

        const messages = await res.json();

        if (!messages.length) {
            messagesBox.innerHTML = `<p class="floating-chat-placeholder">Nog geen berichten</p>`;
            return;
        }

        for (const msg of messages) {
            await addFloatingMessageToUI(msg);
        }
    } catch (err) {
        console.error(err);
        messagesBox.innerHTML = `<p class="floating-chat-placeholder">Kon berichten niet laden</p>`;
    }
}

async function addFloatingMessageToUI(message) {
    const box = document.getElementById('floating-chat-messages');
    if (!box) return;

    const div = document.createElement('div');
    const isMe = message.senderId === FC_CURRENT_USER_ID || message.Sender_id === FC_CURRENT_USER_ID;
    div.className = `floating-chat-message ${isMe ? 'me' : 'them'}`;

    if (!message.type || message.type === 'text') {
        div.textContent = message.content || message.Content || '';
    } else if (message.type === 'appointment') {
        div.textContent = '📅 Afspraakverzoek';
    } else {
        div.textContent = message.content || message.Content || '';
    }

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function sendFloatingMessage() {
    const input = document.getElementById('floating-chat-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    if (!FC_SOCKET || !FC_SELECTED_CHAT_ID) {
        showToast('Kies eerst een chat', 'error');
        return;
    }

    FC_SOCKET.emit('send_message', {
        chatId: FC_SELECTED_CHAT_ID,
        content
    });

    input.value = '';
}

function initFloatingSocket() {
    if (!FC_CURRENT_USER_ID) return;

    FC_SOCKET = io('https://gereedschapspunt.student.open-ict.hu', {
        auth: { userId: FC_CURRENT_USER_ID }
    });

    FC_SOCKET.on('connect', () => {
        console.log(`Floating chat verbonden als user ${FC_CURRENT_USER_ID}`);

        if (FC_SELECTED_CHAT_ID) {
            FC_SOCKET.emit('join_chat', { chatId: FC_SELECTED_CHAT_ID });
        }
    });

    FC_SOCKET.on('receive_message', async (message) => {
        if (message.Chat_id === FC_SELECTED_CHAT_ID || message.chatId === FC_SELECTED_CHAT_ID) {
            await addFloatingMessageToUI(message);
        }

        await loadFloatingChats();
    });

    FC_SOCKET.on('disconnect', () => {
        console.log('Floating chat verbinding verbroken');
    });
}

// ── Alleen initialiseren op pagina's die niet inlog/registratie zijn ──
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('inlog') || path.includes('registre')) return;
    initFloatingChat();
});