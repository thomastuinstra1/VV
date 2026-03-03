document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const login = document.getElementById('login').value;
        const Password = document.getElementById('Password').value;

        if (!login || !Password) {
            alert('Please fill in all fields');
            return;
        }

        // Verstuur naar server
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, Password })
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Welkom ${data.Name}!`);
                window.location.href = 'dashboard.html'; // stuur door na login
            } else {
                alert(data.message || 'Er is iets misgegaan');
            }
        } catch (error) {
            console.error(error);
            alert('Er is iets misgegaan');
        }
    });
});