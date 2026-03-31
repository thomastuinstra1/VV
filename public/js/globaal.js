function showSpinner(show = true) {
    const spinner = document.getElementById('globalSpinner');
    if (!spinner) return;
    spinner.style.display = show ? 'flex' : 'none';
}

async function fetchWithSpinner(url, options) {
    showSpinner(true);
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(err);
        return null;
    } finally {
        showSpinner(false);
    }
}