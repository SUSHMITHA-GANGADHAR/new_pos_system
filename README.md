# Aurelius POS - Modern Retail Management System

A production-ready Retail ERP system built with Flask, Vanilla JS, and Supabase.

## 🚀 Key Features
- **Modern Dark UI**: Indigo/Navy/Green aesthetic with premium animations.
- **POS Billing**: Live search, GST calculation, and printable invoices.
- **Inventory Mgt**: CRUD products, categories, and low stock alerts.
- **Procurement**: Inward stock entry with automatic inventory updates.
- **Analytics**: Sales performance line charts and category doughnuts.
- **Security**: Supabase Auth with JWT and role-based profiles.

## 🛠️ Setup Instructions

### 1. Supabase Setup
1. Create a project at [supabase.com](https://supabase.com).
2. Go to the SQL Editor and run the schema found in `implementation_plan.md`.
3. Enable Email/Password Auth in the Authentication settings.
4. Add some initial categories in the `categories` table (e.g., Electronics, Groceries).

### 2. Backend Configuration
1. Navigate to the `backend/` folder.
2. Create a `.env` file (or update `config.py`) with your Supabase credentials:
   ```env
   SUPABASE_URL=your_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   JWT_SECRET_KEY=your_secret_key
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the API:
   ```bash
   python app.py
   ```

### 3. Frontend Execution
1. The frontend is built with Vanilla JS and can be served using any static host (e.g., VS Code Live Server).
2. Open `index.html` in your browser to log in.

## 📁 Project Structure
- `backend/`: Flask REST API handling DB logic and Auth.
- `frontend/`: Single Page-like interface (HTML/CSS/JS).
- `frontend/js/api.js`: Centralized fetch wrapper for the backend.
- `frontend/js/pos.js`: Heavy logic for cart and transactions.

## 🔒 User Roles
- **Admin**: Full access to Inventory, Procurement, and Settings.
- **Staff**: Access to POS Billing and basic Dashboard.
