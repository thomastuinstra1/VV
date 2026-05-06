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

// -----------------------
// NAV UNREAD BADGE
// -----------------------
async function updateNavUnreadBadge() {
    const badge = document.getElementById('navUnreadBadge');
    if (!badge) return;

    try {
        const res = await fetch('/mijn-chats');
        if (!res || !res.ok) return;

        const chats = await res.json();
        if (!Array.isArray(chats)) return;

        const total = chats.reduce((sum, chat) => {
            return sum + Number(chat.unreadCount || 0);
        }, 0);

        if (total > 0) {
            badge.textContent = total > 99 ? '99+' : String(total);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        console.error('Badge laden mislukt:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('inlog') || path.includes('registre')) return;

    updateNavUnreadBadge();
    setInterval(updateNavUnreadBadge, 30000);
});

const hamburger = document.getElementById('hamburger');
const mainNav = document.getElementById('mainNav');

hamburger.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-container')) {
        mainNav.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', false);
    }
});