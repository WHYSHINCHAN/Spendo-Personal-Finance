// FinanceTrack Main JavaScript
window.loadAccounts = async function() {
    console.log("loadAccounts called directly from HTML");
    await initializeTransactionsPage();
};

window.loadTransactions = async function(limit = 50) {
    console.log("loadTransactions called directly from HTML");
    await loadTransactionsForPage(limit);
};

window.loadCategories = async function() {
    console.log("loadCategories called - loading categories from API");
    try {
        const response = await fetchAPI(API_ENDPOINTS.categories);
        
        if (!response || !response.categories || !Array.isArray(response.categories)) {
            console.error("Invalid categories response:", response);
            showNotification('Failed to load categories: Invalid response', 'error');
            return [];
        }
        
        console.log(`Successfully loaded ${response.categories.length} categories:`, response.categories);
        
        // Group categories by type
        state.categories.income = response.categories.filter(cat => cat.type === 'INCOME');
        state.categories.expense = response.categories.filter(cat => cat.type === 'EXPENSE');
        state.categories.transfer = response.categories.filter(cat => cat.type === 'TRANSFER');
        
        console.log(`Categorized: ${state.categories.income.length} income, ${state.categories.expense.length} expense, ${state.categories.transfer.length} transfer`);
        
        // Update category selectors in forms
        const categorySelects = document.querySelectorAll('.category-select, #budget-category, #edit-budget-category, #bill-category');
        console.log(`Found ${categorySelects.length} category select elements to update`);
        
        if (categorySelects.length > 0) {
            categorySelects.forEach(select => {
                const transactionTypeSelect = document.querySelector(`[data-category-select="${select.id}"]`);
                const type = transactionTypeSelect ? transactionTypeSelect.value : 'EXPENSE';
                console.log(`Updating categories for select #${select.id} with type ${type}`);
                renderCategoryOptions(select, type);
            });
        } else {
            console.warn("No category select elements found on page!");
        }
        
        return response.categories;
    } catch (error) {
        console.error('Failed to load categories:', error);
        showNotification('Failed to load categories: ' + (error.message || 'Unknown error'), 'error');
        return [];
    }
};


window.initializeTransactionsPage = async function() {
    console.log("Initializing transactions page from HTML...");
    
    try {
        // Load profile first
        await loadProfile();
        
        // Then load accounts and categories simultaneously
        await Promise.all([
            loadAccounts(),
            loadCategories()
        ]);
        
        return true;
    } catch (error) {
        console.error("Error initializing transactions page:", error);
        showNotification('Error loading data. Please refresh the page.', 'error');
        return false;
    }
};



document.addEventListener('DOMContentLoaded', function() {
    // API Endpoints
    const API_ENDPOINTS = {
        login: '/api/auth/login',
        register: '/api/auth/register',
        logout: '/api/auth/logout',
        profile: '/api/profile',
        accounts: '/api/accounts',
        transactions: '/api/transactions',
        categories: '/api/categories',
        goals: '/api/goals',
        bills: '/api/bills',
        budget: '/api/budget', 
        education: '/api/education',
        dashboard: {
            summary: '/api/dashboard/summary',
            monthlyOverview: '/api/dashboard/monthly-overview',
            spendingByCategory: '/api/dashboard/spending-by-category'
        },
        creditSuggestion: '/api/credit-suggestion'
    };
    if (window.location.pathname !== '/' && 
        window.location.pathname !== '/index' && 
        window.location.pathname !== '/index.html') {
        setupLogout();
    }

    // Global state
    const state = {
        currentUser: null,
        accounts: [],
        categories: {
            income: [],
            expense: [],
            transfer: []
        },
        transactions: [],
        goals: [],
        bills: [],
        budget: [],
        selectedAccount: null,
        selectedMonth: new Date().getMonth() + 1,
        selectedYear: new Date().getFullYear(),
        modalCallbacks: {} // For storing modal-specific callbacks
    };

    // Format currency based on user preferences
    function formatCurrency(amount, currency = 'INR') {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    // Format date based on user preferences
    function formatDate(dateString, format = 'YYYY-MM-DD') {
        const date = new Date(dateString);
        
        if (format === 'YYYY-MM-DD') {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else if (format === 'DD-MM-YYYY') {
            return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
        } else if (format === 'MM-DD-YYYY') {
            return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`;
        } else if (format === 'DD/MM/YYYY') {
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        } else if (format === 'MM/DD/YYYY') {
            return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
        }
        
        return dateString;
    }

    // Fetch API helper
    // Fetch API helper
async function fetchAPI(url, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin' // Include cookies for session management
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        console.log(`API Request: ${method} ${url}`, data);
        
        const response = await fetch(url, options);
        let result;
        
        try {
            result = await response.json();
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            // If response is OK but not JSON, return the response
            return { success: true, status: response.status };
        }

        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`, result);
            throw new Error(result.message || `API request failed with status ${response.status}`);
        }

        console.log(`API Response:`, result);
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message || 'Something went wrong', 'error');
        throw error;
    }
}


// Setup form submission helper
function setupForm(formId, submitCallback) {
    const form = document.getElementById(formId);
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Gather form data
            const formData = {};
            const formElements = form.elements;
            
            for (let i = 0; i < formElements.length; i++) {
                const element = formElements[i];
                if (element.name && element.type !== 'submit') {
                    if (element.type === 'checkbox') {
                        formData[element.name] = element.checked;
                    } else {
                        formData[element.name] = element.value;
                    }
                }
            }
            
            try {
                // Call the callback with form data
                await submitCallback(formData);
            } catch (error) {
                console.error(`Error submitting form ${formId}:`, error);
                showNotification('An error occurred: ' + (error.message || 'Unknown error'), 'error');
            }
        });
    } else {
        console.warn(`Form with ID "${formId}" not found`);
    }
}
// Show notification
function showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notification-container');
    
    if (!notificationContainer) {
        console.error('Notification container not found');
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${icon} notification-icon"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Show animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto hide after 5 seconds
    const hideTimeout = setTimeout(() => {
        hideNotification(notification);
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(hideTimeout);
        hideNotification(notification);
    });

    return notification;
}

// Hide notification
function hideNotification(notification) {
    if (!notification) return;
    
    notification.classList.add('hide');
    notification.classList.remove('show');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Auth form handling
function setupAuthForms() {
    console.log('Setting up auth forms...');
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    // Tab switching
    if (authTabs && authTabs.length > 0) {
        console.log('Setting up auth tabs...');
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                console.log(`Tab clicked: ${tab.dataset.target}`);
                authTabs.forEach(t => t.classList.remove('active'));
                authForms.forEach(f => f.classList.remove('active'));
                
                tab.classList.add('active');
                const target = tab.dataset.target;
                const targetElement = document.getElementById(target);
                if (targetElement) {
                    targetElement.classList.add('active');
                } else {
                    console.error(`Target element not found: ${target}`);
                }
            });
        });
    } else {
        console.warn('Auth tabs not found');
    }

    // Login form submission
    if (loginForm) {
        console.log('Setting up login form...');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Login form submitted');
            
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            if (!email || !password) {
                showNotification('Please fill in all fields', 'error');
                return;
            }
            
            try {
                showNotification('Logging in...', 'info');
                const response = await fetchAPI(API_ENDPOINTS.login, 'POST', { email, password });
                showNotification('Login successful!', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 500);
            } catch (error) {
                console.error('Login failed:', error);
                showNotification('Login failed: ' + (error.message || 'Unknown error'), 'error');
            }
        });
    } else {
        console.warn('Login form not found');
    }

    // Register form submission
    if (registerForm) {
        console.log('Setting up register form...');
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Register form submitted');
            
            const fullName = document.getElementById('register-full-name').value;
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            
            if (!fullName || !username || !email || !password || !confirmPassword) {
                showNotification('Please fill in all fields', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showNotification('Passwords do not match', 'error');
                return;
            }
            
            try {
                console.log('Submitting registration data...');
                showNotification('Creating your account...', 'info');
                
                const response = await fetchAPI(API_ENDPOINTS.register, 'POST', {
                    full_name: fullName,
                    username,
                    email,
                    password
                });
                
                showNotification('Registration successful!', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 500);
            } catch (error) {
                console.error('Registration failed:', error);
                showNotification('Registration failed: ' + (error.message || 'Unknown error'), 'error');
            }
        });
    } else {
        console.warn('Register form not found');
    }
}

    // Setup logout button
    function setupLogout() {
        console.log('Setting up logout buttons...');
        
        // Array of all possible logout button selectors
        const logoutSelectors = [
            '#logout-btn',
            '#sidebar-logout-btn',
            '.logout-btn',
            'button[title="Logout"]',
            'a.nav-link:contains("Logout")'
        ];
        
        // Function to handle logout
        const handleLogout = async (e) => {
            e.preventDefault();
            console.log('Logout button clicked');
            
            try {
                // Show notification
                showNotification('Logging out...', 'info');
                
                // Call logout API
                await fetchAPI(API_ENDPOINTS.logout, 'POST');
                
                // Redirect to login page
                window.location.href = '/';
            } catch (error) {
                console.error('Logout failed:', error);
                showNotification('Logout failed: ' + error.message, 'error');
            }
        };
        
        // Attach event listeners to all potential logout buttons
        logoutSelectors.forEach(selector => {
            // For jQuery-style selector with :contains
            if (selector.includes(':contains')) {
                const [tagSelector, textContent] = selector.split(':contains');
                const textToFind = textContent.replace(/["'()]/g, '');
                
                document.querySelectorAll(tagSelector).forEach(element => {
                    if (element.textContent.includes(textToFind)) {
                        console.log(`Found logout button matching: ${selector}`);
                        element.addEventListener('click', handleLogout);
                    }
                });
            } else {
                // Standard CSS selector
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    console.log(`Found logout button matching: ${selector}`);
                    element.addEventListener('click', handleLogout);
                });
            }
        });
        
        // Direct implementation for sidebar logout button
        const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
        if (sidebarLogoutBtn) {
            console.log('Found sidebar logout button');
            sidebarLogoutBtn.addEventListener('click', handleLogout);
        }
        
        // Direct implementation for main logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            console.log('Found main logout button');
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        console.log('Logout setup complete');
    }

    // Sidebar menu toggle
    function setupSidebarToggle() {
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
            });
            
            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
                const isMobile = window.matchMedia('(max-width: 768px)').matches;
                
                if (isMobile && sidebar.classList.contains('show') && 
                    !sidebar.contains(e.target) && e.target !== menuToggle) {
                    sidebar.classList.remove('show');
                }
            });
        }
    }

    // Theme toggle
    function setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                
                // Toggle sun/moon icons
                const moonIcon = themeToggle.querySelector('.fa-moon');
                const sunIcon = themeToggle.querySelector('.fa-sun');
                
                if (moonIcon && sunIcon) {
                    if (newTheme === 'dark') {
                        moonIcon.style.display = 'none';
                        sunIcon.style.display = 'block';
                    } else {
                        moonIcon.style.display = 'block';
                        sunIcon.style.display = 'none';
                    }
                }
            });
        }
        
        // Apply saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            
            // Set correct icon visibility
            if (themeToggle) {
                const moonIcon = themeToggle.querySelector('.fa-moon');
                const sunIcon = themeToggle.querySelector('.fa-sun');
                
                if (moonIcon && sunIcon) {
                    if (savedTheme === 'dark') {
                        moonIcon.style.display = 'none';
                        sunIcon.style.display = 'block';
                    } else {
                        moonIcon.style.display = 'block';
                        sunIcon.style.display = 'none';
                    }
                }
            }
        }
    }

    // Modal handling
    function setupModals() {
        const modals = document.querySelectorAll('.modal');
        
        if (modals) {
            // Open modal function
            window.openModal = function(modalId, data = null) {
                const modal = document.getElementById(modalId);
                
                if (modal) {
                    modal.classList.add('show');
                    
                    // If modal has a callback registered, execute it
                    if (state.modalCallbacks && state.modalCallbacks[modalId]) {
                        state.modalCallbacks[modalId](data);
                    }
                }
            };
            
            // Register modal callback
            window.registerModalCallback = function(modalId, callback) {
                state.modalCallbacks[modalId] = callback;
            };
            
            // Close modal function
            window.closeModal = function(modalId) {
                const modal = document.getElementById(modalId);
                
                if (modal) {
                    modal.classList.remove('show');
                }
            };
            window.deleteTransaction = async function(transactionId) {
                if (confirm('Are you sure you want to delete this transaction?')) {
                    try {
                        await fetchAPI(`${API_ENDPOINTS.transactions}/${transactionId}`, 'DELETE');
                        showNotification('Transaction deleted successfully', 'success');
                        
                        // Refresh data
                        if (typeof loadTransactions === 'function') {
                            loadTransactions();
                        }
                        if (typeof loadAccounts === 'function') {
                            loadAccounts();
                        }
                    } catch (error) {
                        console.error('Failed to delete transaction:', error);
                        showNotification('Failed to delete transaction', 'error');
                    }
                }
            };
            // Close modals on close button click
            modals.forEach(modal => {
                const closeButtons = modal.querySelectorAll('.modal-close');
                const overlay = modal.querySelector('.modal-overlay');
                
                closeButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        modal.classList.remove('show');
                    });
                });
                
                if (overlay) {
                    overlay.addEventListener('click', () => {
                        modal.classList.remove('show');
                    });
                }
            });
        }
    }

    // Date setup
    function setupDates() {
        // Set current date in the dashboard header
        const currentDateElement = document.getElementById('current-date');
        if (currentDateElement) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            currentDateElement.textContent = new Date().toLocaleDateString('en-US', options);
        }
        
        // Set current date in transaction forms
        const transactionDateInputs = document.querySelectorAll('input[type="date"]');
        transactionDateInputs.forEach(input => {
            if (!input.value) {
                input.value = new Date().toISOString().slice(0, 10);
            }
        });
    }

    // Load user profile
    async function loadProfile() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.profile);
            state.currentUser = response.user;
            
            // Update UI with user information
            const userNameElements = document.querySelectorAll('#user-name');
            const welcomeNameElement = document.getElementById('welcome-name');
            
            if (userNameElements) {
                userNameElements.forEach(elem => {
                    elem.textContent = state.currentUser.full_name;
                });
            }
            
            if (welcomeNameElement) {
                const firstName = state.currentUser.full_name.split(' ')[0];
                welcomeNameElement.textContent = firstName;
            }
            
            // Update avatar
            const avatarElements = document.querySelectorAll('.account-avatar');
            if (avatarElements) {
                const nameParts = state.currentUser.full_name.split(' ');
                const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
                
                avatarElements.forEach(avatar => {
                    avatar.textContent = initials;
                });
            }
            
            return response;
        } catch (error) {
            console.error('Failed to load profile:', error);
            return null;
        }
    }
    function renderAccounts(container) {
        console.log("Rendering accounts for dashboard with", state.accounts?.length || 0, "accounts");
        
        if (!container) {
            console.error("Account list container not found!");
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        // Handle empty state
        if (!state.accounts || state.accounts.length === 0) {
            container.innerHTML = `
                <div class="add-account" id="add-account-btn" onclick="openModal('add-account-modal')">
                    <div class="add-account-content">
                        <i class="fas fa-plus-circle"></i>
                        <p>Add New Account</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Calculate total balance
        const totalBalance = state.accounts.reduce((sum, account) => sum + parseFloat(account.balance), 0);
        
        // Add each account
        state.accounts.forEach(account => {
            const accountElement = document.createElement('div');
            accountElement.className = 'account-card';
            
            // Set icon based on account type
            let icon = 'credit-card';
            if (account.account_type === 'CHECKING') icon = 'wallet';
            if (account.account_type === 'SAVINGS') icon = 'piggy-bank';
            if (account.account_type === 'INVESTMENT') icon = 'chart-line';
            
            accountElement.innerHTML = `
                <div class="account-type">${account.account_type}</div>
                <div class="account-balance">${formatCurrency(account.balance, account.currency)}</div>
                <div class="account-name">${account.account_name}</div>
                <div class="account-details-row">
                    <span>${account.institution || 'N/A'}</span>
                    <span>${account.account_number ? '****' + account.account_number : ''}</span>
                </div>
                <div class="account-actions">
                    <button class="account-edit" onclick="openModal('edit-account-modal', ${account.id})"><i class="fas fa-edit"></i></button>
                    <button class="account-delete" onclick="deleteAccount(${account.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            container.appendChild(accountElement);
        });
        
        // Add the "Add Account" button
        const addAccountElement = document.createElement('div');
        addAccountElement.className = 'add-account';
        addAccountElement.id = 'add-account-btn';
        addAccountElement.setAttribute('onclick', "openModal('add-account-modal')");
        addAccountElement.innerHTML = `
            <div class="add-account-content">
                <i class="fas fa-plus-circle"></i>
                <p>Add New Account</p>
            </div>
        `;
        
        container.appendChild(addAccountElement);
        
        // Update total balance in the balance card
        const balanceElements = document.querySelectorAll('.balance-card .balance-amount');
        if (balanceElements && balanceElements.length > 0) {
            balanceElements[0].textContent = formatCurrency(totalBalance);
        }
    }
    // Load accounts
    async function loadAccounts() {
        try {
            console.log("Loading accounts...");
            const response = await fetchAPI(API_ENDPOINTS.accounts);
            
            if (!response || !response.accounts) {
                console.error("Invalid account response:", response);
                state.accounts = [];
            } else {
                state.accounts = response.accounts;
                console.log(`Loaded ${state.accounts.length} accounts`);
            }
            
            // Update account statistics
            updateAccountStats(state.accounts);
            
            // Update accounts grid on the accounts page
            const accountsGridElement = document.querySelector('.accounts-grid');
            if (accountsGridElement) {
                renderAccountsGrid(accountsGridElement);
            }
            
            // Update accounts list on the dashboard
            const accountsListElement = document.querySelector('.accounts-list');
            if (accountsListElement) {
                renderAccounts(accountsListElement);
            }
            
            // Update account selectors in forms
            const accountSelects = document.querySelectorAll('.account-select');
            if (accountSelects && accountSelects.length > 0) {
                accountSelects.forEach(select => {
                    renderAccountOptions(select);
                });
            }
            
            // Load transactions for the accounts page
            if (window.location.pathname.includes('accounts')) {
                const accountId = document.getElementById('account-filter')?.value || null;
                loadTransactions(5, accountId);
            }
            
            return state.accounts;
        } catch (error) {
            console.error('Failed to load accounts:', error);
            showNotification('Failed to load accounts', 'error');
            return [];
        }
    }
    
    // Improved renderAccountsGrid function with more error checking
    function renderAccountsGrid(container) {
        if (!container) {
            console.error("Account grid container not found!");
            return;
        }
    
        console.log("Rendering accounts grid with", state.accounts.length, "accounts");
        container.innerHTML = '';
        
        if (!state.accounts || state.accounts.length === 0) {
            // Add only the "Add Account" button if no accounts
            const addAccountElement = document.createElement('div');
            addAccountElement.className = 'add-account-card';
            addAccountElement.setAttribute('onclick', "openModal('add-account-modal')");
            addAccountElement.innerHTML = `
                <i class="fas fa-plus-circle"></i>
                <p>Add New Account</p>
            `;
            container.appendChild(addAccountElement);
            return;
        }
        
        // Render each account
        state.accounts.forEach(account => {
            const accountElement = document.createElement('div');
            accountElement.className = 'account-card';
            
            // Set icon based on account type
            let icon = 'credit-card';
            if (account.account_type === 'CHECKING') icon = 'wallet';
            if (account.account_type === 'SAVINGS') icon = 'piggy-bank';
            if (account.account_type === 'INVESTMENT') icon = 'chart-line';
            
            accountElement.innerHTML = `
                <div class="account-type">${account.account_type}</div>
                <div class="account-balance">${formatCurrency(account.balance, account.currency)}</div>
                <div class="account-name">${account.account_name}</div>
                <div class="account-details-row">
                    <span>${account.institution || 'N/A'}</span>
                    <span>${account.account_number ? '****' + account.account_number : ''}</span>
                </div>
                <div class="account-actions">
                    <button class="account-edit" onclick="openModal('edit-account-modal', ${account.id})"><i class="fas fa-edit"></i></button>
                    <button class="account-delete" onclick="deleteAccount(${account.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            container.appendChild(accountElement);
        });
        
        // Add the "Add Account" button
        const addAccountElement = document.createElement('div');
        addAccountElement.className = 'add-account-card';
        addAccountElement.setAttribute('onclick', "openModal('add-account-modal')");
        addAccountElement.innerHTML = `
            <i class="fas fa-plus-circle"></i>
            <p>Add New Account</p>
        `;
        
        container.appendChild(addAccountElement);
    }

    // Render account options for select dropdowns
    function renderAccountOptions(selectElement) {
        // Clear existing options except the first one (if it's a placeholder)
        const firstOption = selectElement.querySelector('option:first-child');
        selectElement.innerHTML = '';
        
        if (firstOption && firstOption.value === '') {
            selectElement.appendChild(firstOption);
        }
        
        // Add each account as an option
        state.accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.account_name} (${formatCurrency(account.balance, account.currency)})`;
            selectElement.appendChild(option);
        });
    }

    // Load categories
    async function loadCategories() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.categories);
            
            // Group categories by type
            state.categories.income = response.categories.filter(cat => cat.type === 'INCOME');
            state.categories.expense = response.categories.filter(cat => cat.type === 'EXPENSE');
            state.categories.transfer = response.categories.filter(cat => cat.type === 'TRANSFER');
            
            // Update category selectors in forms
            const categorySelects = document.querySelectorAll('.category-select');
            if (categorySelects) {
                categorySelects.forEach(select => {
                    const transactionTypeSelect = document.querySelector(`[data-category-select="${select.id}"]`);
                    const type = transactionTypeSelect ? transactionTypeSelect.value : 'EXPENSE';
                    renderCategoryOptions(select, type);
                });
            }
            
            // Setup transaction type change handlers
            const transactionTypeSelects = document.querySelectorAll('.transaction-type-select');
            if (transactionTypeSelects) {
                transactionTypeSelects.forEach(select => {
                    select.addEventListener('change', (e) => {
                        const categorySelectId = select.dataset.categorySelect;
                        const categorySelect = document.getElementById(categorySelectId);
                        
                        if (categorySelect) {
                            renderCategoryOptions(categorySelect, e.target.value);
                        }
                        
                        // Show/hide transfer fields
                        if (e.target.value === 'TRANSFER') {
                            const formId = select.closest('form').id;
                            const transferFields = document.querySelector(`.transfer-fields`);
                            if (transferFields) transferFields.style.display = 'block';
                        } else {
                            const formId = select.closest('form').id;
                            const transferFields = document.querySelector(`.transfer-fields`);
                            if (transferFields) transferFields.style.display = 'none';
                        }
                    });
                });
            }
            
            return response.categories;
        } catch (error) {
            console.error('Failed to load categories:', error);
            return [];
        }
    }

    // Render category options for select dropdowns
    function renderCategoryOptions(selectElement, transactionType = 'EXPENSE') {
        if (!selectElement) {
            console.error("Cannot render categories: select element is null or undefined");
            return;
        }
        
        console.log(`Rendering categories for ${selectElement.id} with type ${transactionType}`);
        
        // Clear existing options except the first one (if it's a placeholder)
        const firstOption = selectElement.querySelector('option:first-child');
        selectElement.innerHTML = '';
        
        if (firstOption && firstOption.value === '') {
            selectElement.appendChild(firstOption);
        }
        
        // Get appropriate category list based on transaction type
        let categories = [];
        if (transactionType === 'INCOME') {
            categories = state.categories.income || [];
        } else if (transactionType === 'EXPENSE') {
            categories = state.categories.expense || [];
        } else if (transactionType === 'TRANSFER') {
            categories = state.categories.transfer || [];
        }
        
        console.log(`Found ${categories.length} categories for type ${transactionType}`);
        
        // Add each category as an option
        if (categories.length === 0) {
            // Add a default option if no categories found
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "-- No categories available --";
            selectElement.appendChild(option);
            console.warn(`No categories found for type ${transactionType}!`);
        } else {
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                selectElement.appendChild(option);
            });
        }
        
        // Make sure the select isn't disabled
        selectElement.disabled = false;
    }
    window.renderCategoryOptions = renderCategoryOptions;

    
    function updateAccountStats(accounts) {
        // Debug the accounts data
        console.log("Updating account stats with accounts:", accounts);
        
        // Default values in case of empty data
        let totalBalance = 0;
        let highestBalance = 0;
        let accountCount = Array.isArray(accounts) ? accounts.length : 0;
        
        if (Array.isArray(accounts) && accounts.length > 0) {
            accounts.forEach(account => {
                // Convert balance to number and add to total
                const balance = parseFloat(account.balance) || 0;
                totalBalance += balance;
                
                // Update highest balance if this one is higher
                if (balance > highestBalance) {
                    highestBalance = balance;
                }
            });
        }
        
        // Update the UI elements
        const totalBalanceElement = document.getElementById('total-balance');
        const accountCountElement = document.getElementById('account-count');
        const highestBalanceElement = document.getElementById('highest-balance');
        
        if (totalBalanceElement) totalBalanceElement.textContent = formatCurrency(totalBalance);
        if (accountCountElement) accountCountElement.textContent = accountCount;
        if (highestBalanceElement) highestBalanceElement.textContent = formatCurrency(highestBalance);
        
        console.log(`Account stats updated: Total: ${totalBalance}, Count: ${accountCount}, Highest: ${highestBalance}`);
    }
    // Load transactions
    async function loadTransactions(limit = 5) {
        try {
            const response = await fetchAPI(`${API_ENDPOINTS.transactions}?limit=${limit}`);
            state.transactions = response.transactions;
            
            // Update UI with transactions
            const transactionListElement = document.querySelector('.transaction-list');
            if (transactionListElement) {
                renderTransactions(transactionListElement);
            }
            
            return state.transactions;
        } catch (error) {
            console.error('Failed to load transactions:', error);
            return [];
        }
    }

    // Render transactions list
    function renderTransactions(container) {
        console.log("Rendering transactions:", state.transactions?.length || 0);
        
        if (!container) {
            console.error("Transaction container not found!");
            return;
        }
        
        // Clear container first
        container.innerHTML = '';
        
        // Handle empty state
        if (!state.transactions || state.transactions.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-exchange-alt"></i>
                    <p>No transactions found</p>
                    <button class="btn btn-primary" onclick="openModal('add-transaction-modal')">Add Transaction</button>
                </div>
            `;
            return;
        }
        
        // Render each transaction
        state.transactions.forEach(transaction => {
            const transactionElement = document.createElement('div');
            transactionElement.className = 'transaction-item';
            
            // Ensure we have all required properties
            const account = transaction.account_name || 'Unknown Account';
            const description = transaction.description || 'No description';
            const amount = parseFloat(transaction.amount) || 0;
            const type = transaction.transaction_type || 'EXPENSE';
            const date = transaction.transaction_date ? new Date(transaction.transaction_date) : new Date();
            
            // Format date
            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Determine amount class
            const amountClass = type === 'INCOME' ? 'income' : 'expense';
            const sign = type === 'INCOME' ? '+' : '-';
            
            // Determine icon based on category
            let icon = transaction.category_icon || 'fa-receipt';
            let iconColor = transaction.category_color || '#6B7280';
            
            transactionElement.innerHTML = `
                <div class="transaction-icon" style="background-color: ${iconColor}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-title">${description}</div>
                    <div class="transaction-date">${formattedDate} • ${account}</div>
                </div>
                <div class="transaction-amount ${amountClass}">${sign}${formatCurrency(amount)}</div>
                <div class="transaction-actions">
                    <button class="transaction-edit" onclick="openModal('edit-transaction-modal', ${transaction.id})"><i class="fas fa-edit"></i></button>
                    <button class="transaction-delete" onclick="deleteTransaction(${transaction.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            container.appendChild(transactionElement);
        });
    }
    function initializeAccountsPage() {
        loadProfile().then(() => {
            loadAccounts();
            setupAccountForms();
            
            // Setup account filter
            const accountFilter = document.getElementById('account-filter');
            if (accountFilter) {
                accountFilter.addEventListener('change', function() {
                    const accountId = this.value;
                    loadTransactions(5, accountId);
                });
            } else {
                console.warn("Account filter element not found");
            }
        });
    }

    // Load goals
    async function loadGoals() {
        try {
            console.log("Loading goals data...");
            const response = await fetchAPI(API_ENDPOINTS.goals);
            
            if (!response || !response.goals) {
                console.error("Invalid goals response:", response);
                state.goals = [];
            } else {
                state.goals = response.goals;
                console.log(`Loaded ${state.goals.length} goals`);
            }
            
            // Update goals summary
            updateGoalsSummary(state.goals);
            
            // Update goals grid on the goals page
            const goalsGridElement = document.getElementById('goals-grid');
            if (goalsGridElement) {
                renderGoalsGrid(state.goals);
            }
            
            return state.goals;
        } catch (error) {
            console.error('Failed to load goals:', error);
            showNotification('Failed to load goals', 'error');
            return [];
        }
    }
    

    // Render goals list
    function renderGoalsGrid(goals) {
        const goalsGrid = document.getElementById('goals-grid');
        
        if (!goalsGrid) {
            console.error("Goals grid container not found!");
            return;
        }
        
        console.log("Rendering goals grid with", goals?.length || 0, "goals");
        
        // Clear grid except for the add goal card
        const addGoalCard = goalsGrid.querySelector('.add-goal-card');
        goalsGrid.innerHTML = '';
        
        if (!goals || goals.length === 0) {
            goalsGrid.appendChild(addGoalCard);
            return;
        }
        
        // Sort goals: completed goals at the end
        const sortedGoals = [...goals].sort((a, b) => {
            if (a.is_completed && !b.is_completed) return 1;
            if (!a.is_completed && b.is_completed) return -1;
            
            // For non-completed goals, sort by progress percentage (descending)
            if (!a.is_completed && !b.is_completed) {
                const aProgress = a.target_amount > 0 ? (a.current_amount / a.target_amount) : 0;
                const bProgress = b.target_amount > 0 ? (b.current_amount / b.target_amount) : 0;
                return bProgress - aProgress;
            }
            
            return 0;
        });
        
        sortedGoals.forEach(goal => {
            const goalCard = document.createElement('div');
            goalCard.className = goal.is_completed ? 'goal-card completed' : 'goal-card';
            
            const progressPercentage = goal.target_amount > 0 
                ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) 
                : 0;
                
            // Format the date if available
            let dateDisplay = '';
            if (goal.target_date) {
                const targetDate = new Date(goal.target_date);
                const formattedDate = targetDate.toLocaleDateString('en-US', {
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric'
                });
                
                // Calculate days remaining
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysRemaining = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining > 0) {
                    dateDisplay = `<div class="goal-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${formattedDate} (${daysRemaining} days left)
                    </div>`;
                } else if (daysRemaining === 0) {
                    dateDisplay = `<div class="goal-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${formattedDate} (Due today)
                    </div>`;
                } else {
                    dateDisplay = `<div class="goal-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${formattedDate} (Passed by ${Math.abs(daysRemaining)} days)
                    </div>`;
                }
            }
            
            goalCard.innerHTML = `
                <div class="goal-icon" style="color: ${goal.color || 'var(--primary-color)'}">
                    <i class="fas ${goal.icon || 'fa-bullseye'}"></i>
                </div>
                <div class="goal-name">${goal.name}</div>
                <div class="goal-description">${goal.description || ''}</div>
                <div class="goal-target">
                    <span>Target:</span>
                    <span class="goal-target-amount">${formatCurrency(goal.target_amount)}</span>
                </div>
                <div class="goal-progress">
                    <div class="goal-progress-bar" style="width: ${progressPercentage}%"></div>
                </div>
                <div class="goal-status">
                    <div class="goal-current">${formatCurrency(goal.current_amount)}</div>
                    <div class="goal-percentage">${progressPercentage.toFixed(0)}%</div>
                </div>
                ${dateDisplay}
                <div class="goal-actions">
                    <div class="goal-action-btn primary" onclick="openContributeModal(${goal.id})">Contribute</div>
                    <div class="goal-action-btn secondary" onclick="viewGoalDetails(${goal.id})">Details</div>
                </div>
            `;
            
            goalsGrid.appendChild(goalCard);
        });
        
        // Add the "Add Goal" card
        goalsGrid.appendChild(addGoalCard);
    }

    // Load bills
    async function loadBills() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.bills);
            state.bills = response.bills;
            
            // Update UI with bills
            const billsListElement = document.querySelector('.bills-list');
            if (billsListElement) {
                renderBills(billsListElement);
            }
            
            return state.bills;
        } catch (error) {
            console.error('Failed to load bills:', error);
            return [];
        }
    }

    // Render bills list
    function renderBills(container) {
        container.innerHTML = '';
        
        if (state.bills.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-file-invoice"></i>
                    <p>No upcoming bills</p>
                    <button class="btn btn-primary" onclick="openModal('add-bill-modal')">Add Bill</button>
                </div>
            `;
            return;
        }
        
        // Sort bills by due date (closest first)
        const sortedBills = [...state.bills].sort((a, b) => {
            return new Date(a.due_date) - new Date(b.due_date);
        });
        
        // Show only the top 3 bills (or fewer if there are less)
        const billsToShow = sortedBills.slice(0, 3);
        
        billsToShow.forEach(bill => {
            const billElement = document.createElement('div');
            billElement.className = 'bill-card';
            
            // Format date
            const dueDate = new Date(bill.due_date);
            const formattedDate = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Determine due status
            let dueClass = '';
            let dueText = `Due on ${formattedDate}`;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const dueDateObj = new Date(bill.due_date);
            dueDateObj.setHours(0, 0, 0, 0);
            
            const daysUntilDue = Math.round((dueDateObj - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilDue < 0) {
                dueClass = 'overdue';
                dueText = `Overdue by ${Math.abs(daysUntilDue)} days`;
            } else if (daysUntilDue === 0) {
                dueClass = 'due-today';
                dueText = 'Due today';
            } else if (daysUntilDue <= 3) {
                dueClass = 'due-soon';
                dueText = `Due in ${daysUntilDue} days`;
            }
            
            // Determine icon based on category or name
            let icon = 'fa-file-invoice-dollar';
            if (bill.name.toLowerCase().includes('rent') || bill.name.toLowerCase().includes('mortgage')) icon = 'fa-home';
            if (bill.name.toLowerCase().includes('electricity') || bill.name.toLowerCase().includes('power')) icon = 'fa-bolt';
            if (bill.name.toLowerCase().includes('water')) icon = 'fa-tint';
            if (bill.name.toLowerCase().includes('internet') || bill.name.toLowerCase().includes('wifi')) icon = 'fa-wifi';
            if (bill.name.toLowerCase().includes('phone') || bill.name.toLowerCase().includes('mobile')) icon = 'fa-mobile-alt';
            if (bill.name.toLowerCase().includes('gas')) icon = 'fa-fire';
            
            billElement.innerHTML = `
                <div class="bill-header">
                    <div class="bill-logo">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div>
                        <div class="bill-company">${bill.name}</div>
                        <div class="bill-type">${bill.category_name || bill.frequency}</div>
                    </div>
                </div>
                <div class="bill-amount">${formatCurrency(bill.amount)}</div>
                <div class="bill-due ${dueClass}">${dueText}</div>
                <button class="bill-pay-btn" onclick="openModal('pay-bill-modal', ${bill.id})">Pay Now</button>
            `;
            
            container.appendChild(billElement);
        });
        
        // If there are more bills, show a "View All" link
        if (state.bills.length > 3) {
            const viewAllElement = document.createElement('div');
            viewAllElement.className = 'view-all-item';
            viewAllElement.innerHTML = `
                <a href="/bills" class="view-all-link">
                    View All Bills <i class="fas fa-arrow-right"></i>
                </a>
            `;
            
            container.appendChild(viewAllElement);
        }
    }

    // Load budget
    async function loadBudget() {
        try {
            const month = state.selectedMonth;
            const year = state.selectedYear;
            
            if (!month || !year) {
                console.error('Month or year not set in state');
                state.selectedMonth = new Date().getMonth() + 1;
                state.selectedYear = new Date().getFullYear();
            }
            
            console.log(`Loading budget for ${state.selectedMonth}/${state.selectedYear}`);
            
            const response = await fetchAPI(`${API_ENDPOINTS.budget}?month=${state.selectedMonth}&year=${state.selectedYear}`);
            
            if (!response) {
                throw new Error('No response from budget API');
            }
            
            state.budget = response.budget_items || [];
            state.budgetTotals = response.totals || { 
                total_budget: 0, 
                total_spent: 0,
                remaining: 0,
                days_left: 30, // Default values in case they're missing
                daily_budget: 0
            };
            
            // Log successful load
            console.log(`Loaded ${state.budget.length} budget items`);
            console.log('Budget totals:', state.budgetTotals);
            
            // Update UI with budget
            updateBudgetUI();
            
            return state.budget;
        } catch (error) {
            console.error('Failed to load budget:', error);
            showNotification('Failed to load budget data', 'error');
            
            // Set defaults to prevent UI errors
            state.budget = [];
            state.budgetTotals = { 
                total_budget: 0, 
                total_spent: 0,
                remaining: 0,
                days_left: 30,
                daily_budget: 0
            };
            
            // Still update UI with empty data
            updateBudgetUI();
            
            return [];
        }
    }

    // Update budget UI
    function updateBudgetUI() {
        console.log('Updating budget UI with:', state.budget.length, 'items');
        
        // Update budget summary
        const totalBudgetElement = document.getElementById('total-budget');
        const totalSpentElement = document.getElementById('total-spent');
        const totalRemainingElement = document.getElementById('total-remaining');
        const spentPercentageElement = document.getElementById('spent-percentage');
        const remainingDaysElement = document.getElementById('remaining-days');
        const dailyBudgetElement = document.getElementById('daily-budget');
        
        if (totalBudgetElement) {
            totalBudgetElement.textContent = formatCurrency(state.budgetTotals.total_budget || 0);
        }
        
        if (totalSpentElement) {
            totalSpentElement.textContent = formatCurrency(state.budgetTotals.total_spent || 0);
        }
        
        if (totalRemainingElement) {
            totalRemainingElement.textContent = formatCurrency(state.budgetTotals.remaining || 0);
        }
        
        if (spentPercentageElement) {
            const percentage = state.budgetTotals.total_budget > 0 
                ? ((state.budgetTotals.total_spent / state.budgetTotals.total_budget) * 100).toFixed(1) 
                : 0;
            spentPercentageElement.textContent = `${percentage}% of budget`;
        }
        
        if (remainingDaysElement) {
            remainingDaysElement.textContent = `${state.budgetTotals.days_left || 0} days left`;
        }
        
        if (dailyBudgetElement) {
            dailyBudgetElement.textContent = formatCurrency(state.budgetTotals.daily_budget || 0);
        }
        
        // Update budget items list
        const budgetItemsContainer = document.getElementById('budget-items-container');
        if (budgetItemsContainer) {
            renderBudgetItems(budgetItemsContainer);
        }
        
        // Update pie chart if it exists
        const pieChartCanvas = document.getElementById('budget-pie-chart');
        if (pieChartCanvas && state.budget && state.budget.length > 0) {
            try {
                createBudgetPieChart(pieChartCanvas);
            } catch (error) {
                console.error('Failed to create budget pie chart:', error);
            }
        }
        
        // Update spending table if it exists
        const spendingTableBody = document.getElementById('spending-table-body');
        if (spendingTableBody) {
            renderSpendingTable(spendingTableBody);
        }
    }
    function createBudgetPieChart(canvas) {
        // Check if chart already exists
        if (window.budgetPieChart) {
            window.budgetPieChart.destroy();
        }
        
        // Prepare data
        const labels = state.budget.map(item => item.category_name);
        const data = state.budget.map(item => parseFloat(item.budget_amount));
        const backgroundColor = state.budget.map(item => item.color || getRandomColor());
        
        // Create chart
        window.budgetPieChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: "'Nunito', sans-serif",
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    function renderSpendingTable(tableBody) {
        if (!tableBody) {
            console.error('Spending table body not found');
            return;
        }
        
        // Clear existing content
        tableBody.innerHTML = '';
        
        if (!state.budget || state.budget.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="5" class="empty-table">No budget data available</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        try {
            // Calculate total budget for percentage calculation
            const totalBudget = state.budgetTotals.total_budget || 0;
            
            // Sort budget items by percentage spent (highest first)
            const sortedItems = [...state.budget].sort((a, b) => {
                const aPercentage = a.budget_amount > 0 ? (a.actual_amount / a.budget_amount) : 0;
                const bPercentage = b.budget_amount > 0 ? (b.actual_amount / b.budget_amount) : 0;
                return bPercentage - aPercentage;
            });
            
            // Create table rows
            sortedItems.forEach(item => {
                const row = document.createElement('tr');
                
                // Calculate values
                const budget = parseFloat(item.budget_amount) || 0;
                const spent = parseFloat(item.actual_amount) || 0;
                const remaining = budget - spent;
                const percentOfTotal = totalBudget > 0 ? (budget / totalBudget) * 100 : 0;
                
                // Determine status class
                let amountClass = '';
                if (remaining < 0) {
                    amountClass = 'text-danger';
                }
                
                row.innerHTML = `
                    <td>
                        <div class="d-flex align-items-center">
                            <span class="category-icon me-2" style="background-color: ${item.color || '#6B7280'}">
                                <i class="fas ${item.icon || 'fa-tag'}"></i>
                            </span>
                            ${item.category_name}
                        </div>
                    </td>
                    <td>${formatCurrency(budget)}</td>
                    <td>${formatCurrency(spent)}</td>
                    <td class="${amountClass}">${formatCurrency(remaining)}</td>
                    <td>
                        <div>${percentOfTotal.toFixed(1)}%</div>
                        <div class="percentage-bar">
                            <div class="percentage-bar-fill" style="width: ${percentOfTotal}%"></div>
                        </div>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error rendering spending table:', error);
            
            // Show error message in table
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="5" class="empty-table">Error displaying spending data</td>`;
            tableBody.appendChild(row);
        }
    }
    function renderBudgetItems(container) {
        if (!container) {
            console.error('Budget items container not found');
            return;
        }
        
        // Clear existing content
        container.innerHTML = '';
        
        if (!state.budget || state.budget.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-chart-pie"></i>
                    <p>No budget items for this month</p>
                    <button class="btn btn-primary" onclick="openModal('add-budget-modal')">Create Budget</button>
                </div>
            `;
            return;
        }
        
        try {
            state.budget.forEach(item => {
                const budgetElement = document.createElement('div');
                budgetElement.className = 'budget-item';
                
                // Calculate percentage and status with safety checks
                const spent = parseFloat(item.actual_amount) || 0;
                const budget = parseFloat(item.budget_amount) || 0;
                const percentage = budget > 0 ? (spent / budget) * 100 : 0;
                const remaining = budget - spent;
                
                // Determine status class based on percentage
                let statusClass = 'good';
                let barClass = '';
                
                if (percentage >= 90) {
                    statusClass = 'danger';
                    barClass = 'danger';
                } else if (percentage >= 75) {
                    statusClass = 'warning';
                    barClass = 'warning';
                }
                
                budgetElement.innerHTML = `
                    <div class="budget-item-header">
                        <div class="budget-item-category">
                            <i class="fas ${item.icon || 'fa-tag'}" style="color: ${item.color || '#6B7280'}"></i>
                            ${item.category_name}
                        </div>
                        <div class="budget-item-amount">${formatCurrency(budget)}</div>
                    </div>
                    <div class="budget-item-progress">
                        <div class="budget-item-bar ${barClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="budget-item-status">
                        <div class="budget-item-spent">Spent: ${formatCurrency(spent)}</div>
                        <div class="budget-item-left ${statusClass}">
                            ${remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
                        </div>
                    </div>
                    <div class="budget-item-actions">
                        <button class="budget-item-btn" onclick="editBudget(${item.category_id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                `;
                
                container.appendChild(budgetElement);
            });
            
            // Add button to add new budget item
            const addBudgetElement = document.createElement('div');
            addBudgetElement.className = 'add-budget-item';
            addBudgetElement.innerHTML = `
                <button class="btn btn-outline" onclick="openModal('add-budget-modal')">
                    <i class="fas fa-plus"></i> Add Budget Category
                </button>
            `;
            
            container.appendChild(addBudgetElement);
        } catch (error) {
            console.error('Error rendering budget items:', error);
            
            // Show error message in container
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error displaying budget items</p>
                    <button class="btn btn-primary" onclick="loadBudget()">Try Again</button>
                </div>
            `;
        }
    }
    

    // Load monthly summary for dashboard
    async function loadDashboardSummary() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.dashboard.summary);
            
            // Update income, expenses, and savings in the balance cards
            const incomeElement = document.querySelector('.balance-card.income .balance-amount');
            const expensesElement = document.querySelector('.balance-card.expenses .balance-amount');
            const savingsElement = document.querySelector('.balance-card.savings .balance-amount');
            
            if (incomeElement) incomeElement.textContent = formatCurrency(response.income);
            if (expensesElement) expensesElement.textContent = formatCurrency(response.expenses);
            if (savingsElement) savingsElement.textContent = formatCurrency(response.savings);
            
            // Update percentage changes
            const incomeChangeElement = document.querySelector('.balance-card.income .balance-change span');
            const expenseChangeElement = document.querySelector('.balance-card.expenses .balance-change span');
            const savingsRateElement = document.querySelector('.balance-card.savings .balance-change span');
            
            if (incomeChangeElement) {
                const change = response.income_change;
                // Fix: Ensure change is a number before using toFixed
                const numChange = parseFloat(change) || 0;
                const prefix = numChange >= 0 ? '+' : '';
                incomeChangeElement.textContent = `${prefix}${numChange.toFixed(1)}% from last month`;
                
                const iconElement = incomeChangeElement.previousElementSibling;
                if (iconElement) {
                    if (numChange >= 0) {
                        iconElement.className = 'fas fa-arrow-up';
                        incomeChangeElement.parentElement.className = 'balance-change positive';
                    } else {
                        iconElement.className = 'fas fa-arrow-down';
                        incomeChangeElement.parentElement.className = 'balance-change negative';
                    }
                }
            }
            
            if (expenseChangeElement) {
                const change = response.expense_change;
                // Fix: Ensure change is a number before using toFixed
                const numChange = parseFloat(change) || 0;
                const prefix = numChange >= 0 ? '+' : '';
                expenseChangeElement.textContent = `${prefix}${numChange.toFixed(1)}% from last month`;
                
                const iconElement = expenseChangeElement.previousElementSibling;
                if (iconElement) {
                    // For expenses, negative change is good (spending less)
                    if (numChange <= 0) {
                        iconElement.className = 'fas fa-arrow-down';
                        expenseChangeElement.parentElement.className = 'balance-change positive';
                    } else {
                        iconElement.className = 'fas fa-arrow-up';
                        expenseChangeElement.parentElement.className = 'balance-change negative';
                    }
                }
            }
            
            if (savingsRateElement) {
                const savingsRate = response.savings_rate || 0;
                // Fix: Ensure savings_rate is a number
                const numSavingsRate = parseFloat(savingsRate) || 0;
                savingsRateElement.textContent = `${numSavingsRate.toFixed(1)}% savings rate`;
                
                const iconElement = savingsRateElement.previousElementSibling;
                if (iconElement) {
                    if (numSavingsRate >= 20) {
                        iconElement.className = 'fas fa-check-circle';
                        savingsRateElement.parentElement.className = 'balance-change positive';
                    } else if (numSavingsRate <= 0) {
                        iconElement.className = 'fas fa-exclamation-circle';
                        savingsRateElement.parentElement.className = 'balance-change negative';
                    } else {
                        iconElement.className = 'fas fa-info-circle';
                        savingsRateElement.parentElement.className = 'balance-change';
                    }
                }
            }
            return response;
        } catch (error) {
            console.error('Failed to load dashboard summary:', error);
            return null;
        }
    }

    // Load monthly overview chart
    async function loadMonthlyOverview() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.dashboard.monthlyOverview);
            
            // Create chart if container exists
            const chartCanvas = document.getElementById('monthlyChartCanvas');
            if (chartCanvas) {
                createMonthlyChart(chartCanvas, response.monthly_overview);
            }
            
            return response.monthly_overview;
        } catch (error) {
            console.error('Failed to load monthly overview:', error);
            return null;
        }
    }

    // Create monthly overview chart
    // Replace your createMonthlyChart function with this version
// Replace createMonthlyChart function with this version
function createMonthlyChart(canvas, data) {
    // Safety check for canvas
    if (!canvas || !canvas.getContext) {
        console.error("Invalid canvas element for monthly chart");
        return;
    }
    
    try {
        // Check if chart exists before destroying
        if (window.monthlyChart && typeof window.monthlyChart.destroy === 'function') {
            window.monthlyChart.destroy();
            window.monthlyChart = null;
        }
        
        // Prepare chart data
        const labels = data.map(item => item.month);
        const incomeData = data.map(item => item.income);
        const expenseData = data.map(item => item.expenses);
        const savingsData = data.map(item => item.savings);
        
        // Create chart
        window.monthlyChart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Savings',
                        data: savingsData,
                        backgroundColor: 'rgba(124, 58, 237, 0.7)',
                        borderColor: 'rgba(124, 58, 237, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    } catch (err) {
        console.error("Error creating monthly chart:", err);
        // Display fallback text on canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Could not load monthly chart', canvas.width/2, canvas.height/2);
    }
}

    // Load spending by category
    async function loadSpendingByCategory() {
        try {
            // Get current month and year
            const currentMonth = state.selectedMonth || new Date().getMonth() + 1;
            const currentYear = state.selectedYear || new Date().getFullYear();
            
            console.log(`Loading spending for month ${currentMonth}, year ${currentYear}`);
            
            // Fetch data with explicit month/year parameters
            const response = await fetchAPI(
                `${API_ENDPOINTS.dashboard.spendingByCategory}?month=${currentMonth}&year=${currentYear}`
            );
            
            console.log("API response for spending:", response);
            
            if (!response || !response.spending_by_category) {
                console.error("Invalid spending response:", response);
                showNotification('Failed to load spending data', 'error');
                return [];
            }
            
            // Log the spending data to help with debugging
            if (response.spending_by_category.length === 0) {
                console.warn("No spending data returned for this month");
            } else {
                console.log(`Loaded ${response.spending_by_category.length} spending categories:`);
                response.spending_by_category.forEach(cat => {
                    console.log(`  - ${cat.name}: ${cat.total} (${cat.percentage}%)`);
                });
            }
            
            // Update category list
            const categoryListElement = document.querySelector('.category-list');
            if (categoryListElement) {
                renderCategorySpending(categoryListElement, response.spending_by_category);
            } else {
                console.warn("Category list element not found on page");
            }
            
            // Create or update pie chart if element exists
            const pieChartCanvas = document.getElementById('categoryPieChart');
            if (pieChartCanvas) {
                createCategoryPieChart(pieChartCanvas, response.spending_by_category);
            } else {
                console.warn("Category pie chart canvas not found on page");
            }
            
            return response.spending_by_category;
        } catch (error) {
            console.error('Failed to load spending by category:', error);
            showNotification('Failed to load spending data: ' + (error.message || 'Unknown error'), 'error');
            return [];
        }
    }
    
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    

    // Replace createCategoryPieChart with this version
function createCategoryPieChart(canvas, categories) {
    // Safety check for canvas
    if (!canvas || !canvas.getContext) {
        console.error("Invalid canvas element for category chart");
        return;
    }
    
    try {
        // Check if chart exists before destroying
        if (window.categoryPieChart && typeof window.categoryPieChart.destroy === 'function') {
            window.categoryPieChart.destroy();
            window.categoryPieChart = null;
        }
        
        // Handle empty data
        if (!categories || categories.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No spending data for this month', canvas.width/2, canvas.height/2);
            return;
        }
        
        // Create chart
        window.categoryPieChart = new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: categories.map(category => category.name),
                datasets: [{
                    data: categories.map(category => category.total),
                    backgroundColor: categories.map(category => category.color || getRandomColor()),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    } catch (err) {
        console.error("Error creating category chart:", err);
        // Display fallback text on canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Could not load category chart', canvas.width/2, canvas.height/2);
    }
}
function testCharts() {
    console.log("Testing charts...");
    
    // Test monthly chart
    const monthlyCanvas = document.getElementById('monthlyChartCanvas');
    if (monthlyCanvas) {
        const dummyData = [
            {month: 'Jan', income: 5000, expenses: 3000, savings: 2000},
            {month: 'Feb', income: 5500, expenses: 3200, savings: 2300},
            {month: 'Mar', income: 6000, expenses: 3500, savings: 2500}
        ];
        createMonthlyChart(monthlyCanvas, dummyData);
    } else {
        console.error("Monthly canvas not found!");
    }
    
    // Test category chart
    const categoryCanvas = document.getElementById('categoryPieChart');
    if (categoryCanvas) {
        const dummyCategories = [
            {name: 'Food', total: 1200, color: '#FF6384'},
            {name: 'Rent', total: 2000, color: '#36A2EB'},
            {name: 'Transport', total: 800, color: '#FFCE56'}
        ];
        createCategoryPieChart(categoryCanvas, dummyCategories);
    } else {
        console.error("Category canvas not found!");
    }
}

// Call this function after page loads
document.addEventListener('DOMContentLoaded', function() {
    // Existing code...    // Test charts after 2 seconds (to ensure all elements are loaded)
    setTimeout(testCharts, 2000);
});
    // Render category spending
    function renderCategorySpending(container, categories) {
        if (!container) {
            console.error("Category list container not found");
            return;
        }
        
        console.log(`Rendering ${categories?.length || 0} spending categories`);
        
        // Clear container
        container.innerHTML = '';
        
        if (!categories || categories.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-chart-pie"></i>
                    <p>No spending data for this month</p>
                    <small>Try adding some expense transactions!</small>
                </div>
            `;
            return;
        }
        
        // Limit to top 5 categories
        const topCategories = categories.slice(0, 5);
        
        topCategories.forEach(category => {
            // Check if category data is valid
            if (!category || typeof category.total === 'undefined') {
                console.error('Invalid category data:', category);
                return;
            }
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-item';
            
            // Use safe fallback values for missing properties
            const categoryName = category.name || 'Unnamed Category';
            const categoryIcon = category.icon || 'fa-tag';
            const categoryColor = category.color || '#6B7280';
            const categoryTotal = isNaN(parseFloat(category.total)) ? 0 : parseFloat(category.total);
            const categoryPercentage = isNaN(parseFloat(category.percentage)) ? 0 : parseFloat(category.percentage);
            
            categoryElement.innerHTML = `
                <div class="category-icon" style="background-color: ${categoryColor}">
                    <i class="fas ${categoryIcon}"></i>
                </div>
                <div class="category-details">
                    <div class="category-name">${categoryName}</div>
                    <div class="category-amount">${formatCurrency(categoryTotal)}</div>
                </div>
                <div class="category-progress">
                    <div class="progress-bar" style="width: ${categoryPercentage}%"></div>
                </div>
                <div class="category-percentage">${categoryPercentage.toFixed(1)}%</div>
            `;
            
            container.appendChild(categoryElement);
        });
        
        // If there are more categories, show a "View All" link
        if (categories.length > 5) {
            const viewAllElement = document.createElement('div');
            viewAllElement.className = 'view-all-item';
            viewAllElement.innerHTML = `
                <a href="/budget" class="view-all-link">
                    View All Categories <i class="fas fa-arrow-right"></i>
                </a>
            `;
            
            container.appendChild(viewAllElement);
        }
    }

    // Load credit suggestions
    async function loadCreditSuggestions() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.creditSuggestion);
            
            // Update suggestions list
            const suggestionListElement = document.querySelector('.suggestion-list');
            if (suggestionListElement) {
                renderCreditSuggestions(suggestionListElement, response);
            }
            
            return response;
        } catch (error) {
            console.error('Failed to load credit suggestions:', error);
            return null;
        }
    }

    // Render credit suggestions
    function renderCreditSuggestions(container, data) {
        container.innerHTML = '';
        
        // If we have a credit score, show it
        if (data.credit_score) {
            const scoreElement = document.createElement('div');
            scoreElement.className = 'credit-score-card';
            
            // Determine score category and color
            let category = 'Poor';
            let color = '#EF4444';
            
            if (data.credit_score >= 800) {
                category = 'Excellent';
                color = '#10B981';
            } else if (data.credit_score >= 740) {
                category = 'Very Good';
                color = '#10B981';
            } else if (data.credit_score >= 670) {
                category = 'Good';
                color = '#3B82F6';
            } else if (data.credit_score >= 580) {
                category = 'Fair';
                color = '#F59E0B';
            }
            
            scoreElement.innerHTML = `
                <div class="score-header">Your Credit Score</div>
                <div class="score-value" style="color: ${color}">${data.credit_score}</div>
                <div class="score-category">${category}</div>
                <div class="score-date">Last updated: Today</div>
            `;
            
            container.appendChild(scoreElement);
        }
        
        // Show suggestions
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(suggestion => {
                const suggestionElement = document.createElement('div');
                suggestionElement.className = 'suggestion-card';
                
                suggestionElement.innerHTML = `
                    <div class="suggestion-title">${suggestion.title}</div>
                    <div class="suggestion-desc">${suggestion.description}</div>
                `;
                
                container.appendChild(suggestionElement);
            });
        } else {
            container.innerHTML += `
                <div class="no-data">
                    <i class="fas fa-lightbulb"></i>
                    <p>No suggestions available at this time</p>
                </div>
            `;
        }
    }

    // Load education content
    async function loadEducation(limit = 3) {
        try {
            const response = await fetchAPI(API_ENDPOINTS.education);
            
            // Update education list
            const educationListElement = document.querySelector('.education-list');
            if (educationListElement) {
                renderEducation(educationListElement, response.education_content, limit);
            }
            
            return response.education_content;
        } catch (error) {
            console.error('Failed to load education content:', error);
            return null;
        }
    }

    // Render education content
    function renderEducation(container, content, limit) {
        container.innerHTML = '';
        
        if (!content || content.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-graduation-cap"></i>
                    <p>No educational content available</p>
                </div>
            `;
            return;
        }
        
        // Limit to specified number of items
        const limitedContent = content.slice(0, limit);
        
        limitedContent.forEach(item => {
            const educationElement = document.createElement('div');
            educationElement.className = 'education-item';
            
            // Determine icon based on content type
            let icon = 'fa-book';
            let link = 'Read Article';
            
            if (item.content_type === 'VIDEO') {
                icon = 'fa-play-circle';
                link = 'Watch Video';
            } else if (item.content_type === 'GUIDE') {
                icon = 'fa-file-alt';
                link = 'View Guide';
            } else if (item.content_type === 'QUIZ') {
                icon = 'fa-question-circle';
                link = 'Take Quiz';
            }
            
            educationElement.innerHTML = `
                <div class="education-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="education-details">
                    <div class="education-title">${item.title}</div>
                    <div class="education-desc">${item.description}</div>
                    <div class="education-level">${item.level}</div>
                    <a href="${item.url}" class="education-link" target="_blank">
                        <i class="fas fa-external-link-alt"></i> ${link}
                    </a>
                </div>
            `;
            
            container.appendChild(educationElement);
        });
        
        // If there are more items, show a "View All" link
        if (content.length > limit) {
            const viewAllElement = document.createElement('div');
            viewAllElement.className = 'view-all-item';
            viewAllElement.innerHTML = `
                <a href="/education" class="view-all-link">
                    View All Resources <i class="fas fa-arrow-right"></i>
                </a>
            `;
            
            container.appendChild(viewAllElement);
        }
    }

    // Setup form handling for accounts
    function setupAccountForms() {
        const addAccountForm = document.getElementById('add-account-form');
        const editAccountForm = document.getElementById('edit-account-form');
        
        if (addAccountForm) {
            addAccountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    account_name: document.getElementById('account-name').value,
                    account_type: document.getElementById('account-type').value,
                    balance: parseFloat(document.getElementById('account-balance').value),
                    account_number: document.getElementById('account-number').value,
                    institution: document.getElementById('institution').value
                };
                
                try {
                    await fetchAPI(API_ENDPOINTS.accounts, 'POST', formData);
                    showNotification('Account added successfully', 'success');
                    closeModal('add-account-modal');
                    addAccountForm.reset();
                    await loadAccounts();
                } catch (error) {
                    console.error('Failed to add account:', error);
                }
            });
        }
        
        if (editAccountForm) {
            // Register callback for edit modal
            registerModalCallback('edit-account-modal', async (accountId) => {
                const account = state.accounts.find(a => a.id === accountId);
                
                if (account) {
                    document.getElementById('edit-account-name').value = account.account_name;
                    document.getElementById('edit-account-type').value = account.account_type;
                    document.getElementById('edit-account-balance').value = account.balance;
                    document.getElementById('edit-account-number').value = account.account_number || '';
                    document.getElementById('edit-institution').value = account.institution || '';
                    document.getElementById('edit-is-active').checked = account.is_active === 1;
                    
                    // Store account ID in form data attribute
                    editAccountForm.dataset.accountId = accountId;
                }
            });
            
            editAccountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const accountId = editAccountForm.dataset.accountId;
                
                if (!accountId) {
                    showNotification('Account ID not found', 'error');
                    return;
                }
                
                const formData = {
                    account_name: document.getElementById('edit-account-name').value,
                    account_type: document.getElementById('edit-account-type').value,
                    balance: parseFloat(document.getElementById('edit-account-balance').value),
                    account_number: document.getElementById('edit-account-number').value,
                    institution: document.getElementById('edit-institution').value,
                    is_active: document.getElementById('edit-is-active').checked ? 1 : 0
                };
                
                try {
                    await fetchAPI(`${API_ENDPOINTS.accounts}/${accountId}`, 'PUT', formData);
                    showNotification('Account updated successfully', 'success');
                    closeModal('edit-account-modal');
                    await loadAccounts();
                } catch (error) {
                    console.error('Failed to update account:', error);
                }
            });
        }
        
        // Add delete account function to window
        window.deleteAccount = async (accountId) => {
            if (confirm('Are you sure you want to delete this account? This will hide the account but keep all transaction history.')) {
                try {
                    await fetchAPI(`${API_ENDPOINTS.accounts}/${accountId}`, 'DELETE');
                    showNotification('Account deleted successfully', 'success');
                    await loadAccounts();
                } catch (error) {
                    console.error('Failed to delete account:', error);
                }
            }
        };
    }

    // Setup form handling for transactions
    function setupTransactionForms() 
    {
        const addTransactionForm = document.getElementById('add-transaction-form');
        const editTransactionForm = document.getElementById('edit-transaction-form');
        
        if (addTransactionForm) {
            addTransactionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    account_id: document.getElementById('transaction-account').value,
                    category_id: document.getElementById('transaction-category').value,
                    amount: parseFloat(document.getElementById('transaction-amount').value),
                    description: document.getElementById('transaction-description').value,
                    transaction_date: document.getElementById('transaction-date').value,
                    transaction_type: document.getElementById('transaction-type').value,
                    is_recurring: document.getElementById('transaction-recurring').checked
                };
                
                // Add transfer account if it's a transfer
                if (formData.transaction_type === 'TRANSFER') {
                    formData.transfer_account_id = document.getElementById('transfer-account').value;
                    
                    if (formData.account_id === formData.transfer_account_id) {
                        showNotification('Cannot transfer to the same account', 'error');
                        return;
                    }
                }
                
                // Add notes if provided
                const notes = document.getElementById('transaction-notes').value;
                if (notes) {
                    formData.notes = notes;
                }
                
                try {
                    await fetchAPI(API_ENDPOINTS.transactions, 'POST', formData);
                    showNotification('Transaction added successfully', 'success');
                    closeModal('add-transaction-modal');
                    addTransactionForm.reset();
                    
                    // Set default date again
                    document.getElementById('transaction-date').value = new Date().toISOString().slice(0, 10);
                    
                    // Refresh data
                    await Promise.all([
                        loadAccounts(),
                        loadTransactions(),
                        loadDashboardSummary()
                    ]);
                } catch (error) {
                    console.error('Failed to add transaction:', error);
                }
            });
        }
        
        if (editTransactionForm) {
            // Register callback for edit modal
            registerModalCallback('edit-transaction-modal', async (transactionId) => {
                // Fetch the transaction details
                try {
                    const response = await fetchAPI(`${API_ENDPOINTS.transactions}/${transactionId}`);
                    const transaction = response.transaction;
                    
                    if (transaction) {
                        document.getElementById('edit-transaction-type').value = transaction.transaction_type;
                        document.getElementById('edit-transaction-account').value = transaction.account_id;
                        document.getElementById('edit-transaction-amount').value = transaction.amount;
                        document.getElementById('edit-transaction-description').value = transaction.description;
                        document.getElementById('edit-transaction-date').value = transaction.transaction_date;
                        document.getElementById('edit-transaction-recurring').checked = transaction.is_recurring === 1;
                        
                        if (transaction.notes) {
                            document.getElementById('edit-transaction-notes').value = transaction.notes;
                        }
                        
                        // Handle category selection
                        const categorySelect = document.getElementById('edit-transaction-category');
                        renderCategoryOptions(categorySelect, transaction.transaction_type);
                        
                        if (transaction.category_id) {
                            categorySelect.value = transaction.category_id;
                        }
                        
                        // Show/hide transfer fields
                        const transferFields = document.querySelector('.edit-transfer-fields');
                        if (transferFields) {
                            transferFields.style.display = transaction.transaction_type === 'TRANSFER' ? 'block' : 'none';
                        }
                        
                        // Store transaction ID in form data attribute
                        editTransactionForm.dataset.transactionId = transactionId;
                    }
                } catch (error) {
                    console.error('Failed to load transaction details:', error);
                    showNotification('Failed to load transaction details', 'error');
                }
            });
            
            editTransactionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const transactionId = editTransactionForm.dataset.transactionId;
                
                if (!transactionId) {
                    showNotification('Transaction ID not found', 'error');
                    return;
                }
                
                const formData = {
                    account_id: document.getElementById('edit-transaction-account').value,
                    category_id: document.getElementById('edit-transaction-category').value,
                    amount: parseFloat(document.getElementById('edit-transaction-amount').value),
                    description: document.getElementById('edit-transaction-description').value,
                    transaction_date: document.getElementById('edit-transaction-date').value,
                    transaction_type: document.getElementById('edit-transaction-type').value,
                    is_recurring: document.getElementById('edit-transaction-recurring').checked
                };
                
                // Add transfer account if it's a transfer
                if (formData.transaction_type === 'TRANSFER') {
                    formData.transfer_account_id = document.getElementById('edit-transfer-account').value;
                    
                    if (formData.account_id === formData.transfer_account_id) {
                        showNotification('Cannot transfer to the same account', 'error');
                        return;
                    }
                }
                
                // Add notes if provided
                const notes = document.getElementById('edit-transaction-notes').value;
                if (notes) {
                    formData.notes = notes;
                }
                
                try {
                    await fetchAPI(`${API_ENDPOINTS.transactions}/${transactionId}`, 'PUT', formData);
                    showNotification('Transaction updated successfully', 'success');
                    closeModal('edit-transaction-modal');
                    
                    // Refresh data
                    await Promise.all([
                        loadAccounts(),
                        loadTransactions(),
                        loadDashboardSummary()
                    ]);
                } catch (error) {
                    console.error('Failed to update transaction:', error);
                }
            });
        }
        
        // Add delete transaction function to window
        window.deleteTransaction = async (transactionId) => {
            if (confirm('Are you sure you want to delete this transaction?')) {
                try {
                    await fetchAPI(`${API_ENDPOINTS.transactions}/${transactionId}`, 'DELETE');
                    showNotification('Transaction deleted successfully', 'success');
                    
                    // Refresh data
                    await Promise.all([
                        loadAccounts(),
                        loadTransactions(),
                        loadDashboardSummary()
                    ]);
                } catch (error) {
                    console.error('Failed to delete transaction:', error);
                }
            }
        };
    }


    async function loadTransactions(limit = 5, accountId = null) {
        try {
            console.log(`Loading transactions (limit: ${limit}, accountId: ${accountId || 'all'})`);
            
            let url = `${API_ENDPOINTS.transactions}?limit=${limit}`;
            if (accountId) {
                url += `&account_id=${accountId}`;
            }
            
            const response = await fetchAPI(url);
            
            if (!response || !response.transactions) {
                console.error("Invalid transactions response:", response);
                state.transactions = [];
            } else {
                state.transactions = response.transactions;
                console.log(`Loaded ${state.transactions.length} transactions`);
            }
            
            // Update UI with transactions
            const transactionListElement = document.querySelector('.transaction-list');
            console.log("Transaction list element found:", !!transactionListElement, transactionListElement);
            
            if (transactionListElement) {
                renderTransactions(transactionListElement);
            } else {
                console.error("Transaction list container not found! Check your HTML");
            }   
            
            return state.transactions;
        } catch (error) {
            console.error('Failed to load transactions:', error);
            showNotification('Failed to load transactions', 'error');
            return [];
        }
    }
    // Setup form handling for goals
    function setupGoalForms() {
        console.log("Setting up goal forms...");
        const addGoalForm = document.getElementById('add-goal-form');
        const editGoalForm = document.getElementById('edit-goal-form');
        const contributeGoalForm = document.getElementById('contribute-goal-form');
        
        if (addGoalForm) {
            addGoalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    name: document.getElementById('goal-name').value,
                    target_amount: parseFloat(document.getElementById('goal-target-amount').value),
                    current_amount: parseFloat(document.getElementById('goal-current-amount').value || 0)
                };
                
                // Add target date if provided
                const targetDate = document.getElementById('goal-target-date').value;
                if (targetDate) {
                    formData.target_date = targetDate;
                }
                
                try {
                    await fetchAPI(API_ENDPOINTS.goals, 'POST', formData);
                    showNotification('Goal added successfully', 'success');
                    closeModal('add-goal-modal');
                    addGoalForm.reset();
                    await loadGoals();
                } catch (error) {
                    console.error('Failed to add goal:', error);
                    showNotification('Failed to add goal: ' + error.message, 'error');
                }
            });
        }
        
        if (editGoalForm) {
            // Register callback for edit modal
            if (typeof registerModalCallback === 'function') {
                registerModalCallback('edit-goal-modal', async (goalId) => {
                    const goal = state.goals.find(g => g.id === goalId);
                    
                    if (goal) {
                        document.getElementById('edit-goal-name').value = goal.name;
                        document.getElementById('edit-goal-target-amount').value = goal.target_amount;
                        document.getElementById('edit-goal-current-amount').value = goal.current_amount;
                        
                        if (goal.target_date) {
                            document.getElementById('edit-goal-target-date').value = goal.target_date;
                        } else {
                            document.getElementById('edit-goal-target-date').value = '';
                        }
                        
                        // Store goal ID in form data attribute
                        editGoalForm.dataset.goalId = goalId;
                    }
                });
            }
            
            editGoalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const goalId = editGoalForm.dataset.goalId;
                
                if (!goalId) {
                    showNotification('Goal ID not found', 'error');
                    return;
                }
                
                const formData = {
                    name: document.getElementById('edit-goal-name').value,
                    target_amount: parseFloat(document.getElementById('edit-goal-target-amount').value),
                    current_amount: parseFloat(document.getElementById('edit-goal-current-amount').value || 0)
                };
                
                // Add target date if provided
                const targetDate = document.getElementById('edit-goal-target-date').value;
                if (targetDate) {
                    formData.target_date = targetDate;
                }
                
                try {
                    await fetchAPI(`${API_ENDPOINTS.goals}/${goalId}`, 'PUT', formData);
                    showNotification('Goal updated successfully', 'success');
                    closeModal('edit-goal-modal');
                    await loadGoals();
                } catch (error) {
                    console.error('Failed to update goal:', error);
                    showNotification('Failed to update goal: ' + error.message, 'error');
                }
            });
        }
        
        if (contributeGoalForm) {
            // Register callback for contribute modal
            if (typeof registerModalCallback === 'function') {
                registerModalCallback('contribute-goal-modal', async (goalId) => {
                    const goal = state.goals.find(g => g.id === goalId);
                    
                    if (goal) {
                        // Reset form
                        contributeGoalForm.reset();
                        
                        // Set date to today
                        document.getElementById('contribution-date').value = new Date().toISOString().slice(0, 10);
                        
                        // Update modal title
                        const modalTitle = document.querySelector('#contribute-goal-modal .modal-header h3');
                        if (modalTitle) {
                            modalTitle.textContent = `Contribute to ${goal.name}`;
                        }
                        
                        // Store goal ID in form data attribute
                        contributeGoalForm.dataset.goalId = goalId;
                    }
                });
            }
            
            contributeGoalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const goalId = contributeGoalForm.dataset.goalId;
                
                if (!goalId) {
                    showNotification('Goal ID not found', 'error');
                    return;
                }
                
                const formData = {
                    amount: parseFloat(document.getElementById('contribution-amount').value),
                    contribution_date: document.getElementById('contribution-date').value,
                    notes: document.getElementById('contribution-notes')?.value || '',
                    account_id: document.getElementById('contribution-account')?.value || null
                };
                
                try {
                    // Direct API call instead of the commented out code
                    await fetchAPI(`${API_ENDPOINTS.goals}/${goalId}/contribute`, 'POST', formData);
                    showNotification('Contribution added successfully', 'success');
                    closeModal('contribute-goal-modal');
                    
                    // Refresh data
                    await Promise.all([
                        loadGoals(),
                        formData.account_id ? loadAccounts() : Promise.resolve()
                    ]);
                } catch (error) {
                    console.error('Failed to add contribution:', error);
                    showNotification('Failed to add contribution: ' + error.message, 'error');
                }
            });
        }
    }

    window.contributeToGoal = async function(goalId, formData) {
        try {
            // Ensure amount is a valid number
            formData.amount = parseFloat(formData.amount);
            if (isNaN(formData.amount) || formData.amount <= 0) {
                showNotification('Please enter a valid amount', 'error');
                return false;
            }
            
            // Convert account_id to a number if it exists
            if (formData.account_id) {
                formData.account_id = parseInt(formData.account_id);
            }
            
            // Make the API call
            const response = await fetchAPI(`${API_ENDPOINTS.goals}/${goalId}/contribute`, 'POST', formData);
            
            showNotification('Contribution added successfully', 'success');
            
            // Refresh data
            await Promise.all([
                loadGoals(),
                formData.account_id ? loadAccounts() : Promise.resolve()
            ]);
            
            return true;
        } catch (error) {
            console.error('Failed to add contribution:', error);
            showNotification('Failed to add contribution: ' + error.message, 'error');
            return false;
        }
    };

    async function loadGoalsForPage() {
        try {
            console.log("Loading goals for page...");
            
            // Use the existing loadGoals function instead of creating a new one
            return await loadGoals();
        } catch (error) {
            console.error('Failed to load goals for page:', error);
            showNotification('Failed to load goals', 'error');
            return [];
        }
    }
    // Setup form handling for bills
    function setupBillForms() {
        const addBillForm = document.getElementById('add-bill-form');
        const payBillModal = document.getElementById('pay-bill-modal');
        const payBillForm = document.getElementById('pay-bill-form');
        
        if (addBillForm) {
            addBillForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    name: document.getElementById('bill-name').value,
                    amount: parseFloat(document.getElementById('bill-amount').value),
                    due_date: document.getElementById('bill-due-date').value,
                    frequency: document.getElementById('bill-frequency').value,
                    reminder_days: parseInt(document.getElementById('bill-reminder').value || 3)
                };
                
                // Add description if provided
                const description = document.getElementById('bill-description').value;
                if (description) {
                    formData.description = description;
                }
                
                // Add category if provided
                const categoryId = document.getElementById('bill-category').value;
                if (categoryId) {
                    formData.category_id = categoryId;
                }
                
                // Add auto pay setting
                formData.auto_pay = document.getElementById('bill-auto-pay').checked;
                
                try {
                    await fetchAPI(API_ENDPOINTS.bills, 'POST', formData);
                    showNotification('Bill added successfully', 'success');
                    closeModal('add-bill-modal');
                    addBillForm.reset();
                    
                    // Set default date to today
                    document.getElementById('bill-due-date').value = new Date().toISOString().slice(0, 10);
                    
                    await loadBills();
                } catch (error) {
                    console.error('Failed to add bill:', error);
                }
            });
        }
        
        if (payBillModal && payBillForm) {
            // Register callback for pay bill modal
            registerModalCallback('pay-bill-modal', async (billId) => {
                // Fetch bill details
                try {
                    const response = await fetchAPI(`${API_ENDPOINTS.bills}/${billId}`);
                    const bill = response.bill;
                    
                    if (bill) {
                        // Update modal title
                        const billNameElement = document.getElementById('pay-bill-name');
                        if (billNameElement) {
                            billNameElement.textContent = bill.name;
                        }
                        
                        // Set amount
                        const amountElement = document.getElementById('pay-bill-amount');
                        if (amountElement) {
                            amountElement.value = bill.amount;
                        }
                        
                        // Set date to today
                        const dateElement = document.getElementById('pay-bill-date');
                        if (dateElement) {
                            dateElement.value = new Date().toISOString().slice(0, 10);
                        }
                        
                        // Store bill ID in modal data attribute
                        payBillModal.dataset.billId = billId;
                    }
                } catch (error) {
                    console.error('Failed to load bill details:', error);
                    showNotification('Failed to load bill details', 'error');
                }
            });
            
            payBillForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const billId = payBillModal.dataset.billId;
                
                if (!billId) {
                    showNotification('Bill ID not found', 'error');
                    return;
                }
                
                const formData = {
                    account_id: document.getElementById('pay-bill-account').value,
                    payment_date: document.getElementById('pay-bill-date').value
                };
                
                // Add notes if provided
                const notes = document.getElementById('pay-bill-notes').value;
                if (notes) {
                    formData.notes = notes;
                }
                
                try {
                    await fetchAPI(`${API_ENDPOINTS.bills}/${billId}/pay`, 'POST', formData);
                    showNotification('Bill paid successfully', 'success');
                    closeModal('pay-bill-modal');
                    
                    // Refresh data
                    await Promise.all([
                        loadBills(),
                        loadAccounts(),  // Refresh accounts since money was spent
                        loadTransactions()  // Refresh transactions since a new one was created
                    ]);
                } catch (error) {
                    console.error('Failed to pay bill:', error);
                }
            });
        }
    }

    // Setup form handling for budget
    function setupBudgetForms() {
        const addBudgetForm = document.getElementById('add-budget-form');
        const editBudgetForm = document.getElementById('edit-budget-form');
        
        const budgetCategorySelect = document.getElementById('budget-category');
    const editBudgetCategorySelect = document.getElementById('edit-budget-category');
    if (budgetCategorySelect) {
        console.log("Initializing budget category select");
        renderCategoryOptions(budgetCategorySelect, 'EXPENSE');
    }
    
    if (editBudgetCategorySelect) {
        console.log("Initializing edit budget category select");
        renderCategoryOptions(editBudgetCategorySelect, 'EXPENSE');
    }
        if (addBudgetForm) {
            // Set default month and year values
            const monthSelect = document.getElementById('budget-month');
            const yearInput = document.getElementById('budget-year');
            
            if (monthSelect && yearInput) {
                monthSelect.value = new Date().getMonth() + 1;
                yearInput.value = new Date().getFullYear();
            }
            
            addBudgetForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    category_id: document.getElementById('budget-category').value,
                    amount: parseFloat(document.getElementById('budget-amount').value),
                    month: parseInt(document.getElementById('budget-month').value),
                    year: parseInt(document.getElementById('budget-year').value)
                };
                
                try {
                    await fetchAPI(API_ENDPOINTS.budget, 'POST', formData);
                    showNotification('Budget added successfully', 'success');
                    closeModal('add-budget-modal');
                    addBudgetForm.reset();
                    
                    // Reset to current month/year
                    document.getElementById('budget-month').value = new Date().getMonth() + 1;
                    document.getElementById('budget-year').value = new Date().getFullYear();
                    
                    await loadBudget();
                } catch (error) {
                    console.error('Failed to add budget:', error);
                }
            });
        }
        
        if (editBudgetForm) {
            // Add edit budget function to window
            window.editBudget = async (categoryId) => {
                // Find the budget item for this category
                const budgetItem = state.budget.find(item => item.category_id === categoryId);
                
                if (budgetItem) {
                    // Set form values
                    document.getElementById('edit-budget-category').value = budgetItem.category_id;
                    document.getElementById('edit-budget-amount').value = budgetItem.budget_amount;
                    document.getElementById('edit-budget-month').value = state.selectedMonth;
                    document.getElementById('edit-budget-year').value = state.selectedYear;
                    
                    // Store budget ID in form data attribute
                    editBudgetForm.dataset.budgetCategory = categoryId;
                    
                    // Open modal
                    openModal('edit-budget-modal');
                }
            };
            
            editBudgetForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const categoryId = editBudgetForm.dataset.budgetCategory;
                
                if (!categoryId) {
                    showNotification('Budget category not found', 'error');
                    return;
                }
                
                const formData = {
                    category_id: document.getElementById('edit-budget-category').value,
                    amount: parseFloat(document.getElementById('edit-budget-amount').value),
                    month: parseInt(document.getElementById('edit-budget-month').value),
                    year: parseInt(document.getElementById('edit-budget-year').value)
                };
                
                try {
                    await fetchAPI(API_ENDPOINTS.budget, 'POST', formData);  // Use POST since we're using an upsert pattern in the backend
                    showNotification('Budget updated successfully', 'success');
                    closeModal('edit-budget-modal');
                    
                    // Update state.selectedMonth and state.selectedYear if they changed
                    state.selectedMonth = formData.month;
                    state.selectedYear = formData.year;
                    
                    await loadBudget();
                } catch (error) {
                    console.error('Failed to update budget:', error);
                }
            });
        }
        
        // Setup budget month selection
        const budgetMonthSelect = document.getElementById('budgetMonth');
        if (budgetMonthSelect) {
            // Populate month options
            const months = [
                {value: 1, label: 'January'},
                {value: 2, label: 'February'},
                {value: 3, label: 'March'},
                {value: 4, label: 'April'},
                {value: 5, label: 'May'},
                {value: 6, label: 'June'},
                {value: 7, label: 'July'},
                {value: 8, label: 'August'},
                {value: 9, label: 'September'},
                {value: 10, label: 'October'},
                {value: 11, label: 'November'},
                {value: 12, label: 'December'}
            ];
            
            // Add current and previous year
            const currentYear = new Date().getFullYear();
            
            months.forEach(month => {
                // Current year
                const optionCurrent = document.createElement('option');
                optionCurrent.value = `${month.value}-${currentYear}`;
                optionCurrent.textContent = `${month.label} ${currentYear}`;
                budgetMonthSelect.appendChild(optionCurrent);
                
                // Previous year
                const optionPrev = document.createElement('option');
                optionPrev.value = `${month.value}-${currentYear - 1}`;
                optionPrev.textContent = `${month.label} ${currentYear - 1}`;
                budgetMonthSelect.appendChild(optionPrev);
            });
            
            // Set default to current month and year
            budgetMonthSelect.value = `${new Date().getMonth() + 1}-${currentYear}`;
            
            // Handle month change
            budgetMonthSelect.addEventListener('change', () => {
                const [month, year] = budgetMonthSelect.value.split('-').map(Number);
                state.selectedMonth = month;
                state.selectedYear = year;
                loadBudget();
            });
        }
    }

    // Initialize dashboard
    async function initializeDashboard() {
        try {
            console.log("Initializing dashboard...");
            setupDashboardLogout();
            
            // Load basic user data
            await loadProfile();
            
            // Load accounts and categories (needed for forms)
            const [accountsResult, categoriesResult] = await Promise.all([
                loadAccounts(),
                loadCategories()  // Using our improved function
            ]);
            
            console.log(`Loaded ${accountsResult?.length || 0} accounts and ${categoriesResult?.length || 0} categories`);
            
            // Load dashboard data with better error handling
            try {
                await Promise.all([
                    loadTransactions(),
                    loadDashboardGoals(),
                    loadBills(),
                    loadDashboardBudget(),
                    loadEducation(),
                    loadDashboardSummary(),
                    loadMonthlyOverview(),
                    loadSpendingByCategory(),  // Using our improved function
                    loadCreditSuggestions()
                ]);
                console.log("All dashboard components loaded successfully");
            } catch (error) {
                console.error("Error loading some dashboard components:", error);
                showNotification('Some dashboard components could not be loaded. Try refreshing the page.', 'warning');
            }
            
            // Setup form event handlers
            setupAccountForms();
            setupTransactionForms();
            setupGoalForms();
            setupBillForms();
            setupBudgetForms();
            
            console.log("Dashboard initialization completed");
        } catch (error) {
            console.error("Error initializing dashboard:", error);
            showNotification('Error initializing dashboard. Please try refreshing the page.', 'error');
        }
    }

    // Initialize education page
    async function initializeEducation() {
        await loadProfile();
        
        // Load full education content
        const educationData = await loadEducation(999);  // Large number to get all
        
        // Setup education page specific functionality
        const levelFilter = document.getElementById('level-filter');
        const typeFilter = document.getElementById('type-filter');
        const searchInput = document.getElementById('search-input');
        
        if (levelFilter && typeFilter && searchInput) {
            const filterEducation = () => {
                const level = levelFilter.value;
                const type = typeFilter.value;
                const search = searchInput.value.toLowerCase();
                
                let filteredContent = educationData;
                
                if (level) {
                    filteredContent = filteredContent.filter(item => item.level === level);
                }
                
                if (type) {
                    filteredContent = filteredContent.filter(item => item.content_type === type);
                }
                
                if (search) {
                    filteredContent = filteredContent.filter(item => 
                        item.title.toLowerCase().includes(search) || 
                        item.description.toLowerCase().includes(search) ||
                        (item.tags && item.tags.toLowerCase().includes(search))
                    );
                }
                
                const educationGrid = document.getElementById('education-grid');
                if (educationGrid) {
                    renderEducation(educationGrid, filteredContent, 999);  // Show all filtered results
                }
            };
            
            levelFilter.addEventListener('change', filterEducation);
            typeFilter.addEventListener('change', filterEducation);
            
            // Debounce search
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(filterEducation, 300);
            });
        }
    }

    // Initialize settings page
    async function initializeSettings() {
        // Load user profile
        const profileData = await loadProfile();
        
        // Setup settings tabs
        const settingsTabs = document.querySelectorAll('.settings-tab');
        const settingsContents = document.querySelectorAll('.settings-content');
        
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                settingsTabs.forEach(t => t.classList.remove('active'));
                settingsContents.forEach(c => c.classList.remove('active'));
                
                tab.classList.add('active');
                const targetContent = document.getElementById(tab.dataset.target);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
        
        // Set theme options
        const themeOptions = document.querySelectorAll('.theme-option');
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        
        themeOptions.forEach(option => {
            if (option.dataset.theme === currentTheme) {
                option.classList.add('active');
            }
            
            option.addEventListener('click', () => {
                themeOptions.forEach(o => o.classList.remove('active'));
                option.classList.add('active');
                
                // Apply theme
                const theme = option.dataset.theme;
                if (theme === 'system') {
                    // Use system preference
                    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
                    const systemTheme = prefersDarkScheme.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', systemTheme);
                    localStorage.removeItem('theme');
                } else {
                    // Use selected theme
                    document.documentElement.setAttribute('data-theme', theme);
                    localStorage.setItem('theme', theme);
                }
                
                // Update theme toggle icon
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) {
                    const moonIcon = themeToggle.querySelector('.fa-moon');
                    const sunIcon = themeToggle.querySelector('.fa-sun');
                    
                    if (moonIcon && sunIcon) {
                        const currentTheme = document.documentElement.getAttribute('data-theme');
                        if (currentTheme === 'dark') {
                            moonIcon.style.display = 'none';
                            sunIcon.style.display = 'block';
                        } else {
                            moonIcon.style.display = 'block';
                            sunIcon.style.display = 'none';
                        }
                    }
                }
            });
        });
        
        // Populate profile form
        if (profileData && profileData.user) {
            const user = profileData.user;
            
            const fullNameInput = document.getElementById('profile-full-name');
            const usernameInput = document.getElementById('profile-username');
            const emailInput = document.getElementById('profile-email');
            
            if (fullNameInput) fullNameInput.value = user.full_name;
            if (usernameInput) usernameInput.value = user.username;
            if (emailInput) emailInput.value = user.email;
            
            // Update avatar preview
            const avatarPreview = document.getElementById('avatar-preview');
            if (avatarPreview) {
                const nameParts = user.full_name.split(' ');
                const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
                avatarPreview.textContent = initials;
            }
        }
        
        // Populate preferences form
        if (profileData && profileData.preferences) {
            const prefs = profileData.preferences;
            
            const currencySelect = document.getElementById('currency');
            const dateFormatSelect = document.getElementById('date-format');
            const notificationToggle = document.getElementById('notification-enabled');
            const emailNotificationToggle = document.getElementById('email-notification');
            
            if (currencySelect) currencySelect.value = prefs.currency || 'INR';
            if (dateFormatSelect) dateFormatSelect.value = prefs.date_format || 'YYYY-MM-DD';
            if (notificationToggle) notificationToggle.checked = prefs.notification_enabled === 1;
            if (emailNotificationToggle) emailNotificationToggle.checked = prefs.email_notification === 1;
        }
        
        // Setup form submissions
        const profileForm = document.getElementById('profile-form');
        const passwordForm = document.getElementById('password-form');
        const formatForm = document.getElementById('format-form');
        
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    full_name: document.getElementById('profile-full-name').value,
                    username: document.getElementById('profile-username').value,
                    email: document.getElementById('profile-email').value
                };
                
                try {
                    await fetchAPI(API_ENDPOINTS.profile, 'PUT', formData);
                    showNotification('Profile updated successfully', 'success');
                    
                    // Update UI with new name
                    const userNameElements = document.querySelectorAll('#user-name');
                    const welcomeNameElement = document.getElementById('welcome-name');
                    
                    if (userNameElements) {
                        userNameElements.forEach(elem => {
                            elem.textContent = formData.full_name;
                        });
                    }
                    
                    if (welcomeNameElement) {
                        const firstName = formData.full_name.split(' ')[0];
                        welcomeNameElement.textContent = firstName;
                    }
                    
                    // Update avatar
                    const avatarElements = document.querySelectorAll('.account-avatar');
                    if (avatarElements) {
                        const nameParts = formData.full_name.split(' ');
                        const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
                        
                        avatarElements.forEach(avatar => {
                            avatar.textContent = initials;
                        });
                    }
                    
                    const avatarPreview = document.getElementById('avatar-preview');
                    if (avatarPreview) {
                        const nameParts = formData.full_name.split(' ');
                        const initials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
                        avatarPreview.textContent = initials;
                    }
                } catch (error) {
                    console.error('Failed to update profile:', error);
                }
            });
        }
        
        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;
                
                if (newPassword !== confirmPassword) {
                    showNotification('New passwords do not match', 'error');
                    return;
                }
                
                try {
                    await fetchAPI(API_ENDPOINTS.profile, 'PUT', {
                        current_password: currentPassword,
                        new_password: newPassword
                    });
                    
                    showNotification('Password updated successfully', 'success');
                    passwordForm.reset();
                } catch (error) {
                    console.error('Failed to update password:', error);
                }
            });
        }
        
        if (formatForm) {
            formatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    currency: document.getElementById('currency').value,
                    date_format: document.getElementById('date-format').value
                };
                
                try {
                    await fetchAPI(API_ENDPOINTS.profile, 'PUT', formData);
                    showNotification('Preferences updated successfully', 'success');
                } catch (error) {
                    console.error('Failed to update preferences:', error);
                }
            });
        }
        
        // Setup notification toggles
        const notificationToggle = document.getElementById('notification-enabled');
        const emailNotificationToggle = document.getElementById('email-notification');
        
        if (notificationToggle) {
            notificationToggle.addEventListener('change', async (e) => {
                try {
                    await fetchAPI(API_ENDPOINTS.profile, 'PUT', {
                        notification_enabled: e.target.checked ? 1 : 0
                    });
                    showNotification('Notification preference updated', 'success');
                } catch (error) {
                    console.error('Failed to update notification preference:', error);
                    e.target.checked = !e.target.checked;  // Revert if failed
                }
            });
        }
        
        if (emailNotificationToggle) {
            emailNotificationToggle.addEventListener('change', async (e) => {
                try {
                    await fetchAPI(API_ENDPOINTS.profile, 'PUT', {
                        email_notification: e.target.checked ? 1 : 0
                    });
                    showNotification('Email notification preference updated', 'success');
                } catch (error) {
                    console.error('Failed to update email notification preference:', error);
                    e.target.checked = !e.target.checked;  // Revert if failed
                }
            });
        }
        
        // Setup account deletion
        const deleteAccountBtn = document.getElementById('delete-account-btn');
        const confirmDeleteBtn = document.getElementById('confirm-delete-account');
        
        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                openModal('delete-account-modal');
            });
        }
        
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                const password = document.getElementById('delete-password').value;
                
                if (!password) {
                    showNotification('Please enter your password to confirm', 'error');
                    return;
                }
                
                try {
                    await fetchAPI(API_ENDPOINTS.profile, 'DELETE', { password });
                    showNotification('Account deleted successfully', 'success');
                    
                    // Redirect to login page
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                } catch (error) {
                    console.error('Failed to delete account:', error);
                }
            });
        }
    }

    // Make API functions available globally
    window.getEducationContent = async function() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.education);
            return response.education_content;
        } catch (error) {
            console.error('Failed to load education content:', error);
            return [];
        }
    };

    function initializeTransactionsPage() {
        console.log("Initializing transactions page...");
        
        // Load profile first
        loadProfile().then(() => {
            // Then load accounts and categories simultaneously
            Promise.all([
                loadAccounts(),
                loadCategories()
            ]).then(() => {
                // Then load transactions and set up forms
                loadTransactionsForPage(50);
                setupTransactionForms();
                setupFilterHandlers();
                
                // Set up refresh button if it exists
                const refreshBtn = document.getElementById('refresh-btn');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', function() {
                        loadTransactionsForPage(50);
                        showNotification('Transactions refreshed successfully', 'success');
                    });
                }
            }).catch(error => {
                console.error("Error initializing transactions page:", error);
                showNotification('Error loading data. Please refresh the page.', 'error');
            });
        });
        return loadAccounts();
    }
    async function loadTransactionsForPage(limit = 50) {
        try {
            console.log(`Loading transactions for transactions page (limit: ${limit})`);
            
            // Get filter values if they exist
            const accountFilter = document.getElementById('account-filter');
            const categoryFilter = document.getElementById('category-filter');
            const typeFilter = document.getElementById('transaction-type-filter');
            const fromDateFilter = document.getElementById('from-date');
            const toDateFilter = document.getElementById('to-date');
            
            // Build URL with filters
            let url = `${API_ENDPOINTS.transactions}?limit=${limit}`;
            
            if (accountFilter && accountFilter.value) {
                url += `&account_id=${accountFilter.value}`;
            }
            
            if (categoryFilter && categoryFilter.value) {
                url += `&category_id=${categoryFilter.value}`;
            }
            
            if (typeFilter && typeFilter.value) {
                url += `&transaction_type=${typeFilter.value}`;
            }
            
            if (fromDateFilter && fromDateFilter.value) {
                url += `&from_date=${fromDateFilter.value}`;
            }
            
            if (toDateFilter && toDateFilter.value) {
                url += `&to_date=${toDateFilter.value}`;
            }
            
            // Fetch transactions
            const response = await fetchAPI(url);
            
            if (!response || !response.transactions) {
                console.error("Invalid transactions response:", response);
                state.transactions = [];
            } else {
                state.transactions = response.transactions;
                console.log(`Loaded ${state.transactions.length} transactions for transactions page`);
            }
            
            // Find the transactions table body
            const transactionsTableBody = document.getElementById('transactions-table-body');
            
            if (transactionsTableBody) {
                renderTransactionsTable(transactionsTableBody);
            } else {
                console.error("Transactions table body not found! Check your transactions.html");
            }
            
            // Update summary if available
            updateTransactionSummary(response.summary);
            
            return state.transactions;
        } catch (error) {
            console.error('Failed to load transactions for page:', error);
            showNotification('Failed to load transactions', 'error');
            return [];
        }
    }
    function updateTransactionSummary(summary) {
        // If no summary was provided, calculate it from the transactions
        if (!summary) {
            let totalIncome = 0;
            let totalExpenses = 0;
            
            if (state.transactions) {
                state.transactions.forEach(transaction => {
                    if (transaction.transaction_type === 'INCOME') {
                        totalIncome += parseFloat(transaction.amount || 0);
                    } else if (transaction.transaction_type === 'EXPENSE') {
                        totalExpenses += parseFloat(transaction.amount || 0);
                    }
                });
            }
            
            summary = {
                total_income: totalIncome,
                total_expenses: totalExpenses,
                net_balance: totalIncome - totalExpenses,
                transaction_count: state.transactions ? state.transactions.length : 0
            };
        }
        
        // Update summary display if elements exist
        const totalIncomeElement = document.getElementById('total-income');
        const totalExpensesElement = document.getElementById('total-expenses');
        const netBalanceElement = document.getElementById('net-balance');
        const transactionCountElement = document.getElementById('transaction-count');
        
        if (totalIncomeElement) {
            totalIncomeElement.textContent = formatCurrency(summary.total_income || 0);
        }
        
        if (totalExpensesElement) {
            totalExpensesElement.textContent = formatCurrency(summary.total_expenses || 0);
        }
        
        if (netBalanceElement) {
            netBalanceElement.textContent = formatCurrency(summary.net_balance || 0);
            
            // Set net balance color based on value
            if (summary.net_balance > 0) {
                netBalanceElement.classList.add('income-value');
                netBalanceElement.classList.remove('expense-value');
            } else if (summary.net_balance < 0) {
                netBalanceElement.classList.add('expense-value');
                netBalanceElement.classList.remove('income-value');
            } else {
                netBalanceElement.classList.remove('income-value', 'expense-value');
            }
        }
        
        if (transactionCountElement) {
            transactionCountElement.textContent = summary.transaction_count || 0;
        }
    }
    function renderTransactionsTable(tableBody) {
        if (!tableBody) {
            console.error("Transactions table body is null or undefined");
            return;
        }
        
        console.log("Rendering transactions table with", state.transactions?.length || 0, "transactions");
        
        // Clear table body
        tableBody.innerHTML = '';
        
        // Handle empty state
        if (!state.transactions || state.transactions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" style="text-align: center;">No transactions found</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        // Render each transaction as a table row
        state.transactions.forEach(transaction => {
            const row = document.createElement('tr');
            
            // Format date
            const date = new Date(transaction.transaction_date);
            const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            
            // Format amount and class
            const amountClass = transaction.transaction_type === 'INCOME' ? 'transaction-income' : 
                               (transaction.transaction_type === 'EXPENSE' ? 'transaction-expense' : '');
            const sign = transaction.transaction_type === 'INCOME' ? '+' : 
                       (transaction.transaction_type === 'EXPENSE' ? '-' : '');
            
            // Format category
            const categoryStyle = transaction.category_color ? `background-color: ${transaction.category_color}` : '';
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${transaction.description}</td>
                <td>
                    ${transaction.category_name ? 
                        `<span class="category-tag" style="${categoryStyle}">${transaction.category_name}</span>` : 
                        `<span class="category-tag">Uncategorized</span>`}
                </td>
                <td>${transaction.account_name || 'Unknown'}</td>
                <td class="transaction-amount ${amountClass}">${sign}${formatCurrency(transaction.amount)}</td>
                <td class="transaction-actions">
                    <button class="transaction-action-btn" onclick="openModal('edit-transaction-modal', ${transaction.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="transaction-action-btn transaction-delete-btn" onclick="deleteTransaction(${transaction.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    function setupFilterHandlers() {
        const applyFiltersBtn = document.getElementById('apply-filters');
        const clearFiltersBtn = document.getElementById('clear-filters');
        
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', function() {
                loadTransactionsForPage(50);
            });
        }
        
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', function() {
                // Clear all filter inputs
                const accountFilter = document.getElementById('account-filter');
                const categoryFilter = document.getElementById('category-filter');
                const typeFilter = document.getElementById('transaction-type-filter');
                const fromDateFilter = document.getElementById('from-date');
                const toDateFilter = document.getElementById('to-date');
                
                if (accountFilter) accountFilter.value = '';
                if (categoryFilter) categoryFilter.value = '';
                if (typeFilter) typeFilter.value = '';
                if (fromDateFilter) fromDateFilter.value = '';
                if (toDateFilter) toDateFilter.value = '';
                
                // Reload transactions
                loadTransactionsForPage(50);
            });
        }
        
        // Setup export CSV button
        const exportCsvBtn = document.getElementById('export-csv');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', function() {
                exportTransactionsToCSV();
            });
        }
    }
    function exportTransactionsToCSV() {
        console.log("Exporting transactions to CSV");
        
        // Create CSV content
        let csvContent = "Date,Description,Category,Account,Amount,Type,Notes\n";
        
        if (state.transactions && state.transactions.length > 0) {
            state.transactions.forEach(transaction => {
                const date = new Date(transaction.transaction_date).toLocaleDateString('en-US');
                const description = (transaction.description || "").replace(/,/g, ' ');
                const category = transaction.category_name || 'Uncategorized';
                const account = transaction.account_name || 'Unknown';
                const amount = transaction.amount || 0;
                const type = transaction.transaction_type || '';
                const notes = (transaction.notes || '').replace(/,/g, ' ');
                
                csvContent += `${date},"${description}",${category},${account},${amount},${type},"${notes}"\n`;
            });
            
            // Create download link
            const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            
            // Trigger download
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            
            showNotification('Transactions exported successfully', 'success');
        } else {
            showNotification('No transactions to export', 'warning');
        }
    }

    function initializeGoalsPage() {
        console.log("Initializing goals page...");
        
        // Load profile first
        loadProfile().then(() => {
            // Then load accounts and goals simultaneously
            Promise.all([
                loadAccounts(),
                loadGoals()
            ]).then(() => {
                // Set up forms after data is loaded
                setupGoalForms();
                
                // Set up refresh button if it exists
                const refreshBtn = document.getElementById('refresh-btn');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', function() {
                        loadGoals().then(() => {
                            showNotification('Goals refreshed successfully', 'success');
                        });
                    });
                }
            }).catch(error => {
                console.error("Error initializing goals page:", error);
                showNotification('Error loading data. Please refresh the page.', 'error');
            });
        });
    }
    

    function updateGoalsSummary(goals) {
        // Debug the goals data
        console.log("Updating goals summary with goals:", goals?.length || 0);
        
        // Default values in case of empty data
        let totalGoalsValue = 0;
        let totalSaved = 0;
        let activeGoals = 0;
        let completedGoals = 0;
        
        if (Array.isArray(goals) && goals.length > 0) {
            goals.forEach(goal => {
                // Convert target_amount to number and add to total
                const targetAmount = parseFloat(goal.target_amount) || 0;
                totalGoalsValue += targetAmount;
                
                // Convert current_amount to number and add to total saved
                const currentAmount = parseFloat(goal.current_amount) || 0;
                totalSaved += currentAmount;
                
                // Count active and completed goals
                if (goal.is_completed) {
                    completedGoals++;
                } else {
                    activeGoals++;
                }
            });
        }
        
        // Calculate saved percentage
        const savedPercentage = totalGoalsValue > 0 ? (totalSaved / totalGoalsValue) * 100 : 0;
        
        // Update the UI elements
        const totalGoalsValueElement = document.getElementById('total-goals-value');
        const totalSavedElement = document.getElementById('total-saved');
        const savedPercentageElement = document.getElementById('saved-percentage');
        const activeGoalsCountElement = document.getElementById('active-goals-count');
        const completedGoalsCountElement = document.getElementById('completed-goals-count');
        
        if (totalGoalsValueElement) totalGoalsValueElement.textContent = formatCurrency(totalGoalsValue);
        if (totalSavedElement) totalSavedElement.textContent = formatCurrency(totalSaved);
        if (savedPercentageElement) savedPercentageElement.textContent = `${savedPercentage.toFixed(1)}% of total`;
        if (activeGoalsCountElement) activeGoalsCountElement.textContent = activeGoals;
        if (completedGoalsCountElement) completedGoalsCountElement.textContent = completedGoals;
        
        console.log(`Goals summary updated: Total Value: ${totalGoalsValue}, Total Saved: ${totalSaved}, Active: ${activeGoals}, Completed: ${completedGoals}`);
    }


    window.openContributeModal = function(goalId) {
        console.log("openContributeModal called directly from HTML for goal", goalId);
        // Find goal
        const goal = state.goals.find(g => g.id === goalId);
        
        if (goal) {
            // Reset form
            const form = document.getElementById('contribute-goal-form');
            if (form) form.reset();
            
            // Set today's date
            const dateField = document.getElementById('contribution-date');
            if (dateField) dateField.value = new Date().toISOString().slice(0, 10);
            
            // Update modal title
            const modalTitle = document.querySelector('#contribute-goal-modal .modal-header h3');
            if (modalTitle) {
                modalTitle.textContent = `Contribute to ${goal.name}`;
            }
            
            // Store goal ID in form data attribute
            if (form) form.dataset.goalId = goalId;
            
            // Open modal
            openModal('contribute-goal-modal');
        } else {
            console.error("Goal not found with ID:", goalId);
            showNotification('Goal not found', 'error');
        }
    };
    
    window.viewGoalDetails = async function(goalId) {
        console.log("viewGoalDetails called directly from HTML for goal", goalId);
        // Find goal
        const goal = state.goals.find(g => g.id === goalId);
        
        if (!goal) {
            console.error("Goal not found with ID:", goalId);
            showNotification('Goal not found', 'error');
            return;
        }
        
        // Fetch goal details including contributions
        try {
            const response = await fetchAPI(`${API_ENDPOINTS.goals}/${goalId}`);
            const goalDetails = response.goal;
            
            // Populate modal content
            const detailsContent = document.getElementById('goal-details-content');
            
            if (detailsContent) {
                // Calculate progress percentage
                const progressPercentage = goalDetails.target_amount > 0 
                    ? Math.min(100, (goalDetails.current_amount / goalDetails.target_amount) * 100) 
                    : 0;
                    
                // Format target date
                let targetDateFormatted = 'No target date set';
                if (goalDetails.target_date) {
                    const targetDate = new Date(goalDetails.target_date);
                    targetDateFormatted = targetDate.toLocaleDateString('en-US', {
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric'
                    });
                }
                
                // Calculate average monthly contribution if goal has a target date
                let monthlyContributionNeeded = 'N/A';
                if (goalDetails.target_date) {
                    const today = new Date();
                    const targetDate = new Date(goalDetails.target_date);
                    const monthsLeft = (targetDate.getFullYear() - today.getFullYear()) * 12 + 
                                        targetDate.getMonth() - today.getMonth();
                    
                    if (monthsLeft > 0) {
                        const amountLeft = goalDetails.target_amount - goalDetails.current_amount;
                        if (amountLeft > 0) {
                            monthlyContributionNeeded = formatCurrency(amountLeft / monthsLeft);
                        } else {
                            monthlyContributionNeeded = formatCurrency(0);
                        }
                    }
                }
                
                // Build list of contributions
                let contributionsHTML = '';
                if (goalDetails.contributions && goalDetails.contributions.length > 0) {
                    contributionsHTML = `
                        <div class="contribution-list">
                            <div class="contribution-list-header">
                                <div>Date</div>
                                <div>Amount</div>
                                <div>Notes</div>
                                <div>Account</div>
                            </div>
                    `;
                    
                    goalDetails.contributions.forEach(contribution => {
                        const date = new Date(contribution.contribution_date).toLocaleDateString('en-US', {
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric'
                        });
                        
                        contributionsHTML += `
                            <div class="contribution-list-item">
                                <div class="contribution-date">${date}</div>
                                <div class="contribution-amount">${formatCurrency(contribution.amount)}</div>
                                <div class="contribution-note">${contribution.notes || '-'}</div>
                                <div>${contribution.account_name ? 
                                    `<span class="contribution-account">${contribution.account_name}</span>` : 
                                    '-'}</div>
                            </div>
                        `;
                    });
                    
                    contributionsHTML += `</div>`;
                } else {
                    contributionsHTML = `
                        <div class="no-contributions">
                            <p>No contributions have been made to this goal yet.</p>
                        </div>
                    `;
                }
                
                // Build the complete HTML
                detailsContent.innerHTML = `
                    <div class="goal-detail-header">
                        <div class="goal-detail-icon">
                            <i class="fas ${goalDetails.icon || 'fa-bullseye'}"></i>
                        </div>
                        <div>
                            <div class="goal-detail-title">${goalDetails.name}</div>
                            <div>${goalDetails.description || ''}</div>
                        </div>
                    </div>
                    
                    <div class="goal-detail-section">
                        <div class="goal-detail-stats">
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Target Amount</div>
                                <div class="goal-stat-value">${formatCurrency(goalDetails.target_amount)}</div>
                            </div>
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Current Amount</div>
                                <div class="goal-stat-value">${formatCurrency(goalDetails.current_amount)}</div>
                            </div>
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Progress</div>
                                <div class="goal-stat-value">${progressPercentage.toFixed(0)}%</div>
                            </div>
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Target Date</div>
                                <div class="goal-stat-value">${targetDateFormatted}</div>
                            </div>
                        </div>
                        
                        <div class="goal-progress">
                            <div class="goal-progress-bar" style="width: ${progressPercentage}%"></div>
                        </div>
                        
                        <div class="goal-detail-stats">
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Amount Remaining</div>
                                <div class="goal-stat-value">${formatCurrency(Math.max(0, goalDetails.target_amount - goalDetails.current_amount))}</div>
                            </div>
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Monthly Needed</div>
                                <div class="goal-stat-value">${monthlyContributionNeeded}</div>
                            </div>
                            <div class="goal-stat-card">
                                <div class="goal-stat-label">Status</div>
                                <div class="goal-stat-value">${goalDetails.is_completed ? 'Completed' : 'In Progress'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="goal-detail-section">
                        <div class="goal-detail-section-title">Contribution History</div>
                        ${contributionsHTML}
                    </div>
                    
                    <div class="goal-actions">
                        <div class="goal-action-btn primary" onclick="openContributeModal(${goalDetails.id})">Add Contribution</div>
                        <div class="goal-action-btn secondary" onclick="openModal('edit-goal-modal', ${goalDetails.id})">Edit Goal</div>
                    </div>
                `;
            }
            
            // Open modal
            openModal('goal-details-modal');
        } catch (error) {
            console.error('Failed to load goal details:', error);
            showNotification('Failed to load goal details', 'error');
        }
    };

window.loadGoals = async function() {
     console.log("loadGoals called directly from HTML");
     // This is problematic as loadGoalsForPage() doesn't exist
     await loadGoalsForPage();
};

async function contributeToGoal(goalId, formData) {
    try {
        // Ensure amount is a valid number
        formData.amount = parseFloat(formData.amount);
        if (isNaN(formData.amount) || formData.amount <= 0) {
            showNotification('Please enter a valid amount', 'error');
            return false;
        }
        
        // Convert account_id to a number if it exists
        if (formData.account_id) {
            formData.account_id = parseInt(formData.account_id);
        }
        
        // Make the API call
        const response = await fetchAPI(`${API_ENDPOINTS.goals}/${goalId}/contribute`, 'POST', formData);
        
        showNotification('Contribution added successfully', 'success');
        
        // Refresh data
        await Promise.all([
            loadGoals(),
            formData.account_id ? loadAccounts() : Promise.resolve()  // Only refresh accounts if one was used
        ]);
        
        return true;
    } catch (error) {
        console.error('Failed to add contribution:', error);
        showNotification('Failed to add contribution: ' + error.message, 'error');
        return false;
    }
}


async function loadDashboardGoals() {
    try {
        console.log("Loading goals for dashboard...");
        const response = await fetchAPI('/api/dashboard/goals');
        
        if (!response) {
            throw new Error('No response from goals API');
        }
        
        // Store goals in state for reference
        state.dashboardGoals = response.goals || [];
        state.goalsSummary = response.summary || {
            total_goals: 0,
            completed_goals: 0,
            total_amount: 0,
            saved_amount: 0
        };
        
        // Update goals display on dashboard
        const goalsList = document.querySelector('.dashboard-grid .goal-list');
        if (goalsList) {
            renderDashboardGoals(goalsList);
        }
        
        return state.dashboardGoals;
    } catch (error) {
        console.error('Failed to load goals for dashboard:', error);
        // Set empty defaults
        state.dashboardGoals = [];
        state.goalsSummary = {
            total_goals: 0,
            completed_goals: 0,
            total_amount: 0,
            saved_amount: 0
        };
        
        // Still update UI with empty data
        const goalsList = document.querySelector('.dashboard-grid .goal-list');
        if (goalsList) {
            renderDashboardGoals(goalsList);
        }
        
        return [];
    }
}
function renderDashboardGoals(container) {
    if (!container) {
        console.error("Goals list container not found");
        return;
    }
    
    console.log("Rendering goals for dashboard");
    
    // Clear container first
    container.innerHTML = '';
    
    // Handle empty state
    if (!state.dashboardGoals || state.dashboardGoals.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-bullseye"></i>
                <p>No savings goals yet</p>
                <button class="btn btn-primary" id="add-dashboard-goal-btn">Create Goal</button>
            </div>
        `;
        
        // Add event handler for the add goal button
        const addGoalBtn = container.querySelector('#add-dashboard-goal-btn');
        if (addGoalBtn) {
            addGoalBtn.addEventListener('click', () => openModal('add-goal-modal'));
        }
        
        return;
    }
    
    // Render goals
    state.dashboardGoals.forEach(goal => {
        const goalElement = document.createElement('div');
        goalElement.className = 'goal-item';
        
        // Calculate progress percentage
        const targetAmount = parseFloat(goal.target_amount) || 0;
        const currentAmount = parseFloat(goal.current_amount) || 0;
        const progressPercentage = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
        
        // Format target date
        let dueDate = '';
        if (goal.target_date) {
            const targetDate = new Date(goal.target_date);
            dueDate = `
                <div class="goal-due-date">
                    <i class="fas fa-calendar-alt"></i>
                    Due by ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
            `;
        }
        
        goalElement.innerHTML = `
    <div class="goal-header">
        <div>
            <div class="goal-title">${goal.name}</div>
            <div class="goal-target">${formatCurrency(targetAmount)}</div>
        </div>
        <i class="fas ${goal.icon || 'fa-bullseye'}" style="color: ${goal.color || 'var(--primary-color)'}"></i>
    </div>
    <div class="goal-progress">
        <div class="goal-progress-bar" style="width: ${progressPercentage}%"></div>
    </div>
    <div class="goal-status">
        <div>${formatCurrency(currentAmount)}</div>
        <div>${progressPercentage.toFixed(0)}%</div>
    </div>
    ${dueDate}
    <div class="goal-actions">
        <button class="goal-edit-btn" style="flex: 1;" onclick="window.location.href = '/goals'">View</button>
    </div>
`;
        
        container.appendChild(goalElement);
    });
    
    // Add a "View All" link if there are likely more goals
    if (state.dashboardGoals.length > 0 && state.goalsSummary.total_goals > state.dashboardGoals.length) {
        const viewAllElement = document.createElement('div');
        viewAllElement.className = 'view-all-item';
        viewAllElement.innerHTML = `
            <a href="/goals" class="view-all-link">
                View All Goals <i class="fas fa-arrow-right"></i>
            </a>
        `;
        
        container.appendChild(viewAllElement);
    }
}
async function loadDashboardBudget() {
    try {
        console.log("Loading budget for dashboard...");
        const response = await fetchAPI('/api/dashboard/budget');
        
        if (!response) {
            throw new Error('No response from budget API');
        }
        
        // Store budget data in state
        state.dashboardBudget = response.budget_items || [];
        state.dashboardBudgetTotals = response.totals || {
            total_budget: 0,
            total_spent: 0,
            remaining: 0
        };
        
        console.log(`Loaded ${state.dashboardBudget.length} budget items for dashboard`);
        
        // Update dashboard UI
        updateDashboardBudgetUI();
        
        return state.dashboardBudget;
    } catch (error) {
        console.error('Failed to load budget for dashboard:', error);
        
        // Set empty defaults
        state.dashboardBudget = [];
        state.dashboardBudgetTotals = {
            total_budget: 0,
            total_spent: 0,
            remaining: 0
        };
        
        // Still update UI with empty data
        updateDashboardBudgetUI();
        
        return [];
    }
}

function updateDashboardBudgetUI() {
    // Update budget overview in the dashboard
    const budgetOverview = document.querySelector('.dashboard-grid .budget-overview');
    if (budgetOverview) {
        const budgetStatValues = budgetOverview.querySelectorAll('.budget-stat-value');
        
        if (budgetStatValues.length >= 3) {
            budgetStatValues[0].textContent = formatCurrency(state.dashboardBudgetTotals.total_budget || 0);
            budgetStatValues[1].textContent = formatCurrency(state.dashboardBudgetTotals.total_spent || 0);
            budgetStatValues[2].textContent = formatCurrency(state.dashboardBudgetTotals.remaining || 0);
        }
    }
    
    // Update budget list
    const budgetList = document.querySelector('.dashboard-grid .budget-list');
    if (budgetList) {
        renderDashboardBudgetItems(budgetList);
    }
}
function renderDashboardBudgetItems(container) {
    if (!container) {
        console.error("Budget list container not found");
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Handle empty state
    if (!state.dashboardBudget || state.dashboardBudget.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <i class="fas fa-chart-pie"></i>
                <p>No budget items for this month</p>
                <button class="btn btn-primary" id="dashboard-add-budget-btn">Create Budget</button>
            </div>
        `;
        
        // Add event handler for the add budget button
        const addBudgetBtn = container.querySelector('#dashboard-add-budget-btn');
        if (addBudgetBtn) {
            addBudgetBtn.addEventListener('click', () => openModal('add-budget-modal'));
        }
        
        return;
    }
    
    // Render budget items
    state.dashboardBudget.forEach(item => {
        const budgetElement = document.createElement('div');
        budgetElement.className = 'budget-item';
        
        // Calculate percentage and status
        const spent = parseFloat(item.actual_amount) || 0;
        const budget = parseFloat(item.budget_amount) || 0;
        const percentage = budget > 0 ? (spent / budget) * 100 : 0;
        const remaining = budget - spent;
        
        // Determine status class based on percentage
        let statusClass = 'good';
        let barClass = '';
        
        if (percentage >= 90) {
            statusClass = 'danger';
            barClass = 'danger';
        } else if (percentage >= 75) {
            statusClass = 'warning';
            barClass = 'warning';
        }
        
        budgetElement.innerHTML = `
            <div class="budget-item-header">
                <div class="budget-item-category">
                    <i class="fas ${item.icon || 'fa-tag'}" style="color: ${item.color || '#6B7280'}"></i>
                    ${item.category_name}
                </div>
                <div class="budget-item-amount">${formatCurrency(budget)}</div>
            </div>
            <div class="budget-item-progress">
                <div class="budget-item-bar ${barClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
            <div class="budget-item-status">
                <div class="budget-item-spent">Spent: ${formatCurrency(spent)}</div>
                <div class="budget-item-left ${statusClass}">
                    ${remaining >= 0 ? `${formatCurrency(remaining)} left` : `${formatCurrency(Math.abs(remaining))} over`}
                </div>
            </div>
        `;
        
        container.appendChild(budgetElement);
    });
    
    // Add a "View All" button at the bottom
    const viewAllElement = document.createElement('div');
    viewAllElement.className = 'view-all-item';
    viewAllElement.innerHTML = `
        <a href="/budget" class="view-all-link">
            View Budget Details <i class="fas fa-arrow-right"></i>
        </a>
    `;
    
    container.appendChild(viewAllElement);
}

function setupDashboardLogout() {
    console.log("Setting up dashboard logout button...");
    
    // Find all potential logout buttons on the dashboard
    const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Handle logout function
    const handleLogout = async (e) => {
        e.preventDefault();
        console.log("Dashboard logout button clicked");
        
        try {
            showNotification('Logging out...', 'info');
            await fetchAPI(API_ENDPOINTS.logout, 'POST');
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed:', error);
            showNotification('Logout failed. Please try again.', 'error');
        }
    };
    
    // Attach event listeners
    if (sidebarLogoutBtn) {
        console.log("Found sidebar logout button on dashboard");
        sidebarLogoutBtn.addEventListener('click', handleLogout);
    } else {
        console.log("Sidebar logout button not found on dashboard");
    }
    
    if (logoutBtn) {
        console.log("Found main logout button on dashboard");
        logoutBtn.addEventListener('click', handleLogout);
    } else {
        console.log("Main logout button not found on dashboard");
    }
    
    // Also add a direct event listener to the dashboard section
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection) {
        const logoutBtns = dashboardSection.querySelectorAll('a, button').forEach(element => {
            if (element.textContent.toLowerCase().includes('logout')) {
                console.log("Found logout text in element:", element);
                element.addEventListener('click', handleLogout);
            }
        });
    }
    
    console.log("Dashboard logout setup complete");
}

// Initialize app based on current page
function initializePage() {
    // Common setup for all pages
    setupSidebarToggle();
    setupThemeToggle();
    setupLogout();
    setupModals();
    setupDates();
    
    // Page-specific initialization
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index' || path === '/index.html') {
        // Index/login page
        setupAuthForms();
    } else if (path.includes('dashboard')) {
        // Dashboard page
        initializeDashboard();
    } else if (path.includes('education')) {
        // Education page
        initializeEducation();
    } else if (path.includes('settings')) {
        // Settings page
        initializeSettings();
    } else if (path.includes('accounts')) {
        // Use the new account page initialization
        initializeAccountsPage();
    } else if (path.includes('transactions')) {
        // Use our new transactions page initializer
        initializeTransactionsPage();
    } else if (path.includes('goals')) {
        // Use our new goals page initializer
        initializeGoalsPage();
    } else if (path.includes('bills')) {
        // Load bills data
        loadProfile().then(() => {
            Promise.all([
                loadAccounts(),
                loadCategories(),
                loadBills()
            ]).then(() => {
                setupBillForms();
            });
        });
    } else if (path.includes('budget')) {
        // Load budget data
        loadProfile().then(() => {
            Promise.all([
                loadCategories(),
                loadBudget()
            ]).then(() => {
                setupBudgetForms();
            });
        });
    }
}
    // Initialize app based on current page
    initializePage();
});