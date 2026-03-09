document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const E_mail = document.getElementById("E_mail").value;
        const Name = document.getElementById("Name").value;
        const Password = document.getElementById("Password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const Postcode = document.getElementById("Postcode").value;

        // Wachtwoord validatie
        if (Password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (Password.length < 6 || !Password.match(/[0-9]/) || !Password.match(/[A-Z]/)) {
            alert('Password must be at least 6 characters, contain a number and an uppercase letter');
            return;
        }

        // Verstuur naar server
        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Name, E_mail, Password, Postcode })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Account aangemaakt!');
                window.location.href = 'inlog.html'; // stuur door naar login
            } else {
                alert(data.message || 'Er is iets misgegaan');
            }
        } catch (error) {
            console.error(error);
            alert('Er is zeker iets misgegaan');
        }
    });
});