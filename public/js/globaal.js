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

function updateNavAvatar(gebruiker) {
  const avatar = document.getElementById('navAvatar');
  if (!avatar || !gebruiker) return;

  if (gebruiker.Afbeelding) {
    avatar.innerHTML = `<img src="${gebruiker.Afbeelding}" alt="Profielfoto" style="width:100%;height:100%;object-fit:cover;" />`;
  } else if (gebruiker.Name) {
    const delen = gebruiker.Name.trim().split(' ');
    const initialen = delen.length > 1
      ? delen[0][0] + delen[delen.length - 1][0]
      : delen[0].substring(0, 2);
    avatar.innerHTML = `<span style="font-size:13px;font-weight:500;color:#534AB7;">${initialen.toUpperCase()}</span>`;
  }
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

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('inlog') || path.includes('registre')) return;
    injectFloatingChatHTML();
});