import os
import json
import uuid
import mysql.connector
from mysql.connector import pooling
import datetime
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, request, jsonify, render_template, session, redirect, url_for, g, abort

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'finance_tracker_secret_key_change_in_production')

# MySQL Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'root'),
    'database': os.environ.get('DB_NAME', 'finance_tracker'),
    'port': int(os.environ.get('DB_PORT', '3306')),
    'autocommit': True
}

# Create connection pool
try:
    connection_pool = mysql.connector.pooling.MySQLConnectionPool(
    pool_name="finance_pool",
    pool_size=20,  # Increased from 5 to handle more concurrent requests
    **DB_CONFIG
)
except mysql.connector.Error as err:
    print(f"Error creating connection pool: {err}")
    exit(1)

# Database helper functions
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        try:
            db = g._database = connection_pool.get_connection()
        except mysql.connector.errors.PoolError as err:
            # Retry once with a delay
            import time
            time.sleep(0.5)
            try:
                db = g._database = connection_pool.get_connection()
            except mysql.connector.errors.PoolError as err:
                print(f"Error getting connection from pool after retry: {err}")
                # Create a new connection outside the pool if the pool is exhausted
                db = g._database = mysql.connector.connect(**DB_CONFIG)
        except mysql.connector.Error as err:
            print(f"Error getting connection from pool: {err}")
            raise
    return db

def query_db(query, args=(), one=False):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, args)
        rv = cursor.fetchall()
        cursor.close()
        return (rv[0] if rv else None) if one else rv
    except mysql.connector.Error as err:
        print(f"Error executing query: {err}")
        cursor.close()
        raise

def execute_db(query, args=()):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(query, args)
        last_id = cursor.lastrowid
        cursor.close()
        return last_id
    except mysql.connector.Error as err:
        print(f"Error executing statement: {err}")
        cursor.close()
        raise

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        try:
            db.close()
        except Exception as e:
            print(f"Error closing database connection: {e}")

in_trigger = False
# Replace the create_schema_file function with this improved version
# This fixes the DELIMITER handling for triggers

def create_schema_file():
    try:
        # Create schema.sql for MySQL
        with open('db.sql', 'r') as f:
            db_script = f.read()
        
        # Extract CREATE TABLE statements and other useful components
        lines = db_script.split('\n')
        filtered_lines = []
        current_statement = []
        in_create_table = False
        in_trigger = False
        trigger_lines = []
        skip_line = False
        
        for line in lines:
            skip_line = False
            
            # Skip database creation, use, and user creation lines
            if any(cmd in line.upper() for cmd in ['CREATE DATABASE', 'USE ', 'CREATE USER', 'GRANT', 'FLUSH']):
                skip_line = True
                continue
            
            # Handle DELIMITER statements for triggers
            if line.strip().startswith('DELIMITER //'):
                in_trigger = True
                # Don't include DELIMITER command in output
                continue
            elif in_trigger and line.strip() == 'DELIMITER ;':
                in_trigger = False
                continue
            # Handle CREATE TRIGGER statements
            elif in_trigger and line.strip().startswith('CREATE TRIGGER'):
                trigger_lines = [line.replace('//', ';')]
                continue
            elif in_trigger and line.strip() == 'END //':
                trigger_lines.append('END;')
                filtered_lines.extend(trigger_lines)
                trigger_lines = []
                continue
            elif in_trigger:
                trigger_lines.append(line)
                continue
            
            # Handle table creation
            if 'CREATE TABLE' in line and 'IF NOT EXISTS' in line:
                in_create_table = True
                current_statement = [line]
            elif in_create_table and ');' in line:
                current_statement.append(line)
                filtered_lines.extend(current_statement)
                in_create_table = False
                current_statement = []
            elif in_create_table:
                # Adjust the line for MySQL
                current_statement.append(line)
            # Handle INSERT statements for education content and other useful components
            elif line.strip().startswith('INSERT INTO'):
                filtered_lines.append(line)
            
            # Add any other SQL statements that aren't part of the above categories
            elif line.strip() and not skip_line and not in_trigger and not in_create_table:
                filtered_lines.append(line)
        
        # Filter out any empty statements before joining
        filtered_lines = [line for line in filtered_lines if line.strip()]
        
        # Write the filtered content to schema.sql
        with open('schema.sql', 'w') as f:
            f.write('\n'.join(filtered_lines))
        
        # Initialize the database
        init_db()
    except Exception as e:
        print(f"Error creating schema file: {e}")

# Also improve the init_db function to handle statements better
def init_db():
    try:
        # First, check if database exists, if not create it
        root_conn = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            port=DB_CONFIG['port']
        )
        root_cursor = root_conn.cursor()
        
        # Create database if not exists
        root_cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
        root_cursor.close()
        root_conn.close()
        
        # Now connect to the database and create the schema
        with app.app_context():
            conn = get_db()
            with open('schema.sql', 'r') as f:
                # Split the SQL file into separate statements
                sql_script = f.read()
                statements = sql_script.split(';')
                
                cursor = conn.cursor()
                for statement in statements:
                    # Skip empty statements
                    if statement.strip():
                        try:
                            # Add proper delimiter
                            stmt = statement.strip() + ";"
                            cursor.execute(stmt)
                        except mysql.connector.Error as err:
                            print(f"Error executing statement: {statement[:100]}... - {err}")
                cursor.close()
            
            # Check if any education content exists
            education_count = query_db("SELECT COUNT(*) as count FROM education_content", one=True)
            
            # If no education content, insert default content
            if education_count and education_count['count'] == 0:
                insert_default_education_content()
            
            print("Database initialized successfully")
    except mysql.connector.Error as err:
        print(f"Error initializing database: {err}")
        raise

def insert_default_education_content():
    defaults = [
        ('Beginner\'s Guide to Investing', 'Learn the basics of investing and how to start building wealth for your future.', 'VIDEO', 'https://www.youtube.com/watch?v=Uw_Gbr8mQiw', 'BEGINNER', 'investing,stocks,beginners'),
        ('Understanding Credit Scores', 'Discover how credit scores work and tips to improve your score.', 'ARTICLE', 'https://www.bankbazaar.com/credit-score.html', 'BEGINNER', 'credit,finance,101'),
        ('Budget Planning 101', 'Master the art of budgeting and take control of your finances.', 'GUIDE', 'https://www.personalfinanceclub.com/how-to-make-a-budget-the-simple-way/', 'BEGINNER', 'budget,planning,saving'),
        ('Advanced Investment Strategies', 'Take your investment knowledge to the next level with these advanced strategies.', 'VIDEO', 'https://www.youtube.com/watch?v=PHe0bXAIuk0', 'ADVANCED', 'investing,strategies,advanced'),
        ('Retirement Planning Made Simple', 'Plan for your retirement with these easy-to-follow steps.', 'ARTICLE', 'https://cleartax.in/s/retirement-planning', 'INTERMEDIATE', 'retirement,planning,401k,ira')
    ]
    
    for item in defaults:
        execute_db(
            'INSERT INTO education_content (title, description, content_type, url, level, tags, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())',
            item
        )

# New way to initialize database on startup
# This replaces the deprecated @app.before_first_request
with app.app_context():
    create_schema_file()

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function
# Routes
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/dashboard')
@login_required
def dashboard():
    # Check if the user is authenticated
    if 'user_id' not in session:
        # Not authenticated, redirect to login page
        return redirect(url_for('index'))
    
    return render_template('dashboard.html')


@app.route('/accounts')
@login_required
def accounts():
    return render_template('accounts.html')

@app.route('/transactions')
@login_required
def transactions():
    return render_template('transactions.html')

@app.route('/budget')
@login_required
def budget():
    return render_template('budget.html')

@app.route('/goals')
@login_required
def goals():
    return render_template('goals.html')

@app.route('/bills')
@login_required
def bills():
    return render_template('bills.html')

@app.route('/education')
@login_required
def education():
    return render_template('education.html')

@app.route('/settings')
@login_required
def settings():
    return render_template('settings.html')

# API Endpoints
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Missing email or password'}), 400
    
    user = query_db('SELECT * FROM users WHERE email = %s', [data['email']], one=True)
    
    # Check if user exists and has a valid password hash format
    if not user or not user['password_hash'] or ':' not in user['password_hash']:
       return jsonify({'message': 'Invalid email or password'}), 401
    
    try:
        password_valid = check_password_hash(user['password_hash'], data['password'])
        if not password_valid:
            return jsonify({'message': 'Invalid email or password'}), 401
    except ValueError:
        print(f"Invalid password hash format for user: {user['email']}")
        return jsonify({'message': 'Account error, please contact support'}), 500
    
    session['user_id'] = user['id']
    session['username'] = user['username']
    
    return jsonify({'message': 'Login successful', 'user': {'id': user['id'], 'username': user['username']}})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password') or not data.get('username') or not data.get('full_name'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Check if email already exists
    existing_user = query_db('SELECT id FROM users WHERE email = %s', [data['email']], one=True)
    if existing_user:
        return jsonify({'message': 'Email already exists'}), 409
    
    # Check if username already exists
    existing_username = query_db('SELECT id FROM users WHERE username = %s', [data['username']], one=True)
    if existing_username:
        return jsonify({'message': 'Username already exists'}), 409
    
    password_hash = generate_password_hash(data['password'])
    
    user_id = execute_db(
        'INSERT INTO users (username, email, password_hash, full_name, created_at) VALUES (%s, %s, %s, %s, NOW())',
        [data['username'], data['email'], password_hash, data['full_name']]
    )
    
    # Create default preferences
    execute_db('INSERT INTO user_preferences (user_id, currency, date_format, created_at) VALUES (%s, %s, %s, NOW())',
              [user_id, 'INR', 'YYYY-MM-DD'])
    
    # Create default categories
    default_categories = [
        (user_id, 'Salary', 'INCOME', 'fa-money-bill', '#10B981', True),
        (user_id, 'Bonus', 'INCOME', 'fa-gift', '#3B82F6', True),
        (user_id, 'Investment', 'INCOME', 'fa-chart-line', '#8B5CF6', True),
        (user_id, 'Housing', 'EXPENSE', 'fa-home', '#EF4444', True),
        (user_id, 'Food', 'EXPENSE', 'fa-utensils', '#F59E0B', True),
        (user_id, 'Transportation', 'EXPENSE', 'fa-car', '#10B981', True),
        (user_id, 'Entertainment', 'EXPENSE', 'fa-film', '#3B82F6', True),
        (user_id, 'Shopping', 'EXPENSE', 'fa-shopping-bag', '#EC4899', True),
        (user_id, 'Health', 'EXPENSE', 'fa-heartbeat', '#10B981', True),
        (user_id, 'Education', 'EXPENSE', 'fa-graduation-cap', '#8B5CF6', True),
        (user_id, 'Transfer', 'TRANSFER', 'fa-exchange-alt', '#6B7280', True)
    ]
    
    for category in default_categories:
        execute_db(
            'INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())',
            category
        )
    
    session['user_id'] = user_id
    session['username'] = data['username']
    
    return jsonify({'message': 'Registration successful', 'user': {'id': user_id, 'username': data['username']}})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    return jsonify({'message': 'Logout successful'})

@app.route('/api/profile', methods=['GET', 'PUT', 'DELETE'])
@login_required
def profile():
    user_id = session['user_id']
    
    if request.method == 'GET':
        user = query_db('SELECT id, username, email, full_name FROM users WHERE id = %s', [user_id], one=True)
        preferences = query_db('SELECT currency, date_format, theme, notification_enabled, email_notification FROM user_preferences WHERE user_id = %s', [user_id], one=True)
        
        return jsonify({
            'user': user,
            'preferences': preferences if preferences else None
        })
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        if data.get('current_password') and data.get('new_password'):
            # Update password
            user = query_db('SELECT password_hash FROM users WHERE id = %s', [user_id], one=True)
            
            if not check_password_hash(user['password_hash'], data['current_password']):
                return jsonify({'message': 'Current password is incorrect'}), 401
            
            new_password_hash = generate_password_hash(data['new_password'])
            execute_db('UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s',
                      [new_password_hash, user_id])
            
            return jsonify({'message': 'Password updated successfully'})
        
        # Update profile details
        if data.get('full_name'):
            execute_db('UPDATE users SET full_name = %s, updated_at = NOW() WHERE id = %s',
                     [data['full_name'], user_id])
        
        if data.get('email'):
            execute_db('UPDATE users SET email = %s, updated_at = NOW() WHERE id = %s',
                     [data['email'], user_id])
        
        # Update preferences
        if any(key in data for key in ['currency', 'date_format', 'theme', 'notification_enabled', 'email_notification']):
            pref_fields = []
            pref_values = []
            
            for key in ['currency', 'date_format', 'theme', 'notification_enabled', 'email_notification']:
                if key in data:
                    pref_fields.append(f"{key} = %s")
                    pref_values.append(data[key])
            
            if pref_fields:
                pref_values.append(user_id)
                execute_db(f'UPDATE user_preferences SET {", ".join(pref_fields)}, updated_at = NOW() WHERE user_id = %s',
                         pref_values)
        
        return jsonify({'message': 'Profile updated successfully'})
    
    elif request.method == 'DELETE':
        data = request.get_json()
        
        if not data or not data.get('password'):
            return jsonify({'message': 'Password is required to delete account'}), 400
        
        user = query_db('SELECT password_hash FROM users WHERE id = %s', [user_id], one=True)
        
        if not check_password_hash(user['password_hash'], data['password']):
            return jsonify({'message': 'Password is incorrect'}), 401
        
        # Delete user and all related data
        execute_db('DELETE FROM users WHERE id = %s', [user_id])
        
        session.pop('user_id', None)
        session.pop('username', None)
        
        return jsonify({'message': 'Account deleted successfully'})

@app.route('/api/accounts', methods=['GET', 'POST'])
@login_required
def api_accounts():
    user_id = session['user_id']
    
    if request.method == 'GET':
        accounts = query_db('SELECT * FROM accounts WHERE user_id = %s AND is_active = 1', [user_id])
        return jsonify({'accounts': accounts})
    
    elif request.method == 'POST':
        data = request.get_json()
        
        if not data or not data.get('account_name') or not data.get('account_type') or 'balance' not in data:
            return jsonify({'message': 'Missing required fields'}), 400
        
        account_id = execute_db(
            'INSERT INTO accounts (user_id, account_name, account_type, account_number, balance, currency, institution, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())',
            [user_id, data['account_name'], data['account_type'], data.get('account_number', ''), data['balance'], data.get('currency', 'INR'), data.get('institution', '')]
        )
        
        return jsonify({'message': 'Account created successfully', 'account_id': account_id})

@app.route('/api/accounts/<int:account_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_account(account_id):
    user_id = session['user_id']
    
    # Check if account belongs to user
    account = query_db('SELECT * FROM accounts WHERE id = %s AND user_id = %s', [account_id, user_id], one=True)
    
    if not account:
        return jsonify({'message': 'Account not found'}), 404
    
    if request.method == 'GET':
        return jsonify({'account': account})
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        if not data:
            return jsonify({'message': 'No data provided'}), 400
        
        fields = []
        values = []
        
        for key in ['account_name', 'account_type', 'account_number', 'balance', 'currency', 'institution', 'is_active']:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])
        
        if fields:
            values.append(account_id)
            execute_db(f'UPDATE accounts SET {", ".join(fields)}, updated_at = NOW() WHERE id = %s', values)
        
        return jsonify({'message': 'Account updated successfully'})
    
    elif request.method == 'DELETE':
        # Soft delete
        execute_db('delete from  accounts WHERE id = %s', [account_id])
        return jsonify({'message': 'Account deleted successfully'})

@app.route('/api/transactions', methods=['GET', 'POST'])
@login_required
def api_transactions():
    user_id = session['user_id']
    
    if request.method == 'GET':
        # Current code for retrieving transactions
        limit = int(request.args.get('limit', 50))
        account_id = request.args.get('account_id')
        
        # Build query
        query = """
            SELECT t.*, a.account_name, c.name as category_name, c.icon as category_icon, 
                c.color as category_color 
            FROM transactions t
            LEFT JOIN accounts a ON t.account_id = a.id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s
        """
        params = [user_id]
        
        # Add account filter if provided
        if account_id:
            query += " AND t.account_id = %s"
            params.append(account_id)
        
        # Add order and limit
        query += " ORDER BY t.transaction_date DESC LIMIT %s"
        params.append(limit)
        
        transactions = query_db(query, params)
        return jsonify({'transactions': transactions})
    
    elif request.method == 'POST':
        data = request.get_json()
        
        if not data or not data.get('account_id') or not data.get('amount') or not data.get('description') or not data.get('transaction_date') or not data.get('transaction_type'):
            return jsonify({'message': 'Missing required fields'}), 400
        
        # Insert transaction
        transaction_id = execute_db(
            'INSERT INTO transactions (user_id, account_id, category_id, amount, description, transaction_date, transaction_type, is_recurring, notes, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())',
            [user_id, data['account_id'], data.get('category_id'), data['amount'], data['description'], data['transaction_date'], data['transaction_type'], data.get('is_recurring', False), data.get('notes', '')]
        )
        
        # Update account balance
        if data['transaction_type'] == 'INCOME':
            execute_db('UPDATE accounts SET balance = balance + %s WHERE id = %s', [data['amount'], data['account_id']])
        elif data['transaction_type'] == 'EXPENSE':
            execute_db('UPDATE accounts SET balance = balance - %s WHERE id = %s', [data['amount'], data['account_id']])
        
        return jsonify({'message': 'Transaction added successfully', 'transaction_id': transaction_id})

@app.route('/api/transactions/<int:transaction_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_transaction(transaction_id):
    user_id = session['user_id']
    
    # Check if transaction belongs to user
    transaction = query_db('SELECT * FROM transactions WHERE id = %s AND user_id = %s', [transaction_id, user_id], one=True)
    
    if not transaction:
        return jsonify({'message': 'Transaction not found'}), 404
    
    if request.method == 'GET':
        return jsonify({'transaction': transaction})
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        if not data:
            return jsonify({'message': 'No data provided'}), 400
        
        # Get original transaction data for balance adjustment
        original = transaction
        
        fields = []
        values = []
        
        for key in ['account_id', 'category_id', 'amount', 'description', 'transaction_date', 'transaction_type', 'is_recurring', 'notes']:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])
        
        if fields:
            values.append(transaction_id)
            execute_db(f'UPDATE transactions SET {", ".join(fields)}, updated_at = NOW() WHERE id = %s', values)
            
            # Adjust account balances if needed
            if 'amount' in data or 'transaction_type' in data or 'account_id' in data:
                # Revert original transaction effect
                if original['transaction_type'] == 'INCOME':
                    execute_db('UPDATE accounts SET balance = balance - %s WHERE id = %s', [original['amount'], original['account_id']])
                elif original['transaction_type'] == 'EXPENSE':
                    execute_db('UPDATE accounts SET balance = balance + %s WHERE id = %s', [original['amount'], original['account_id']])
                
                # Apply new transaction effect
                new_type = data.get('transaction_type', original['transaction_type'])
                new_amount = data.get('amount', original['amount'])
                new_account = data.get('account_id', original['account_id'])
                
                if new_type == 'INCOME':
                    execute_db('UPDATE accounts SET balance = balance + %s WHERE id = %s', [new_amount, new_account])
                elif new_type == 'EXPENSE':
                    execute_db('UPDATE accounts SET balance = balance - %s WHERE id = %s', [new_amount, new_account])
        
        return jsonify({'message': 'Transaction updated successfully'})
    
    elif request.method == 'DELETE':
        # Adjust account balance before deleting
        if transaction['transaction_type'] == 'INCOME':
            execute_db('UPDATE accounts SET balance = balance - %s WHERE id = %s', [transaction['amount'], transaction['account_id']])
        elif transaction['transaction_type'] == 'EXPENSE':
            execute_db('UPDATE accounts SET balance = balance + %s WHERE id = %s', [transaction['amount'], transaction['account_id']])
        
        # Delete the transaction
        execute_db('DELETE FROM transactions WHERE id = %s', [transaction_id])
        
        return jsonify({'message': 'Transaction deleted successfully'})

@app.route('/api/categories', methods=['GET', 'POST'])
@login_required
def api_categories():
    user_id = session['user_id']
    
    if request.method == 'GET':
        category_type = request.args.get('type')
        
        query = "SELECT * FROM categories WHERE user_id = %s"
        params = [user_id]
        
        if category_type:
            query += " AND type = %s"
            params.append(category_type)
        
        query += " ORDER BY name ASC"
        
        categories = query_db(query, params)
        
        return jsonify({'categories': categories})
    
    elif request.method == 'POST':
        data = request.get_json()
        
        if not data or not data.get('name') or not data.get('type'):
            return jsonify({'message': 'Missing required fields'}), 400
        
        # Check if category with same name already exists
        existing = query_db('SELECT id FROM categories WHERE user_id = %s AND name = %s', [user_id, data['name']], one=True)
        if existing:
            return jsonify({'message': 'Category with this name already exists'}), 409
        
        category_id = execute_db(
            'INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())',
            [user_id, data['name'], data['type'], data.get('icon', 'fa-tag'), data.get('color', '#6B7280'), False]
        )
        
        return jsonify({'message': 'Category created successfully', 'category_id': category_id})

@app.route('/api/categories/<int:category_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_category(category_id):
    user_id = session['user_id']
    
    # Check if category belongs to user
    category = query_db('SELECT * FROM categories WHERE id = %s AND user_id = %s', [category_id, user_id], one=True)
    
    if not category:
        return jsonify({'message': 'Category not found'}), 404
    
    if request.method == 'GET':
        return jsonify({'category': category})
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        if not data:
            return jsonify({'message': 'No data provided'}), 400
        
        # Check if updating to a name that already exists
        if data.get('name'):
            existing = query_db('SELECT id FROM categories WHERE user_id = %s AND name = %s AND id != %s', 
                              [user_id, data['name'], category_id], one=True)
            if existing:
                return jsonify({'message': 'Category with this name already exists'}), 409
        
        fields = []
        values = []
        
        for key in ['name', 'type', 'icon', 'color']:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])
        
        if fields:
            values.append(category_id)
            execute_db(f'UPDATE categories SET {", ".join(fields)}, updated_at = NOW() WHERE id = %s', values)
        
        return jsonify({'message': 'Category updated successfully'})
    
    elif request.method == 'DELETE':
        # Check if it's a default category
        if category['is_default']:
            return jsonify({'message': 'Cannot delete default category'}), 400
        
        # Check if category is used in transactions
        used = query_db('SELECT id FROM transactions WHERE category_id = %s LIMIT 1', [category_id], one=True)
        if used:
            return jsonify({'message': 'Category is used in transactions and cannot be deleted'}), 400
        
        # Delete the category
        execute_db('DELETE FROM categories WHERE id = %s', [category_id])
        
        return jsonify({'message': 'Category deleted successfully'})

@app.route('/api/goals', methods=['GET', 'POST'])
@login_required
def api_goals():
    user_id = session['user_id']
    
    if request.method == 'GET':
        try:
            # Get all goals for the user
            goals = query_db('SELECT * FROM goals WHERE user_id = %s ORDER BY created_at DESC', [user_id])
            
            # Format dates for JSON serialization
            for goal in goals:
                if goal['target_date']:
                    goal['target_date'] = goal['target_date'].strftime('%Y-%m-%d')
                if goal['created_at']:
                    goal['created_at'] = goal['created_at'].strftime('%Y-%m-%d %H:%M:%S')
                if goal['updated_at']:
                    goal['updated_at'] = goal['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            return jsonify({'goals': goals})
        except Exception as e:
            print(f"Error fetching goals: {e}")
            return jsonify({'message': 'Failed to load goals', 'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            if not data or not data.get('name') or not data.get('target_amount'):
                return jsonify({'message': 'Missing required fields'}), 400
            
            # Prepare data for insertion
            insert_data = {
                'user_id': user_id,
                'name': data.get('name'),
                'description': data.get('description', ''),
                'target_amount': float(data.get('target_amount')),
                'current_amount': float(data.get('current_amount', 0)),
                'icon': data.get('icon', 'fa-bullseye'),
                'color': data.get('color', '#3B82F6')
            }
            
            # Add target date if provided
            if data.get('target_date'):
                insert_data['target_date'] = data.get('target_date')
            
            # Check if goal is complete
            if float(insert_data['current_amount']) >= float(insert_data['target_amount']):
                insert_data['is_completed'] = True
            
            # Build the SQL query
            fields = ', '.join(insert_data.keys())
            placeholders = ', '.join(['%s'] * len(insert_data))
            query = f'INSERT INTO goals ({fields}, created_at) VALUES ({placeholders}, NOW())'
            
            # Execute query
            goal_id = execute_db(query, list(insert_data.values()))
            
            return jsonify({'message': 'Goal created successfully', 'goal_id': goal_id})
        except Exception as e:
            print(f"Error creating goal: {e}")
            return jsonify({'message': 'Failed to create goal', 'error': str(e)}), 500


@app.route('/api/goals/<int:goal_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_goal(goal_id):
    user_id = session['user_id']
    
    # Check if goal belongs to user
    goal = query_db('SELECT * FROM goals WHERE id = %s AND user_id = %s', [goal_id, user_id], one=True)
    
    if not goal:
        return jsonify({'message': 'Goal not found'}), 404
    
    if request.method == 'GET':
        try:
            # Format dates for JSON serialization
            if goal['target_date']:
                goal['target_date'] = goal['target_date'].strftime('%Y-%m-%d')
            if goal['created_at']:
                goal['created_at'] = goal['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if goal['updated_at'] and goal['updated_at'] is not None:
                goal['updated_at'] = goal['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            # Get contributions for this goal - fixed JOIN with accounts
            contributions = query_db(
                '''SELECT gc.*, a.account_name 
                   FROM goal_contributions gc 
                   LEFT JOIN transactions t ON gc.transaction_id = t.id
                   LEFT JOIN accounts a ON t.account_id = a.id 
                   WHERE gc.goal_id = %s 
                   ORDER BY gc.contribution_date DESC''', 
                [goal_id]
            )
            
            # Format dates in contributions
            for contrib in contributions:
                if contrib['contribution_date']:
                    contrib['contribution_date'] = contrib['contribution_date'].strftime('%Y-%m-%d')
                if contrib['created_at']:
                    contrib['created_at'] = contrib['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            # Add contributions to goal object
            goal_dict = dict(goal)
            goal_dict['contributions'] = contributions
            
            return jsonify({'goal': goal_dict})
        except Exception as e:
            print(f"Error fetching goal details: {e}")
            return jsonify({'message': 'Failed to load goal details', 'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'message': 'No data provided'}), 400
            
            # Prepare update data
            update_data = {}
            
            for key in ['name', 'description', 'target_amount', 'current_amount', 'target_date', 'icon', 'color']:
                if key in data:
                    update_data[key] = data[key]
            
            # Check if goal should be marked as completed
            if 'current_amount' in update_data and 'target_amount' in update_data:
                if float(update_data['current_amount']) >= float(update_data['target_amount']):
                    update_data['is_completed'] = True
                else:
                    update_data['is_completed'] = False
            elif 'current_amount' in update_data:
                if float(update_data['current_amount']) >= float(goal['target_amount']):
                    update_data['is_completed'] = True
                else:
                    update_data['is_completed'] = False
            elif 'target_amount' in update_data:
                if float(goal['current_amount']) >= float(update_data['target_amount']):
                    update_data['is_completed'] = True
                else:
                    update_data['is_completed'] = False
            
            if update_data:
                # Build the SQL query
                set_clause = ', '.join([f"{key} = %s" for key in update_data.keys()])
                query = f'UPDATE goals SET {set_clause}, updated_at = NOW() WHERE id = %s'
                
                # Execute query
                values = list(update_data.values()) + [goal_id]
                execute_db(query, values)
            
            return jsonify({'message': 'Goal updated successfully'})
        except Exception as e:
            print(f"Error updating goal: {e}")
            return jsonify({'message': 'Failed to update goal', 'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        try:
            # Delete all contributions first
            execute_db('DELETE FROM goal_contributions WHERE goal_id = %s', [goal_id])
            
            # Then delete the goal
            execute_db('DELETE FROM goals WHERE id = %s', [goal_id])
            
            return jsonify({'message': 'Goal deleted successfully'})
        except Exception as e:
            print(f"Error deleting goal: {e}")
            return jsonify({'message': 'Failed to delete goal', 'error': str(e)}), 500

@app.route('/api/goals/<int:goal_id>/contribute', methods=['POST'])
@login_required
def contribute_to_goal(goal_id):
    user_id = session['user_id']
    
    # Check if goal belongs to user
    goal = query_db('SELECT * FROM goals WHERE id = %s AND user_id = %s', [goal_id, user_id], one=True)
    
    if not goal:
        return jsonify({'message': 'Goal not found'}), 404
    
    try:
        data = request.get_json()
        
        if not data or not data.get('amount') or not data.get('contribution_date'):
            return jsonify({'message': 'Missing required fields'}), 400
        
        contribution_amount = float(data.get('amount', 0))
        transaction_id = None
        
        # If contribution is from an account, create a transaction
        if data.get('account_id'):
            account_id = data.get('account_id')
            
            # Create an expense transaction
            transaction_id = execute_db(
                '''INSERT INTO transactions 
                   (user_id, account_id, amount, description, transaction_date, transaction_type, created_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, NOW())''',
                [user_id, account_id, contribution_amount, f"Contribution to {goal['name']}", 
                 data['contribution_date'], 'EXPENSE']
            )
            
            # Update account balance
            execute_db('UPDATE accounts SET balance = balance - %s WHERE id = %s', 
                      [contribution_amount, account_id])
        
        # Add the contribution - without account_id which doesn't exist in the schema
        contribution_id = execute_db(
            '''INSERT INTO goal_contributions 
               (goal_id, user_id, amount, contribution_date, notes, transaction_id, created_at) 
               VALUES (%s, %s, %s, %s, %s, %s, NOW())''',
            [goal_id, user_id, contribution_amount, data['contribution_date'], 
             data.get('notes', ''), transaction_id]
        )
        
        # Calculate new amount - careful with decimal conversion
        current_amount = float(goal['current_amount']) if goal['current_amount'] else 0
        new_amount = current_amount + contribution_amount
        
        # Check if goal is now completed
        is_completed = new_amount >= float(goal['target_amount'])
        
        # Update goal current amount
        execute_db(
            'UPDATE goals SET current_amount = %s, is_completed = %s, updated_at = NOW() WHERE id = %s',
            [new_amount, is_completed, goal_id]
        )
        
        return jsonify({
            'message': 'Contribution added successfully', 
            'contribution_id': contribution_id,
            'current_amount': new_amount,
            'is_completed': is_completed
        })
    except Exception as e:
        print(f"Error adding contribution: {e}")
        return jsonify({'message': 'Failed to add contribution', 'error': str(e)}), 500

@app.route('/api/bills', methods=['GET', 'POST'])
@login_required
def api_bills():
    user_id = session['user_id']
    
    if request.method == 'GET':
        # Get upcoming bills
        today = datetime.date.today()
        
        bills = query_db(
            'SELECT b.*, c.name as category_name, a.account_name, DATEDIFF(b.due_date, %s) as days_until_due ' +
            'FROM bills b ' +
            'LEFT JOIN categories c ON b.category_id = c.id ' +
            'LEFT JOIN accounts a ON b.account_id = a.id ' +
            'WHERE b.user_id = %s AND (b.is_paid = 0 OR b.last_paid_date IS NULL OR DATEDIFF(NOW(), b.last_paid_date) > 30) ' +
            'ORDER BY b.due_date ASC',
            [today.strftime('%Y-%m-%d'), user_id]
        )
        
        return jsonify({'bills': bills})
    
    elif request.method == 'POST':
        data = request.get_json()
        
        if not data or not data.get('name') or not data.get('amount') or not data.get('due_date') or not data.get('frequency'):
            return jsonify({'message': 'Missing required fields'}), 400
        
        bill_id = execute_db(
            'INSERT INTO bills (user_id, name, description, amount, due_date, frequency, category_id, account_id, auto_pay, reminder_days, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())',
            [user_id, data['name'], data.get('description', ''), data['amount'], data['due_date'], data['frequency'], 
             data.get('category_id'), data.get('account_id'), data.get('auto_pay', False), data.get('reminder_days', 3)]
        )
        
        return jsonify({'message': 'Bill created successfully', 'bill_id': bill_id})

@app.route('/api/bills/<int:bill_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_bill(bill_id):
    user_id = session['user_id']
    
    # Check if bill belongs to user
    bill = query_db('SELECT * FROM bills WHERE id = %s AND user_id = %s', [bill_id, user_id], one=True)
    
    if not bill:
        return jsonify({'message': 'Bill not found'}), 404
    
    if request.method == 'GET':
        return jsonify({'bill': bill})
    
    elif request.method == 'PUT':
        data = request.get_json()
        
        if not data:
            return jsonify({'message': 'No data provided'}), 400
        
        fields = []
        values = []
        
        for key in ['name', 'description', 'amount', 'due_date', 'frequency', 'category_id', 'account_id', 'is_paid', 'last_paid_date', 'auto_pay', 'reminder_days']:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])
        
        if fields:
            values.append(bill_id)
            execute_db(f'UPDATE bills SET {", ".join(fields)}, updated_at = NOW() WHERE id = %s', values)
        
        return jsonify({'message': 'Bill updated successfully'})
    
    elif request.method == 'DELETE':
        execute_db('DELETE FROM bills WHERE id = %s', [bill_id])
        return jsonify({'message': 'Bill deleted successfully'})

@app.route('/api/bills/<int:bill_id>/pay', methods=['POST'])
@login_required
def pay_bill(bill_id):
    user_id = session['user_id']
    
    # Check if bill belongs to user
    bill = query_db('SELECT * FROM bills WHERE id = %s AND user_id = %s', [bill_id, user_id], one=True)
    
    if not bill:
        return jsonify({'message': 'Bill not found'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('account_id') or not data.get('payment_date'):
        return jsonify({'message': 'Missing required fields'}), 400
    
    # Create an expense transaction
    transaction_id = execute_db(
        'INSERT INTO transactions (user_id, account_id, category_id, amount, description, transaction_date, transaction_type, notes, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())',
        [user_id, data['account_id'], bill['category_id'], bill['amount'], f"Payment for {bill['name']}", data['payment_date'], 'EXPENSE', data.get('notes', '')]
    )
    
    # Update account balance
    execute_db('UPDATE accounts SET balance = balance - %s WHERE id = %s', [bill['amount'], data['account_id']])
    
    # Update bill status
    execute_db('UPDATE bills SET is_paid = 1, last_paid_date = %s, updated_at = NOW() WHERE id = %s',
              [data['payment_date'], bill_id])
    
    # Calculate next due date based on frequency
    next_due_date = None
    due_date = datetime.datetime.strptime(bill['due_date'].strftime('%Y-%m-%d'), '%Y-%m-%d').date()
    
    if bill['frequency'] == 'DAILY':
        next_due_date = due_date + datetime.timedelta(days=1)
    elif bill['frequency'] == 'WEEKLY':
        next_due_date = due_date + datetime.timedelta(weeks=1)
    elif bill['frequency'] == 'MONTHLY':
        # Add a month (approximately)
        if due_date.month == 12:
            next_due_date = due_date.replace(year=due_date.year + 1, month=1)
        else:
            next_due_date = due_date.replace(month=due_date.month + 1)
    elif bill['frequency'] == 'YEARLY':
        next_due_date = due_date.replace(year=due_date.year + 1)
    
    # If it's a recurring bill, create the next instance
    if bill['frequency'] != 'ONCE' and next_due_date:
        execute_db('UPDATE bills SET due_date = %s, is_paid = 0, last_paid_date = %s, updated_at = NOW() WHERE id = %s',
                  [next_due_date.strftime('%Y-%m-%d'), data['payment_date'], bill_id])
    
    return jsonify({'message': 'Bill paid successfully', 'transaction_id': transaction_id})

@app.route('/api/budget', methods=['GET', 'POST'])
@login_required
def api_budget():
    user_id = session['user_id']
    
    if request.method == 'GET':
        try:
            # Get month and year from query parameters, default to current
            month = int(request.args.get('month', datetime.date.today().month))
            year = int(request.args.get('year', datetime.date.today().year))
            
            # Format the month for date-based comparisons
            month_str = f"{year}-{month:02d}"
            
            # Get budget items with category info
            budget_items = query_db(
                '''SELECT b.id, c.id as category_id, c.name as category_name, c.icon, c.color, 
                          b.amount as budget_amount
                   FROM budget b
                   JOIN categories c ON b.category_id = c.id
                   WHERE b.user_id = %s AND b.month = %s AND b.year = %s''',
                [user_id, month, year]
            )
            
            # For each budget item, get the actual spending
            for item in budget_items:
                # Get actual spending for this category in this month
                actual_spending = query_db(
                    '''SELECT COALESCE(SUM(amount), 0) as actual_amount
                       FROM transactions
                       WHERE user_id = %s AND category_id = %s AND transaction_type = 'EXPENSE'
                       AND DATE_FORMAT(transaction_date, '%%Y-%%m') = %s''',
                    [user_id, item['category_id'], month_str],
                    one=True
                )
                
                # Add actual amount to the item
                item['actual_amount'] = float(actual_spending['actual_amount']) if actual_spending and actual_spending['actual_amount'] else 0
            
            # Calculate totals
            total_budget = sum(float(item['budget_amount']) for item in budget_items)
            
            # Get total spent for the month
            total_spent_result = query_db(
                '''SELECT COALESCE(SUM(amount), 0) as total_spent
                   FROM transactions
                   WHERE user_id = %s AND transaction_type = 'EXPENSE'
                   AND DATE_FORMAT(transaction_date, '%%Y-%%m') = %s''',
                [user_id, month_str],
                one=True
            )
            
            total_spent = float(total_spent_result['total_spent']) if total_spent_result and total_spent_result['total_spent'] else 0
            
            # Calculate days info for daily budget
            today = datetime.date.today()
            current_month = datetime.date(year, month, 1)
            
            # Calculate days in month
            if month == 12:
                next_month = datetime.date(year + 1, 1, 1)
            else:
                next_month = datetime.date(year, month + 1, 1)
                
            days_in_month = (next_month - current_month).days
            
            # If month is current month, calculate days left
            if today.year == year and today.month == month:
                days_passed = today.day - 1  # Not counting today
                days_left = days_in_month - today.day + 1  # Including today
            elif (year > today.year) or (year == today.year and month > today.month):
                # Future month
                days_passed = 0
                days_left = days_in_month
            else:
                # Past month
                days_passed = days_in_month
                days_left = 0
            
            # Calculate daily budget
            daily_budget = (total_budget - total_spent) / days_left if days_left > 0 else 0
            
            # Prepare the response
            response = {
                'budget_items': budget_items,
                'totals': {
                    'total_budget': total_budget,
                    'total_spent': total_spent,
                    'remaining': total_budget - total_spent,
                    'days_in_month': days_in_month,
                    'days_passed': days_passed,
                    'days_left': days_left,
                    'daily_budget': daily_budget
                }
            }
            
            return jsonify(response)
        except Exception as e:
            print(f"Error fetching budget: {e}")
            return jsonify({'message': 'Failed to load budget', 'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            if not data or not data.get('category_id') or 'amount' not in data or not data.get('month') or not data.get('year'):
                return jsonify({'message': 'Missing required fields'}), 400
            
            # Check if budget already exists for this category, month, and year
            existing = query_db(
                'SELECT id FROM budget WHERE user_id = %s AND category_id = %s AND month = %s AND year = %s',
                [user_id, data['category_id'], data['month'], data['year']],
                one=True
            )
            
            if existing:
                # Update existing budget
                budget_id = existing['id']
                execute_db(
                    'UPDATE budget SET amount = %s, updated_at = NOW() WHERE id = %s',
                    [data['amount'], budget_id]
                )
                message = 'Budget updated successfully'
            else:
                # Create new budget
                budget_id = execute_db(
                    'INSERT INTO budget (user_id, category_id, amount, month, year, created_at) VALUES (%s, %s, %s, %s, %s, NOW())',
                    [user_id, data['category_id'], data['amount'], data['month'], data['year']]
                )
                message = 'Budget created successfully'
            
            return jsonify({'message': message, 'budget_id': budget_id})
        except Exception as e:
            print(f"Error creating/updating budget: {e}")
            return jsonify({'message': 'Failed to save budget', 'error': str(e)}), 500


@app.route('/api/budget/<int:budget_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_budget_item(budget_id):
    user_id = session['user_id']
    
    # Check if budget belongs to user
    budget = query_db('SELECT * FROM budget WHERE id = %s AND user_id = %s', [budget_id, user_id], one=True)
    
    if not budget:
        return jsonify({'message': 'Budget not found'}), 404
    
    if request.method == 'GET':
        try:
            # Format dates for JSON serialization
            if budget['created_at']:
                budget['created_at'] = budget['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if budget['updated_at'] and budget['updated_at'] is not None:
                budget['updated_at'] = budget['updated_at'].strftime('%Y-%m-%d %H:%M:%S')
            
            # Get category details
            category = query_db(
                'SELECT name, icon, color FROM categories WHERE id = %s',
                [budget['category_id']],
                one=True
            )
            
            if category:
                budget['category_name'] = category['name']
                budget['category_icon'] = category['icon']
                budget['category_color'] = category['color']
            
            # Get actual spending for this budget
            month_str = f"{budget['year']}-{budget['month']:02d}"
            actual_spending = query_db(
                '''SELECT COALESCE(SUM(amount), 0) as actual_amount
                   FROM transactions
                   WHERE user_id = %s AND category_id = %s AND transaction_type = 'EXPENSE'
                   AND DATE_FORMAT(transaction_date, '%%Y-%%m') = %s''',
                [user_id, budget['category_id'], month_str],
                one=True
            )
            
            budget['actual_amount'] = float(actual_spending['actual_amount']) if actual_spending and actual_spending['actual_amount'] else 0
            
            return jsonify({'budget': budget})
        except Exception as e:
            print(f"Error fetching budget details: {e}")
            return jsonify({'message': 'Failed to load budget details', 'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            
            if not data or 'amount' not in data:
                return jsonify({'message': 'Missing required fields'}), 400
            
            # Update budget amount
            execute_db(
                'UPDATE budget SET amount = %s, updated_at = NOW() WHERE id = %s',
                [data['amount'], budget_id]
            )
            
            return jsonify({'message': 'Budget updated successfully'})
        except Exception as e:
            print(f"Error updating budget: {e}")
            return jsonify({'message': 'Failed to update budget', 'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        try:
            # Delete the budget
            execute_db('DELETE FROM budget WHERE id = %s', [budget_id])
            
            return jsonify({'message': 'Budget deleted successfully'})
        except Exception as e:
            print(f"Error deleting budget: {e}")
            return jsonify({'message': 'Failed to delete budget', 'error': str(e)}), 500

@app.route('/api/education', methods=['GET'])
@login_required
def api_education():
    # Query parameters for filtering
    level = request.args.get('level')
    content_type = request.args.get('content_type')
    search = request.args.get('search')
    
    query = "SELECT * FROM education_content"
    params = []
    
    if level or content_type or search:
        query += " WHERE"
        conditions = []
        
        if level:
            conditions.append("level = %s")
            params.append(level)
        
        if content_type:
            conditions.append("content_type = %s")
            params.append(content_type)
        
        if search:
            conditions.append("(title LIKE %s OR description LIKE %s OR tags LIKE %s)")
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])
        
        query += " " + " AND ".join(conditions)
    
    query += " ORDER BY level, title"
    
    education_content = query_db(query, params)
    
    return jsonify({'education_content': education_content})

@app.route('/api/dashboard/summary', methods=['GET'])
@login_required
def dashboard_summary():
    user_id = session['user_id']
    
    # Get current month and year
    today = datetime.date.today()
    
    # Get income and expenses for current month
    income_expense = query_db(
        'SELECT ' +
        'COALESCE(SUM(CASE WHEN transaction_type = "INCOME" THEN amount ELSE 0 END), 0) as income, ' +
        'COALESCE(SUM(CASE WHEN transaction_type = "EXPENSE" THEN amount ELSE 0 END), 0) as expenses ' +
        'FROM transactions ' +
        'WHERE user_id = %s AND ( year(transaction_date)=year(CURDATE()) and month(transaction_date)=month(CURDATE()) )',
        [user_id],
        one=True
    )
    
    # Get income and expenses for previous month
    prev_income_expense = query_db(
        'SELECT ' +
        'COALESCE(SUM(CASE WHEN transaction_type = "INCOME" THEN amount ELSE 0 END), 0) as income, ' +
        'COALESCE(SUM(CASE WHEN transaction_type = "EXPENSE" THEN amount ELSE 0 END), 0) as expenses ' +
        'FROM transactions ' +
        'WHERE user_id = %s AND ( year(transaction_date)=year(CURDATE()) and month(transaction_date)=month(CURDATE())-1)',
        [user_id],
        one=True
    )
    
    # Calculate percentage changes
    income = income_expense['income'] if income_expense else 0
    expenses = income_expense['expenses'] if income_expense else 0
    prev_income = prev_income_expense['income'] if prev_income_expense else 0
    prev_expenses = prev_income_expense['expenses'] if prev_income_expense else 0
    
    income_change = ((income - prev_income) / prev_income * 100) if prev_income > 0 else 0
    expense_change = ((expenses - prev_expenses) / prev_expenses * 100) if prev_expenses > 0 else 0
    
    # Calculate savings and savings rate
    savings = income - expenses
    savings_rate = (savings / income * 100) if income > 0 else 0
    
    # Get total balances across all accounts
    account_balances = query_db(
        'SELECT SUM(balance) as total_balance FROM accounts WHERE user_id = %s',
        [user_id],
        one=True
    )
    total_balance = account_balances['total_balance'] if account_balances else 0
    
   # Make sure in your dashboard_summary function:
    return jsonify({
    'income': income,
    'expenses': expenses,
    'savings': savings,
    'income_change': float(income_change),  # Explicitly convert to float
    'expense_change': float(expense_change),  # Explicitly convert to float
    'savings_rate': float(savings_rate),    # Explicitly convert to float
    'total_balance': total_balance
    })

@app.route('/api/dashboard/goals', methods=['GET'])
@login_required
def dashboard_goals():
    user_id = session['user_id']
    
    try:
        # Get a few goals for dashboard display (limit to 3 most active)
        goals = query_db('''
            SELECT id, name, description, target_amount, current_amount, 
                   target_date, is_completed, icon, color
            FROM goals 
            WHERE user_id = %s 
            ORDER BY is_completed ASC, updated_at DESC 
            LIMIT 3
        ''', [user_id])
        
        # Format dates for JSON serialization
        for goal in goals:
            if goal['target_date']:
                goal['target_date'] = goal['target_date'].strftime('%Y-%m-%d')
        
        # Calculate goal summary data
        summary = {
            'total_goals': len(goals),
            'completed_goals': sum(1 for goal in goals if goal['is_completed']),
            'total_amount': sum(float(goal['target_amount']) for goal in goals),
            'saved_amount': sum(float(goal['current_amount']) for goal in goals)
        }
        
        return jsonify({
            'goals': goals,
            'summary': summary
        })
    except Exception as e:
        print(f"Error fetching dashboard goals: {e}")
        return jsonify({'message': 'Failed to load goals for dashboard', 'error': str(e)}), 500

@app.route('/api/dashboard/budget', methods=['GET'])
@login_required
def dashboard_budget():
    user_id = session['user_id']
    
    try:
        # Get current month and year
        today = datetime.date.today()
        month = today.month
        year = today.year
        
        # Format the month for date-based comparisons
        month_str = f"{year}-{month:02d}"
        
        # Get budget items for current month with category info (limit to top 3)
        budget_items = query_db('''
            SELECT b.id, c.id as category_id, c.name as category_name, c.icon, c.color, 
                   b.amount as budget_amount
            FROM budget b
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = %s AND b.month = %s AND b.year = %s
            ORDER BY b.amount DESC
            LIMIT 3
        ''', [user_id, month, year])
        
        # For each budget item, get the actual spending
        for item in budget_items:
            # Get actual spending for this category in this month
            actual_spending = query_db('''
                SELECT COALESCE(SUM(amount), 0) as actual_amount
                FROM transactions
                WHERE user_id = %s AND category_id = %s AND transaction_type = 'EXPENSE'
                AND DATE_FORMAT(transaction_date, '%%Y-%%m') = %s
            ''', [user_id, item['category_id'], month_str], one=True)
            
            # Add actual amount to the item
            item['actual_amount'] = float(actual_spending['actual_amount']) if actual_spending and actual_spending['actual_amount'] else 0
        
        # Calculate totals
        total_budget = 0
        total_spent = 0
        
        # Get all budget items for totals (not just the top 3)
        all_budget_items = query_db('''
            SELECT b.amount as budget_amount
            FROM budget b
            WHERE b.user_id = %s AND b.month = %s AND b.year = %s
        ''', [user_id, month, year])
        
        for item in all_budget_items:
            total_budget += float(item['budget_amount']) if item['budget_amount'] else 0
        
        # Get total spent for the month
        total_spent_result = query_db('''
            SELECT COALESCE(SUM(amount), 0) as total_spent
            FROM transactions
            WHERE user_id = %s AND transaction_type = 'EXPENSE'
            AND DATE_FORMAT(transaction_date, '%%Y-%%m') = %s
        ''', [user_id, month_str], one=True)
        
        total_spent = float(total_spent_result['total_spent']) if total_spent_result and total_spent_result['total_spent'] else 0
        
        return jsonify({
            'budget_items': budget_items,
            'totals': {
                'total_budget': total_budget,
                'total_spent': total_spent,
                'remaining': total_budget - total_spent
            }
        })
    except Exception as e:
        print(f"Error fetching dashboard budget: {e}")
        return jsonify({'message': 'Failed to load budget for dashboard', 'error': str(e)}), 500

@app.route('/api/dashboard/monthly-overview', methods=['GET'])
@login_required
def monthly_overview():
    user_id = session['user_id']
    # Get income vs expenses by month
    monthly_data = query_db("SELECT MONTH(transaction_date) as month, SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) as income, SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) as expenses FROM transactions WHERE user_id =%s AND year(transaction_date) = year(CURDATE()) GROUP BY month(transaction_date) ORDER BY month",
        [user_id]
    )
    print(f"Monthly data for user {user_id}, year: {monthly_data}")
    
    # Format the data for charting
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    chart_data = []
    
    for i in range(12):
        month_data = {
            'month': months[i],
            'income': 0,
            'expenses': 0,
            'savings': 0
        }
        
        # Find data for this month if it exists
        month_number = i + 1
        for row in monthly_data:
            if int(row['month']) == month_number:
                month_data['income'] = float(row['income'])
                month_data['expenses'] = float(row['expenses'])
                month_data['savings'] = float(row['income']) - float(row['expenses'])
                break
        
        chart_data.append(month_data)
    
    return jsonify({'monthly_overview': chart_data})

@app.route('/api/dashboard/spending-by-category', methods=['GET'])
@login_required
def spending_by_category():
    user_id = session['user_id']
    month = request.args.get('month', datetime.date.today().month)
    year = request.args.get('year', datetime.date.today().year)
    
    # Create date range for the month
    start_date = f"{year}-{int(month):02d}-01"
    
    # Calculate end date (last day of month)
    if int(month) == 12:
        end_date = f"{year}-12-31"
    else:
        end_date = f"{year}-{int(month)+1:02d}-01"
    
    # Get spending by category with direct date comparison instead of DATE_FORMAT
    spending_data = query_db(
        'SELECT c.id, c.name, c.icon, c.color, SUM(t.amount) as total ' +
        'FROM transactions t ' +
        'JOIN categories c ON t.category_id = c.id ' +
        'WHERE t.user_id = %s AND t.transaction_type = "EXPENSE" ' +
        'AND t.transaction_date >= %s AND t.transaction_date < %s ' +
        'GROUP BY c.id ' +
        'ORDER BY total DESC',
        [user_id, start_date, end_date]
    )
    
    # Debug: log what we found
    print(f"Found {len(spending_data)} spending categories for {year}-{month}")
    print(f"Total spending: {sum(row['total'] for row in spending_data) if spending_data else 0}")
    
    # Calculate percentages
    total_spending = sum(row['total'] for row in spending_data) if spending_data else 0
    
    categories = []
    for row in spending_data:
        category = dict(row)  # Create a copy of the row to avoid modifying the original
        category['percentage'] = (row['total'] / total_spending * 100) if total_spending > 0 else 0
        categories.append(category)
    
    return jsonify({'spending_by_category': categories, 'total_spending': total_spending})

@app.route('/api/credit-suggestion', methods=['GET'])
@login_required
def credit_suggestion():
    user_id = session['user_id']
    
    # Get the latest credit score if available
    credit_score = query_db(
        'SELECT score FROM credit_score WHERE user_id = %s ORDER BY date DESC LIMIT 1',
        [user_id],
        one=True
    )
    
    # Get total monthly income and expenses
    today = datetime.date.today()
    six_months_ago = today - datetime.timedelta(days=180)
    
    monthly_stats = query_db(
        'SELECT AVG(CASE WHEN transaction_type = "INCOME" THEN amount ELSE 0 END) as avg_income, ' +
        'AVG(CASE WHEN transaction_type = "EXPENSE" THEN amount ELSE 0 END) as avg_expense, ' +
        'SUM(CASE WHEN transaction_type = "EXPENSE" THEN amount ELSE 0 END) / ' +
        'SUM(CASE WHEN transaction_type = "INCOME" THEN amount ELSE 0 END) * 100 as expense_ratio ' +
        'FROM (' +
        '  SELECT DATE_FORMAT(transaction_date, "%%Y-%%m") as month, ' +
        '  transaction_type, ' +
        '  SUM(amount) as amount ' +
        '  FROM transactions ' +
        '  WHERE user_id = %s AND transaction_date BETWEEN %s AND %s ' +
        '  GROUP BY DATE_FORMAT(transaction_date, "%%Y-%%m"), transaction_type' +
        ') as monthly_transactions',
        [user_id, six_months_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')],
        one=True
    )
    
    # Get category spending breakdown
    category_spending = query_db(
        'SELECT c.name, SUM(t.amount) as total, ' +
        'SUM(t.amount) / (SELECT SUM(amount) FROM transactions WHERE user_id = %s AND transaction_type = "EXPENSE" AND transaction_date BETWEEN %s AND %s) * 100 as percentage ' +
        'FROM transactions t ' +
        'JOIN categories c ON t.category_id = c.id ' +
        'WHERE t.user_id = %s AND t.transaction_type = "EXPENSE" AND t.transaction_date BETWEEN %s AND %s ' +
        'GROUP BY c.id ' +
        'ORDER BY total DESC',
        [user_id, six_months_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d'), 
         user_id, six_months_ago.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')]
    )
    
    # Apply budget optimization algorithm
    # This is a simple implementation that could be expanded
    suggestions = []
    
    # Check expense to income ratio (50-30-20 rule)
    if monthly_stats and monthly_stats['expense_ratio']:
        expense_ratio = monthly_stats['expense_ratio']
        
        if expense_ratio > 80:
            suggestions.append({
                'title': 'High Expense Ratio',
                'description': 'Your expenses are above 80% of your income. Try to reduce expenses to improve your financial health.'
            })
        
        # Find categories with the highest spending
        high_spending_categories = []
        for category in category_spending:
            if category['percentage'] > 20:  # Categories taking up more than 20% of total spending
                high_spending_categories.append(category)
        
        if high_spending_categories:
            suggestions.append({
                'title': 'High Category Spending',
                'description': f"Consider reducing spending in {', '.join([cat['name'] for cat in high_spending_categories])} which make up a large portion of your expenses."
            })
    
    # Credit score specific advice
    if credit_score:
        score = credit_score['score']
        
        if score < 580:
            suggestions.append({
                'title': 'Improve Your Credit Score',
                'description': 'Your credit score is considered poor. Focus on paying bills on time and reducing debt to improve it.'
            })
        elif score < 670:
            suggestions.append({
                'title': 'Fair Credit Score',
                'description': 'Your credit score is fair. Continue to make on-time payments and reduce high-interest debt.'
            })
        elif score < 740:
            suggestions.append({
                'title': 'Good Credit Score',
                'description': 'You have a good credit score. To improve further, maintain low credit utilization and pay bills on time.'
            })
        elif score < 800:
            suggestions.append({
                'title': 'Very Good Credit Score',
                'description': 'You have a very good credit score. Keep up your excellent financial habits.'
            })
        else:
            suggestions.append({
                'title': 'Excellent Credit Score',
                'description': 'Congratulations on your excellent credit score! Continue your strong financial management.'
            })
    
    # Add general suggestions if we don't have enough specific ones
    if len(suggestions) < 3:
        general_suggestions = [
            {
                'title': 'Build an Emergency Fund',
                'description': 'Try to save 3-6 months of expenses in an emergency fund for financial security.'
            },
            {
                'title': 'Debt Snowball Method',
                'description': 'Pay off your smallest debts first to gain momentum and motivation in becoming debt-free.'
            },
            {
                'title': 'Automate Your Savings',
                'description': 'Set up automatic transfers to your savings account each month to build wealth consistently.'
            },
            {
                'title': '50-30-20 Budget Rule',
                'description': 'Allocate 50% of your income to needs, 30% to wants, and 20% to savings and debt repayment.'
            },
            {
                'title': 'Track Your Spending',
                'description': 'Regularly monitor your expenses to identify areas where you can cut back.'
            }
        ]
        
        # Add general suggestions until we have at least 3
        for suggestion in general_suggestions:
            if len(suggestions) >= 3:
                break
            
            if suggestion not in suggestions:
                suggestions.append(suggestion)
    
    return jsonify({
        'credit_score': credit_score['score'] if credit_score else None,
        'expense_ratio': monthly_stats['expense_ratio'] if monthly_stats else None,
        'suggestions': suggestions
    })

@app.route('/api/debug/transactions', methods=['GET'])
def debug_transactions():
    """Admin route to debug transaction data"""
    user_id = session['user_id']
    
    # Get the most recent 10 transactions with all details
    transactions = query_db(
        'SELECT t.*, c.name as category_name, a.account_name ' +
        'FROM transactions t ' +
        'LEFT JOIN categories c ON t.category_id = c.id ' +
        'LEFT JOIN accounts a ON t.account_id = a.id ' +
        'WHERE t.user_id = %s ' +
        'ORDER BY t.transaction_date DESC, t.created_at DESC LIMIT 10',
        [user_id]
    )
    
    # Count transactions by type and month
    counts = query_db(
        'SELECT transaction_type, ' +
        'DATE_FORMAT(transaction_date, "%Y-%m") as month, ' +
        'COUNT(*) as count, SUM(amount) as total ' +
        'FROM transactions ' +
        'WHERE user_id = %s ' +
        'GROUP BY transaction_type, DATE_FORMAT(transaction_date, "%Y-%m") ' +
        'ORDER BY month DESC, transaction_type',
        [user_id]
    )
    
    # Check for transactions with missing category_id
    missing_category = query_db(
        'SELECT COUNT(*) as count FROM transactions ' +
        'WHERE user_id = %s AND category_id IS NULL',
        [user_id],
        one=True
    )
    
    return jsonify({
        'transactions': transactions,
        'counts_by_month_type': counts,
        'missing_category_count': missing_category['count']
    })
# Create MySQL schema file from the provided DB script
with app.app_context():
    create_schema_file()

if __name__ == '__main__':
    app.run(debug=True)
