function showSpinner(show = true) {
    const spinner = document.getElementById('globalSpinner');
    if (!spinner) return;
    spinner.style.display = show ? 'flex' : 'none';
}

let activeRequests = 0;

async function fetchWithSpinner(url, options, delay = 300) {
    let spinnerTimeout;

    activeRequests++;

    spinnerTimeout = setTimeout(() => {
        if (activeRequests > 0) {
            showSpinner(true);
        }
    }, delay);

    try {
        const res = await fetch(url, options);
        return res;
    } catch (err) {
        console.error(err);
        return null;
    } finally {
        clearTimeout(spinnerTimeout);
        activeRequests--;
        if (activeRequests === 0) {
            showSpinner(false);
        }
    }
}

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('success', 'error', 'info');
    toast.classList.add('show', type);

    setTimeout(() => {
        toast.classList.remove('show', type);
    }, duration);
}

function injectFloatingChatHTML() {
    if (document.getElementById('floating-chat-root')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="floating-chat-root" class="floating-chat hidden">
            <button id="floating-chat-toggle" class="floating-chat-toggle" type="button">
                💬
                <span id="floating-chat-count" class="floating-chat-count" style="display:none;">0</span>
            </button>

            <div id="floating-chat-window" class="floating-chat-window hidden">
                <div class="floating-chat-header">
                    <span>Berichten</span>
                    <button id="floating-chat-close" type="button">✕</button>
                </div>

                <div class="floating-chat-body">
                    <div class="floating-chat-sidebar">
                        <div id="floating-chat-contacts"></div>
                    </div>

                    <div class="floating-chat-main">
                        <div id="floating-chat-messages" class="floating-chat-messages">
                            <p class="floating-chat-placeholder">Kies een contact om te chatten</p>
                        </div>

                        <div class="floating-chat-input-area">
                            <input
                                type="text"
                                id="floating-chat-input"
                                placeholder="Typ een bericht..."
                            />
                            <button id="floating-chat-send" type="button">Verstuur</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
}

function loadFakeConversation(name) {
    const messages = document.getElementById('floating-chat-messages');
    if (!messages) return;

    if (name === 'Anna') {
        messages.innerHTML = `
            <div class="floating-chat-message them">Hoi! Is de boormachine nog beschikbaar?</div>
            <div class="floating-chat-message me">Ja, zeker.</div>
        `;
        return;
    }

    if (name === 'Mohamed') {
        messages.innerHTML = `
            <div class="floating-chat-message them">Kan ik de ladder morgen lenen?</div>
            <div class="floating-chat-message me">Ja, dat is prima 👍</div>
        `;
        return;
    }

    messages.innerHTML = `<p class="floating-chat-placeholder">Geen berichten</p>`;
}

function renderTestContacts() {
    const contacts = document.getElementById('floating-chat-contacts');
    if (!contacts) return;

    contacts.innerHTML = `
        <div class="floating-chat-contact active" data-name="Anna">
            <div class="floating-chat-contact-name">Anna</div>
            <div class="floating-chat-contact-last">Boormachine</div>
        </div>
        <div class="floating-chat-contact" data-name="Mohamed">
            <div class="floating-chat-contact-name">Mohamed</div>
            <div class="floating-chat-contact-last">Ladder</div>
        </div>
    `;

    const allContacts = contacts.querySelectorAll('.floating-chat-contact');

    allContacts.forEach(contact => {
        contact.addEventListener('click', () => {
            allContacts.forEach(c => c.classList.remove('active'));
            contact.classList.add('active');

            const name = contact.dataset.name;
            loadFakeConversation(name);
        });
    });

    loadFakeConversation('Anna');
}

document.addEventListener('DOMContentLoaded', () => {
    injectFloatingChatHTML();

    const root = document.getElementById('floating-chat-root');
    const windowEl = document.getElementById('floating-chat-window');
    const toggle = document.getElementById('floating-chat-toggle');
    const closeBtn = document.getElementById('floating-chat-close');
    const count = document.getElementById('floating-chat-count');

    if (!root || !windowEl || !toggle || !closeBtn || !count) return;

    root.classList.remove('hidden');
    count.style.display = 'flex';
    count.textContent = '2';

    renderTestContacts();

    toggle.addEventListener('click', () => {
        windowEl.classList.toggle('hidden');
    });

    closeBtn.addEventListener('click', () => {
        windowEl.classList.add('hidden');
    });
});