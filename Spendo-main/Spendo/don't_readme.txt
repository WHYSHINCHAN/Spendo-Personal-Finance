
finance_tracker/
│
├── app.py                  # Main Flask application
├── schema.sql              
├── static/
│   ├── css/
│   │   └── style.css       
│   │
│   └── js/
│       └── main.js         # The JavaScript file I provided
│
└── templates/
    ├── index.html          # Login/registration page
    ├── dashboard.html      # Main dashboard
    ├── accounts.html       # Accounts management page
    ├── transactions.html   # Transactions management page
    ├── budget.html         # Budget management page
    ├── goals.html          # Goals management page
    ├── bills.html          # Bills management page
    ├── education.html      # Financial education page
    ├── settings.html       # User settings page
    └── error.html          # Error page
```

### Setup Instructions

1. **Create the project directory structure** as shown above

2. **Copy the files** you already have:
   - Copy your `style.css` to `static/css/`
   - Copy all your HTML files to `templates/`
   - Copy the `app.py` and `main.js` files I provided to their respective locations

3. **Install required dependencies**:
   ```bash
   pip install flask
   ```

4. **Run the application**:
   ```bash
   python app.py
   ```

5. **Access the application** at:
   ```
   http://localhost:5000
   ```

## Additional Features and Customization

### Database Configuration

You can customize the database configuration in `app.py`:

```python
# For SQLite (default)
app.config['DATABASE'] = 'finance_tracker.db'

# For MySQL
# app.config['DATABASE_URI'] = 'mysql://username:password@localhost/finance_tracker'
```

### Session Security

To enhance security, you should set a strong secret key for sessions:

```python
# In app.py, replace this line:
app.secret_key = os.environ.get('SECRET_KEY', 'finance_tracker_secret_key_change_in_production')

# With a strong secret key or environment variable:
import secrets
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))
```

### Adding More Categories

You can customize the default categories in the `register` function in `app.py`:

```python
default_categories = [
    (user_id, 'Salary', 'INCOME', 'fa-money-bill', '#10B981', True),
    # Add more categories here as needed
    (user_id, 'Groceries', 'EXPENSE', 'fa-shopping-basket', '#F59E0B', True),
    # ...
]
```

### Uploading Transactions

If you want to add a feature to import transactions from CSV/Excel files, add this route to `app.py`:

```python
@app.route('/api/transactions/import', methods=['POST'])
@login_required
def import_transactions():
    if 'file' not in request.files:
        return jsonify({'message': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400
    
    if file and file.filename.endswith(('.csv', '.xlsx')):
        # Process the file
        # ...
        
        return jsonify({'message': 'Transactions imported successfully'})
    
    return jsonify({'message': 'Invalid file format'}), 400
```

### Email Notifications

To enable email notifications, add this to `app.py`:

```python
from flask_mail import Mail, Message

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-password'
app.config['MAIL_DEFAULT_SENDER'] = 'your-email@gmail.com'

mail = Mail(app)

def send_email_notification(user_id, subject, message):
    user = query_db('SELECT email FROM users WHERE id = ?', [user_id], one=True)
    if user and user['email']:
        # Check if user has email notifications enabled
        prefs = query_db('SELECT email_notification FROM user_preferences WHERE user_id = ?', [user_id], one=True)
        if prefs and prefs['email_notification'] == 1:
            msg = Message(subject, recipients=[user['email']])
            msg.body = message
            mail.send(msg)
```

## Deployment

### To deploy on a production server:

1. **Use a production WSGI server**:
   ```bash
   pip install gunicorn
   gunicorn app:app
   ```

2. **Use a production database** like PostgreSQL or MySQL instead of SQLite

3. **Set environment variables** for security-sensitive information:
   ```bash
   export SECRET_KEY="your-secure-secret-key"
   export DATABASE_URI="postgresql://username:password@localhost/finance_tracker"
   ```

4. **Configure HTTPS** using Nginx or Apache as a reverse proxy

5. **Set up automated backups** for your database

## Advanced Features for Future Enhancement

1. **Two-Factor Authentication**: Add an extra layer of security for users

2. **Data Export/Import**: Allow users to export their financial data

3. **Mobile Optimization**: Enhance the mobile experience with responsive design

4. **Reports and Analytics**: Add more detailed financial reports and analytics

5. **Investment Tracking**: Track investment portfolio performance

6. **Receipt Scanning**: Add functionality to scan and process receipts

7. **Multi-currency Support**: Enhance support for multiple currencies and exchange rates

8. **Recurring Transactions**: Improve handling of recurring income and expenses

Let me know if you'd like me to elaborate on any of these aspects or if you need help with other parts of the implementation!