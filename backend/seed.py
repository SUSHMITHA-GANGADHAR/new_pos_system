from supabase import create_client
import os

url = 'https://lqgdvacncugzlydvvijz.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ2R2YWNuY3Vnemx5ZHZ2aWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI0MDczOSwiZXhwIjoyMDg5ODE2NzM5fQ.0uYkrWU0Ukzf9fBv_73y8sLOUWwX5hxig0KEJF9tBF8'

print(f"Connecting to {url}...")

try:
    supabase = create_client(url, key)

    # ------------------ CATEGORIES ------------------
    print("Seeding categories...")
    supabase.table('categories').upsert([
        {'id': 1, 'name': 'Electronics'},
        {'id': 2, 'name': 'Groceries'},
        {'id': 3, 'name': 'Clothing'},
        {'id': 4, 'name': 'Beverages'},
        {'id': 5, 'name': 'Personal Care'},
        {'id': 6, 'name': 'Household'}
    ]).execute()

    # ------------------ PRODUCTS ------------------
    print("Seeding products...")
    supabase.table('products').upsert([

        # Electronics
        {'id': 1, 'name': 'Samsung Galaxy S23', 'sku': 'SM-G23', 'category_id': 1, 'price': 75000, 'stock': 45, 'low_stock_threshold': 5},
        {'id': 2, 'name': 'Bluetooth Headphones', 'sku': 'ELE-BTH', 'category_id': 1, 'price': 2999, 'stock': 35, 'low_stock_threshold': 5},
        {'id': 3, 'name': 'HP Laptop 15s', 'sku': 'ELE-HP15', 'category_id': 1, 'price': 55000, 'stock': 10, 'low_stock_threshold': 2},

        # Groceries
        {'id': 4, 'name': 'Fortune Sun Lite Oil', 'sku': 'GRO-OIL', 'category_id': 2, 'price': 180, 'stock': 120, 'low_stock_threshold': 10},
        {'id': 5, 'name': 'Rice Bag 25kg', 'sku': 'GRO-RICE', 'category_id': 2, 'price': 1800, 'stock': 60, 'low_stock_threshold': 10},
        {'id': 6, 'name': 'Toor Dal 1kg', 'sku': 'GRO-DAL', 'category_id': 2, 'price': 140, 'stock': 100, 'low_stock_threshold': 10},
        {'id': 7, 'name': 'Sugar 1kg', 'sku': 'GRO-SUG', 'category_id': 2, 'price': 50, 'stock': 200, 'low_stock_threshold': 20},

        # Clothing
        {'id': 8, 'name': 'Levis Slim Fit 511', 'sku': 'CLO-LEV', 'category_id': 3, 'price': 2499, 'stock': 30, 'low_stock_threshold': 5},
        {'id': 9, 'name': 'Nike Sports T-Shirt', 'sku': 'CLO-NIKE', 'category_id': 3, 'price': 1499, 'stock': 50, 'low_stock_threshold': 5},
        {'id': 10, 'name': 'Puma Hoodie', 'sku': 'CLO-PUMA', 'category_id': 3, 'price': 2999, 'stock': 20, 'low_stock_threshold': 5},

        # Beverages
        {'id': 11, 'name': 'Coca Cola 2L', 'sku': 'BEV-COC', 'category_id': 4, 'price': 95, 'stock': 200, 'low_stock_threshold': 20},
        {'id': 12, 'name': 'Pepsi 1.5L', 'sku': 'BEV-PEP', 'category_id': 4, 'price': 75, 'stock': 180, 'low_stock_threshold': 20},
        {'id': 13, 'name': 'Red Bull Energy Drink', 'sku': 'BEV-RB', 'category_id': 4, 'price': 125, 'stock': 70, 'low_stock_threshold': 10},

        # Personal Care
        {'id': 14, 'name': 'Dove Soap Pack', 'sku': 'PC-DOVE', 'category_id': 5, 'price': 180, 'stock': 90, 'low_stock_threshold': 10},
        {'id': 15, 'name': 'Colgate Toothpaste', 'sku': 'PC-COL', 'category_id': 5, 'price': 120, 'stock': 110, 'low_stock_threshold': 10},

        # Household
        {'id': 16, 'name': 'Surf Excel Detergent', 'sku': 'HH-SURF', 'category_id': 6, 'price': 250, 'stock': 80, 'low_stock_threshold': 10},
        {'id': 17, 'name': 'Lizol Floor Cleaner', 'sku': 'HH-LIZ', 'category_id': 6, 'price': 150, 'stock': 75, 'low_stock_threshold': 10},

    ]).execute()

    # ------------------ CUSTOMERS ------------------
    print("Seeding customers...")
    supabase.table('customers').upsert([
        {'id': 1, 'name': 'Rahul Sharma', 'phone': '9876543210', 'email': 'rahul@example.com'},
        {'id': 2, 'name': 'Priya Patel', 'phone': '9123456789', 'email': 'priya@example.com'},
        {'id': 3, 'name': 'Amit Verma', 'phone': '9012345678', 'email': 'amit@example.com'},
        {'id': 4, 'name': 'Sneha Reddy', 'phone': '9988776655', 'email': 'sneha@example.com'}
    ]).execute()

    print("✅ All seeds successful!")

except Exception as e:
    print(f"❌ Error: {e}")