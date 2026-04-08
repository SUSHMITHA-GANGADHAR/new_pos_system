document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const loginBtn = loginForm.querySelector('button');
            const originalBtnText = loginBtn.innerText;
            
            loginBtn.innerText = 'Logging in...';
            loginBtn.disabled = true;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Role based redirect
                    if (data.user.role === 'admin') {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'staff_dashboard.html';
                    }
                } else {
                    alert(data.message || 'Login failed!');
                }
            } catch (err) {
                console.error(err);
                alert('Could not connect to server.');
            } finally {
                loginBtn.innerText = originalBtnText;
                loginBtn.disabled = false;
            }
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    }
});

// Auth Guard
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
    }
}

if (!window.location.pathname.endsWith('index.html')) {
    checkAuth();
}
