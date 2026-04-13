import os
# GLOBAL TIMEOUT OVERRIDE (Must be before any httpx/supabase imports)
os.environ["HTTPX_TIMEOUT"] = "60.0"

from flask import Flask, request, jsonify
from flask_cors import CORS
from whitenoise import WhiteNoise
from supabase import create_client
from config import Config
from functools import wraps
import jwt
import datetime
import httpx

# Get absolute path to the directory containing app.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Frontend is in the sibling directory to 'backend'
frontend_path = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))

app = Flask(__name__, 
            static_folder=frontend_path, 
            static_url_path='')

# Wrap Flask with WhiteNoise
# 'index_file=True' allows it to serve index.html for the '/' route automatically
app.wsgi_app = WhiteNoise(app.wsgi_app, root=frontend_path, prefix='/', index_file=True)

app.config.from_object(Config)
CORS(app)

# Force browser to always reload the latest files during development (Fixes '304' logs)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

# Global exception handler for any unhandled errors
from werkzeug.exceptions import HTTPException

@app.errorhandler(Exception)
def handle_exception(e):
    # Log the full error to visibility in console
    print(f"DEBUG: Uncaught Exception - {str(e)}")
    
    # If it's a standard HTTP error (like 404), return it properly
    if isinstance(e, HTTPException):
        return jsonify({
            "status": "error",
            "message": e.description
        }), e.code
    
    # Check for timeout or connectivity issues
    error_msg = str(e).lower()
    if any(keyword in error_msg for keyword in ["timeout", "timed out", "connecttimeout", "httpcore"]):
        return jsonify({
            "status": "error", 
            "type": "timeout",
            "message": "The connection to the database timed out. Please check your internet or try again."
        }), 504
        
    return jsonify({
        "status": "error",
        "message": f"Server Error: {str(e)}"
    }), 500

# Supabase initialization
url: str = Config.SUPABASE_URL
key: str = Config.SUPABASE_KEY

# Initialize Supabase client
supabase = create_client(url, key)

# --- DIAGNOSTIC PROBE (Check if database is reachable) ---
import time
print(f"🔍 Initializing Supabase connection to: {url[:15]}...{url[-3:]}")

max_retries = 3
retry_delay = 2 # seconds
connected = False

for attempt in range(1, max_retries + 1):
    try:
        # 1. Update timeouts for the probe
        if hasattr(supabase.postgrest, 'session'):
            supabase.postgrest.session.timeout = httpx.Timeout(45.0)
        
        # 2. Try health check
        probe = supabase.table('settings').select('id').limit(1).execute()
        print(f"✅ DATABASE REACHABLE: Connection verified on attempt {attempt}.")
        connected = True
        break
    except Exception as probe_err:
        error_str = str(probe_err)
        print(f"⏳ Attempt {attempt} failed: {type(probe_err).__name__}")
        
        if attempt < max_retries:
            print(f"   Retrying in {retry_delay}s...")
            time.sleep(retry_delay)
        else:
            print("❌ ALL CONNECTION ATTEMPTS FAILED.")
            print(f"   Final Error: {error_str}")
            if "getaddrinfo failed" in error_str or "11001" in error_str:
                print("   💡 DNS ERROR: Your system cannot find 'supabase.co'.")
                print("      Check internet, disable VPN, or try a mobile hotspot.")
            print("---------------------------------------------------------")

if connected:
    # Robustly increase all timeouts to 60s for the actual app
    try:
        if hasattr(supabase.postgrest, 'session'):
            supabase.postgrest.session.timeout = httpx.Timeout(60.0)
        
        auth_client = None
        if hasattr(supabase.auth, '_client'): auth_client = supabase.auth._client
        elif hasattr(supabase.auth, 'http_client'): auth_client = supabase.auth.http_client
        
        if auth_client:
            auth_client.timeout = httpx.Timeout(60.0)
            
        print("✅ Full system timeout confirmed at 60s")
    except Exception as e:
        print(f"Note: Could not override default timeout settings: {e}")


# Helper for Auth
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            # You can also verify with Supabase if needed
            # data = supabase.auth.get_user(token)
            # For simplicity, we can decode JWT if we have secret
            payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            current_user = payload['sub']
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/')
def index():
    return app.send_static_file('index.html')

# Serve other HTML files directly
@app.route('/<path:path>.html')
def serve_html(path):
    return app.send_static_file(path + '.html')

# --- Auth Routes ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    print(f"Login attempt for: {email}")
    
    try:
        # Step 1: Auth sign-in
        # Use explicit named arguments to avoid dictionary-related 401 errors
        res = supabase.auth.sign_in_with_password(credentials={"email": email, "password": password})
        user = res.user
        token = res.session.access_token
        
        print(f"Auth success for user ID: {user.id}")
        
        # Step 2: Determine role from profiles table
        try:
            profile_res = supabase.table('profiles').select('*').eq('id', user.id).execute()
            
            if not profile_res.data:
                print(f"Warning: No profile record for UID {user.id}")
                # Fallback to defaults or metadata if profile fetch fails
                role = user.user_metadata.get('role', 'staff') if user.user_metadata else 'staff'
                full_name = user.user_metadata.get('full_name', email) if user.user_metadata else email
            else:
                role = profile_res.data[0]['role']
                full_name = profile_res.data[0]['full_name']
                print(f"Profile found: {full_name} ({role})")
                
        except Exception as profile_err:
            print(f"Profile fetch error: {profile_err}")
            role = 'staff'
            full_name = email

        return jsonify({
            "status": "success",
            "token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": role,
                "full_name": full_name
            }
        })
        
    except Exception as e:
        error_msg = str(e)
        print(f"Login Error: {error_msg}")
        
        # User-friendly error mapping
        if "Invalid login credentials" in error_msg:
             return jsonify({"status": "error", "message": "Invalid email or password"}), 401
        elif "Email not confirmed" in error_msg:
             return jsonify({"status": "error", "message": "Email not verified. Please check your inbox."}), 401
        
        return jsonify({"status": "error", "message": error_msg}), 401


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('fullName', '')
    role = data.get('role', 'staff')
    
    try:
        # 1. Create user in Supabase Auth (Admin API)
        # Using admin API bypasses email confirmation if needed
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": role}
        })
        
        user_id = res.user.id
        
        # 2. Create profile entry
        supabase.table('profiles').insert({
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": role
        }).execute()
        
        return jsonify({"status": "success", "message": "User registered successfully"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Sign-up error: {str(e)}"}), 400

# --- Dashboard Summary ---
@app.route('/api/dashboard/summary', methods=['GET'])
def get_dashboard_summary():
    try:
        data = {
            "totalRevenue": 0.0,
            "totalOrders": 0,
            "totalCustomers": 0,
            "lowStockCount": 0
        }
        
        # 1. Revenue and Orders
        try:
            sales = supabase.table('sales').select('grand_total').execute()
            data["totalRevenue"] = sum(float(s['grand_total']) for s in (sales.data or []))
            data["totalOrders"] = len(sales.data or [])
        except Exception as e:
            print(f"Stats Error (Sales): {e}")

        # 2. Customers
        try:
            customers = supabase.table('customers').select('count', count='exact').execute()
            data["totalCustomers"] = customers.count or 0
        except Exception as e:
            print(f"Stats Error (Customers): {e}")
        
        # 3. Low Stock
        try:
            low_stock = supabase.table('products').select('id, stock, low_stock_threshold').execute()
            # Filter in Python if the GT/LT query is slow
            count = 0
            for p in (low_stock.data or []):
                if int(p.get('stock', 0)) <= int(p.get('low_stock_threshold', 10)):
                    count += 1
            data["lowStockCount"] = count
        except Exception as e:
            print(f"Stats Error (Inventory): {e}")
        
        return jsonify(data)
    except Exception as e:
        print(f"Critical Dashboard Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/dashboard/analytics', methods=['GET'])
def get_dashboard_analytics():
    try:
        # 1. Sales by Day (Last 7 Days)
        # For simplicity, we'll fetch all sales and group in Python or use a clever select
        sales_res = supabase.table('sales').select('sale_date, grand_total').execute()
        sales_data = sales_res.data or []
        
        # Initialize last 7 days
        days = []
        for i in range(6, -1, -1):
            date = (datetime.datetime.now() - datetime.timedelta(days=i)).strftime('%Y-%m-%d')
            days.append(date)
            
        daily_sales = {day: 0.0 for day in days}
        for s in sales_data:
            dt = s['sale_date'].split('T')[0]
            if dt in daily_sales:
                daily_sales[dt] += float(s['grand_total'])
        
        # 2. Sales by Category
        # Join sale_items with products and categories
        items_res = supabase.table('sale_items').select('quantity, unit_price, products(category_id, categories(name))').execute()
        items_data = items_res.data or []
        
        cat_sales = {}
        for item in items_data:
            cat_name = item['products']['categories']['name'] if item.get('products') and item['products'].get('categories') else 'Others'
            amount = float(item['quantity']) * float(item['unit_price'])
            cat_sales[cat_name] = cat_sales.get(cat_name, 0.0) + amount
            
        return jsonify({
            "dailySales": {
                "labels": [datetime.datetime.strptime(d, '%Y-%m-%d').strftime('%a') for d in days],
                "data": [daily_sales[d] for d in days]
            },
            "categorySales": {
                "labels": list(cat_sales.keys()),
                "data": list(cat_sales.values())
            }
        })
    except Exception as e:
        print(f"Analytics Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Products CRUD ---
@app.route('/api/products', methods=['GET'])
def get_products():
    res = supabase.table('products').select("*, categories(*)").execute()
    return jsonify(res.data)

@app.route('/api/products', methods=['POST'])
def add_product():
    data = request.get_json()
    res = supabase.table('products').insert(data).execute()
    return jsonify(res.data)

@app.route('/api/products/<int:id>', methods=['PUT', 'DELETE'])
def update_product(id):
    if request.method == 'PUT':
        data = request.get_json()
        res = supabase.table('products').update(data).eq('id', id).execute()
    else:
        res = supabase.table('products').delete().eq('id', id).execute()
    return jsonify(res.data)

# --- Categories ---
@app.route('/api/categories', methods=['GET'])
def get_categories():
    try:
        res = supabase.table('categories').select('*').execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Sales (POS Checkout) ---
@app.route('/api/sales', methods=['POST'])
def create_sale():
    data = request.get_json()
    items = data.get('items', [])
    customer_id = data.get('customer_id')
    user_id = data.get('user_id')
    
    # --- Handle Customer Selection & Stats ---
    final_customer_id = customer_id
    if not final_customer_id:
        try:
            # Look for "Walking Customer" record
            walk_res = supabase.table('customers').select('id').eq('name', 'Walking Customer').execute()
            if walk_res.data:
                final_customer_id = walk_res.data[0]['id']
            else:
                # SELF-HEAL: Create it if it doesn't exist
                new_walk = supabase.table('customers').insert({
                    "name": "Walking Customer",
                    "phone": "0000000000",
                    "email": "walking@pos.com"
                }).execute()
                if new_walk.data:
                    final_customer_id = new_walk.data[0]['id']
        except Exception as e:
            print(f"Walking customer setup error: {e}")

    try:
        # 1. Create Sale entry
        res = supabase.table('sales').insert({
            "total_amount": data.get('subtotal', 0),
            "gst_amount": data.get('gst', 0),
            "grand_total": data.get('total', 0),
            "payment_mode": data.get('payment_mode', 'cash'),
            "customer_id": final_customer_id,
            "user_id": user_id
        }).execute()
        
        if not res.data:
            raise Exception("Failed to insert sale")
            
        sale_id = res.data[0]['id']
        
        # 2. Add Sale Items and Update Stock
        grand_total = data.get('total', 0)
        for item in items:
            p_id = item['product_id']
            qty = int(item['quantity'])
            
            supabase.table('sale_items').insert({
                "sale_id": sale_id,
                "product_id": p_id,
                "quantity": qty,
                "unit_price": item['price']
            }).execute()
            
            # Reduce Stock
            prod = supabase.table('products').select('stock').eq('id', p_id).execute()
            if prod.data:
                new_stock = max(0, int(prod.data[0]['stock']) - qty)
                supabase.table('products').update({"stock": new_stock}).eq('id', p_id).execute()
        
        # 3. Update Customer Stats (Optional: Local aggregation is used instead)
        # Note: We skip manual column updates to avoid DB schema errors if columns are missing.
        # The /api/customers route now calculates these on the fly for accuracy.
        pass
            
        return jsonify({"status": "success", "sale_id": sale_id})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Sale failed: {str(e)}"}), 400

@app.route('/api/sales/recent', methods=['GET'])
def get_recent_sales():
    try:
        # Join with customers for names
        res = supabase.from_('sales').select('*, customers(name)').order('sale_date', desc=True).limit(20).execute()
        
        output = []
        for s in (res.data or []):
            customer_name = s['customers']['name'] if s.get('customers') else 'Walking Customer'
            output.append({
                "id": s['id'],
                "sale_date": s['sale_date'],
                "total_amount": s['total_amount'],
                "gst_amount": s['gst_amount'],
                "grand_total": s['grand_total'],
                "payment_mode": s.get('payment_mode', 'cash'),
                "customer_name": customer_name
            })
        return jsonify(output)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# --- Procurement (Purchases) ---
@app.route('/api/purchases', methods=['GET'])
def get_purchases():
    try:
        res = supabase.table('purchases').select('*, purchase_items(*, products(*))').order('purchase_date', desc=True).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/purchases', methods=['POST'])
def create_purchase():
    data = request.get_json()
    items = data.get('items', [])
    status = data.get('status', 'delivered')
    
    try:
        # 1. Create Purchase record
        res = supabase.table('purchases').insert({
            "supplier_name": data.get('supplier_name', 'General Supplier'),
            "total_cost": data.get('total_cost', 0),
            "status": status
        }).execute()
        purchase_id = res.data[0]['id']
        
        # 2. Add Purchase Items and (Optionally) Increase Stock
        for item in items:
            p_id = item['product_id']
            qty = int(item['quantity'])
            
            supabase.table('purchase_items').insert({
                "purchase_id": purchase_id,
                "product_id": p_id,
                "quantity": qty,
                "unit_cost": item['unit_cost']
            }).execute()
            
            # Increase Stock ONLY if delivered
            if status == 'delivered':
                prod = supabase.table('products').select('stock').eq('id', p_id).execute()
                if prod.data:
                    new_stock = int(prod.data[0]['stock']) + qty
                    supabase.table('products').update({"stock": new_stock}).eq('id', p_id).execute()
            
        return jsonify({"status": "success", "purchase_id": purchase_id})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Purchase failed: {str(e)}"}), 400

@app.route('/api/purchases/<int:id>', methods=['PUT', 'DELETE'])
def update_purchase(id):
    try:
        if request.method == 'PUT':
            data = request.get_json()
            # Simple update for now (supplier and status)
            res = supabase.table('purchases').update({
                "supplier_name": data.get('supplier_name'),
                "status": data.get('status')
            }).eq('id', id).execute()
            return jsonify({"status": "success", "data": res.data})
        else:
            # Delete items first then purchase
            supabase.table('purchase_items').delete().eq('purchase_id', id).execute()
            res = supabase.table('purchases').delete().eq('id', id).execute()
            return jsonify({"status": "success", "message": "Purchase deleted"})
    except Exception as e:
        print(f"Update/Delete Purchase Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 400

# --- Customers ---
@app.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        # 1. Fetch all customers
        cust_res = supabase.table('customers').select('*').execute()
        customers_list = cust_res.data or []
        
        # Identify Walking Customer and rename it as requested
        walking_id = None
        for c in customers_list:
            if c['name'].lower() == "walking customer":
                walking_id = c['id']
                c['name'] = "Walking Customer (Common)"
        
        # 2. Fetch Sales and Sale Items for aggregation
        sales_res = supabase.table('sales').select('id, customer_id, grand_total').execute()
        all_sales = sales_res.data or []
        
        # Mapping sale_id -> customer_id (with fallback to walking customer for unassigned sales)
        sale_to_cust = {}
        for s in all_sales:
             sale_to_cust[s['id']] = s.get('customer_id') or walking_id
             
        # Aggregation object
        stats = {c['id']: {'purchases': 0, 'items': 0, 'spent': 0.0} for c in customers_list}
        
        # Aggregate Sales
        for s in all_sales:
            cid = s.get('customer_id') or walking_id
            if cid and cid in stats:
                stats[cid]['purchases'] += 1
                stats[cid]['spent'] += float(s.get('grand_total', 0))
        
        # Aggregate Item Counts
        try:
            items_res = supabase.table('sale_items').select('sale_id, quantity').execute()
            for item in (items_res.data or []):
                sid = item.get('sale_id')
                cid = sale_to_cust.get(sid)
                if cid and cid in stats:
                    stats[cid]['items'] += int(item.get('quantity', 0))
        except Exception as item_err:
            print(f"Item counts aggregation skipped: {item_err}")

        # 3. Merge stats into customer objects
        for cust in customers_list:
            cid = cust['id']
            c_vals = stats.get(cid, {'purchases': 0, 'items': 0, 'spent': 0.0})
            cust['total_purchases'] = c_vals['purchases']
            cust['total_items'] = c_vals['items']
            cust['total_spent'] = c_vals['spent']
            
        return jsonify(customers_list)
    except Exception as e:
        print(f"Fetch Customers Error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.get_json()
    try:
        res = supabase.table('customers').insert(data).execute()
        return jsonify({"status": "success", "data": res.data})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == '__main__':
    app.run(port=5000)

