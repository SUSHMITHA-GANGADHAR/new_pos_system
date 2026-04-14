let purchaseItems = [];
let allProducts = [];
let editingPurchaseId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load
    loadVendors().catch(err => console.error("Vendors load failed", err));
    loadProducts().catch(err => console.error("Procurement products failed", err));
    loadPurchaseHistory().catch(err => console.error("Purchase history failed", err));

    // 2. Event Listeners
    const newBtn = document.getElementById('newPurchaseBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => {
            editingPurchaseId = null;
            purchaseItems = [];
            document.getElementById('purchaseForm').reset();
            document.getElementById('purchaseModalTitle').innerText = 'New Stock Entry';
            document.getElementById('purchaseSubmitBtn').innerText = 'Confirm Purchase';
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
                        <button class="btn btn-outline small" onclick="openEditPurchaseModal(${p.id})">
                            <i class="fas fa-edit"></i> Edit
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

function openEditPurchaseModal(id) {
    const p = purchaseHistory.find(item => item.id == id);
    if (!p) return;

    editingPurchaseId = id;
    document.getElementById('purchaseModalTitle').innerText = 'Edit Purchase Record';
    document.getElementById('purchaseSubmitBtn').innerText = 'Update Purchase';
    
    document.getElementById('supplierName').value = p.supplier_name;
    document.getElementById('purchaseStatus').value = p.status || 'delivered';
    
    // Convert items
    purchaseItems = (p.purchase_items || []).map(item => ({
        id: item.product_id,
        name: item.products?.name || 'Unknown',
        quantity: item.quantity,
        cost: item.unit_cost
    }));

    updatePurchaseListUI();
    document.getElementById('purchaseModal').style.display = 'flex';
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
        
        let result;
        if (editingPurchaseId) {
            result = await api.put(`/purchases/${editingPurchaseId}`, payload);
        } else {
            result = await api.post('/purchases', payload);
        }
        
        if (result.status === 'success') {
            toast.show(editingPurchaseId ? "Purchase record updated" : "Stock inward recorded successfully");
            closePurchaseModal();
            await loadProducts();
            await loadPurchaseHistory();
        }
    } catch (err) {
        toast.show("Operation failed", "error");
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
                card.className = 'vendor-item'; // Use a new class for better styling
                card.innerHTML = `
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🏢</div>
                    <div style="font-weight: 700; color: #fff; margin-bottom: 0.25rem;">${v.name}</div>
                    <div style="color: #ffd700; font-size: 0.75rem; margin-bottom: 0.5rem;">${stars}</div>
                    <div class="text-muted small">${v.category}</div>
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
