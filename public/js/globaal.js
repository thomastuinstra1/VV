function showSpinner(show = true) {
    const spinner = document.getElementById('globalSpinner');
    if (!spinner) return;
    spinner.style.display = show ? 'flex' : 'none';
}

let activeRequests = 0;

function showSpinner(show = true) {
    const spinner = document.getElementById('globalSpinner');
    if (!spinner) return;

    spinner.style.display = show ? 'flex' : 'none';
}

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

        if (!res.ok) throw new Error(`Fetch error: ${res.status}`);

        return await res.json();
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