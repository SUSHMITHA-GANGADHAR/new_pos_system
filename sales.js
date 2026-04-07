let salesData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load
    loadSalesReport().catch(err => console.error("Sales Load failed", err));

    // 2. Event Listeners
    const searchInput = document.getElementById('salesSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = salesData.filter(s => 
                s.id.toString().includes(query) || 
                (s.customer_name && s.customer_name.toLowerCase().includes(query))
            );
            renderSales(filtered);
        });
    }
    
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            const filtered = salesData.filter(s => s.created_at.startsWith(selectedDate));
            renderSales(filtered);
        });
    }
});

async function loadSalesReport() {
    try {
        console.log("Fetching sales reports...");
        const result = await api.get('/sales/recent');
        salesData = result || [];
        console.log("Sales data received:", salesData);
        renderSales(salesData);
    } catch (err) {
        console.error("Could not load sales", err);
        const tbody = document.getElementById('salesTable');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-danger" style="padding: 2rem; text-align: center;">Error loading sales data. Check server console.</td></tr>';
    }
}

function renderSales(data) {
    const tbody = document.getElementById('salesTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic;">No sales history found. Total recorded sales: 0.</td></tr>';
        return;
    }
    
    data.forEach(s => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        tr.innerHTML = `
            <td style="padding: 1rem;">#INV-${s.id}</td>
            <td style="padding: 1rem;">${new Date(s.created_at).toLocaleDateString()}</td>
            <td style="padding: 1rem;">${s.customer_name || 'Walking Customer'}</td>
            <td style="padding: 1rem;">₹${parseFloat(s.total_amount).toFixed(2)}</td>
            <td style="padding: 1rem;">₹${parseFloat(s.gst_amount).toFixed(2)}</td>
            <td style="padding: 1rem; font-weight: 600; color: var(--accent-color);">₹${parseFloat(s.grand_total).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}
