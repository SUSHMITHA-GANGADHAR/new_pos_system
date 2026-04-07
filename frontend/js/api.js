const API_BASE_URL = '/api';

// Global Toast System
const toast = {
    show: (message, type = 'success') => {
        const container = document.getElementById('toastContainer') || document.body;
        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${type}`;
        toastEl.style.cssText = `
            background: ${type === 'success' ? 'var(--accent-color)' : 'var(--danger-color)'};
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            margin-top: 1rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
            z-index: 9999;
        `;
        toastEl.innerText = message;
        container.appendChild(toastEl);
        setTimeout(() => {
            toastEl.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toastEl.remove(), 300);
        }, 3000);
    }
};

const api = {
    get: async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        return await response.json();
    },
    post: async (endpoint, data) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    },
    put: async (endpoint, data) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    },
    delete: async (endpoint) => {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        return await response.json();
    }
};

// End of API object
