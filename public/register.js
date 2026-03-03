
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 6 && !password.match(/[0-9]/) && !password.match(/[A-Z]/)) {
            alert('Password must be at least 6 characters and contain at least one uppercase letter and one number');
            return;
        }
        
        console.log('Registration successful:', { email, username, password });
      
    });
});