let purchaseItems = [];
let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load
    loadVendors().catch(err => console.error("Vendors load failed", err));
    loadProducts().catch(err => console.error("Procurement products failed", err));
    loadPurchaseHistory().catch(err => console.error("Purchase history failed", err));

    // 2. Event Listeners
    const newBtn = document.getElementById('newPurchaseBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            purchaseItems = [];
            updatePurchaseListUI();
            document.getElementById('purchaseModal').style.display = 'flex';
        });
    }
    
    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) addBtn.addEventListener('click', addItemToPurchase);
    
    const purchaseForm = document.getElementById('purchaseForm');
    if (purchaseForm) purchaseForm.addEventListener('submit', handlePurchaseSubmit);
});

let purchaseHistory = [];

async function loadProducts() {
    try {
        const response = await api.get('/products');
        allProducts = response || [];
        
        const select = document.getElementById('procureProduct');
        select.innerHTML = '<option value="">Select Product...</option>';
        allProducts.forEach(p => {
            const company = p.categories?.company_name || 'Generic';
            const rating = p.categories?.rating || 5;
            const stars = '★'.repeat(rating) + '☆'.repeat(5-rating);
            select.innerHTML += `<option value="${p.id}">${p.name} - [${company}] (${stars})</option>`;
        });

        // Update total stock value
        const totalValue = allProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
        document.getElementById('stockValue').innerText = totalValue.toLocaleString('en-IN');
    } catch (err) {
        console.error("Error loading products", err);
    }
}

async function loadPurchaseHistory() {
    try {
        const response = await api.get('/purchases');
        purchaseHistory = response || [];
        const tbody = document.getElementById('purchaseHistoryTable');
        tbody.innerHTML = '';
        
        if (purchaseHistory.length > 0) {
            purchaseHistory.forEach(p => {
                const statusColor = p.status === 'delivered' ? 'var(--accent-color)' : 'orange';
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                tr.innerHTML = `
                    <td style="padding: 1rem;">${new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td style="padding: 1rem;">${p.supplier_name}</td>
                    <td style="padding: 1rem; font-weight: 700;">₹${parseFloat(p.total_cost).toFixed(2)}</td>
                    <td style="padding: 1rem;">
                        <span style="color: ${statusColor}; font-weight: 700;">${p.status ? p.status.toUpperCase() : 'DELIVERED'}</span>
                    </td>
                    <td style="padding: 1rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                        <button class="btn btn-outline small" onclick="openDetailsModal(${p.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-outline small" onclick="handleDeletePurchase(${p.id})">
                            <i class="fas fa-trash text-danger"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">No records found.</td></tr>';
        }
    } catch (err) {
        toast.show("Error loading purchase history", "error");
    }
}

function openDetailsModal(purchaseId) {
    const purchase = purchaseHistory.find(p => p.id == purchaseId);
    if (!purchase) return;

    const content = document.getElementById('detailsContent');
    const statusText = purchase.status === 'delivered' ? 'Marked as Delivered' : 'Currently Booked';
    
    let itemsHTML = '';
    (purchase.purchase_items || []).forEach(item => {
        const prodName = item.products?.name || 'Unknown Product';
        itemsHTML += `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dotted var(--border-color);">
                <span>${prodName} (x${item.quantity})</span>
                <span>₹${(item.quantity * item.unit_cost).toFixed(2)}</span>
            </div>
        `;
    });

    content.innerHTML = `
        <div style="padding: 1rem; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <p><strong>Supplier:</strong> ${purchase.supplier_name}</p>
            <p><strong>Status:</strong> <span class="text-accent">${statusText}</span></p>
            <p><strong>Date:</strong> ${new Date(purchase.purchase_date).toLocaleString()}</p>
        </div>
        <h4>Items List</h4>
        <div style="margin-top: 1rem;">
            ${itemsHTML || '<p class="text-muted">No items list found.</p>'}
        </div>
        <div style="margin-top: 1.5rem; text-align: right; border-top: 2px solid var(--border-color); padding-top: 1rem; font-size: 1.25rem;">
            <strong>GRAND TOTAL: ₹${parseFloat(purchase.total_cost).toFixed(2)}</strong>
        </div>
    `;

    document.getElementById('detailsModal').style.display = 'flex';
}

function closeDetailsModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

function addItemToPurchase() {
    const productId = document.getElementById('procureProduct').value;
    const qty = parseInt(document.getElementById('procureQty').value);
    const cost = parseFloat(document.getElementById('procureCost').value);
    
    if (!productId || isNaN(qty) || isNaN(cost) || qty <= 0) {
        toast.show("Please fill all item fields", "error");
        return;
    }
    
    const product = allProducts.find(p => p.id == productId);
    
    purchaseItems.push({
        id: product.id,
        name: product.name,
        quantity: qty,
        cost: cost
    });
    
    // Clear inputs
    document.getElementById('procureQty').value = '';
    document.getElementById('procureCost').value = '';
    
    updatePurchaseListUI();
}

function updatePurchaseListUI() {
    const list = document.getElementById('addedItemsList');
    list.innerHTML = '';
    let total = 0;
    
    purchaseItems.forEach((item, index) => {
        const rowTotal = item.quantity * item.cost;
        total += rowTotal;
        
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.padding = '0.5rem';
        div.style.borderBottom = '1px solid var(--border-color)';
        div.innerHTML = `
            <div style="flex: 1;">
                <strong>${item.name}</strong><br>
                <span class="text-muted small">${item.quantity} units @ ₹${item.cost}</span>
            </div>
            <div style="font-weight: 700;">₹${rowTotal.toFixed(2)}</div>
            <button type="button" onclick="removeItem(${index})" style="background: transparent; color: var(--danger-color); border: none; margin-left: 1rem; cursor: pointer;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        list.appendChild(div);
    });
    
    document.getElementById('purchaseTotal').innerText = total.toFixed(2);
}

function removeItem(index) {
    purchaseItems.splice(index, 1);
    updatePurchaseListUI();
}

function closePurchaseModal() {
    document.getElementById('purchaseModal').style.display = 'none';
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    
    const supplier = document.getElementById('supplierName').value;
    const total = parseFloat(document.getElementById('purchaseTotal').innerText);
    const status = document.getElementById('purchaseStatus').value;
    
    if (!supplier || purchaseItems.length === 0) {
        toast.show("Please add items and supplier", "error");
        return;
    }
    
    try {
        const payload = {
            supplier_name: supplier,
            total_cost: total,
            status: status,
            items: purchaseItems.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                unit_cost: item.cost
            }))
        };
        
        const result = await api.post('/purchases', payload);
        
        if (result.status === 'success') {
            toast.show("Stock inward recorded successfully");
            closePurchaseModal();
            await loadProducts();
            await loadPurchaseHistory();
        }
    } catch (err) {
        toast.show("Could not record purchase", "error");
    }
}

async function loadVendors() {
    try {
        const categories = await api.get('/categories');
        const spotlight = document.getElementById('vendorSpotlight');
        if (!spotlight) return;
        
        spotlight.innerHTML = '';
        
        if (categories && categories.length > 0) {
            // Find unique companies
            const vendors = {};
            categories.forEach(c => {
                const name = c.company_name || 'General Supplier';
                if (!vendors[name]) {
                    vendors[name] = { 
                        name: name, 
                        rating: c.rating || 5,
                        category: c.name
                    };
                }
            });

            Object.values(vendors).forEach(v => {
                const stars = '★'.repeat(v.rating) + '☆'.repeat(5 - v.rating);
                const card = document.createElement('div');
                card.className = 'stat-card';
                card.style.minWidth = '200px';
                card.style.textAlign = 'center';
                card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                card.style.background = 'rgba(255, 255, 255, 0.03)';
                card.style.transition = 'transform 0.3s ease';
                card.style.padding = '1.5rem';
                
                card.onmouseover = () => card.style.transform = 'translateY(-5px)';
                card.onmouseout = () => card.style.transform = 'translateY(0)';
                
                card.innerHTML = `
                    <div style="font-size: 2rem; margin-bottom: 1rem;">🏢</div>
                    <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; color: #fff; border-bottom: 1px solid var(--accent-outer); padding-bottom: 0.5rem;">${v.name}</div>
                    <div style="color: #ffd700; font-size: 0.9rem; margin-bottom: 0.75rem; letter-spacing: 2px;">${stars}</div>
                    <div class="text-muted small" style="background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 20px; display: inline-block;">${v.category}</div>
                `;
                spotlight.appendChild(card);
            });
        } else {
            spotlight.innerHTML = '<div class="text-muted">No vendors found. Add categories to see them here.</div>';
        }
    } catch (err) {
        console.error("Error loading vendors", err);
    }
}

async function handleDeletePurchase(id) {
    if (confirm("Are you sure you want to delete this purchase record? This won't automatically reverse stock changes.")) {
        try {
            await api.delete(`/purchases/${id}`);
            toast.show("Purchase record deleted");
            await loadPurchaseHistory();
        } catch (err) {
            toast.show("Delete failed", "error");
        }
    }
}
