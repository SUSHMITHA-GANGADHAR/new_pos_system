let customers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load
    loadCustomers().catch(err => console.error("Customers Load failed", err));

    // 2. Event Listeners
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = customers.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.phone.includes(query) ||
                (c.email && c.email.toLowerCase().includes(query))
            );
            renderCustomers(filtered);
        });
    }
    
    const addCustBtn = document.getElementById('addCustomerBtn');
    if (addCustBtn) {
        addCustBtn.addEventListener('click', () => {
            document.getElementById('customerModal').style.display = 'flex';
        });
    }
    
    const customerForm = document.getElementById('customerForm');
    if (customerForm) customerForm.addEventListener('submit', handleAddCustomer);
});

async function loadCustomers() {
    try {
        const result = await api.get('/customers'); // Need backend route
        customers = result || [];
        renderCustomers(customers);
    } catch (err) {
        toast.show("Error loading customers", "error");
    }
}

function renderCustomers(items) {
    const tbody = document.getElementById('customersTable');
    tbody.innerHTML = '';
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">No customers found.</td></tr>';
        return;
    }

    items.forEach(c => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: 600;">${c.name}</td>
            <td style="padding: 1rem;">${c.phone}</td>
            <td style="padding: 1rem;" class="text-muted">${c.email || 'N/A'}</td>
            <td style="padding: 1rem; text-align: right; font-weight: 700;">${c.total_purchases || 0}</td>
            <td style="padding: 1rem; text-align: right; font-weight: 600; color: var(--text-muted);">${c.total_items || 0}</td>
            <td style="padding: 1rem; text-align: right; color: var(--accent-color); font-weight: 600;">₹${parseFloat(c.total_spent || 0).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function closeModal() {
    document.getElementById('customerModal').style.display = 'none';
}

async function handleAddCustomer(e) {
    e.preventDefault();
    
    const payload = {
        name: document.getElementById('cName').value,
        phone: document.getElementById('cPhone').value,
        email: document.getElementById('cEmail').value
    };
    
    try {
        await api.post('/customers', payload);
        toast.show("Customer registered successfully");
        closeModal();
        await loadCustomers();
    } catch (err) {
        toast.show("Registration failed", "error");
    }
}
