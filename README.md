# Learnovo Backend

A comprehensive, multi-tenant school management system backend built with Node.js, Express, and MongoDB.

## Features

- **Multi-tenant Architecture**: Support for multiple schools/organizations with subdomain-based tenant resolution
- **Role-based Access Control**: Admin, Teacher, Student, Parent, Accountant, Principal, and more roles with proper permissions
- **Subscription & Plan Gating**: Feature and usage limits enforced per tenant subscription plan
- **Super Admin Panel**: Platform-level management of all tenants, plans, and billing
- **Comprehensive Registration**: School registration with transaction support
- **CSV/Excel Import**: Bulk import of students and employees with preview
- **Fee Management**: Fee structures, annual allocations, invoices, online payments (Razorpay, ICICI EazyPay), receipts, and dispute resolution
- **Attendance Tracking**: Student and employee attendance with analytics, holidays, and export
- **Academic Management**: Academic sessions, exams, results, report cards, homework, assignments, and timetable scheduling
- **Certificate Generation**: Transfer and bonafide certificates with customizable templates (PDF via Puppeteer)
- **Transport Management**: Vehicles, drivers, routes, stops, and student transport assignments
- **Payroll & HR**: Employee payroll generation, advance salary, and leave management
- **Finance Module**: Expenses, income tracking, budgets, and combined finance dashboard
- **Announcements & Notifications**: Multi-channel notifications (in-app, email, WhatsApp) with preferences
- **Admissions**: Online admission applications with approval workflow
- **Backup & Restore**: Manual and scheduled backups to Google Drive
- **File Storage**: Cloudinary and AWS S3 integration for file uploads
- **Email Notifications**: Automated onboarding, fee reminders, and transactional emails
- **Structured Logging**: JSON-formatted request tracking with request IDs
- **Database Migrations**: Version-controlled schema updates
- **Health Monitoring**: System health checks with service status
- **Security**: Rate limiting, input validation, helmet, CORS, encryption of sensitive fields

## Quick Start

### Prerequisites

- Node.js 16+
- MongoDB 4.4+
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd learnovo-backend
   npm ci
   ```

2. **Environment setup:**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your settings
   ```

3. **Database setup:**
   ```bash
   npm run migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`

## Configuration

### Environment Variables

Create a `config.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/learnovo
MONGODB_TEST_URI=mongodb://localhost:27017/learnovo_test

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
JWT_COOKIE_EXPIRE=7

# Email Configuration (supports both EMAIL_* and SMTP_*)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@learnovo.com

# Legacy SMTP variables (also supported)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@learnovo.com

# Frontend URL (for email links and CORS)
# Multiple origins can be comma-separated
FRONTEND_URL=http://localhost:3000,http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# External Services (Optional)
SENTRY_DSN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Development
ENABLE_DEBUG=false
ENABLE_SWAGGER=true
```

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node --expose-gc --max-old-space-size=512 server.js` | Production server with GC and memory limit |
| `dev` | `nodemon server.js` | Development server with auto-reload |
| `seed` | `node scripts/seedData.js` | Seed initial data |
| `seed:demo` | `node scripts/seedDemoData.js` | Seed demo/sample data |
| `seed:attendance` | `node scripts/seedAttendanceData.js` | Seed attendance records |
| `migrate` | `node scripts/migrate.js` | Run pending migrations |
| `migrate:status` | `node scripts/migrate.js --status` | Check migration status |
| `migrate:rollback` | `node scripts/migrate.js --rollback` | Rollback last migration |
| `clear:db` | `node scripts/clearDatabase.js` | Clear database (development only) |
| `test` | `jest` | Run all tests |
| `test:unit` | `jest --testPathPattern=unit` | Unit tests only |
| `test:integration` | `jest --testPathPattern=integration` | Integration tests only |
| `test:ci` | Unit + integration tests | CI test suite |
| `lint` | `eslint .` | Lint codebase |
| `lint:fix` | `eslint . --fix` | Auto-fix lint issues |

## API Documentation

### Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

### Response Shape

```json
// Success
{ "success": true, "message": "...", "data": {}, "requestId": "uuid" }

// Error
{ "success": false, "message": "...", "errors": [{ "field": "", "message": "" }], "requestId": "uuid" }
```

| Status | When |
|--------|------|
| 200 | Success |
| 201 | Created |
| 400 | Validation failure |
| 401 | Bad/missing token |
| 403 | Insufficient role / plan limit |
| 409 | Duplicate/conflict |
| 500 | Unexpected server error |

---

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login user |
| POST | `/api/auth/register` | Admin | Register user within tenant |
| GET | `/api/auth/me` | Any | Get current user profile |
| PUT | `/api/auth/profile` | Any | Update user profile |
| PUT | `/api/auth/password` | Any | Change password |
| POST | `/api/auth/upload-photo` | Any | Upload profile photo |
| POST | `/api/auth/logout` | Any | Logout user |
| POST | `/api/auth/forgot-password` | None | Request password reset |
| PUT | `/api/auth/reset-password` | None | Reset password with token |

### Registration (`/api/tenants`, `/api/schools`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/tenants/register` | None | Register new school/tenant |
| POST | `/api/schools/register` | None | Register new school (alternate) |

### Students (`/api/students`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/students` | Admin, Teacher | List students with pagination and filters |
| GET | `/api/students/filters` | Admin, Teacher | Get filter options |
| GET | `/api/students/export` | Admin, Teacher | Export students to CSV/Excel |
| GET | `/api/students/import/template` | Admin | Download CSV import template |
| GET | `/api/students/import/template/excel` | Admin | Download Excel import template |
| POST | `/api/students/import/preview` | Admin | Preview CSV import |
| POST | `/api/students/import/execute` | Admin | Execute CSV import |
| GET | `/api/students/:id` | Access-controlled | Get single student |
| POST | `/api/students` | Admin | Create new student |
| PUT | `/api/students/:id` | Access-controlled | Update student |
| DELETE | `/api/students/:id` | Admin | Delete student |
| DELETE | `/api/students/bulk-delete` | Admin | Bulk delete students |
| PUT | `/api/students/:id/deactivate` | Admin | Deactivate student |
| PUT | `/api/students/:id/reactivate` | Admin | Reactivate student |
| PUT | `/api/students/:id/toggle-status` | Admin | Toggle student status |
| PUT | `/api/students/:id/reset-password` | Admin | Reset student password |
| POST | `/api/students/:id/create-login` | Admin | Create login credentials |
| POST | `/api/students/bulk-activate` | Admin | Bulk activate students |
| POST | `/api/students/bulk-deactivate` | Admin | Bulk deactivate students |
| POST | `/api/students/promote` | Admin | Bulk promote students |
| POST | `/api/students/:id/promote` | Admin, Principal | Promote individual student |
| POST | `/api/students/:id/demote` | Admin, Principal | Demote individual student |
| POST | `/api/students/bulk-class-action` | Admin, Principal | Bulk class action (promote/demote) |
| GET | `/api/students/promotions/report` | Admin, Principal | Promotion report |
| GET | `/api/students/:id/class-history` | Admin, Teacher | Get class history |
| GET | `/api/students/:id/fees` | Access-controlled | Get student fees |
| GET | `/api/students/:id/pending-fees` | Admin | Get pending fees |
| GET | `/api/students/:id/statistics` | Access-controlled | Get student statistics |
| GET | `/api/students/:id/subject-preferences` | Admin, Principal | Get subject preferences |
| PUT | `/api/students/:id/subject-preferences` | Admin, Principal | Update subject preferences |

### Employees (`/api/employees`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/employees` | Admin, Teacher | List all employees |
| GET | `/api/employees/filters` | Admin | Get filter options |
| GET | `/api/employees/export` | Admin | Export employees |
| GET | `/api/employees/import/template` | Admin | Download CSV template |
| POST | `/api/employees/import/preview` | Admin | Preview CSV import |
| POST | `/api/employees/import/execute` | Admin | Execute CSV import |
| GET | `/api/employees/:id` | Admin, Self | Get single employee |
| POST | `/api/employees` | Admin | Create employee |
| PUT | `/api/employees/:id` | Admin | Update employee |
| DELETE | `/api/employees/:id` | Admin | Delete employee (soft) |
| PUT | `/api/employees/:id/toggle-status` | Admin | Toggle employee status |
| PUT | `/api/employees/:id/reset-password` | Admin | Reset password |
| POST | `/api/employees/:id/create-login` | Admin | Create login for employee |
| PUT | `/api/employees/:id/disable-login` | Admin | Disable login |
| GET | `/api/employees/:id/leave-balance` | Admin, Self | Get leave balance |
| PATCH | `/api/employees/:id/leave-balance` | Admin | Update leave balance |
| POST | `/api/employees/:id/upload-photo` | Admin | Upload employee photo |

### Teachers (`/api/teachers`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/teachers` | Admin | List all teachers |
| POST | `/api/teachers` | Admin | Create teacher |
| PUT | `/api/teachers/:id` | Admin | Update teacher |
| DELETE | `/api/teachers/:id` | Admin | Delete teacher |
| GET | `/api/teachers/my-classes` | Teacher | Get teacher's assigned classes |

### Classes (`/api/classes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/classes` | Any | List all classes with student counts |
| GET | `/api/classes/:id` | Any | Get specific class |
| POST | `/api/classes` | Admin | Create class |
| PUT | `/api/classes/:id` | Admin | Update class |
| DELETE | `/api/classes/:id` | Admin | Delete class |
| GET | `/api/classes/:id/sections` | Any | Get sections for class |
| GET | `/api/classes/:id/students` | Any | Get students in class |
| POST | `/api/classes/:id/students` | Admin | Enroll students in class |
| GET | `/api/classes/:id/subjects` | Any | Get subjects for class |
| POST | `/api/classes/:id/subjects` | Admin | Assign subject to class |
| DELETE | `/api/classes/:id/subjects/:subjectId` | Admin | Remove subject from class |

### Subjects (`/api/subjects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/subjects` | Any | List all subjects |
| GET | `/api/subjects/:id` | Any | Get subject |
| POST | `/api/subjects` | Admin | Create subject |
| PUT | `/api/subjects/:id` | Admin | Update subject |
| DELETE | `/api/subjects/:id` | Admin | Delete subject |

### Class-Subject Assignments (`/api/class-subjects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/class-subjects` | Any | Get class-subject assignments |
| POST | `/api/class-subjects` | Admin | Assign subject to class |
| POST | `/api/class-subjects/bulk` | Admin | Bulk assign subjects |
| PUT | `/api/class-subjects/:id` | Admin | Update assignment |
| DELETE | `/api/class-subjects/:id` | Admin | Delete assignment |

### Teacher-Subject Assignments (`/api/teacher-assignments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/teacher-assignments` | Any | Get teacher-subject assignments |
| GET | `/api/teacher-assignments/teacher/:id` | Any | Get specific teacher's assignments |

### Academic Sessions (`/api/academic-sessions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/academic-sessions` | Admin, Teacher | List academic sessions |
| GET | `/api/academic-sessions/active` | Any | Get active session |
| GET | `/api/academic-sessions/:id` | Admin, Teacher | Get single session |
| POST | `/api/academic-sessions` | Admin | Create session |
| PUT | `/api/academic-sessions/:id` | Admin | Update session |
| PUT | `/api/academic-sessions/:id/activate` | Admin | Activate session |
| PUT | `/api/academic-sessions/:id/lock` | Admin | Lock/unlock session |
| DELETE | `/api/academic-sessions/:id` | Admin | Delete session |

### Attendance (`/api/attendance`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/attendance` | Any | Get attendance for class/date/subject |
| POST | `/api/attendance` | Admin, Teacher | Mark/update student attendance (bulk) |
| GET | `/api/attendance/dashboard` | Admin, Teacher | Combined dashboard stats |
| GET | `/api/attendance/report` | Any | Attendance report with statistics |
| GET | `/api/attendance/analytics` | Admin, Teacher | Attendance analytics |
| GET | `/api/attendance/students/daily-summary` | Any | School-wide daily summary |
| GET | `/api/attendance/students/unmarked-classes` | Admin, Teacher | Unmarked classes |
| GET | `/api/attendance/students/absentees` | Any | Absent students for date |
| GET | `/api/attendance/students/monthly-report` | Any | Monthly class/section report |
| GET | `/api/attendance/students/export` | Admin, Teacher | Export attendance CSV |
| GET | `/api/attendance/students/:studentId` | Any | Student attendance history |
| GET | `/api/attendance/students/:studentId/summary` | Any | Student attendance summary |
| GET | `/api/attendance/students-list/:classId` | Any | Students for class |
| GET | `/api/attendance/employees` | Admin | Employee attendance for date |
| POST | `/api/attendance/employees/mark` | Admin | Mark employee attendance |
| GET | `/api/attendance/employees/daily-summary` | Admin | Employee daily summary |
| GET | `/api/attendance/employees/:employeeId` | Any | Employee attendance history |
| GET | `/api/attendance/employees/:employeeId/summary` | Any | Employee attendance summary |
| GET | `/api/attendance/settings` | Any | Get attendance settings |
| PUT | `/api/attendance/settings` | Admin | Update attendance settings |
| GET | `/api/attendance/holidays` | Any | List holidays |
| POST | `/api/attendance/holidays` | Admin | Add holiday |
| PUT | `/api/attendance/holidays/:id` | Admin | Update holiday |
| DELETE | `/api/attendance/holidays/:id` | Admin | Delete holiday |

### Exams & Results (`/api/exams`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/exams` | Any | List exams (role-filtered) |
| GET | `/api/exams/:id` | Any | Get exam details |
| POST | `/api/exams` | Admin, Teacher | Create exam |
| PATCH | `/api/exams/:id` | Admin, Teacher | Update exam |
| DELETE | `/api/exams/:id` | Admin, Teacher | Delete exam |
| POST | `/api/exams/:id/results` | Admin, Teacher | Add/update results |
| GET | `/api/exams/:id/results` | Any | Get exam results |
| PUT | `/api/exams/:id/results/publish` | Admin, Teacher | Publish/unpublish results |
| GET | `/api/exams/result-card/:studentId` | Any | Get aggregated result card |
| GET | `/api/exams/result-card/:studentId/pdf` | Any | Download report card PDF |
| GET | `/api/exams/my-results` | Student | Get own results |

### Report Cards (`/api/report-cards`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/report-cards/:studentId/blank/pdf` | Admin, Teacher | Download blank report card |
| POST | `/api/report-cards/bulk-download` | Admin, Teacher | Start bulk PDF download job |

### Homework (`/api/homework`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/homework` | Any | List homework (role-filtered) |
| GET | `/api/homework/stats` | Any | Homework statistics |
| GET | `/api/homework/my-submissions` | Student | Get own submissions |
| GET | `/api/homework/:id` | Any | Get homework details |
| POST | `/api/homework` | Teacher, Admin | Create homework |
| PUT | `/api/homework/:id` | Teacher, Admin | Update homework |
| DELETE | `/api/homework/:id` | Teacher, Admin | Delete homework |
| POST | `/api/homework/:id/submit` | Student | Submit homework |
| GET | `/api/homework/:id/submissions` | Teacher, Admin | Get submissions |
| PUT | `/api/homework/submissions/:id` | Teacher, Admin | Update submission feedback |
| DELETE | `/api/homework/:id/submission` | Student | Delete own submission |

### Assignments (`/api/assignments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/assignments` | Any | List assignments (role-filtered) |
| GET | `/api/assignments/stats/overview` | Any | Assignment statistics |
| GET | `/api/assignments/upcoming/list` | Any | Upcoming assignments |
| GET | `/api/assignments/:id` | Any | Get assignment |
| POST | `/api/assignments` | Admin, Teacher | Create assignment |
| PUT | `/api/assignments/:id` | Admin, Teacher | Update assignment |
| DELETE | `/api/assignments/:id` | Admin, Teacher | Delete assignment |

### Fee Structures (`/api/fee-structures`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/fee-structures` | Admin, Accountant | List fee structures |
| GET | `/api/fee-structures/:id` | Admin, Accountant | Get fee structure |
| POST | `/api/fee-structures` | Admin | Create fee structure |
| PUT | `/api/fee-structures/:id` | Admin | Update fee structure |
| DELETE | `/api/fee-structures/:id` | Admin | Delete fee structure |

### Fee Allocations (`/api/fees/allocations`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/fees/allocations` | Admin, Accountant | List allocations with filters |
| GET | `/api/fees/allocations/:id` | Admin, Accountant | Get allocation details |
| GET | `/api/fees/allocations/dashboard/summary` | Admin, Accountant | Dashboard summary stats |
| POST | `/api/fees/allocations/generate` | Admin | Generate annual allocations for class(es) |
| POST | `/api/fees/allocations/generate-invoices` | Admin | Generate invoices from allocations |
| POST | `/api/fees/allocations/generate-all` | Admin | Generate allocations + invoices in one step |
| POST | `/api/fees/allocations/generate-single` | Admin | Generate for single student |
| POST | `/api/fees/allocations/mid-year` | Admin | Mid-year admission allocation |
| POST | `/api/fees/allocations/preview` | Admin | Preview invoice generation (dry run) |
| POST | `/api/fees/allocations/apply-late-fees` | Admin | Apply late fees to overdue invoices |
| PUT | `/api/fees/allocations/:id/payment-plan` | Admin | Change payment plan |
| PUT | `/api/fees/allocations/:id/cancel` | Admin | Cancel/terminate allocation |
| PUT | `/api/fees/allocations/:id/discount` | Admin | Apply discount/scholarship |
| PUT | `/api/fees/allocations/:id/waive` | Admin | Waive specific fee heads |

### Invoices (`/api/invoices`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/invoices/generate` | Admin, Accountant | Generate invoice for student |

### Fees & Reports (`/api/fees`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/fees` | Any | List fees with filters |
| GET | `/api/fees/statistics` | Any | Fee statistics |
| GET | `/api/fees/overdue` | Any | Overdue fees |
| GET | `/api/fees/dashboard` | Admin, Accountant | Fees dashboard summary |

### Student Fee Portal (`/api/student-fees`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/student-fees` | Student | Get own fee invoices |
| GET | `/api/student-fees/summary` | Student | Annual fee summary |
| GET | `/api/student-fees/history` | Student | Payment attempt history |
| GET | `/api/student-fees/receipts` | Student | Get all receipts |
| GET | `/api/student-fees/receipt/:id` | Student | Get single receipt |
| GET | `/api/student-fees/gateway-status` | Student | Check payment gateway status |
| GET | `/api/student-fees/:id` | Student | Get invoice detail |
| GET | `/api/student-fees/payment/:id/status` | Student | Payment attempt status |
| POST | `/api/student-fees/:id/pay` | Student | Initiate payment for invoice |
| POST | `/api/student-fees/pay-combined` | Student | Pay multiple invoices at once |
| POST | `/api/student-fees/:id/submit-payment` | Student | Submit manual payment proof |
| POST | `/api/student-fees/submit-payment-combined` | Student | Submit manual proof for multiple |
| POST | `/api/student-fees/dispute` | Student | Raise payment dispute |
| GET | `/api/student-fees/dispute/:id` | Student | Get dispute status |
| POST | `/api/student-fees/admin/verify-payment/:attemptId` | Admin, Accountant | Verify manual payment |
| POST | `/api/student-fees/payment/notify` | None | Payment gateway webhook |
| POST | `/api/student-fees/payment/razorpay-verify` | Student | Razorpay callback |
| POST | `/api/student-fees/payment/icici-return` | None | ICICI EazyPay return URL |

### Admin Payment Disputes (`/api/admin-disputes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin-disputes` | Admin | Get all disputes and stuck payments |
| POST | `/api/admin-disputes/:id/resolve` | Admin | Resolve dispute manually |

### Online Payments (`/api/fee-payments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/fee-payments/create-order` | Any | Create Razorpay payment order |
| POST | `/api/fee-payments/verify` | Any | Verify payment |
| GET | `/api/fee-payments/status/:orderId` | Any | Get payment status |
| POST | `/api/fee-payments/webhook` | None | Razorpay webhook handler |

### Finance Dashboard (`/api/finance`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/finance/dashboard` | Admin | Combined finance dashboard |

### Expenses (`/api/expenses`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/expenses` | Admin | List expenses with filters |
| GET | `/api/expenses/:id` | Admin | Get single expense |
| POST | `/api/expenses` | Admin | Create expense |
| PUT | `/api/expenses/:id` | Admin | Update expense |
| DELETE | `/api/expenses/:id` | Admin | Delete expense (soft) |
| POST | `/api/expenses/:id/approve` | Admin | Approve expense |
| POST | `/api/expenses/:id/reject` | Admin | Reject expense |
| GET | `/api/expenses/summary/monthly` | Admin | Monthly summary |
| GET | `/api/expenses/summary/category` | Admin | Category summary |
| GET | `/api/expenses/summary/dashboard` | Admin | Dashboard summary |
| GET | `/api/expenses/export` | Admin | Export to CSV |

### Income (`/api/income`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/income` | Admin | List income records |
| GET | `/api/income/:id` | Admin | Get single record |
| POST | `/api/income` | Admin | Create income |
| PUT | `/api/income/:id` | Admin | Update income |
| DELETE | `/api/income/:id` | Admin | Delete income |
| GET | `/api/income/summary/monthly` | Admin | Monthly summary |
| GET | `/api/income/summary/category` | Admin | Category summary |
| GET | `/api/income/summary/dashboard` | Admin | Dashboard summary |
| GET | `/api/income/export` | Admin | Export to CSV |

### Payroll (`/api/payroll`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payroll` | Admin | List payroll records |
| GET | `/api/payroll/:id` | Admin | Get payroll record |
| POST | `/api/payroll/generate` | Admin | Generate monthly payroll |
| PUT | `/api/payroll/:id` | Admin | Update payroll |
| DELETE | `/api/payroll/:id` | Admin | Delete payroll (soft) |
| GET | `/api/payroll/employee/:employeeId` | Admin | Employee payroll history |
| GET | `/api/payroll/summary/:year/:month` | Admin | Monthly salary summary |

### Advance Salary (`/api/advance-salary`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/advance-salary` | Admin | List advance salary requests |
| GET | `/api/advance-salary/:id` | Admin | Get single request |
| POST | `/api/advance-salary` | Admin | Create request |
| PUT | `/api/advance-salary/:id/approve` | Admin | Approve request |
| PUT | `/api/advance-salary/:id/reject` | Admin | Reject request |
| GET | `/api/advance-salary/employee/:employeeId` | Admin | Employee advance history |
| GET | `/api/advance-salary/stats/summary` | Admin | Advance salary statistics |

### Announcements (`/api/announcements`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/announcements` | Any | List announcements |
| GET | `/api/announcements/:id` | Any | Get announcement |
| POST | `/api/announcements` | Admin, Teacher | Create announcement |
| PUT | `/api/announcements/:id` | Admin | Update announcement |
| DELETE | `/api/announcements/:id` | Admin, Teacher | Delete announcement |

### Notifications (`/api/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Any | Get notifications (paginated) |
| GET | `/api/notifications/unread-count` | Any | Get unread count |
| GET | `/api/notifications/preferences` | Any | Get notification preferences |
| PUT | `/api/notifications/preferences` | Any | Update preferences |
| PATCH | `/api/notifications/mark-all-read` | Any | Mark all as read |
| PATCH | `/api/notifications/:id/read` | Any | Mark one as read |
| PATCH | `/api/notifications/:id/unread` | Any | Mark one as unread |
| DELETE | `/api/notifications/:id` | Any | Delete notification |

### Admissions (`/api/admissions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admissions` | Admin | List admissions with pagination |
| POST | `/api/admissions` | None | Submit admission application |
| PUT | `/api/admissions/:id/approve` | Admin | Approve admission |
| PUT | `/api/admissions/:id/reject` | Admin | Reject admission |

### Certificates (`/api/certificates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/certificates/templates` | Admin, Principal | Get certificate templates |
| POST | `/api/certificates/templates` | Admin, Principal | Create/update template |
| POST | `/api/certificates/preview` | Admin, Principal, Teacher | Preview certificate |
| POST | `/api/certificates/generate` | Admin, Principal, Teacher | Generate certificate |
| GET | `/api/certificates/history` | Admin, Principal, Teacher | Generated certificates list |
| GET | `/api/certificates/:id/download` | Admin, Principal, Teacher | Download certificate PDF |
| PUT | `/api/certificates/:id` | Admin, Principal | Update certificate |
| DELETE | `/api/certificates/:id` | Admin, Principal | Delete certificate |

### Timetable Templates (`/api/timetable`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/timetable/templates` | Any | List timetable templates |
| POST | `/api/timetable/templates` | Admin | Create template |
| GET | `/api/timetable/templates/:id` | Any | Get template with stats |
| PUT | `/api/timetable/templates/:id` | Admin | Update template (draft only) |
| DELETE | `/api/timetable/templates/:id` | Admin | Delete template (draft only) |
| POST | `/api/timetable/templates/:id/publish` | Admin | Publish template |
| POST | `/api/timetable/templates/:id/archive` | Admin | Archive template |
| POST | `/api/timetable/templates/:id/duplicate` | Admin | Duplicate template |
| GET | `/api/timetable/templates/:id/timings` | Any | Get timing slots |
| GET | `/api/timetable/templates/:id/entries` | Any | Get timetable entries |
| POST | `/api/timetable/templates/:id/entries` | Admin | Add entry |
| PATCH | `/api/timetable/templates/:id/entries/:entryId` | Admin | Update entry |
| DELETE | `/api/timetable/templates/:id/entries/:entryId` | Admin | Delete entry |

### Timetable Overrides (`/api/timetable`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/timetable/overrides` | Any | List overrides |
| POST | `/api/timetable/overrides` | Admin | Create override (holiday, half-day, etc.) |
| GET | `/api/timetable/overrides/:id` | Any | Get override details |
| PUT | `/api/timetable/overrides/:id` | Admin | Update override |
| DELETE | `/api/timetable/overrides/:id` | Admin | Delete override |

### Timetable Substitutions (`/api/timetable`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/timetable/substitutions` | Any | List substitutions |
| POST | `/api/timetable/substitutions` | Admin | Create substitution |
| PUT | `/api/timetable/substitutions/:id` | Admin | Update substitution |
| DELETE | `/api/timetable/substitutions/:id` | Admin | Delete substitution |

### Timetable Views (`/api/timetable`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/timetable/views/today` | Any | Today's effective schedule |
| GET | `/api/timetable/views/week` | Any | Weekly schedule |
| GET | `/api/timetable/views/class/:classId` | Any | Weekly class timetable |
| GET | `/api/timetable/views/teacher/:teacherId` | Any | Weekly teacher timetable |
| GET | `/api/timetable/views/room/:roomId` | Admin, Teacher | Room occupancy |
| GET | `/api/timetable/views/export/pdf` | Any | Export timetable PDF |

### Timetable Rooms (`/api/timetable`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/timetable/rooms` | Any | List rooms |
| POST | `/api/timetable/rooms` | Admin | Create room |
| PUT | `/api/timetable/rooms/:id` | Admin | Update room |
| DELETE | `/api/timetable/rooms/:id` | Admin | Delete room (soft) |

### Transport — Vehicles (`/api/vehicles`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/vehicles` | Admin | List vehicles |
| GET | `/api/vehicles/:id` | Admin | Get vehicle |
| POST | `/api/vehicles` | Admin | Create vehicle |
| PUT | `/api/vehicles/:id` | Admin | Update vehicle |
| DELETE | `/api/vehicles/:id` | Admin | Delete vehicle |
| GET | `/api/vehicles/export` | Admin | Export to CSV |

### Transport — Drivers (`/api/drivers`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/drivers` | Admin | List drivers |
| GET | `/api/drivers/:id` | Admin | Get driver |
| POST | `/api/drivers` | Admin | Create driver |
| PUT | `/api/drivers/:id` | Admin | Update driver |
| DELETE | `/api/drivers/:id` | Admin | Delete driver (soft) |
| PUT | `/api/drivers/:id/toggle-status` | Admin | Toggle driver status |
| POST | `/api/drivers/:id/upload-photo` | Admin | Upload driver photo |
| GET | `/api/drivers/expiring/licenses` | Admin | Expiring licenses |
| GET | `/api/drivers/export` | Admin | Export to CSV |

### Transport — Routes (`/api/transport/routes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transport/routes` | Admin | List routes |
| GET | `/api/transport/routes/:id` | Admin | Get route |
| POST | `/api/transport/routes` | Admin | Create route |
| PUT | `/api/transport/routes/:id` | Admin | Update route |
| DELETE | `/api/transport/routes/:id` | Admin | Delete route |
| GET | `/api/transport/routes/export` | Admin | Export to CSV |

### Transport — Student Assignments (`/api/student-transport`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/student-transport` | Admin | List transport assignments |
| GET | `/api/student-transport/export` | Admin | Export assignments |

### Student Lists (`/api/student-lists`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/student-lists` | Any | List student lists (role-based) |
| GET | `/api/student-lists/:id` | Any | Get student list |
| POST | `/api/student-lists` | Any | Create student list |
| PATCH | `/api/student-lists/:id/add-students` | Any | Add students to list |
| PATCH | `/api/student-lists/:id/remove-student/:studentId` | Any | Remove student from list |
| DELETE | `/api/student-lists/:id` | Any | Delete student list |
| GET | `/api/student-lists/:id/export/pdf` | Any | Export list as PDF |
| GET | `/api/student-lists/:id/export/excel` | Any | Export list as Excel |
| GET | `/api/student-lists/:id/export/csv` | Any | Export list as CSV |
| GET | `/api/student-lists/:id/export/txt` | Any | Export list as text |

### Reports & Dashboard (`/api/reports`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/reports/dashboard` | Any | Dashboard report |
| GET | `/api/reports/activities` | Any | Activity log |
| POST | `/api/reports/activities/log` | Any | Log activity |
| GET | `/api/reports/enrollment-trend` | Any | Enrollment trend data |

### Settings (`/api/settings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | Any | Get tenant settings |
| PUT | `/api/settings` | Admin | Update settings |
| PUT | `/api/settings/currency` | Admin | Update currency |
| GET | `/api/settings/currencies` | None | List supported currencies |
| POST | `/api/settings/classes` | Admin | Add class to settings |
| POST | `/api/settings/subjects` | Admin | Add subject to settings |
| POST | `/api/settings/fee-structure` | Admin | Add fee structure to settings |
| PUT | `/api/settings/notifications` | Admin | Update notification settings |
| PUT | `/api/settings/system` | Admin | Update system settings |
| PUT | `/api/settings/theme` | Admin | Update theme settings |
| POST | `/api/settings/upload-logo` | Admin | Upload institution logo |
| POST | `/api/settings/upload-signature` | Admin | Upload principal signature |
| GET | `/api/settings/payment-gateway` | Admin | Get payment gateway config |
| PUT | `/api/settings/payment-gateway` | Admin | Update payment gateway config |

### Sub-Departments (`/api/sub-departments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sub-departments` | Any | List sub-departments |
| POST | `/api/sub-departments` | Admin | Create sub-department |
| PUT | `/api/sub-departments/:id` | Admin | Update sub-department |

### Subscription (`/api/subscription`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/subscription/status` | Any | Get subscription status with limits |

### Platform Payments (`/api/payments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payments/plans` | None | Get subscription plans |
| POST | `/api/payments/create-order` | Admin | Create subscription payment order |

### Files (`/api/files`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/files/signed-url` | Any | Get signed URL for file access |
| POST | `/api/files/upload` | Any | Upload file |

### Backup & Restore (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/backup` | Admin | Download backup + upload to Google Drive |
| POST | `/api/admin/backup/cloud` | Admin | Backup to Google Drive |
| GET | `/api/admin/backup/cloud/status` | Admin | Google Drive backup status |
| POST | `/api/admin/backup/cloud/restore` | Admin | Restore from Google Drive |
| POST | `/api/admin/restore` | Admin | Restore from uploaded backup |
| GET | `/api/admin/backup/history` | Admin | Backup history |
| GET | `/api/admin/backup/last` | Admin | Last successful backup |

### Super Admin Auth (`/api/super-admin/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/super-admin/auth/login` | None | Super admin login |

### Super Admin Management (`/api/super-admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/super-admin/tenants` | Super Admin | List all tenants |
| GET | `/api/super-admin/tenants/:id` | Super Admin | Get tenant details with usage stats |
| POST | `/api/super-admin/tenants` | Super Admin | Create tenant with admin user |
| PATCH | `/api/super-admin/tenants/:id/plan` | Super Admin | Change tenant plan/status |
| PATCH | `/api/super-admin/tenants/:id/suspend` | Super Admin | Suspend tenant |
| PATCH | `/api/super-admin/tenants/:id/activate` | Super Admin | Activate tenant |
| DELETE | `/api/super-admin/tenants/:id` | Super Admin | Soft/hard delete tenant |
| POST | `/api/super-admin/tenants/:id/extend-trial` | Super Admin | Extend trial period |
| PATCH | `/api/super-admin/tenants/:id/override-features` | Super Admin | Override features/limits |
| GET | `/api/super-admin/tenants/:tenantId/notes` | Super Admin | Get tenant notes |
| POST | `/api/super-admin/tenants/:tenantId/notes` | Super Admin | Add tenant note |
| DELETE | `/api/super-admin/tenants/:tenantId/notes/:noteId` | Super Admin | Delete tenant note |
| GET | `/api/super-admin/tenants/:tenantId/users` | Super Admin | List tenant users |
| GET | `/api/super-admin/tenants/:tenantId/invoices` | Super Admin | List tenant invoices |

### Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | None | Root status endpoint |
| GET | `/health` | None | Enhanced health check (DB, email, queue) |
| GET | `/healthz` | None | Kubernetes-style liveness probe |

---

## Database Schema

### Collections (72 models)

#### Core
| Collection | Description |
|-----------|-------------|
| `Tenant` | Schools/organizations with subscription, payment gateway config, and branding |
| `User` | All users (admin, teacher, student, parent, accountant, principal, staff, etc.) |
| `SuperAdmin` | Platform super administrators |
| `Settings` | Per-tenant institution settings (grading, bank accounts, theme, backup config) |
| `PlatformSettings` | Global platform settings (branding, payment, storage, maintenance) |

#### Academic
| Collection | Description |
|-----------|-------------|
| `AcademicSession` | Academic years/sessions with active/locked state |
| `Class` | Classes/grades with academic year and class teacher |
| `Section` | Sections within classes with capacity tracking |
| `Subject` | Subjects with type (Theory/Practical), marks, and optional flag |
| `ClassSubject` | Class-subject assignment mapping per session |
| `TeacherSubjectAssignment` | Teacher-subject-class mapping per session |
| `SubjectAllocation` | Timetable subject allocation per template |

#### Student Management
| Collection | Description |
|-----------|-------------|
| `StudentList` | Custom student groups/lists |
| `StudentClassHistory` | Promotion/demotion/transfer history |
| `StudentBalance` | Per-student fee balance per session |
| `Family` | Family grouping for sibling management |
| `Admission` | Admission applications with approval workflow |
| `StudentTransportAssignment` | Student transport route/stop assignments |

#### Attendance
| Collection | Description |
|-----------|-------------|
| `Attendance` | Student attendance records (per class/section/date/subject) |
| `EmployeeAttendance` | Employee daily attendance |
| `AttendanceSettings` | Tenant attendance configuration |
| `Holiday` | Holidays and breaks |

#### Exams & Results
| Collection | Description |
|-----------|-------------|
| `Exam` | Exam definitions (FA/SA series, written/practical/oral) |
| `Result` | Student exam results with grades |

#### Homework & Assignments
| Collection | Description |
|-----------|-------------|
| `Homework` | Teacher-assigned homework |
| `HomeworkSubmission` | Student homework submissions with feedback |
| `Assignment` | Assignments with attachments and marks |

#### Fee Management
| Collection | Description |
|-----------|-------------|
| `FeeStructure` | Fee heads per class/session with late fee config |
| `AnnualFeeAllocation` | Student-level annual fee allocation with discount/waiver |
| `FeeInvoice` | Generated invoices with billing periods |
| `Fee` | Legacy fee records |
| `Payment` | Confirmed payments with encrypted transaction details |
| `PaymentAttempt` | Payment attempts (all gateways) with status tracking |
| `FeePaymentOrder` | Razorpay-specific payment orders |
| `Receipt` | Payment receipts with PDF path |
| `FeeAuditLog` | Fee operation audit trail |
| `PaymentAuditLog` | Payment status change audit trail |
| `PaymentDispute` | Student-raised payment disputes |
| `StudentBalance` | Running balance per student per session |
| `Coupon` | Discount coupons for subscriptions |

#### Finance
| Collection | Description |
|-----------|-------------|
| `Expense` | Expense records with approval workflow |
| `ExpenseCategory` | Expense categories per tenant |
| `ExpenseBudget` | Monthly expense budgets per category |
| `Income` | Income records (fee collections, manual entries) |
| `IncomeCategory` | Income categories per tenant |

#### HR & Payroll
| Collection | Description |
|-----------|-------------|
| `Payroll` | Monthly payroll records with advance deductions |
| `AdvanceSalary` | Advance salary requests with approval workflow |
| `SubDepartment` | Sub-departments within tenant |

#### Transport
| Collection | Description |
|-----------|-------------|
| `Vehicle` | Vehicles with document tracking and expiry alerts |
| `Driver` | Drivers with license and document tracking |
| `Route` | Transport routes with stops, GPS coordinates, and fees |

#### Timetable
| Collection | Description |
|-----------|-------------|
| `TimetableTemplate` | Timetable versions (draft/published/archived) |
| `TimetableEntry` | Individual timetable slots |
| `SchoolTiming` | Period/break timing definitions |
| `TimetableOverride` | Schedule exceptions (holidays, half-days, exams) |
| `Substitution` | Teacher substitution records |
| `TeacherConstraint` | Teacher availability constraints |
| `Room` | Classrooms, labs, and facilities |

#### Certificates
| Collection | Description |
|-----------|-------------|
| `CertificateTemplate` | TC/Bonafide certificate templates |
| `GeneratedCertificate` | Generated certificate records |

#### Communication
| Collection | Description |
|-----------|-------------|
| `Announcement` | Tenant announcements with target audience |
| `Notification` | User notifications (multi-channel) |
| `NotificationPreference` | Per-user notification channel preferences |
| `EmailTemplate` | Email template library |

#### Platform (Super Admin)
| Collection | Description |
|-----------|-------------|
| `SubscriptionPlan` | Available subscription plans with limits |
| `PlatformAnnouncement` | Platform-wide announcements |
| `PlatformInvoice` | Platform billing invoices |
| `SuperAdminAuditLog` | Super admin action audit trail |
| `SupportTicket` | Support ticket system |
| `KnowledgeBaseArticle` | Help/knowledge base articles |

#### Misc
| Collection | Description |
|-----------|-------------|
| `ActivityLog` | Activity logs (auto-expire after 90 days) |
| `BackupLog` | Backup operation history |
| `Counter` | Auto-increment counters (admission numbers, receipts) |

## Middleware

| Middleware | Description |
|-----------|-------------|
| `auth.js` | JWT authentication (`protect`), role authorization (`authorize`), hierarchical access (`canAccessStudent`, `canAccessFee`) |
| `tenant.js` | Multi-tenant resolution (subdomain, header, query param, JWT), caching, subscription enforcement |
| `superAdminAuth.js` | Super admin JWT authentication (separate secret) |
| `planGate.js` | Subscription plan enforcement — feature gates and usage limits |
| `errorHandler.js` | Centralized error handling with request ID correlation |
| `validation.js` | Express-validator chains for users, students, fees, admissions, settings |
| `timetableValidation.js` | Timetable-specific validation rules |
| `fileUpload.js` | CSV/Excel upload middleware (10MB, memory storage) |
| `upload.js` | General file upload middleware (20MB, includes images) |

## Services

| Service | Description |
|--------|-------------|
| `emailService.js` | Email queue with retry logic |
| `csvImportService.js` | CSV parsing and import |
| `studentImportService.js` | Student CSV/Excel import with validation |
| `employeeImportService.js` | Employee CSV/Excel import |
| `importExportService.js` | Generic import/export utilities |
| `cloudinaryService.js` | Cloudinary file upload/management |
| `googleDriveService.js` | Google Drive backup integration |
| `backupService.js` | Database backup/restore logic |
| `pdfService.js` | PDF generation (fee receipts, reports) |
| `bulkPdfService.js` | Bulk PDF generation with Puppeteer |
| `receiptPdfService.js` | Fee receipt PDF generation |
| `payrollPdfService.js` | Payroll slip PDF generation |
| `reportCardService.js` | Report card generation |
| `invoiceGenerationService.js` | Invoice generation from fee allocations |
| `financeAutoSyncService.js` | Auto-sync payments to income records |
| `announcementService.js` | Announcement creation and delivery |
| `notificationService.js` | Multi-channel notification dispatch |
| `examService.js` | Exam and result management |
| `homeworkService.js` | Homework assignment and submission logic |
| `payrollService.js` | Payroll calculation and generation |
| `timetableService.js` | Core timetable operations |
| `timetableGeneratorService.js` | Auto-generate timetable entries |
| `timetableViewService.js` | Timetable view queries (today, week, class, teacher) |
| `timetableExportService.js` | Timetable PDF/export |
| `payment/GatewayFactory.js` | Payment gateway factory pattern |
| `payment/RazorpayGateway.js` | Razorpay payment integration |
| `payment/ICICIEazypayGateway.js` | ICICI EazyPay payment integration |
| `payment/MockPaymentGateway.js` | Mock gateway for testing |
| `payment/PaymentGateway.js` | Abstract payment gateway interface |

## Background Jobs

| Job | Description |
|-----|-------------|
| `jobs/reconciliationJob.js` | Automatic payment reconciliation |
| `jobs/backupJob.js` | Scheduled database backups |

## Testing

### Running Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:ci       # CI tests (unit + integration)
npm test -- --coverage    # With coverage report
```

Tests must maintain >80% coverage. Tests use a separate database (`learnovo_test`).

### Test Files

- `tests/unit/tenantRegistration.test.js` — Tenant registration
- `tests/unit/students.test.js` — Student CRUD
- `tests/unit/pdfService.test.js` — PDF generation
- `tests/unit/notificationService.test.js` — Notification service
- `tests/integration/csvImport.test.js` — CSV import flow

## Project Structure

```
learnovo-backend/
├── controllers/              # Controller logic (certificates, fee payments)
│   ├── certificateController.js
│   └── feePayment.controller.js
├── jobs/                     # Background/cron jobs
│   ├── backupJob.js
│   └── reconciliationJob.js
├── middleware/                # Express middleware
│   ├── auth.js               # JWT auth & role authorization
│   ├── errorHandler.js       # Centralized error handling
│   ├── fileUpload.js         # CSV/Excel upload (10MB)
│   ├── planGate.js           # Subscription plan enforcement
│   ├── superAdminAuth.js     # Super admin auth
│   ├── tenant.js             # Multi-tenant resolution
│   ├── timetableValidation.js # Timetable validators
│   ├── upload.js             # General file upload (20MB)
│   └── validation.js         # Input validation rules
├── migrations/               # Database migrations
├── models/                   # Mongoose models (72 schemas)
├── routes/                   # Express route definitions (55+ route files)
├── services/                 # Business logic layer
│   └── payment/              # Payment gateway integrations
│       ├── GatewayFactory.js
│       ├── ICICIEazypayGateway.js
│       ├── MockPaymentGateway.js
│       ├── PaymentGateway.js
│       └── RazorpayGateway.js
├── templates/                # HTML templates
│   ├── certificates/         # TC, bonafide certificate templates
│   └── report-cards/         # Report card templates
├── utils/                    # Shared utilities
│   ├── admissionUtils.js
│   ├── cache.js              # In-memory caching (node-cache)
│   ├── csvHandler.js
│   ├── currency.js
│   ├── email.js
│   ├── encryption.js         # Field-level encryption
│   ├── indexes.js
│   ├── migrationManager.js
│   ├── money.js
│   ├── pagination.js
│   ├── planConfig.js         # Subscription plan definitions
│   ├── s3.js                 # AWS S3 client
│   ├── s3PresignedUrl.js
│   └── s3Upload.js
├── scripts/                  # Database & maintenance scripts
├── tests/                    # Test files
│   ├── unit/
│   ├── integration/
│   ├── setup.js
│   └── testHelpers.js
├── design-spec/              # Design specifications & OpenAPI
├── public/                   # Static files (dev only)
├── .github/workflows/ci-cd.yml  # GitHub Actions CI/CD
├── server.js                 # Application entry point
├── package.json
└── config.env.example
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `mongoose` | MongoDB ODM |
| `jsonwebtoken` | JWT authentication |
| `bcryptjs` | Password hashing |
| `nodemailer` | Email sending |
| `razorpay` | Razorpay payment gateway SDK |
| `puppeteer` | PDF generation (certificates, report cards) |
| `pdfkit` | PDF generation (receipts, reports) |
| `cloudinary` | Cloud file storage |
| `@aws-sdk/client-s3` | AWS S3 file storage |
| `googleapis` | Google Drive backup integration |
| `exceljs` / `xlsx` | Excel file handling |
| `fast-csv` / `csv-parser` | CSV parsing |
| `archiver` | ZIP archive creation (bulk downloads) |
| `helmet` | Security headers |
| `express-rate-limit` | Rate limiting |
| `express-validator` / `joi` | Input validation |
| `compression` | Response compression |
| `node-cache` | In-memory caching |
| `cron` | Scheduled job execution |
| `date-fns` | Date manipulation |
| `axios` | HTTP client (external API calls) |
| `p-queue` | Concurrency-limited task queues |
| `multer` | File upload handling |

## CI/CD

GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs on push/PR:

1. **Test** — Lint, unit tests, integration tests (MongoDB 4.4 service), coverage upload to Codecov
2. **Build** — Create deployment artifact
3. **Security** — `npm audit` vulnerability scan
4. **Deploy Staging** — On `develop` branch
5. **Deploy Production** — On `main` branch

## Monitoring & Logging

### Structured Logging

All logs are JSON-formatted with fields: `timestamp`, `level`, `requestId`, `route`, `tenantId`, `userEmail`, `message`, `error`.

### Health Monitoring

- **`/health`** — Database connectivity, email service status, email queue metrics. Returns 503 if degraded.
- **`/healthz`** — Simple liveness probe for orchestrators.
- **Memory monitoring** — Logs warnings when heap usage exceeds 85%; manual GC every 30 minutes if `--expose-gc` is set.
- **Request timeout** — 15s default, 180s for bulk invoice generation.

### Error Tracking

- All errors include request IDs for correlation
- 5xx errors return request IDs to clients
- Optional Sentry integration via `SENTRY_DSN`

## Security

### Implemented Measures

- **Helmet**: Security headers
- **Rate Limiting**: Configurable per-window rate limits
- **Input Validation**: Express-validator + Joi validation on all endpoints
- **Password Hashing**: bcrypt with configurable salt rounds
- **JWT Authentication**: Secure token-based auth with HTTP-only cookies
- **CORS**: Strict origin allowlist with credentials support
- **File Upload Validation**: Size and type restrictions (10MB CSV, 20MB media)
- **Field Encryption**: Sensitive payment fields (UPI IDs, cheque numbers, gateway responses) encrypted at rest
- **Subscription Enforcement**: Feature and usage gating via plan middleware
- **Multi-tenant Isolation**: All queries scoped by `tenantId`; middleware prevents cross-tenant access

## Deployment

### Hosting

- **Backend**: Hostinger VPS (Node.js + PM2) — `api.learnovoportal.com`
- **Frontend**: Vercel — `learnovoportal.com` (multi-tenant subdomains: `{school}.learnovoportal.com`)
- **Database**: MongoDB Atlas

### Production Start Command

```bash
node --expose-gc --max-old-space-size=512 server.js
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production MongoDB URI (Atlas)
- [ ] Set secure `JWT_SECRET` and `SUPER_ADMIN_JWT_SECRET`
- [ ] Configure email credentials (`EMAIL_*` or `SMTP_*`)
- [ ] Set `FRONTEND_URL` to production domains
- [ ] Configure Razorpay/ICICI payment gateway credentials
- [ ] Configure Cloudinary credentials
- [ ] Run database migrations (`npm run migrate`)
- [ ] Set up PM2 process manager
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure Google Drive backup credentials (optional)
- [ ] Seed super admin: `node scripts/seedSuperAdmin.js`

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "--expose-gc", "--max-old-space-size=512", "server.js"]
```

## Troubleshooting

### Common Issues

**Database Connection Issues:**
- Verify MongoDB is running / Atlas is accessible
- Check `MONGODB_URI` in config.env
- Ensure network connectivity and IP whitelist

**Email Issues:**
- Verify SMTP/EMAIL credentials
- Check email service logs
- Test with Gmail App Password

**Payment Issues:**
- Verify Razorpay/ICICI credentials
- Check webhook URL configuration
- Review payment audit logs

**Migration Issues:**
- Check status: `npm run migrate:status`
- Rollback: `npm run migrate:rollback`
- Check database permissions

**Memory Issues:**
- Server starts with `--max-old-space-size=512`
- GC runs every 30 minutes with `--expose-gc`
- Check heap usage warnings in logs

**Test Failures:**
- Ensure test database (`learnovo_test`) is accessible
- Check test environment variables
- Verify all dependencies are installed

### Debug Mode

```bash
DEBUG=learnovo:* npm run dev
```

## Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** with proper tests
4. **Run tests**: `npm run test:ci`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Write tests for new features (maintain >80% coverage)
- Follow ESLint rules
- Use conventional commit messages
- Business logic in `services/`, not route handlers
- Every DB query must be scoped by `tenantId`
- Use MongoDB transactions for multi-collection writes
- Schema changes require a migration in `scripts/`
- Use structured logger, not `console.log`
- Never commit secrets or `config.env`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
