async function injectSidebar() {
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : { role: 'staff', full_name: 'Guest' };
    const role = user.role;
    
    // Check access: if staff tries to visit admin pages, redirect
    const adminPages = ['inventory.html', 'procurement.html', 'sales.html', 'customers.html', 'settings.html', 'dashboard.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (role === 'staff' && adminPages.includes(currentPage)) {
        window.location.href = 'staff_dashboard.html'; // Redirect staff to their dashboard
        return;
    }

    const dashboardLink = (role === 'admin') ? 'dashboard.html' : 'staff_dashboard.html';

    let menuHtml = `
        <div class="menu-item">
            <a href="${dashboardLink}" class="menu-link ${currentPage === dashboardLink ? 'active' : ''}">
                <i class="fas fa-th-large"></i>
                <span>Dashboard</span>
            </a>
        </div>
        <div class="menu-item">
            <a href="pos.html" class="menu-link ${currentPage === 'pos.html' ? 'active' : ''}">
                <i class="fas fa-cash-register"></i>
                <span>POS Billing</span>
            </a>
        </div>`;
    
    if (role === 'admin') {
        menuHtml += `
        <div class="menu-item">
            <a href="inventory.html" class="menu-link ${currentPage === 'inventory.html' ? 'active' : ''}">
                <i class="fas fa-boxes"></i>
                <span>Inventory</span>
            </a>
        </div>
        <div class="menu-item">
            <a href="procurement.html" class="menu-link ${currentPage === 'procurement.html' ? 'active' : ''}">
                <i class="fas fa-truck"></i>
                <span>Procurement</span>
            </a>
        </div>
        <div class="menu-item">
            <a href="sales.html" class="menu-link ${currentPage === 'sales.html' ? 'active' : ''}">
                <i class="fas fa-chart-line"></i>
                <span>Sales Reports</span>
            </a>
        </div>
        <div class="menu-item">
            <a href="customers.html" class="menu-link ${currentPage === 'customers.html' ? 'active' : ''}">
                <i class="fas fa-users"></i>
                <span>Customers</span>
            </a>
        </div>
        <div class="menu-item">
            <a href="settings.html" class="menu-link ${currentPage === 'settings.html' ? 'active' : ''}">
                <i class="fas fa-cog"></i>
                <span>Settings</span>
            </a>
        </div>`;
    }

    const sidebarHtml = `
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="logo-icon"><i class="fas fa-shopping-cart"></i></div>
            <div class="logo-text">Aurelius POS</div>
        </div>
        
        <nav class="sidebar-menu">
            ${menuHtml}
        </nav>

        <div class="sidebar-footer">
            <div class="user-peek mb-4" style="padding: 0.5rem 1rem; border-radius: 8px; background: rgba(255,255,255,0.05); margin-bottom: 1rem;">
                <div style="font-weight: 600; font-size: 0.9rem;">${user.full_name}</div>
                <div class="text-muted small">${role.charAt(0).toUpperCase() + role.slice(1)}</div>
            </div>
            <a href="#" id="logoutBtn" class="menu-link text-danger">
                <i class="fas fa-sign-out-alt"></i>
                <span>Logout</span>
            </a>
        </div>
    </aside>`;
    
    const target = document.getElementById('sidebarTarget');
    if (target) {
        target.innerHTML = sidebarHtml;
        
        // Re-attach logout event
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'index.html';
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', injectSidebar);
