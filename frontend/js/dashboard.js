document.addEventListener('DOMContentLoaded', async () => {
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : { role: 'staff' };
    const role = user.role;

    // 1. Fetch Dashboard Summary
    const summary = await api.get('/dashboard/summary');
    
    if (summary) {
        document.getElementById('totalRevenue').innerText = parseFloat(summary.totalRevenue || 0).toLocaleString('en-IN');
        document.getElementById('totalOrders').innerText = summary.totalOrders || 0;
        document.getElementById('totalCustomers').innerText = summary.totalCustomers || 0;
        document.getElementById('lowStockCount').innerText = summary.lowStockCount || 0;
        
        // If staff, maybe hide revenue or stock alerts if needed
        if (role === 'staff') {
            document.getElementById('lowStockCount').parentElement.style.display = 'none';
        }
    }

    // 2. Load Charts (with real data)
    try {
        const analytics = await api.get('/dashboard/analytics');
        if (analytics && typeof Chart !== 'undefined') {
            // Sales Chart
            const ctxSales = document.getElementById('salesChart').getContext('2d');
            new Chart(ctxSales, {
                type: 'line',
                data: {
                    labels: analytics.dailySales.labels,
                    datasets: [{
                        label: 'Sales (₹)',
                        data: analytics.dailySales.data,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            min: 1000,
                            grid: { color: '#334155' }, 
                            ticks: { 
                                color: '#94a3b8',
                                callback: function(value) { return '₹' + value; }
                            } 
                        },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    }
                }
            });

            // Category Chart
            const ctxCat = document.getElementById('categoryChart').getContext('2d');
            new Chart(ctxCat, {
                type: 'doughnut',
                data: {
                    labels: analytics.categorySales.labels,
                    datasets: [{
                        data: analytics.categorySales.data,
                        backgroundColor: ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
                }
            });
        }
    } catch (chartErr) {
        console.error("Charts could not be initialized", chartErr);
    }

    // 4. Update Recent Transactions
    try {
        const transactions = await api.get('/sales/recent');
        const tbody = document.getElementById('recentTransactions');
        if (!tbody) return;
        
        if (transactions && transactions.length > 0) {
            tbody.innerHTML = '';
            transactions.forEach(t => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                const dateObj = t.sale_date ? new Date(t.sale_date) : new Date();
                
                tr.innerHTML = `
                    <td style="padding: 1rem;">${dateObj.toLocaleDateString()} <span class="text-muted small">${dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                    <td style="padding: 1rem; font-weight: 700; color: var(--primary-color);">#INV-${t.id}</td>
                    <td style="padding: 1rem;">${t.customer_name || 'Walking Customer'}</td>
                    <td style="padding: 1rem; font-weight: 700;">₹${parseFloat(t.grand_total).toFixed(2)}</td>
                    <td style="padding: 1rem;"><span class="text-accent" style="font-size: 0.8rem; font-weight: 700;">● PAID</span></td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic;">No sales recorded yet today. Click "POS Billing" to start.</td></tr>';
        }
    } catch (tErr) {
        console.error("Recent transactions failed", tErr);
    }

    // 5. Update Staff Performance
    try {
        const rankings = await api.get('/admin/staff-performance');
        const pBody = document.getElementById('staffPerformanceBody');
        if (pBody && rankings) {
            pBody.innerHTML = '';
            rankings.forEach((s, idx) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                const badge = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : ''));
                tr.innerHTML = `
                    <td style="padding: 0.75rem;">
                        <div style="font-weight: 600;">${badge} ${s.name}</div>
                        <div class="text-muted small">${s.orders} orders</div>
                    </td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 700; color: var(--accent-color);">
                        ₹${parseFloat(s.revenue).toLocaleString('en-IN')}
                    </td>
                `;
                pBody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Staff performance load failed", err);
    }
});
