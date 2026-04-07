document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const role = document.getElementById('role').value;
            const password = document.getElementById('password').value;
            
            const registerBtn = registerForm.querySelector('button');
            const originalBtnText = registerBtn.innerText;
            
            registerBtn.innerText = 'Creating account...';
            registerBtn.disabled = true;
            
            try {
                const response = await fetch('http://localhost:5000/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, role, password })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    alert('Registration successful! Please login.');
                    window.location.href = 'index.html';
                } else {
                    alert(data.message || 'Registration failed!');
                }
            } catch (err) {
                console.error(err);
                alert('Could not connect to server.');
            } finally {
                registerBtn.innerText = originalBtnText;
                registerBtn.disabled = false;
            }
        });
    }
});
