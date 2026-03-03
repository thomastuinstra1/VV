document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.querySelector('input[type="email"]').value;
            const password = document.querySelector('input[type="password"]').value;
            
            if (email && password) {

                if (email.includes('@') && password.length >= 6 && password.match(/[0-9]/) && password.match(/[A-Z]/)) {
                        console.log('Login attempt:', email);
                        alert('Login successful!');
                } else {
                    alert('Invalid email or password (min 6 characters, must include a number and an uppercase letter)');
                }
            } else {
                alert('Please fill in all fields');
            }
        });
    }
});


