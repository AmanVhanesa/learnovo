// Global Variables
let currentUser = null;
let currentRole = null;
let students = [];
let teachers = [];
let fees = [];
let admissions = [];
let notifications = [];

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadSampleData();
    setupEventListeners();
});

// Initialize Application
function initializeApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentRole = currentUser.role;
        showMainApp();
        updateUserInterface();
    } else {
        showLoginScreen();
    }
}

// Show Login Screen
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// Show Main Application
function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    setupSidebarMenu();
    loadDashboardData();
}

// Setup Event Listeners
function setupEventListeners() {
    // Login Form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Global Search
    document.getElementById('globalSearch').addEventListener('input', handleGlobalSearch);
    
    // Sidebar Toggle
    document.querySelector('.sidebar-toggle').addEventListener('click', toggleSidebar);
    
    // Load data from localStorage
    loadDataFromStorage();
}

// Handle Login
function handleLogin(e) {
    e.preventDefault();
    
    const role = document.getElementById('userRole').value;
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Simple authentication (in real app, this would be server-side)
    if (authenticateUser(role, email, password)) {
        currentUser = {
            id: Date.now(),
            role: role,
            email: email,
            name: getDefaultUserName(role),
            avatar: getDefaultAvatar(role)
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        currentRole = role;
        
        showMainApp();
        updateUserInterface();
        showNotification('Login successful!', 'success');
    } else {
        showNotification('Invalid credentials. Please try again.', 'error');
    }
}

// Simple Authentication (Demo purposes)
function authenticateUser(role, email, password) {
    const validCredentials = {
        admin: { email: 'admin@learnovo.com', password: 'admin123' },
        teacher: { email: 'teacher@learnovo.com', password: 'teacher123' },
        student: { email: 'student@learnovo.com', password: 'student123' },
        parent: { email: 'parent@learnovo.com', password: 'parent123' }
    };
    
    return validCredentials[role] && 
           validCredentials[role].email === email && 
           validCredentials[role].password === password;
}

// Get Default User Name
function getDefaultUserName(role) {
    const names = {
        admin: 'Admin User',
        teacher: 'John Teacher',
        student: 'Jane Student',
        parent: 'Parent User'
    };
    return names[role] || 'User';
}

// Get Default Avatar
function getDefaultAvatar(role) {
    const avatars = {
        admin: 'https://via.placeholder.com/40/3EC4B1/FFFFFF?text=A',
        teacher: 'https://via.placeholder.com/40/2355A6/FFFFFF?text=T',
        student: 'https://via.placeholder.com/40/31828D/FFFFFF?text=S',
        parent: 'https://via.placeholder.com/40/A99080/FFFFFF?text=P'
    };
    return avatars[role] || 'https://via.placeholder.com/40/6B8EBB/FFFFFF?text=U';
}

// Update User Interface
function updateUserInterface() {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRoleDisplay').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('userAvatar').src = currentUser.avatar;
    
    setupSidebarMenu();
    loadDashboardData();
}

// Setup Sidebar Menu Based on Role
function setupSidebarMenu() {
    const menuItems = {
        admin: [
            { id: 'dashboard', icon: 'fas fa-tachometer-alt', text: 'Dashboard' },
            { id: 'students', icon: 'fas fa-users', text: 'Students' },
            { id: 'teachers', icon: 'fas fa-chalkboard-teacher', text: 'Teachers' },
            { id: 'fees', icon: 'fas fa-credit-card', text: 'Fees Management' },
            { id: 'admissions', icon: 'fas fa-user-plus', text: 'Admissions' },
            { id: 'reports', icon: 'fas fa-chart-bar', text: 'Reports' },
            { id: 'notifications', icon: 'fas fa-bell', text: 'Notifications' },
            { id: 'settings', icon: 'fas fa-cog', text: 'Settings' }
        ],
        teacher: [
            { id: 'dashboard', icon: 'fas fa-tachometer-alt', text: 'Dashboard' },
            { id: 'students', icon: 'fas fa-users', text: 'My Students' },
            { id: 'fees', icon: 'fas fa-credit-card', text: 'Pending Fees' },
            { id: 'notifications', icon: 'fas fa-bell', text: 'Notifications' },
            { id: 'settings', icon: 'fas fa-cog', text: 'Settings' }
        ],
        student: [
            { id: 'dashboard', icon: 'fas fa-tachometer-alt', text: 'Dashboard' },
            { id: 'fees', icon: 'fas fa-credit-card', text: 'My Fees' },
            { id: 'notifications', icon: 'fas fa-bell', text: 'Notifications' },
            { id: 'settings', icon: 'fas fa-cog', text: 'Settings' }
        ],
        parent: [
            { id: 'dashboard', icon: 'fas fa-tachometer-alt', text: 'Dashboard' },
            { id: 'students', icon: 'fas fa-users', text: 'My Children' },
            { id: 'fees', icon: 'fas fa-credit-card', text: 'Fees' },
            { id: 'notifications', icon: 'fas fa-bell', text: 'Notifications' },
            { id: 'settings', icon: 'fas fa-cog', text: 'Settings' }
        ]
    };
    
    const sidebarMenu = document.getElementById('sidebarMenu');
    sidebarMenu.innerHTML = '';
    
    const userMenuItems = menuItems[currentRole] || menuItems.student;
    
    userMenuItems.forEach(item => {
        const menuItem = document.createElement('li');
        menuItem.className = 'menu-item';
        menuItem.setAttribute('data-page', item.id);
        menuItem.innerHTML = `
            <i class="${item.icon}"></i>
            <span>${item.text}</span>
        `;
        menuItem.addEventListener('click', () => showPage(item.id));
        sidebarMenu.appendChild(menuItem);
    });
    
    // Set first item as active
    if (sidebarMenu.firstChild) {
        sidebarMenu.firstChild.classList.add('active');
    }
}

// Show Page
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Remove active class from all menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected page
    const page = document.getElementById(`${pageId}-page`);
    if (page) {
        page.classList.add('active');
        document.getElementById('pageTitle').textContent = getPageTitle(pageId);
    }
    
    // Add active class to selected menu item
    const menuItem = document.querySelector(`[data-page="${pageId}"]`);
    if (menuItem) {
        menuItem.classList.add('active');
    }
    
    // Load page-specific data
    loadPageData(pageId);
}

// Get Page Title
function getPageTitle(pageId) {
    const titles = {
        dashboard: 'Dashboard',
        students: 'Student Management',
        teachers: 'Teacher Management',
        fees: 'Fee Management',
        admissions: 'Admission Management',
        reports: 'Reports & Analytics',
        notifications: 'Notifications',
        settings: 'Settings'
    };
    return titles[pageId] || 'Page';
}

// Load Page Data
function loadPageData(pageId) {
    switch(pageId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'students':
            loadStudentsData();
            break;
        case 'teachers':
            loadTeachersData();
            break;
        case 'fees':
            loadFeesData();
            break;
        case 'admissions':
            loadAdmissionsData();
            break;
        case 'reports':
            loadReportsData();
            break;
        case 'notifications':
            loadNotificationsData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

// Load Dashboard Data
function loadDashboardData() {
    updateDashboardStats();
    updateDashboardCharts();
    updateRecentActivities();
}

// Update Dashboard Stats
function updateDashboardStats() {
    const statsContainer = document.getElementById('dashboardStats');
    if (!statsContainer) return;
    
    const stats = getDashboardStats();
    statsContainer.innerHTML = '';
    
    stats.forEach(stat => {
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        statCard.innerHTML = `
            <div class="stat-icon">
                <i class="${stat.icon}"></i>
            </div>
            <div class="stat-content">
                <h3>${stat.value}</h3>
                <p>${stat.label}</p>
            </div>
        `;
        statsContainer.appendChild(statCard);
    });
}

// Get Dashboard Stats Based on Role
function getDashboardStats() {
    const baseStats = {
        admin: [
            { icon: 'fas fa-users', label: 'Total Students', value: students.length },
            { icon: 'fas fa-chalkboard-teacher', label: 'Total Teachers', value: teachers.length },
            { icon: 'fas fa-dollar-sign', label: 'Fees Collected', value: `$${getTotalFeesCollected()}` },
            { icon: 'fas fa-exclamation-triangle', label: 'Pending Fees', value: getPendingFeesCount() }
        ],
        teacher: [
            { icon: 'fas fa-users', label: 'My Students', value: getMyStudentsCount() },
            { icon: 'fas fa-exclamation-triangle', label: 'Pending Fees', value: getMyPendingFeesCount() },
            { icon: 'fas fa-tasks', label: 'Assignments', value: '12' },
            { icon: 'fas fa-calendar-check', label: 'Attendance Rate', value: '95%' }
        ],
        student: [
            { icon: 'fas fa-user', label: 'My Profile', value: 'Complete' },
            { icon: 'fas fa-credit-card', label: 'Fees Status', value: getMyFeesStatus() },
            { icon: 'fas fa-tasks', label: 'Assignments', value: '5' },
            { icon: 'fas fa-bell', label: 'Notifications', value: notifications.length }
        ],
        parent: [
            { icon: 'fas fa-users', label: 'My Children', value: getMyChildrenCount() },
            { icon: 'fas fa-credit-card', label: 'Fees Status', value: getMyChildrenFeesStatus() },
            { icon: 'fas fa-bell', label: 'Notifications', value: notifications.length },
            { icon: 'fas fa-chart-line', label: 'Performance', value: 'Good' }
        ]
    };
    
    return baseStats[currentRole] || baseStats.student;
}

// Load Students Data
function loadStudentsData() {
    const tableBody = document.getElementById('studentsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const studentsToShow = getStudentsForCurrentUser();
    
    studentsToShow.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <img src="${student.avatar || 'https://via.placeholder.com/40'}" alt="${student.name}" class="user-avatar" style="width: 40px; height: 40px; border-radius: 50%;">
            </td>
            <td>${student.name}</td>
            <td>${student.rollNumber}</td>
            <td>${student.class}</td>
            <td>${formatDate(student.admissionDate)}</td>
            <td><span class="status ${student.status}">${student.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewStudent(${student.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editStudent(${student.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteStudent(${student.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Load Fees Data
function loadFeesData() {
    updateFeesSummary();
    loadFeesTable();
}

// Update Fees Summary
function updateFeesSummary() {
    const totalCollected = getTotalFeesCollected();
    const pendingDues = getPendingFeesAmount();
    const thisMonth = getThisMonthFees();
    const overdue = getOverdueFees();
    
    document.getElementById('totalCollected').textContent = `$${totalCollected}`;
    document.getElementById('pendingDues').textContent = `$${pendingDues}`;
    document.getElementById('thisMonth').textContent = `$${thisMonth}`;
    document.getElementById('overdueAmount').textContent = `$${overdue}`;
}

// Load Fees Table
function loadFeesTable() {
    const tableBody = document.getElementById('feesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const feesToShow = getFeesForCurrentUser();
    
    feesToShow.forEach(fee => {
        const student = students.find(s => s.id === fee.studentId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student ? student.name : 'Unknown'}</td>
            <td>${student ? student.class : 'N/A'}</td>
            <td>$${fee.amount}</td>
            <td>${formatDate(fee.dueDate)}</td>
            <td><span class="status ${fee.status}">${fee.status}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" onclick="viewFee(${fee.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn edit" onclick="editFee(${fee.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${fee.status === 'pending' ? `<button class="action-btn success" onclick="markAsPaid(${fee.id})">
                        <i class="fas fa-check"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Load Sample Data
function loadSampleData() {
    // Load from localStorage or create sample data
    students = JSON.parse(localStorage.getItem('students') || '[]');
    teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
    fees = JSON.parse(localStorage.getItem('fees') || '[]');
    admissions = JSON.parse(localStorage.getItem('admissions') || '[]');
    notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
    
    if (students.length === 0) {
        createSampleData();
    }
}

// Create Sample Data
function createSampleData() {
    // Sample Students
    students = [
        {
            id: 1,
            name: 'John Doe',
            rollNumber: 'ST001',
            class: '10th A',
            admissionDate: '2023-06-15',
            status: 'active',
            avatar: 'https://via.placeholder.com/40/3EC4B1/FFFFFF?text=JD',
            guardianName: 'Jane Doe',
            guardianPhone: '+1234567890',
            address: '123 Main St, City'
        },
        {
            id: 2,
            name: 'Jane Smith',
            rollNumber: 'ST002',
            class: '10th B',
            admissionDate: '2023-06-20',
            status: 'active',
            avatar: 'https://via.placeholder.com/40/2355A6/FFFFFF?text=JS',
            guardianName: 'Bob Smith',
            guardianPhone: '+1234567891',
            address: '456 Oak Ave, City'
        },
        {
            id: 3,
            name: 'Mike Johnson',
            rollNumber: 'ST003',
            class: '9th A',
            admissionDate: '2023-07-01',
            status: 'active',
            avatar: 'https://via.placeholder.com/40/31828D/FFFFFF?text=MJ',
            guardianName: 'Sarah Johnson',
            guardianPhone: '+1234567892',
            address: '789 Pine St, City'
        }
    ];
    
    // Sample Teachers
    teachers = [
        {
            id: 1,
            name: 'Dr. Sarah Wilson',
            subject: 'Mathematics',
            qualification: 'PhD in Mathematics',
            assignedClasses: ['10th A', '10th B'],
            status: 'active',
            avatar: 'https://via.placeholder.com/40/A99080/FFFFFF?text=SW'
        },
        {
            id: 2,
            name: 'Mr. David Brown',
            subject: 'Science',
            qualification: 'MSc in Physics',
            assignedClasses: ['9th A', '9th B'],
            status: 'active',
            avatar: 'https://via.placeholder.com/40/6B8EBB/FFFFFF?text=DB'
        }
    ];
    
    // Sample Fees
    fees = [
        {
            id: 1,
            studentId: 1,
            amount: 500,
            dueDate: '2024-01-15',
            status: 'paid',
            paidDate: '2024-01-10',
            description: 'Monthly Tuition Fee'
        },
        {
            id: 2,
            studentId: 2,
            amount: 500,
            dueDate: '2024-01-15',
            status: 'pending',
            description: 'Monthly Tuition Fee'
        },
        {
            id: 3,
            studentId: 3,
            amount: 500,
            dueDate: '2024-01-15',
            status: 'overdue',
            description: 'Monthly Tuition Fee'
        }
    ];
    
    // Sample Notifications
    notifications = [
        {
            id: 1,
            title: 'Fee Payment Reminder',
            message: 'Please pay your monthly tuition fee by January 15th.',
            type: 'warning',
            date: '2024-01-10',
            read: false
        },
        {
            id: 2,
            title: 'Parent-Teacher Meeting',
            message: 'Parent-teacher meeting scheduled for January 20th at 2 PM.',
            type: 'info',
            date: '2024-01-08',
            read: false
        }
    ];
    
    // Save to localStorage
    saveDataToStorage();
}

// Save Data to Storage
function saveDataToStorage() {
    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('teachers', JSON.stringify(teachers));
    localStorage.setItem('fees', JSON.stringify(fees));
    localStorage.setItem('admissions', JSON.stringify(admissions));
    localStorage.setItem('notifications', JSON.stringify(notifications));
}

// Load Data from Storage
function loadDataFromStorage() {
    students = JSON.parse(localStorage.getItem('students') || '[]');
    teachers = JSON.parse(localStorage.getItem('teachers') || '[]');
    fees = JSON.parse(localStorage.getItem('fees') || '[]');
    admissions = JSON.parse(localStorage.getItem('admissions') || '[]');
    notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
}

// Utility Functions
function getStudentsForCurrentUser() {
    if (currentRole === 'admin') {
        return students;
    } else if (currentRole === 'teacher') {
        // Return students assigned to this teacher's classes
        const teacher = teachers.find(t => t.name === currentUser.name);
        if (teacher) {
            return students.filter(s => teacher.assignedClasses.includes(s.class));
        }
        return [];
    } else if (currentRole === 'parent') {
        // Return children of this parent
        return students.filter(s => s.guardianName === currentUser.name);
    } else {
        // Student - return only their own data
        return students.filter(s => s.name === currentUser.name);
    }
}

function getFeesForCurrentUser() {
    const studentsForUser = getStudentsForCurrentUser();
    const studentIds = studentsForUser.map(s => s.id);
    return fees.filter(f => studentIds.includes(f.studentId));
}

function getTotalFeesCollected() {
    return fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0);
}

function getPendingFeesAmount() {
    return fees.filter(f => f.status === 'pending').reduce((sum, f) => sum + f.amount, 0);
}

function getThisMonthFees() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return fees.filter(f => {
        const paidDate = new Date(f.paidDate);
        return f.status === 'paid' && 
               paidDate.getMonth() === currentMonth && 
               paidDate.getFullYear() === currentYear;
    }).reduce((sum, f) => sum + f.amount, 0);
}

function getOverdueFees() {
    const today = new Date();
    return fees.filter(f => {
        const dueDate = new Date(f.dueDate);
        return f.status === 'pending' && dueDate < today;
    }).reduce((sum, f) => sum + f.amount, 0);
}

function getPendingFeesCount() {
    return fees.filter(f => f.status === 'pending').length;
}

function getMyStudentsCount() {
    return getStudentsForCurrentUser().length;
}

function getMyPendingFeesCount() {
    return getFeesForCurrentUser().filter(f => f.status === 'pending').length;
}

function getMyFeesStatus() {
    const myFees = getFeesForCurrentUser();
    const pending = myFees.filter(f => f.status === 'pending').length;
    return pending === 0 ? 'All Paid' : `${pending} Pending`;
}

function getMyChildrenCount() {
    return getStudentsForCurrentUser().length;
}

function getMyChildrenFeesStatus() {
    const childrenFees = getFeesForCurrentUser();
    const pending = childrenFees.filter(f => f.status === 'pending').length;
    return pending === 0 ? 'All Paid' : `${pending} Pending`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Modal Functions
function showAddStudentModal() {
    const modal = createModal(`
        <div class="modal-header">
            <h2>Add New Student</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="addStudentForm">
            <div class="form-row">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="studentName" required>
                </div>
                <div class="form-group">
                    <label>Roll Number</label>
                    <input type="text" id="studentRollNumber" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Class</label>
                    <select id="studentClass" required>
                        <option value="">Select Class</option>
                        <option value="1st">1st Grade</option>
                        <option value="2nd">2nd Grade</option>
                        <option value="3rd">3rd Grade</option>
                        <option value="4th">4th Grade</option>
                        <option value="5th">5th Grade</option>
                        <option value="6th">6th Grade</option>
                        <option value="7th">7th Grade</option>
                        <option value="8th">8th Grade</option>
                        <option value="9th">9th Grade</option>
                        <option value="10th">10th Grade</option>
                        <option value="11th">11th Grade</option>
                        <option value="12th">12th Grade</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Admission Date</label>
                    <input type="date" id="studentAdmissionDate" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Guardian Name</label>
                    <input type="text" id="studentGuardianName" required>
                </div>
                <div class="form-group">
                    <label>Guardian Phone</label>
                    <input type="tel" id="studentGuardianPhone" required>
                </div>
            </div>
            <div class="form-group">
                <label>Address</label>
                <textarea id="studentAddress" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="studentStatus">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-outline" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn-primary">Add Student</button>
            </div>
        </form>
    `);
    
    document.getElementById('addStudentForm').addEventListener('submit', handleAddStudent);
}

function handleAddStudent(e) {
    e.preventDefault();
    
    const newStudent = {
        id: Date.now(),
        name: document.getElementById('studentName').value,
        rollNumber: document.getElementById('studentRollNumber').value,
        class: document.getElementById('studentClass').value,
        admissionDate: document.getElementById('studentAdmissionDate').value,
        guardianName: document.getElementById('studentGuardianName').value,
        guardianPhone: document.getElementById('studentGuardianPhone').value,
        address: document.getElementById('studentAddress').value,
        status: document.getElementById('studentStatus').value,
        avatar: `https://via.placeholder.com/40/3EC4B1/FFFFFF?text=${document.getElementById('studentName').value.charAt(0)}`
    };
    
    students.push(newStudent);
    saveDataToStorage();
    loadStudentsData();
    closeModal();
    showNotification('Student added successfully!', 'success');
}

// Create Modal
function createModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            ${content}
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    return modal;
}

// Close Modal
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.getElementById('notificationContainer').appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Toggle Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Logout
function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    currentRole = null;
    showLoginScreen();
    showNotification('Logged out successfully!', 'info');
}

// Demo Login
function showDemoLogin() {
    document.getElementById('userRole').value = 'admin';
    document.getElementById('loginEmail').value = 'admin@learnovo.com';
    document.getElementById('loginPassword').value = 'admin123';
}

// Global Search
function handleGlobalSearch(e) {
    const query = e.target.value.toLowerCase();
    // Implement global search functionality
    console.log('Searching for:', query);
}

// Update Recent Activities
function updateRecentActivities() {
    const activitiesContainer = document.getElementById('recentActivities');
    if (!activitiesContainer) return;
    
    const activities = [
        { icon: 'fas fa-user-plus', text: 'New student John Doe enrolled', time: '2 hours ago' },
        { icon: 'fas fa-credit-card', text: 'Fee payment received from Jane Smith', time: '4 hours ago' },
        { icon: 'fas fa-bell', text: 'New notification: Parent-Teacher Meeting', time: '6 hours ago' },
        { icon: 'fas fa-edit', text: 'Student profile updated', time: '1 day ago' }
    ];
    
    activitiesContainer.innerHTML = '';
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${activity.text}</div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `;
        activitiesContainer.appendChild(activityItem);
    });
}

// Update Dashboard Charts
function updateDashboardCharts() {
    // Enrollment Chart
    const enrollmentCtx = document.getElementById('enrollmentChart');
    if (enrollmentCtx) {
        new Chart(enrollmentCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Students Enrolled',
                    data: [12, 19, 3, 5, 2, 3],
                    borderColor: '#3EC4B1',
                    backgroundColor: 'rgba(62, 196, 177, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    // Fees Chart
    const feesCtx = document.getElementById('feesChart');
    if (feesCtx) {
        new Chart(feesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Paid', 'Pending', 'Overdue'],
                datasets: [{
                    data: [getTotalFeesCollected(), getPendingFeesAmount(), getOverdueFees()],
                    backgroundColor: ['#28a745', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// Placeholder functions for other features
function showAddTeacherModal() { showNotification('Teacher management coming soon!', 'info'); }
function showAddFeeModal() { showNotification('Fee management coming soon!', 'info'); }
function showAdmissionForm() { showNotification('Admission management coming soon!', 'info'); }
function showAddNotificationModal() { showNotification('Notification system coming soon!', 'info'); }
function loadTeachersData() { showNotification('Teacher data loading...', 'info'); }
function loadAdmissionsData() { showNotification('Admission data loading...', 'info'); }
function loadReportsData() { showNotification('Reports loading...', 'info'); }
function loadNotificationsData() { showNotification('Notifications loading...', 'info'); }
function loadSettingsData() { showNotification('Settings loading...', 'info'); }
function generateReport() { showNotification('Report generation coming soon!', 'info'); }
function exportStudents() { showNotification('Export functionality coming soon!', 'info'); }
function viewStudent(id) { showNotification(`Viewing student ${id}`, 'info'); }
function editStudent(id) { showNotification(`Editing student ${id}`, 'info'); }
function deleteStudent(id) { showNotification(`Deleting student ${id}`, 'info'); }
function viewFee(id) { showNotification(`Viewing fee ${id}`, 'info'); }
function editFee(id) { showNotification(`Editing fee ${id}`, 'info'); }
function markAsPaid(id) { showNotification(`Marking fee ${id} as paid`, 'info'); }
function showNotifications() { showNotification('Notification panel coming soon!', 'info'); }
function showForgotPassword() { showNotification('Password reset coming soon!', 'info'); }
