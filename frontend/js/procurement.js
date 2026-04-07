let purchaseItems = [];
let allProducts = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load
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

async function loadProducts() {
    try {
        const response = await api.get('/products');
        allProducts = response || [];
        
        const select = document.getElementById('procureProduct');
        select.innerHTML = '<option value="">Select Product...</option>';
        allProducts.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.name} (SKU: ${p.sku})</option>`;
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
        const tbody = document.getElementById('purchaseHistoryTable');
        tbody.innerHTML = '';
        
        if (response && response.length > 0) {
            response.forEach(p => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-color)';
                tr.innerHTML = `
                    <td style="padding: 1rem;">${new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td style="padding: 1rem;">${p.supplier_name}</td>
                    <td style="padding: 1rem; font-weight: 700;">₹${parseFloat(p.total_cost).toFixed(2)}</td>
                    <td style="padding: 1rem;">View Details</td>
                    <td style="padding: 1rem; text-align: right;">
                        <button class="btn btn-outline small">View</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">No purchase records found.</td></tr>';
        }
    } catch (err) {
        toast.show("Error loading purchase history", "error");
    }
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
    
    if (!supplier || purchaseItems.length === 0) {
        toast.show("Please add items and supplier", "error");
        return;
    }
    
    try {
        const payload = {
            supplier_name: supplier,
            total_cost: total,
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
