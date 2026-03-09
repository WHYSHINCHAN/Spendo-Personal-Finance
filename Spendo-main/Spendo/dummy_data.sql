-- First, we need a user (if you don't already have one)
-- If a user already exists, you can skip this step
use finance_tracker;
INSERT INTO users (username, email, password_hash, full_name, created_at)
VALUES 
('demouser', 'demo@example.com', '$2b$12$Q9oNvZ4UZWKxQF1Qz1JVUOhZqQBZGxT5uVJJMU0TQ9MKb1EjRvx8S', 'Demo User', NOW());

-- Get the user ID for the remaining statements (replace with your actual user ID if already exists)
SET @user_id = (SELECT id FROM users WHERE username = 'DARSH ROCKS');

-- Clear existing data for this user (optional, if you want a clean slate)
DELETE FROM transactions WHERE user_id = @user_id;
DELETE FROM budget WHERE user_id = @user_id;
DELETE FROM goals WHERE user_id = @user_id;
DELETE FROM accounts WHERE user_id = @user_id;
DELETE FROM categories WHERE user_id = @user_id;

-- Insert accounts
INSERT INTO accounts (user_id, account_name, account_type, account_number, balance, currency, institution, created_at)
VALUES
(@user_id, 'HDFC Savings', 'SAVINGS', '1234', 85000.00, 'INR', 'HDFC Bank', NOW()),
(@user_id, 'SBI Current', 'CHECKING', '5678', 25000.00, 'INR', 'State Bank of India', NOW()),
(@user_id, 'ICICI Credit Card', 'CREDIT', '9012', -15000.00, 'INR', 'ICICI Bank', NOW()),
(@user_id, 'Axis Mutual Fund', 'INVESTMENT', '3456', 50000.00, 'INR', 'Axis Bank', NOW());

-- Get the account IDs
SET @savings_account = (SELECT id FROM accounts WHERE user_id = @user_id AND account_name = 'HDFC Savings');
SET @checking_account = (SELECT id FROM accounts WHERE user_id = @user_id AND account_name = 'SBI Current');
SET @credit_account = (SELECT id FROM accounts WHERE user_id = @user_id AND account_name = 'ICICI Credit Card');
SET @investment_account = (SELECT id FROM accounts WHERE user_id = @user_id AND account_name = 'Axis Mutual Fund');

-- Insert categories (income)
INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at)
VALUES
(@user_id, 'Salary', 'INCOME', 'fa-money-bill', '#10B981', 1, NOW()),
(@user_id, 'Freelance', 'INCOME', 'fa-laptop', '#3B82F6', 1, NOW()),
(@user_id, 'Investments', 'INCOME', 'fa-chart-line', '#8B5CF6', 1, NOW()),
(@user_id, 'Gifts', 'INCOME', 'fa-gift', '#EC4899', 1, NOW());

-- Insert categories (expense)
INSERT INTO categories (user_id, name, type, icon, color, is_default, created_at)
VALUES
(@user_id, 'Housing', 'EXPENSE', 'fa-home', '#EF4444', 1, NOW()),
(@user_id, 'Food', 'EXPENSE', 'fa-utensils', '#F59E0B', 1, NOW()),
(@user_id, 'Transportation', 'EXPENSE', 'fa-car', '#10B981', 1, NOW()),
(@user_id, 'Entertainment', 'EXPENSE', 'fa-film', '#3B82F6', 1, NOW()),
(@user_id, 'Shopping', 'EXPENSE', 'fa-shopping-bag', '#EC4899', 1, NOW()),
(@user_id, 'Health', 'EXPENSE', 'fa-heartbeat', '#10B981', 1, NOW()),
(@user_id, 'Bills', 'EXPENSE', 'fa-file-invoice', '#F59E0B', 1, NOW());

-- Get category IDs
SET @salary_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Salary');
SET @freelance_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Freelance');
SET @investment_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Investments');
SET @housing_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Housing');
SET @food_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Food');
SET @transport_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Transportation');
SET @entertainment_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Entertainment');
SET @shopping_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Shopping');
SET @health_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Health');
SET @bills_cat = (SELECT id FROM categories WHERE user_id = @user_id AND name = 'Bills');

-- Current month is April 2025 (based on the screenshots)
-- Insert income transactions
INSERT INTO transactions (user_id, account_id, category_id, amount, description, transaction_date, transaction_type, created_at)
VALUES
(@user_id, @savings_account, @salary_cat, 75000.00, 'Monthly Salary', '2025-04-01', 'INCOME', NOW()),
(@user_id, @checking_account, @freelance_cat, 15000.00, 'Website Design Project', '2025-04-10', 'INCOME', NOW()),
(@user_id, @savings_account, @investment_cat, 3500.00, 'Dividend Income', '2025-04-15', 'INCOME', NOW());

-- Insert expense transactions (current month)
INSERT INTO transactions (user_id, account_id, category_id, amount, description, transaction_date, transaction_type, created_at)
VALUES
(@user_id, @savings_account, @housing_cat, 25000.00, 'Rent Payment', '2025-04-05', 'EXPENSE', NOW()),
(@user_id, @savings_account, @food_cat, 12000.00, 'Grocery Shopping', '2025-04-08', 'EXPENSE', NOW()),
(@user_id, @credit_account, @food_cat, 4500.00, 'Restaurant Dinner', '2025-04-12', 'EXPENSE', NOW()),
(@user_id, @savings_account, @transport_cat, 3000.00, 'Fuel', '2025-04-07', 'EXPENSE', NOW()),
(@user_id, @checking_account, @transport_cat, 1500.00, 'Uber Rides', '2025-04-14', 'EXPENSE', NOW()),
(@user_id, @credit_account, @entertainment_cat, 2800.00, 'Movie Night', '2025-04-18', 'EXPENSE', NOW()),
(@user_id, @savings_account, @bills_cat, 1800.00, 'Internet Bill', '2025-04-16', 'EXPENSE', NOW()),
(@user_id, @savings_account, @bills_cat, 1200.00, 'Water Bill', '2025-04-15', 'EXPENSE', NOW()),
(@user_id, @savings_account, @bills_cat, 4500.00, 'Electricity Bill', '2025-04-15', 'EXPENSE', NOW()),
(@user_id, @credit_account, @shopping_cat, 6500.00, 'New Clothes', '2025-04-20', 'EXPENSE', NOW()),
(@user_id, @savings_account, @health_cat, 3500.00, 'Doctor Appointment', '2025-04-22', 'EXPENSE', NOW());

-- Insert previous month transactions (for comparative data)
INSERT INTO transactions (user_id, account_id, category_id, amount, description, transaction_date, transaction_type, created_at)
VALUES
(@user_id, @savings_account, @salary_cat, 75000.00, 'Monthly Salary', '2025-03-01', 'INCOME', NOW()),
(@user_id, @savings_account, @housing_cat, 25000.00, 'Rent Payment', '2025-03-05', 'EXPENSE', NOW()),
(@user_id, @savings_account, @food_cat, 10000.00, 'Grocery Shopping', '2025-03-08', 'EXPENSE', NOW()),
(@user_id, @credit_account, @transport_cat, 2800.00, 'Fuel', '2025-03-10', 'EXPENSE', NOW()),
(@user_id, @credit_account, @entertainment_cat, 3500.00, 'Concert Tickets', '2025-03-15', 'EXPENSE', NOW()),
(@user_id, @savings_account, @bills_cat, 5800.00, 'Utility Bills', '2025-03-20', 'EXPENSE', NOW());

-- Insert goals
INSERT INTO goals (user_id, name, description, target_amount, current_amount, target_date, is_completed, icon, color, created_at)
VALUES
(@user_id, 'Vacation Fund', 'Trip to Bali', 100000.00, 70000.00, '2025-05-31', 0, 'fa-umbrella-beach', '#F59E0B', NOW()),
(@user_id, 'New Car', 'Down payment for Honda City', 300000.00, 150000.00, '2025-09-30', 0, 'fa-car', '#3B82F6', NOW()),
(@user_id, 'Emergency Fund', '6 months of expenses', 450000.00, 200000.00, '2025-12-31', 0, 'fa-shield-alt', '#10B981', NOW());

-- Insert budget items for current month (April 2025)
INSERT INTO budget (user_id, category_id, amount, month, year, created_at)
VALUES
(@user_id, @housing_cat, 25000.00, 4, 2025, NOW()),
(@user_id, @food_cat, 15000.00, 4, 2025, NOW()),
(@user_id, @transport_cat, 8000.00, 4, 2025, NOW()),
(@user_id, @entertainment_cat, 5000.00, 4, 2025, NOW()),
(@user_id, @shopping_cat, 10000.00, 4, 2025, NOW()),
(@user_id, @health_cat, 5000.00, 4, 2025, NOW()),
(@user_id, @bills_cat, 10000.00, 4, 2025, NOW());

-- Add a bill for next month
INSERT INTO bills (user_id, name, description, amount, due_date, frequency, category_id, account_id, created_at)
VALUES
(@user_id, 'Home Rent', 'Monthly rent payment', 25000.00, '2025-05-05', 'MONTHLY', @housing_cat, @savings_account, NOW()),
(@user_id, 'Internet', 'Jio Fiber subscription', 1500.00, '2025-05-16', 'MONTHLY', @bills_cat, @savings_account, NOW()),
(@user_id, 'Mobile Phone', 'Airtel postpaid plan', 999.00, '2025-05-18', 'MONTHLY', @bills_cat, @credit_account, NOW()),
(@user_id, 'Gym Membership', 'Annual membership fee', 12000.00, '2025-06-10', 'YEARLY', @health_cat, @checking_account, NOW());


SELECT * FROM users;
 WHERE password_hash IS NULL 
OR password_hash = '' 
OR password_hash NOT LIKE '%:%';

UPDATE users SET password_hash = 'pbkdf2:sha256:600000$QGSNJl4wU9ygTWCN$3c42c428a9c2a2b6f508ca905a942037e9a49c3060f03b43e9d59f7b0e5cfc1b', updated_at = NOW() WHERE id = 1;
select * from users;
desc transactions;
SELECT sum(amount)
FROM transactions 
WHERE user_id = 2 and transaction_type='EXPENSE' and month(transaction_date)=month(CURDATE());

SELECT COALESCE(SUM(CASE WHEN transaction_type = "INCOME" THEN amount ELSE 0 END), 0) as income, COALESCE(SUM(CASE WHEN transaction_type = "EXPENSE" THEN amount ELSE 0 END), 0) as expenses FROM transactions WHERE user_id = 2 AND ( year(transaction_date)=year(CURDATE()) and month(transaction_date)=month(CURDATE())-1 );

SELECT balance as total_balance FROM accounts WHERE user_id = 2;

desc ACCOUNTs;


SELECT MONTH(transaction_date) as month, 
        SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) as income, 
        SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) as expenses 
        FROM transactions 
        WHERE user_id = 2 AND year(transaction_date) = year(CURDATE())
        GROUP BY month(transaction_date)
        ORDER BY month;