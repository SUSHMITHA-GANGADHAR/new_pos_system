let cart = [];
let allProducts = [];
let allCustomers = [];
const GST_PERCENT = 18;

document.addEventListener('DOMContentLoaded', async () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 1. Initial Load
    await Promise.all([loadProducts(), loadCustomers()]);
    renderProducts(allProducts);

    // 2. Event Listeners
    document.getElementById('productSearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allProducts.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.sku.toLowerCase().includes(query)
        );
        renderProducts(filtered);
    });

    document.getElementById('checkoutBtn').addEventListener('click', processCheckout);
    document.getElementById('clearCart').addEventListener('click', () => {
        cart = [];
        updateCartUI();
    });

    // 3. Category Tabs Filter
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // UI Toggle
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const cat = tab.getAttribute('data-category');
            const filtered = (cat === 'all') 
                ? allProducts 
                : allProducts.filter(p => p.category_id == cat);
            renderProducts(filtered);
        });
    });
});

async function loadCustomers() {
    try {
        const response = await api.get('/customers');
        allCustomers = response || [];
        const select = document.getElementById('customerSelect');
        if (select) {
            select.innerHTML = '<option value="">-- Choose Customer (Optional) --</option>';
            allCustomers.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.name} (${c.phone})</option>`;
            });
        }
    } catch (err) {
        console.error("Error loading customers", err);
    }
}

async function loadProducts() {
    try {
        const response = await api.get('/products');
        allProducts = response || [];
    } catch (err) {
        console.error("Error loading products", err);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';
    
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.style.cursor = 'pointer';
        card.style.padding = '1rem';
        card.style.textAlign = 'center';
        
        card.innerHTML = `
            <div class="mb-2" style="font-size: 1.5rem;">📦</div>
            <div style="font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
            <div class="text-muted small">₹${p.price}</div>
            <div class="${p.stock <= p.low_stock_threshold ? 'text-danger' : 'text-accent'} small mt-2">${p.stock} in stock</div>
        `;
        
        if (p.stock > 0) {
            card.addEventListener('click', () => addToCart(p));
        } else {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }
        
        grid.appendChild(card);
    });
}

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        if (existing.quantity < product.stock) {
            existing.quantity++;
            toast.show(`Increased quantity for ${product.name}`);
        } else {
            toast.show(`Stock limit reached for ${product.name}`, 'error');
        }
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            stock: product.stock
        });
        toast.show(`Added ${product.name} to cart`);
    }
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cartItems');
    container.innerHTML = '';
    
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        const rowTotal = item.price * item.quantity;
        subtotal += rowTotal;
        
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '1rem';
        row.style.padding = '0.5rem';
        row.style.borderBottom = '1px solid var(--border-color)';
        
        row.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600;">${item.name}</div>
                <div class="text-muted small">₹${item.price} x ${item.quantity}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button onclick="changeQty(${index}, -1)" class="btn btn-outline" style="padding: 0.2rem 0.5rem;">-</button>
                <span style="font-weight: 700;">${item.quantity}</span>
                <button onclick="changeQty(${index}, 1)" class="btn btn-outline" style="padding: 0.2rem 0.5rem;">+</button>
            </div>
            <div style="font-weight: 700; margin-left: 1rem;">₹${rowTotal.toFixed(2)}</div>
        `;
        container.appendChild(row);
    });

    const gst = (subtotal * GST_PERCENT) / 100;
    const total = subtotal + gst;

    document.getElementById('subTotal').innerText = subtotal.toFixed(2);
    document.getElementById('gstAmount').innerText = gst.toFixed(2);
    document.getElementById('grandTotal').innerText = total.toFixed(2);
}

function changeQty(index, delta) {
    const item = cart[index];
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
        cart.splice(index, 1);
    } else if (newQty > item.stock) {
        toast.show(`Only ${item.stock} items available`, 'error');
    } else {
        item.quantity = newQty;
    }
    updateCartUI();
}

async function processCheckout() {
    if (cart.length === 0) {
        toast.show("Cart is empty!", "error");
        return;
    }
    
    const customerId = document.getElementById('customerSelect')?.value || null;
    const subtotal = parseFloat(document.getElementById('subTotal').innerText);
    const gst = parseFloat(document.getElementById('gstAmount').innerText);
    const total = parseFloat(document.getElementById('grandTotal').innerText);
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerText = "PROCESSING...";

    const user = JSON.parse(localStorage.getItem('user'));
    try {
        const payload = {
            user_id: user ? user.id : null,
            customer_id: customerId,
            subtotal: subtotal,
            gst: gst,
            total: total,
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price
            }))
        };

        const result = await api.post('/sales', payload);
        
        if (result.status === 'success') {
            toast.show("Transaction Successful!");
            showReceipt(result.sale_id, payload);
            
            // CLEAR CART AND REFRESH
            cart = [];
            updateCartUI();
            await loadProducts(); // IMPORTANT: Refresh stock levels
            renderProducts(allProducts);
        } else {
            toast.show(result.message || "Checkout failed", "error");
        }
    } catch (err) {
        toast.show("Checkout could not be completed", "error");
    } finally {
        checkoutBtn.disabled = false;
        checkoutBtn.innerText = "COMPLETE TRANSACTION";
    }
}

function showReceipt(id, payload) {
    document.getElementById('receiptId').innerText = `#INV-${id}`;
    document.getElementById('receiptDate').innerText = new Date().toLocaleString();
    document.getElementById('receiptSubtotal').innerText = payload.subtotal.toFixed(2);
    document.getElementById('receiptGst').innerText = payload.gst.toFixed(2);
    document.getElementById('receiptGrandTotal').innerText = payload.total.toFixed(2);
    
    const receiptItems = document.getElementById('receiptItems');
    receiptItems.innerHTML = '';
    
    payload.items.forEach(item => {
        const prod = allProducts.find(p => p.id === item.product_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 0.5rem;">${prod ? prod.name : 'Unknown Product'}</td>
            <td style="padding: 0.5rem; text-align: right;">${item.quantity}</td>
            <td style="padding: 0.5rem; text-align: right;">₹${item.price}</td>
            <td style="padding: 0.5rem; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
        `;
        receiptItems.appendChild(tr);
    });

    document.getElementById('invoiceModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('invoiceModal').style.display = 'none';
}

function updateDateTime() {
    const now = new Date();
    const el = document.getElementById('currentDateTime');
    if (el) el.innerText = now.toLocaleString();
}
