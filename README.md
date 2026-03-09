# 💰 Spendo

**Spendo** is a fast and privacy-focused personal finance web application designed for **manual expense tracking, budgeting, and subscription management**.

It provides a **clean, minimalist interface** to track daily spending, set budget goals, and view visual analytics while keeping your financial data **securely stored on your device**.

---

# 🚀 Features

- 📊 Track daily income and expenses
- 🎯 Set and manage budget goals
- 📈 Visual spending analytics
- 🔒 Privacy-focused (data stored locally)
- 🧾 Subscription management
- 🗂 Category-based expense tracking
- ⚡ Simple and fast user interface

---

# 📁 Project Structure


Spendo/
│
├── app.py
├── finance_tracker.db
│
├── static/
│ ├── css/
│ │ └── style.css
│ └── js/
│ └── main.js
│
├── templates/
│ ├── index.html
│ ├── login.html
│ ├── register.html
│ ├── dashboard.html
│ └── transactions.html
│
└── README.md


---

# ⚙️ Setup Instructions

## 1️⃣ Create Project Directory

Create the project folder and maintain the structure shown above.

---

## 2️⃣ Copy Required Files

Place the files in their respective directories:

- Copy **`style.css`** → `static/css/`
- Copy **HTML files** → `templates/`
- Copy **`main.js`** → `static/js/`
- Place **`app.py`** in the root folder

---

## 3️⃣ Install Dependencies

Install Flask using pip:

```bash
pip install flask
4️⃣ Run the Application

Start the Flask server:

python app.py
5️⃣ Open the Application

Visit the application in your browser:

http://localhost:5000
🗄 Database Configuration

You can customize the database configuration inside app.py.

SQLite (Default)
app.config['DATABASE'] = 'finance_tracker.db'
MySQL
app.config['DATABASE_URI'] = 'mysql://username:password@localhost/finance_tracker'
🔐 Session Security

For better security, use a strong secret key.

Replace this line in app.py:

app.secret_key = os.environ.get('SECRET_KEY', 'finance_tracker_secret_key_change_in_production')

With:

import secrets
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))
🗂 Custom Categories

Default categories can be customized in the register function inside app.py.

Example:

default_categories = [
    (user_id, 'Salary', 'INCOME', 'fa-money-bill', '#10B981', True),
    (user_id, 'Groceries', 'EXPENSE', 'fa-shopping-basket', '#F59E0B', True),
]

You can add more categories as needed.

📤 Uploading Transactions

You can add a feature to import transactions from CSV or Excel files.

Example route in app.py:

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
        return jsonify({'message': 'Transactions imported successfully'})
    
    return jsonify({'message': 'Invalid file format'}), 400
📧 Email Notifications

To enable email notifications, add the following configuration in app.py.

from flask_mail import Mail, Message

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-password'
app.config['MAIL_DEFAULT_SENDER'] = 'your-email@gmail.com'

mail = Mail(app)

Example function:

def send_email_notification(user_id, subject, message):
    user = query_db('SELECT email FROM users WHERE id = ?', [user_id], one=True)
    
    if user and user['email']:
        prefs = query_db('SELECT email_notification FROM user_preferences WHERE user_id = ?', [user_id], one=True)
        
        if prefs and prefs['email_notification'] == 1:
            msg = Message(subject, recipients=[user['email']])
            msg.body = message
            mail.send(msg)
🌐 Deployment

For deploying the application in production:

1️⃣ Use a Production WSGI Server
pip install gunicorn
gunicorn app:app

2️⃣ Use a Production Database

Recommended options:
PostgreSQL

MySQL

3️⃣ Set Environment Variables
export SECRET_KEY="your-secure-secret-key"
export DATABASE_URI="postgresql://username:password@localhost/finance_tracker"
4️⃣ Configure Reverse Proxy

Use:
Ngin
Apache
Enable HTTPS for secure connections.

5️⃣ Database Backups

Set up automatic database backups to prevent data loss.

🔮 Future Enhancements

Planned features for future versions:

🔐 Two-Factor Authentication

📥 Data Export / Import

📱 Mobile Optimization

📊 Advanced Reports & Analytics

📈 Investment Portfolio Tracking

🧾 Receipt Scanning

💱 Multi-Currency Support

🔁 Recurring Transactions

🤝 Contributing

Contributions are welcome!

If you'd like to improve Spendo, feel free to fork the repository and submit a pull request.





