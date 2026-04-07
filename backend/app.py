from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from config import Config
import os
from functools import wraps
import jwt
import datetime

app = Flask(__name__, 
            static_folder=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend'), 
            static_url_path='')
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

from supabase import create_client, Client

# Supabase initialization
url: str = Config.SUPABASE_URL
key: str = Config.SUPABASE_KEY
supabase: Client = create_client(url, key)

# Robust Timeout settings for slow networks (Version-agnostic)
try:
    # Postgrest (Database) timeout
    if hasattr(supabase, 'postgrest'):
        supabase.postgrest.timeout = 60
    # Auth (Identity) timeout
    if hasattr(supabase, 'auth') and hasattr(supabase.auth, '_client'):
        supabase.auth._client.timeout = 60
except Exception as e:
    print(f"Warning: Could not set custom timeouts: {e}")

# Manually increase Auth timeout (if possible by accessing underlying client)
try:
    if hasattr(supabase.auth, '_client'):
        supabase.auth._client.timeout = 60
except:
    pass

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
    email = data.get('email')
    password = data.get('password')
    
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user = res.user
        token = res.session.access_token
        
        # Determine role from profiles table
        profile = supabase.table('profiles').select('*').eq('id', user.id).execute()
        role = profile.data[0]['role'] if profile.data else 'staff'
        full_name = profile.data[0]['full_name'] if profile.data else email
        
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
        # Standardize error message for clean UX
        error_msg = str(e)
        if "Email not confirmed" in error_msg:
             return jsonify({"status": "error", "message": "Email not verified. Please contact administrator."}), 401
        
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

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

# --- Products CRUD ---
@app.route('/api/products', methods=['GET'])
def get_products():
    res = supabase.table('products').select("*, categories(name)").execute()
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
    
    try:
        # 1. Create Sale entry
        res = supabase.table('sales').insert({
            "total_amount": data.get('subtotal', 0),
            "gst_amount": data.get('gst', 0),
            "grand_total": data.get('total', 0),
            "customer_id": customer_id,
            "user_id": user_id
        }).execute()
        
        if not res.data:
            raise Exception("Failed to insert sale")
            
        sale_id = res.data[0]['id']
        
        # 2. Add Sale Items and Update Stock
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
                "customer_name": customer_name
            })
        return jsonify(output)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# --- Procurement (Purchases) ---
@app.route('/api/purchases', methods=['GET'])
def get_purchases():
    try:
        res = supabase.table('purchases').select('*').order('purchase_date', desc=True).execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route('/api/purchases', methods=['POST'])
def create_purchase():
    data = request.get_json()
    items = data.get('items', [])
    
    try:
        # 1. Create Purchase record
        res = supabase.table('purchases').insert({
            "supplier_name": data.get('supplier_name', 'General Supplier'),
            "total_cost": data.get('total_cost', 0)
        }).execute()
        purchase_id = res.data[0]['id']
        
        # 2. Add Purchase Items and Increase Stock
        for item in items:
            p_id = item['product_id']
            qty = int(item['quantity'])
            
            supabase.table('purchase_items').insert({
                "purchase_id": purchase_id,
                "product_id": p_id,
                "quantity": qty,
                "unit_cost": item['unit_cost']
            }).execute()
            
            # Increase Stock
            prod = supabase.table('products').select('stock').eq('id', p_id).execute()
            if prod.data:
                new_stock = int(prod.data[0]['stock']) + qty
                supabase.table('products').update({"stock": new_stock}).eq('id', p_id).execute()
            
        return jsonify({"status": "success", "purchase_id": purchase_id})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Purchase failed: {str(e)}"}), 400

# --- Customers ---
@app.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        # Get customers with purchase count (simplification: just count sales)
        res = supabase.table('customers').select('*').execute()
        return jsonify(res.data)
    except Exception as e:
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

