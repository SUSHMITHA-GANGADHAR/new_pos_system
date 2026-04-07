let products = [];
let categories = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Load (Awaited with error handling)
    console.log("Loading inventory system...");
    try {
        await Promise.all([loadCategories(), loadInventory()]);
        console.log("Inventory load complete.");
    } catch (err) {
        console.error("Initial load sequence failed", err);
        toast.show("Check server connection", "error");
    }

    // 2. Event Listeners (Attach immediately)
    const searchInput = document.getElementById('inventorySearch');
    const catFilter = document.getElementById('categoryFilter');
    const stockFilter = document.getElementById('stockFilter');
    const addBtn = document.getElementById('addProductBtn');
    
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (catFilter) catFilter.addEventListener('change', applyFilters);
    if (stockFilter) stockFilter.addEventListener('change', applyFilters);
    
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            console.log("Add Product Button Clicked");
            showProductModal();
        });
    } else {
        console.error("addProductBtn not found in DOM");
    }

    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', handleProductSubmit);
});

async function loadCategories() {
    try {
        const result = await api.get('/categories');
        categories = result || [];
        console.log("Loaded categories:", categories);
        
        const filter = document.getElementById('categoryFilter');
        filter.innerHTML = '<option value="all">All Categories</option>';
        
        const modalSelect = document.getElementById('pCategory');
        if (categories.length === 0) {
            modalSelect.innerHTML = '<option value="">No categories found. Add items via SQL editor first.</option>';
        } else {
            modalSelect.innerHTML = '';
            categories.forEach(c => {
                filter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                modalSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    } catch (err) {
        console.error("Could not load categories", err);
        toast.show("Check database connection for categories", "error");
    }
}

async function loadInventory() {
    try {
        const result = await api.get('/products');
        products = result || [];
        renderInventory(products);
    } catch (err) {
        toast.show("Error loading inventory", "error");
    }
}

function renderInventory(items) {
    const tbody = document.getElementById('inventoryTable');
    tbody.innerHTML = '';
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">No products found matching criteria.</td></tr>';
        return;
    }

    items.forEach(p => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        
        // Stock highlighting
        let stockClass = '';
        if (p.stock <= 0) stockClass = 'text-danger font-bold';
        else if (p.stock <= p.low_stock_threshold) stockClass = 'text-accent';

        row.innerHTML = `
            <td style="padding: 1rem;">
                <div style="font-weight: 600;">${p.name}</div>
            </td>
            <td style="padding: 1rem;" class="text-muted">${p.sku}</td>
            <td style="padding: 1rem;">${p.categories?.name || 'N/A'}</td>
            <td style="padding: 1rem; font-weight: 700;">₹${p.price}</td>
            <td style="padding: 1rem;"><span class="${stockClass}">${p.stock}</span></td>
            <td style="padding: 1rem; text-align: right;">
                <button onclick="showProductModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" class="btn btn-outline small mr-2" style="margin-right: 0.5rem;"><i class="fas fa-edit"></i> Edit</button>
                <button onclick="handleDelete(${p.id})" class="btn btn-outline small text-danger"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function applyFilters() {
    const search = document.getElementById('inventorySearch').value.toLowerCase();
    const catId = document.getElementById('categoryFilter').value;
    const stockStatus = document.getElementById('stockFilter').value;
    
    let filtered = products;
    
    if (search) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(search) || 
            p.sku.toLowerCase().includes(search)
        );
    }
    
    if (catId !== 'all') {
        filtered = filtered.filter(p => p.category_id == catId);
    }
    
    if (stockStatus === 'low') {
        filtered = filtered.filter(p => p.stock > 0 && p.stock <= p.low_stock_threshold);
    } else if (stockStatus === 'out') {
        filtered = filtered.filter(p => p.stock <= 0);
    }
    
    renderInventory(filtered);
}

function showProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    
    form.reset();
    
    if (product) {
        title.innerText = 'Edit Product';
        document.getElementById('editProductId').value = product.id;
        document.getElementById('pName').value = product.name;
        document.getElementById('pSku').value = product.sku;
        document.getElementById('pCategory').value = product.category_id;
        document.getElementById('pPrice').value = product.price;
        document.getElementById('pStock').value = product.stock;
        document.getElementById('pThreshold').value = product.low_stock_threshold;
    } else {
        title.innerText = 'Add New Product';
        document.getElementById('editProductId').value = '';
    }
    
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}

async function handleProductSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editProductId').value;
    const payload = {
        name: document.getElementById('pName').value,
        sku: document.getElementById('pSku').value,
        category_id: parseInt(document.getElementById('pCategory').value),
        price: parseFloat(document.getElementById('pPrice').value),
        stock: parseInt(document.getElementById('pStock').value),
        low_stock_threshold: parseInt(document.getElementById('pThreshold').value)
    };
    
    try {
        let result;
        if (id) {
            result = await api.put(`/products/${id}`, payload);
            toast.show("Product updated successfully");
        } else {
            result = await api.post('/products', payload);
            toast.show("Product added successfully");
        }
        
        closeModal();
        await loadInventory();
    } catch (err) {
        toast.show("Error saving product", "error");
    }
}

async function handleDelete(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        try {
            await api.delete(`/products/${id}`);
            toast.show("Product deleted");
            await loadInventory();
        } catch (err) {
            toast.show("Delete failed", "error");
        }
    }
}
