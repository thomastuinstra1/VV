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
        FC_CURRENT_USER_ID = me.Account_id ?? me.id ?? null;

        if (!FC_CURRENT_USER_ID) {
            root.classList.add('hidden');
            return;
        }

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
        if (!Array.isArray(FC_CHATS)) FC_CHATS = [];

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
        item.className =
            'floating-chat-contact' +
            (Number(chat.Chat_id) === Number(FC_SELECTED_CHAT_ID) ? ' active' : '');

        const unread = Number(chat.unreadCount || 0);
        const naam = chat.Name || 'Onbekend';
        const gereedschapNaam = chat.Gereedschap_naam || '';
        const partnerId = encodeURIComponent(chat.Account_id || '');
        const toolId = encodeURIComponent(chat.Gereedschap_id || '');

        item.innerHTML = `
            <div class="floating-chat-contact-top">
                <a
                    class="floating-chat-contact-name"
                    href="chat.html?partner=${partnerId}&tool=${toolId}"
                    title="Open volledige chat"
                >
                    ${escapeHtml(naam)}
                </a>
                ${unread > 0 ? `<span class="floating-chat-contact-badge">${unread}</span>` : ''}
            </div>
            <div class="floating-chat-contact-last">${escapeHtml(gereedschapNaam)}</div>
        `;

        item.addEventListener('click', async (e) => {
            if (e.target.closest('.floating-chat-contact-name')) return;

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

    const unreadTotal = chats.reduce((sum, chat) => {
        return sum + Number(chat.unreadCount || 0);
    }, 0);

    if (unreadTotal > 0) {
        countEl.style.display = 'flex';
        countEl.textContent = String(unreadTotal);
        countEl.classList.add('ping');
        countEl.setAttribute('aria-label', `${unreadTotal} ongelezen berichten`);
    } else {
        countEl.style.display = 'none';
        countEl.textContent = '0';
        countEl.classList.remove('ping');
        countEl.removeAttribute('aria-label');
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
    const senderId = message.senderId ?? message.Sender_id ?? null;
    const isMe = Number(senderId) === Number(FC_CURRENT_USER_ID);

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
        const incomingChatId = message.Chat_id ?? message.chatId ?? null;

        if (Number(incomingChatId) === Number(FC_SELECTED_CHAT_ID)) {
            await addFloatingMessageToUI(message);
        }

        await loadFloatingChats();
    });

    FC_SOCKET.on('disconnect', () => {
        console.log('Floating chat verbinding verbroken');
    });
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (match) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return map[match];
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('inlog') || path.includes('registre')) return;
    initFloatingChat();
});