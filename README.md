# Learnovo - Complete Student Management System

A comprehensive, full-stack student management system built with modern technologies, featuring role-based access control, currency management, fee tracking, and much more.

## 🚀 Features

### 🔐 **Authentication & Roles**
- **4 Role-based Login System**: Admin, Teacher, Student, Parent
- **JWT Authentication**: Secure token-based authentication
- **Role-specific Dashboards**: Customized interfaces for each user type
- **Password Management**: Change password, forgot password functionality

### 👥 **Student Management**
- **Complete CRUD Operations**: Add, edit, delete, view students
- **Comprehensive Student Profiles**: Name, roll number, class, admission date, guardian info
- **Photo Support**: Avatar system for student profiles
- **Status Tracking**: Active/Inactive student status
- **Search & Filter**: Find students by class, name, or other criteria

### 👨‍🏫 **Teacher Management**
- **Teacher Profiles**: Name, subject, qualifications, assigned classes
- **Class Assignments**: Teachers can view students in their assigned classes
- **Subject Specialization**: Track teacher expertise areas
- **Status Management**: Active/Inactive teacher status

### 💰 **Fee Management System**
- **Comprehensive Fee Tracking**: Individual student fee records
- **Payment Status**: Paid, Pending, Overdue status tracking
- **Fee Summary Dashboard**: Total collected, pending dues, monthly totals
- **Payment History**: Track when fees were paid
- **Overdue Alerts**: Highlight overdue payments
- **Currency Support**: Multi-currency support with proper formatting

### 📊 **Role-Specific Dashboards**

#### **Admin Dashboard:**
- Total students, teachers, fees collected, pending fees
- Enrollment trends chart
- Fee collection status chart
- Recent activities feed

#### **Teacher Dashboard:**
- My students count
- Pending fees alerts for their classes
- Assignment tracking
- Attendance rate monitoring

#### **Student Dashboard:**
- Personal profile status
- Individual fee status
- Assignment tracking
- Notification center

#### **Parent Dashboard:**
- Children overview
- Fee status for all children
- Performance tracking
- Communication center

### 📝 **Admission Management**
- **Application System**: Complete admission application process
- **Document Upload**: Support for photos, certificates, and other documents
- **Status Tracking**: Pending, under review, approved, rejected, waitlisted
- **Review Process**: Admin can review and approve/reject applications
- **Timeline Tracking**: Complete application timeline

### 🔔 **Communication System**
- **Notification Center**: Real-time notifications for all users
- **Email Integration**: Automated email reminders and notifications
- **SMS Support**: Optional SMS notifications
- **Fee Reminders**: Automatic pending fee alerts
- **Activity Feed**: Recent system activities

### 📈 **Reports & Analytics**
- **Interactive Charts**: Enrollment trends, fee collection, class distribution
- **Export Functionality**: PDF and Excel export capabilities
- **Real-time Data**: Live updates from database
- **Visual Analytics**: Chart.js integration for beautiful visualizations

### ⚙️ **System Settings**
- **Currency Management**: Set default currency, symbol position, formatting
- **Institution Settings**: School information, contact details
- **Academic Settings**: Classes, subjects, terms configuration
- **Notification Settings**: Email/SMS configuration
- **Theme Customization**: Colors, logos, branding

### 📱 **Responsive Design**
- **Mobile-First**: Optimized for all screen sizes
- **Touch-Friendly**: Mobile navigation and interactions
- **Adaptive Layout**: Sidebar collapses on mobile
- **Modern UI**: Clean, professional design with smooth animations

## 🛠️ **Tech Stack**

### **Backend**
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Nodemailer** for email notifications
- **Multer** for file uploads
- **Express Validator** for input validation
- **Helmet** for security
- **CORS** for cross-origin requests

### **Frontend**
- **React 18** with Vite
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Chart.js** for data visualization
- **React Hook Form** for form handling
- **React Hot Toast** for notifications
- **Axios** for API calls

### **Database**
- **MongoDB** with comprehensive schemas
- **Indexed queries** for optimal performance
- **Data validation** at schema level

## 📦 **Installation & Setup**

### **Prerequisites**
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### **Backend Setup**

1. **Navigate to backend directory:**
   ```bash
   cd learnovo-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp config.env.example config.env
   ```
   Edit `config.env` with your settings:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/learnovo
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRE=7d
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   DEFAULT_CURRENCY=INR
   ```

4. **Start MongoDB:**
   ```bash
   mongod
   ```

5. **Seed the database:**
   ```bash
   npm run seed
   ```

6. **Start the backend server:**
   ```bash
   npm run dev
   ```

### **Frontend Setup**

1. **Navigate to frontend directory:**
   ```bash
   cd learnovo-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## 🔑 **Demo Credentials**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@learnovo.com | admin123 |
| Teacher | sarah.wilson@learnovo.com | teacher123 |
| Student | john.doe@learnovo.com | student123 |
| Parent | parent@learnovo.com | parent123 |

## 📋 **API Endpoints**

### **Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/password` - Change password
- `POST /api/auth/logout` - User logout

### **Students**
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get single student
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/students/:id/fees` - Get student fees
- `GET /api/students/:id/statistics` - Get student statistics

### **Fees**
- `GET /api/fees` - Get all fees
- `GET /api/fees/:id` - Get single fee
- `POST /api/fees` - Create fee
- `PUT /api/fees/:id` - Update fee
- `PUT /api/fees/:id/pay` - Mark fee as paid
- `POST /api/fees/:id/remind` - Send fee reminder
- `DELETE /api/fees/:id` - Delete fee
- `GET /api/fees/statistics` - Get fee statistics
- `GET /api/fees/overdue` - Get overdue fees

### **Settings**
- `GET /api/settings` - Get system settings
- `PUT /api/settings` - Update settings
- `PUT /api/settings/currency` - Update currency settings
- `GET /api/settings/currencies` - Get supported currencies

## 🎨 **UI/UX Features**

- **Modern Design**: Clean, minimal interface with professional look
- **Color Scheme**: Teal and blue palette reflecting trust and innovation
- **Smooth Animations**: Hover effects, transitions, and loading states
- **Intuitive Navigation**: Easy-to-use sidebar menu with role-based items
- **Visual Feedback**: Loading states, success/error notifications
- **Accessibility**: Keyboard navigation and screen reader support
- **Responsive**: Works perfectly on desktop, tablet, and mobile

## 🔒 **Security Features**

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Input Validation**: Server-side validation for all inputs
- **Rate Limiting**: Protection against brute force attacks
- **CORS Configuration**: Secure cross-origin requests
- **Helmet Security**: Security headers and protection
- **Role-based Access**: Different access levels for different users

## 📊 **Database Schema**

### **Users Collection**
- Personal information (name, email, phone)
- Authentication (password, role)
- Role-specific fields (subjects, classes, student info)
- Timestamps and status tracking

### **Fees Collection**
- Student reference and amount
- Currency and payment details
- Due dates and status tracking
- Reminder history and late fees

### **Admissions Collection**
- Personal and contact information
- Guardian details and academic info
- Document references and status
- Timeline and review information

### **Settings Collection**
- Institution information
- Currency and academic settings
- Notification and system configuration
- Theme and backup settings

## 🚀 **Deployment**

### **Quick Start (Recommended)**

Ready to go live? Follow our step-by-step guide:

**👉 Start here: [`DEPLOY_NOW.md`](./DEPLOY_NOW.md)** - Fastest deployment path

**Other guides:**
- **Quick Deploy**: [`QUICK_START_DEPLOY.md`](./QUICK_START_DEPLOY.md) - 5-minute quick start
- **Detailed Guide**: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) - Comprehensive instructions
- **Quick Reference**: [`DEPLOY.md`](./DEPLOY.md) - Deploy reference guide

### **Recommended Deployment**

**Backend**: Deploy to **Render** (Free tier available)
**Frontend**: Deploy to **Vercel** (Free tier available)  
**Database**: **MongoDB Atlas** (Free M0 tier available)

### **Prerequisites**
- MongoDB Atlas account
- GitHub account
- Render account (free)
- Vercel account (free)

**Total Cost: FREE** on free tiers! 🎉

### **Quick Deploy Steps**

1. Set up MongoDB Atlas → Get connection string
2. Push code to GitHub
3. Deploy backend to Render → Add environment variables
4. Deploy frontend to Vercel → Add API URL
5. Update backend with frontend URL
6. Test and go live!

**Full instructions**: See [`DEPLOY_NOW.md`](./DEPLOY_NOW.md)

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 **Support**

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 **Future Enhancements**

- **Mobile App**: React Native mobile application
- **Advanced Analytics**: More detailed reporting and insights
- **Integration**: Third-party integrations (payment gateways, SMS services)
- **Multi-language Support**: Internationalization
- **Advanced Notifications**: Push notifications, real-time updates
- **Backup & Recovery**: Automated backup system
- **API Documentation**: Swagger/OpenAPI documentation

---

**Built with ❤️ by the Learnovo Team**
