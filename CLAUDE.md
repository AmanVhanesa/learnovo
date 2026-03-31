# CLAUDE.md — Learnovo

## Project Overview

Learnovo is a multi-tenant school management SaaS platform. Each tenant (school) gets isolated data via `tenantId` scoping on every collection. The backend is a Node.js/Express REST API with MongoDB (Mongoose), and the frontend is a React 18 SPA built with Vite. The platform covers academics, fees/finance, attendance, exams, transport, payroll, certificates, timetables, homework, admissions, and a super-admin panel for platform-wide management.

## Hosting & Deployment

- **Backend:** VPS `157.173.219.189` (Node.js + PM2 cluster) — `api.learnovoportal.com`
- **Frontend:** Same VPS `157.173.219.189` (Vite build → symlinked releases) — `learnovoportal.com` (multi-tenant subdomains: `{school}.learnovoportal.com`)
- **Database:** MongoDB Atlas
- **File Storage:** Cloudinary (images, PDFs), AWS S3 (documents, report cards)
- **Backups:** Google Drive via OAuth2 (optional, cron-scheduled)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 16+, Express 4.18, Mongoose 7.5 |
| Frontend | React 18.2, Vite 4.4, TanStack React Query, React Router 6, Tailwind CSS 3 |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Payments | Razorpay, ICICI EazyPay (per-tenant gateway config) |
| Email | Nodemailer (SMTP, queued with retry) |
| PDF | Puppeteer (headless Chrome), PDFKit |
| File Upload | Multer → Cloudinary / AWS S3 |
| CSV/Excel | fast-csv, exceljs, xlsx |
| Caching | node-cache (in-memory, 300s TTL) |
| Testing | Jest 29, Supertest |
| Linting | ESLint 8, Husky + lint-staged |
| CI/CD | GitHub Actions (test → build → security audit → deploy) |

---

## Quick Commands

### Backend (`learnovo-backend/`)

```bash
npm run dev                    # Dev server with nodemon on port 5000
npm start                      # Production start (--expose-gc --max-old-space-size=512)
npm test                       # Run all tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:ci                # CI pipeline (unit + integration)
npm test -- --coverage         # Coverage report (must stay >80%)
npm run lint                   # Check code style
npm run lint:fix               # Auto-fix lint issues
npm run migrate                # Run pending database migrations
npm run migrate:status         # Check migration state
npm run migrate:rollback       # Rollback last migration
npm run seed                   # Seed initial data
npm run seed:demo              # Create demo tenant (admin@learnovo.com / admin123)
npm run seed:attendance        # Seed attendance test data
npm run clear:db               # Clear database (DESTRUCTIVE)
DEBUG=learnovo:* npm run dev   # Verbose debug logging
```

### Frontend (`learnovo-frontend/`)

```bash
npm run dev                    # Vite dev server
npm run build                  # Production build
npm run preview                # Preview production build
```

---

## Architecture & Patterns

### Request Lifecycle

```
Client Request
  → CORS check
  → Helmet security headers
  → Compression
  → Body parsing (10MB limit, raw body capture for webhooks)
  → Request ID middleware (UUID per request)
  → Request timeout (15s default, 3min for bulk operations)
  → Route matching
    → getTenantFromRequest (subdomain / X-Tenant-Subdomain header / schoolCode / JWT)
    → protect (JWT verification, attaches req.user)
    → authorize(...roles) (role gate)
    → planGate.* (subscription feature gate)
    → express-validator rules + handleValidationErrors
    → Route handler (validate → call service → respond)
  → errorHandler (formats by error type, includes requestId)
  → 404 notFoundHandler
```

### Tenant Isolation

- `getTenantFromRequest` middleware resolves tenant from: subdomain extraction, `X-Tenant-Subdomain` header, `schoolCode` body field, or JWT `tenantId` claim
- Base domains: `learnovoportal.com`, `learnovo.app`, `localhost`
- Reserved subdomains: www, api, admin, app, mail, ftp, staging, dev
- Tenant lookups are cached (10-minute TTL via node-cache)
- **Every DB query must include `tenantId`** — forgetting this leaks data across schools
- `validateTenantAccess` ensures user belongs to the tenant (superadmin exempt)

### Error Handling

All errors flow through `middleware/errorHandler.js`:
- Catches: ValidationError, CastError, JsonWebTokenError, TokenExpiredError, duplicate key (11000)
- Every response includes `requestId` for correlation
- Structured JSON logging with: timestamp, level, requestId, route, tenantId, userEmail

### Auth Flow

1. Login: `POST /api/auth/login` → validates credentials → `generateToken(userId)` → returns JWT + HttpOnly cookie
2. Protected routes: `protect` middleware verifies Bearer token, attaches `req.user`
3. Role checking: `authorize('admin', 'teacher')` checks `req.user.role`
4. Password reset: rate-limited (5/15min), email with reset token
5. Super admin: separate JWT secret (`SUPER_ADMIN_JWT_SECRET`), separate auth middleware

### Subscription Plan Gating

- `planGate.requireActiveSubscription` — blocks expired trials, suspended, cancelled
- `planGate.requireFeature(name)` — checks plan feature flags
- `planGate.limitGate(key, countFn)` — enforces usage limits (students, teachers, etc.)
- Convenience gates: `checkStudentLimit`, `checkTeacherLimit`, `checkFeesAndFinance`, `checkCsvImport`, `checkPaymentGateway`, etc.
- Plans: free (14-day trial), basic (₹2999/mo), pro, enterprise

### Email Queue

- Singleton `EmailService` with queue (max 100 pending)
- Auto-processes queue with retry (3 attempts, 5s backoff)
- Templates: onboarding, password reset, user invitation, fee reminders
- SMTP config via `EMAIL_*` or `SMTP_*` env vars

### Finance Auto-Sync

- `financeAutoSyncService` auto-creates Income records when fee payments are confirmed
- Auto-creates Expense records when payroll is marked paid
- Idempotent via `referenceId` checks — safe to call multiple times
- Supports reversal (soft-deletes income/expense on payment reversal)

---

## API Response Shape

```json
// Success
{ "success": true, "message": "...", "data": {}, "requestId": "uuid", "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 } }

// Error
{ "success": false, "message": "...", "errors": [{ "field": "", "message": "" }], "requestId": "uuid" }
```

| Status | When |
|--------|------|
| 201 | Created |
| 400 | Validation failure |
| 401 | Bad/missing token |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Duplicate/conflict |
| 500 | Unexpected server error |

---

## API Endpoint Reference

### Auth (`/api/auth`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/login` | - | Public | Login (email/admissionNumber + password + optional schoolCode) |
| POST | `/register` | protect | Admin | Register new user |
| GET | `/me` | protect | Any | Get current user |
| PUT | `/profile` | protect | Any | Update profile |
| PUT | `/password` | protect | Any | Change password |
| POST | `/upload-photo` | protect | Any | Upload profile photo |
| POST | `/logout` | protect | Any | Logout |
| POST | `/forgot-password` | Rate limited | Public | Request password reset |
| PUT | `/reset-password` | - | Public | Reset password with token |

### Tenants (`/api/tenants`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/register` | - | Public | Register new school |
| GET | `/info` | protect | Admin | Get tenant info |
| PUT | `/info` | protect | Admin | Update tenant info |
| GET | `/subscription` | protect | Admin | Get subscription details |
| PUT | `/subscription` | protect | Admin | Update subscription |
| GET | `/public/:subdomain` | - | Public | Get public tenant info |
| GET | `/check-availability` | - | Public | Check schoolCode/subdomain/email availability |
| POST | `/:id/import/csv` | protect | Admin | Bulk import teachers/students |
| GET | `/:id/import/template` | protect | Admin | Download CSV template |

### Students (`/api/students`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect | Admin/Teacher | List with pagination/filters |
| GET | `/:id` | protect | Any | Get student details |
| POST | `/` | protect | Admin | Create student |
| PUT | `/:id` | protect | Admin | Update student |
| DELETE | `/:id` | protect | Admin | Delete student |
| GET | `/export` | protect | Admin | Export CSV |
| POST | `/import/preview` | protect | Admin | Preview CSV import |
| POST | `/import/execute` | protect | Admin | Execute bulk import |

### Employees (`/api/employees`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect | Admin/Teacher | List employees (non-student roles) |
| GET | `/filters` | protect | Admin | Get unique roles/departments |
| GET | `/:id` | protect | Any | Get employee (admin or self) |
| POST | `/` | protect+planGate | Admin | Create employee |
| PUT | `/:id` | protect | Admin | Update employee |
| DELETE | `/:id` | protect | Admin | Soft delete |
| PUT | `/:id/toggle-status` | protect | Admin | Toggle active/inactive |
| PUT | `/:id/reset-password` | protect | Admin | Reset password |
| POST | `/:id/create-login` | protect | Admin | Enable login |
| PUT | `/:id/disable-login` | protect | Admin | Disable login |
| GET | `/:id/leave-balance` | protect | Any | Get leave balance |
| PATCH | `/:id/leave-balance` | protect | Admin | Update leave balance |
| GET | `/import/template` | protect+planGate | Admin | CSV template |
| POST | `/import/preview` | protect+planGate | Admin | Preview import |
| POST | `/import/execute` | protect+planGate | Admin | Execute import |
| GET | `/export` | protect | Admin | Export CSV |

### Academic Sessions (`/api/academic-sessions`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect | Admin/Teacher | List sessions |
| GET | `/active` | protect | Any | Get active session |
| GET | `/:id` | protect | Admin/Teacher | Get session |
| POST | `/` | protect | Admin | Create session |
| PUT | `/:id` | protect | Admin | Update session |
| PUT | `/:id/activate` | protect | Admin | Activate session |
| PUT | `/:id/lock` | protect | Admin | Lock/unlock session |
| DELETE | `/:id` | protect | Admin | Delete (if not active/locked) |

### Classes (`/api/classes`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect | Any | List classes |
| GET | `/:id` | protect | Any | Get class with sections |
| POST | `/` | protect | Admin | Create class with sections |
| PUT | `/:id` | protect | Admin | Update class |
| DELETE | `/:id` | protect | Admin | Delete (if no students) |
| GET | `/:id/sections` | protect | Any | Get sections |
| GET | `/:id/students` | protect | Any | Get students |
| POST | `/:id/students` | protect | Admin | Enroll students |
| GET | `/:id/subjects` | protect | Any | Get subjects |
| POST | `/:id/subjects` | protect | Admin | Assign subject+teacher |
| DELETE | `/:id/subjects/:subjectId` | protect | Admin | Remove subject |

### Subjects (`/api/subjects`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect | Any | List subjects |
| GET | `/:id` | protect | Any | Get subject |
| POST | `/` | protect | Admin | Create subject |
| PUT | `/:id` | protect | Admin | Update subject |
| DELETE | `/:id` | protect | Admin | Delete subject |
| PATCH | `/:id/toggle` | protect | Admin | Toggle active status |

### Fees (`/api/fees`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect+planGate | Any | List fees |
| GET | `/statistics` | protect+planGate | Any | Fee statistics |
| GET | `/overdue` | protect+planGate | Any | Overdue fees |
| GET | `/:id` | protect+planGate | Any | Get fee |
| POST | `/` | protect+planGate | Admin/Teacher | Create fee |
| PUT | `/:id` | protect+planGate | Admin/Teacher | Update fee |
| PUT | `/:id/pay` | protect+planGate | Admin/Teacher | Mark as paid |
| POST | `/:id/remind` | protect+planGate | Admin/Teacher | Send reminder |
| DELETE | `/:id` | protect+planGate | Admin | Delete fee |

### Exams (`/api/exams`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect+planGate | Any | List exams |
| POST | `/` | protect+planGate | Admin/Teacher | Create exam |
| GET | `/result-card/:studentId` | protect+planGate | Any | Get result card |
| GET | `/result-card/:studentId/pdf` | protect+planGate | Any | Download result card PDF |
| GET | `/my-results` | protect+planGate | Student | Get own results |
| GET | `/:id` | protect+planGate | Any | Get exam |
| PATCH | `/:id` | protect+planGate | Admin/Teacher | Update exam |
| DELETE | `/:id` | protect+planGate | Admin/Teacher | Delete exam + results |
| POST | `/:id/results` | protect+planGate | Admin/Teacher | Add/update results |
| GET | `/:id/results` | protect+planGate | Any | Get results |
| PUT | `/:id/results/publish` | protect+planGate | Admin/Teacher | Publish/unpublish results |

### Assignments (`/api/assignments`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/stats/overview` | protect | Any | Assignment statistics |
| GET | `/upcoming/list` | protect | Any | Next 10 upcoming |
| GET | `/` | protect | Any | List (role-filtered) |
| GET | `/:id` | protect | Any | Get assignment |
| POST | `/` | protect | Admin/Teacher | Create |
| PUT | `/:id` | protect | Admin/Teacher | Update |
| DELETE | `/:id` | protect | Admin/Teacher | Delete |

### Notifications (`/api/notifications`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/preferences` | protect | Get notification preferences |
| PUT | `/preferences` | protect | Update preferences |
| GET | `/unread-count` | protect | Unread count |
| GET | `/` | protect | List (pagination, filters) |
| PATCH | `/mark-all-read` | protect | Mark all read |
| PATCH | `/:id/read` | protect | Mark read |
| PATCH | `/:id/unread` | protect | Mark unread |
| DELETE | `/:id` | protect | Soft delete |

### Payments (`/api/payments`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/plans` | - | Public | Available subscription plans |
| POST | `/create-order` | protect | Admin | Create Razorpay order |
| POST | `/verify` | protect | Admin | Verify payment + activate subscription |
| GET | `/subscription` | protect | Admin | Current subscription |
| POST | `/notify` | - | Public | Payment gateway webhook |
| POST | `/return` | - | Public | Payment success redirect |
| POST | `/cancel` | - | Public | Payment cancel redirect |
| POST | `/failure` | - | Public | Payment failure redirect |

### Settings (`/api/settings`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | protect | Any | Get settings |
| PUT | `/` | protect | Admin | Update settings |
| PUT | `/currency` | protect | Admin | Update currency |
| GET | `/currencies` | - | Public | Supported currencies |
| POST | `/classes` | protect | Admin | Add class |
| POST | `/subjects` | protect | Admin | Add subject |
| POST | `/fee-structure` | protect | Admin | Add fee structure |
| PUT | `/notifications` | protect | Admin | Update notification settings |
| PUT | `/system` | protect | Admin | System settings |
| PUT | `/theme` | protect | Admin | Theme settings |
| POST | `/upload-logo` | protect | Admin | Upload logo |
| POST | `/upload-signature` | protect | Admin | Upload signature |
| GET | `/payment-gateway` | protect | Admin | Get gateway config (masked) |
| PUT | `/payment-gateway` | protect | Admin | Update gateway config |

### Additional Route Mounts

| Path | Description |
|------|-------------|
| `/api/schools` | School registration |
| `/api/teachers` | Teacher CRUD + my-classes |
| `/api/attendance` | Attendance tracking |
| `/api/admissions` | Admission process |
| `/api/student-fees` | Student fee transactions & online payment |
| `/api/fee-structures` | Fee structure templates |
| `/api/fees/allocations` | Fee allocation rules |
| `/api/invoices` | Invoice management |
| `/api/fee-payments` | Fee payment workflows + webhooks |
| `/api/admin-disputes` | Payment dispute resolution |
| `/api/student-lists` | Student list management |
| `/api/announcements` | Announcement broadcast |
| `/api/reports` | Reporting |
| `/api/certificates` | TC/Bonafide certificate generation |
| `/api/homework` | Homework + submissions |
| `/api/timetable` | Timetable templates, entries, overrides, substitutions |
| `/api/transport/routes` | Transport route management |
| `/api/drivers` | Driver management |
| `/api/vehicles` | Vehicle management |
| `/api/student-transport` | Student transport assignments |
| `/api/payroll` | Payroll generation & management |
| `/api/advance-salary` | Advance salary requests |
| `/api/expenses` | Expense tracking |
| `/api/income` | Income tracking |
| `/api/finance` | Finance dashboard |
| `/api/sub-departments` | Sub-department structure |
| `/api/class-subjects` | Class-subject mapping |
| `/api/teacher-assignments` | Teacher-class assignments |
| `/api/report-cards` | Report card generation |
| `/api/subscription` | Subscription management |
| `/api/files` | Cloudinary file operations |
| `/api/admin` | Admin backup/restore |
| `/api/super-admin/auth` | Super admin authentication |
| `/api/super-admin` | Super admin tenant/platform management |

### Health Endpoints (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Basic API status |
| GET | `/health` | Detailed health (DB, email, queue) |
| GET | `/healthz` | Kubernetes-style simple 200 OK |

---

## Database Schema Reference (76 Models)

### Core Models

**User** (`users`) — Central user model for all roles
- Fields: tenantId, name/firstName/lastName, email (optional, lowercase), password (hashed, select:false), role (admin/teacher/student/parent/accountant/staff/librarian/driver/support_staff/principal/vice_principal), phone, avatar, photo, isActive, lastLogin, employeeId, loginEnabled, department, designation, and role-specific fields
- Indexes: tenantId, email+tenantId, role+tenantId

**Tenant** (`tenants`) — School/organization
- Fields: schoolName, schoolCode (unique, lowercase), subdomain (unique, sparse), email (unique), phone, address, logo, primaryColor, secondaryColor, subscription (plan/status/trial/billing), settings, paymentGateway (per-tenant config)
- Indexes: schoolCode, subdomain, email

**Settings** (`settings`) — Per-tenant configuration (singleton per tenant)
- Fields: tenantId (unique), institution (name/logo/board/signature), grading rules, bankAccounts[], currency, academic config, fees config, notification settings, system settings, theme, backup config
- Static: `getSettings(tenantId)` — get or create with defaults

**SuperAdmin** (`superadmins`) — Platform admin (separate from tenant users)
- Fields: name, email (unique), password (hashed), isSuperAdmin, isActive, lastLogin

### Academic Models

**AcademicSession** (`academicsessions`) — Academic year periods
- Fields: tenantId, name, startDate, endDate, isActive, isLocked, createdBy
- Unique: {tenantId, name}. Pre-hook ensures only one active session per tenant.

**Class** (`classes`) — Grade/class definitions
- Fields: tenantId, name, grade, academicYear, classTeacher (ref User), subjects[] ({subject, teacher}), isActive

**Section** (`sections`) — Class sections (A, B, C...)
- Fields: tenantId, classId, name (uppercase), capacity, currentStrength, sectionTeacher
- Unique: {tenantId, classId, name}. Methods: incrementStrength(), decrementStrength()

**Subject** (`subjects`) — Subject catalog
- Fields: tenantId, name, subjectCode (unique uppercase), type (Theory/Practical/Both), maxMarks, passingMarks, isOptional, isActive

**ClassSubject** (`classsubjects`) — Class-subject mapping with marks config
- Unique: {tenantId, classId, subjectId, academicSessionId}

**TeacherSubjectAssignment** (`teachersubjectassignments`) — Teacher-subject-class mapping
- Unique: {tenantId, teacherId, subjectId, classId, sectionId, academicSessionId}

### Student Lifecycle

**Admission** (`admissions`) — Admission application workflow
- Fields: applicationNumber (auto-generated), personalInfo, contactInfo, guardianInfo, academicInfo, documents, status (pending→under_review→approved/rejected/waitlisted), reviewInfo, timeline[]
- Methods: approve(), reject(), getStatistics()

**Family** (`families`) — Family grouping for siblings
- Fields: tenantId, familyCode (auto-generated), primaryGuardian, secondaryGuardian, address, students[], totalSiblings

**StudentClassHistory** (`studentclasshistories`) — Class promotion/transfer audit trail

**StudentList** (`studentlists`) — Named student groups

### Finance Models

**FeeStructure** (`feestructures`) — Fee template per class/session
- Fields: tenantId, classId, sectionId, academicSessionId, feeHeads[] (name, annualAmount, type: recurring/one_time, isOptional, isAdmissionFee), lateFeeConfig
- Virtuals: totalAmount, totalAnnualAmount, recurringTotal, oneTimeTotal

**AnnualFeeAllocation** (`annualfeeallocations`) — Student-specific fee allocation from structure
- Unique: {tenantId, studentId, academicSessionId}
- Fields: allocatedFeeHeads[], totalAnnualAmount, totalPaid, totalWaived, totalDiscount, balance, paymentPlan, discountPercentage/Fixed
- Pre-hook recalculates balance on save

**FeeInvoice** (`feeinvoices`) — Individual invoices
- Fields: invoiceNumber (auto-generated, unique), studentId, items[] (feeHeadName, periodAmount, discount, netAmount), periodLabel/Start/End, totalAmount, paidAmount, balanceAmount, status (Pending/Partial/Paid/Overdue/Cancelled), dueDate, lateFee config

**Payment** (`payments`) — Confirmed payments
- Fields: receiptNumber (auto-generated, unique), studentId, invoiceId, amount, paymentMethod, transactionDetails (encrypted), allocation[], isConfirmed, isReversed
- Pre-hook encrypts sensitive fields; post-hook decrypts

**PaymentAttempt** (`paymentattempts`) — Online payment attempts (gateway integration)
- Fields: idempotencyKey (unique), studentId, invoiceId/invoiceIds[], amount, gatewayRefId, status (INITIATED→PROCESSING→SUCCESS/FAILED/PENDING/DISPUTED/UNDER_REVIEW/VERIFIED), triggerSource, gatewayResponse (encrypted)

**FeePaymentOrder** (`feepaymentorders`) — Razorpay order tracking
- Fields: razorpayOrderId (unique), razorpayPaymentId, status, verifiedViaCallback/Webhook

**Receipt** (`receipts`) — Payment receipts with PDF
- Fields: receiptNumber (auto-generated via Counter), paymentAttemptId, pdfPath

**StudentBalance** (`studentbalances`) — Running balance per student per session
- Unique: {tenantId, studentId, academicSessionId}
- Static: updateBalance() recalculates from invoices/payments, getDefaulters()

**Fee** (`fees`) — Legacy fee records
- Fields: student, amount, description, dueDate, status, paidAmount, balance, feeType, remindersSent[]

**PaymentDispute** (`paymentdisputes`) — Student-raised disputes
- Fields: studentId, invoiceId, screenshotPath, status (RAISED→UNDER_REVIEW→RESOLVED/REJECTED)

**FeeAuditLog** (`feeauditlogs`) — Fee action audit trail
- Static: logAction(), getEntityAuditTrail(), getUserActivity()

### Attendance Models

**Attendance** (`attendances`) — Student attendance
- Unique: {tenantId, classId, sectionId, date, subject}
- Fields: attendanceRecords[] ({studentId, admissionNumber, status, remarks}), totals
- Pre-hook calculates totals. Static: getAttendanceByDate(), getStudentAttendanceStats()

**EmployeeAttendance** (`employeeattendances`) — Staff attendance
- Unique: {tenantId, employeeId, date}

**AttendanceSettings** (`attendancesettings`) — Per-tenant attendance config
- Unique: tenantId

### Exam Models

**Exam** (`exams`) — Exam scheduling
- Fields: name, examSeries (FA1-FA4/SA1-SA2/Unit Test/Midterm/Final/Custom), class, subject, date, totalMarks, passingMarks, examType, status

**Result** (`results`) — Exam results
- Unique: {exam, student}
- Fields: marksObtained, percentage, grade, isPassed, isPublished

### Timetable Models (6 models)

**TimetableTemplate** (`timetabletemplates`) — Template container (draft/published/archived)
**SchoolTiming** (`schooltimings`) — Period/break slots within template
**SubjectAllocation** (`subjectallocations`) — How many periods per week per subject/class
**TimetableEntry** (`timetableentries`) — Actual slot assignments (day+timing+class→subject+teacher)
**TimetableOverride** (`timetableoverrides`) — Date-specific overrides (holiday/half_day/exam_day)
**Substitution** (`substitutions`) — Teacher substitution records
**TeacherConstraint** (`teacherconstraints`) — Scheduling constraints (unavailable, maxPeriodsPerDay, etc.)
**Room** (`rooms`) — Room catalog for scheduling

### Transport Models

**Driver** (`drivers`) — Driver records with license tracking
**Vehicle** (`vehicles`) — Vehicle records with document expiry tracking
**Route** (`routes`) — Transport routes with stops, fees, assigned vehicle/driver
**StudentTransportAssignment** (`studenttransportassignments`) — Student-route mapping

### Payroll Models

**Payroll** (`payrolls`) — Monthly payroll records
- Unique: {employeeId, month, year, tenantId}
- Pre-hook calculates net salary. Fields: baseSalary, bonuses, deductions, advanceDeductions[], netSalary

**AdvanceSalary** (`advancesalaries`) — Advance salary requests with deduction tracking

### Notification Models

**Notification** (`notifications`) — In-app notifications
- Fields: userId, title, message, type, category, visibility[] (role-based), isRead, channels (inApp/email/whatsapp)

**NotificationPreference** (`notificationpreferences`) — Per-user notification settings
- Static: getOrCreate(), shouldNotify()

**Announcement** (`announcements`) — Broadcast announcements
- Fields: targetAudience[], targetClasses[], priority, expiresAt

### Finance Tracking

**Income** (`incomes`) — Income records (manual + auto-synced from fee payments)
**IncomeCategory** (`incomecategories`) — Income categories
**Expense** (`expenses`) — Expense records (manual + auto-synced from payroll)
**ExpenseCategory** (`expensecategories`) — Expense categories
**ExpenseBudget** (`expensebudgets`) — Monthly budget per category

### Certificate Models

**CertificateTemplate** (`certificatetemplates`) — TC/Bonafide templates
**GeneratedCertificate** (`generatedcertificates`) — Issued certificates with content snapshot

### Homework Models

**Homework** (`homeworks`) — Homework assignments
**HomeworkSubmission** (`homeworksubmissions`) — Student submissions with grading

### Platform/Super Admin Models

**SubscriptionPlan** (`subscriptionplans`) — Available plans with limits/features
**PlatformSettings** (`platformsettings`) — Singleton platform config
**PlatformAnnouncement** (`platformannouncements`) — Platform-wide announcements
**PlatformInvoice** (`platforminvoices`) — Subscription invoices
**Coupon** (`coupons`) — Discount coupons
**EmailTemplate** (`emailtemplates`) — Platform email templates with variables
**KnowledgeBaseArticle** (`knowledgebasearticles`) — Help center articles
**SupportTicket** (`supporttickets`) — Support tickets with message threads
**SuperAdminAuditLog** (`superadminauditlogs`) — Super admin action audit (TTL: 2 years)

### Utility Models

**Counter** (`counters`) — Atomic sequence generators (admission numbers, receipt numbers)
- Static: getNextSequence(), formatAdmissionNumber(), rollbackSequence()

**ActivityLog** (`activitylogs`) — General activity log (TTL: 90 days)
**BackupLog** (`backuplogs`) — Backup history
**Holiday** (`holidays`) — Holiday calendar
**SubDepartment** (`subdepartments`) — Department hierarchy
**PaymentAuditLog** (`paymentauditlogs`) — Payment status change audit (append-only)

---

## Middleware Reference

| File | Purpose | Used On |
|------|---------|---------|
| `auth.js` | JWT verification (`protect`), role gates (`authorize`), student/fee access checks, token generation | All protected routes |
| `errorHandler.js` | Centralized error formatting, structured logging, requestId generation, 404 handler | Global (server.js) |
| `tenant.js` | Tenant resolution from subdomain/header/body/JWT, tenant access validation, tenant caching | All `/api/*` routes |
| `planGate.js` | Subscription feature gating, usage limit enforcement | Feature-specific routes (fees, exams, imports) |
| `superAdminAuth.js` | Super admin JWT verification (separate secret) | `/api/super-admin/*` |
| `validation.js` | Express-validator rules for User, Student, Fee, Admission, Settings, pagination, search | Route-specific |
| `timetableValidation.js` | Express-validator rules for timetable operations (templates, timings, entries, constraints) | `/api/timetable/*` |
| `fileUpload.js` | Multer for CSV/Excel imports (memory storage, 10MB limit) | Import endpoints |
| `upload.js` | Multer for images + CSV/Excel (memory storage, 20MB limit) | Photo uploads, file imports |

---

## Services Reference

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| `emailService.js` | Queued email with retry (singleton) | queueEmail, sendOnboardingEmail, sendPasswordResetEmail, sendUserInvitationEmail |
| `notificationService.js` | In-app notifications with dedup (5-min window) | createNotification, createBulkNotifications, notifyFeePaymentReceived, notifyExamScheduled, etc. |
| `cloudinaryService.js` | Multi-tenant Cloudinary uploads (singleton) | uploadFile, uploadStudentPhoto, uploadSchoolLogo, deleteFile, getSignedUrl |
| `importExportService.js` | CSV/Excel parse + export | parseCSVBuffer, parseExcelBuffer, exportToCSV, exportToExcel, generateTemplate |
| `studentImportService.js` | Bulk student import with Joi validation | previewImport, executeImport (100-doc chunks), generateTemplate |
| `employeeImportService.js` | Bulk employee import | previewImport, executeImport, generateDefaultPassword (employeeId + '@123') |
| `examService.js` | Exam + result management | resolveTeacherClassNames (4 strategies), calculateGrade, getExamsForStudent |
| `homeworkService.js` | Homework CRUD + submissions | createHomework, submitHomework, getHomeworkStats, updateSubmissionFeedback |
| `announcementService.js` | Announcements + notification broadcast | createAnnouncement, broadcastAnnouncementNotifications (500-batch) |
| `payrollService.js` | Monthly payroll generation | generateMonthlyPayroll (deducts pending advances up to 50% salary) |
| `financeAutoSyncService.js` | Auto-create Income/Expense records | syncFeePaymentToIncome, syncPayrollToExpense, reversals |
| `timetableService.js` | Conflict checking + stats | checkConflicts (teacher/class/room), getTemplateStats |
| `timetableGeneratorService.js` | Auto-generate timetable (CSP + backtracking) | generateTimetable (MRV heuristic, 30s timeout, 50K max backtracks) |
| `timetableViewService.js` | Effective schedule with substitutions | getPublishedTemplate, getEffectiveSchedule |
| `backupService.js` | Compressed tenant backups | createBackupBuffer (gzipped JSON), createAndUploadBackup (to Google Drive) |
| `googleDriveService.js` | Google Drive OAuth2 backup storage | uploadOrReplace, downloadFile, checkConnection |
| `pdfService.js` | Puppeteer PDF generation (lazy browser) | Launches headless Chrome on demand, closes after 60s idle |
| `receiptPdfService.js` | Fee payment receipt PDFs | generateReceiptPdf (in-memory buffer with school branding) |
| `payrollPdfService.js` | Payroll slip PDFs | PDF with logos, signatures, salary breakdown |
| `reportCardService.js` | Student report card generation | buildSchoolData, buildStudentData, calculateGrade |

---

## Utilities Reference

| Utility | Purpose |
|---------|---------|
| `admissionUtils.js` | Atomic admission number generation (Counter-based), rollback support |
| `cache.js` | In-memory cache (node-cache): get/set/del/delByPrefix/getOrSet, 300s TTL, 500 max keys |
| `currency.js` | Multi-currency formatting (INR/USD/EUR/GBP/JPY), conversion, parsing |
| `money.js` | Safe monetary arithmetic: roundToRupee, moneyEquals (0.01 tolerance), calcBalance, rupeesToPaise/paiseToRupees |
| `encryption.js` | AES-256-GCM encryption for payment data: encrypt/decrypt/encryptObject/decryptObject |
| `email.js` | Email templates: sendFeeReminder, sendOverdueFeeReminder, sendAdmissionApproval/Rejection |
| `pagination.js` | parsePagination (clamp 1-500), paginatedResponse envelope. DEFAULT_LIMIT=20, MAX_LIMIT=500 |
| `planConfig.js` | Subscription plan definitions: free/basic/pro/enterprise with limits, features, pricing |
| `csvHandler.js` | CSV/Excel file parsing helper |
| `s3.js` | AWS S3 client initialization |
| `s3Upload.js` | Upload buffers to S3: uploadBufferToS3, buildS3Key |
| `s3PresignedUrl.js` | Generate pre-signed S3 URLs |
| `indexes.js` | Background MongoDB index creation |
| `migrationManager.js` | Schema migration runner |

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGO_URI` / `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `ENCRYPTION_KEY` | AES-256-GCM key (64 hex chars = 32 bytes) for payment data encryption |

### Auth & Security

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRE` | `7d` | Token expiration |
| `JWT_COOKIE_EXPIRE` | `7` | Cookie expiration (days) |
| `SUPER_ADMIN_JWT_SECRET` | - | Separate secret for super admin tokens |
| `SUPER_ADMIN_EMAIL` | - | For seeding super admin |
| `SUPER_ADMIN_PASSWORD` | - | For seeding super admin |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `5000` | Server port |
| `FRONTEND_URL` | - | Frontend URL for email links |
| `FRONTEND_ORIGIN` | - | CORS allowed origins (comma-separated) |
| `BACKEND_URL` | `http://localhost:5001` | Public backend URL for webhooks |

### Email (either EMAIL_* or SMTP_* prefix)

| Variable | Default | Description |
|----------|---------|-------------|
| `EMAIL_HOST` / `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `EMAIL_PORT` / `SMTP_PORT` | `587` | SMTP port |
| `EMAIL_SECURE` / `SMTP_SECURE` | - | Use TLS |
| `EMAIL_USER` / `SMTP_USER` | - | SMTP username |
| `EMAIL_PASS` / `SMTP_PASS` | - | SMTP password |
| `EMAIL_FROM` / `SMTP_FROM` | fallback to USER | Sender address |

### Payment Gateways

| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay merchant key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification |

### AWS S3

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `ap-south-1` | AWS region |
| `AWS_BUCKET_NAME` | `learnovo-files` | S3 bucket |
| `AWS_ACCESS_KEY_ID` | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | - | AWS secret |

### Google Drive (Backups)

| Variable | Description |
|----------|-------------|
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth refresh token |
| `GOOGLE_DRIVE_FOLDER_ID` | Target folder ID |
| `BACKUP_CRON_ENABLED` | Enable scheduled backups (`true`/`false`) |

### Testing

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_TEST_URI` | `mongodb://localhost:27017/learnovo_test` | Test database |

---

## Testing

### Running Tests

```bash
npm test                       # All tests
npm run test:unit              # Unit tests only (mocked)
npm run test:integration       # Integration tests (real DB)
npm run test:ci                # CI pipeline (unit + integration)
npm test -- --coverage         # Coverage report (must stay >80%)
```

### Test Helpers (`tests/testHelpers.js`)

- `setupTestDB()` — connects to test DB, clears collections before each test, disconnects after
- `createTestTenant(overrides)` — factory for test tenants
- `createTestUser(tenantId, overrides)` — factory for test users
- `getAuthToken(user)` — generates JWT for authenticated requests
- `makeAuthenticatedRequest(app, method, url, token, data)` — supertest wrapper
- Data factories: `validRegistrationData`, `invalidRegistrationData`, `validTeacherData`, `validStudentData`

### Test Database

Uses separate `learnovo_test` database. Collections are cleared before each test via `setupTestDB()`. Requires MongoDB running locally or set `MONGODB_TEST_URI`.

### Coverage

- Threshold: 80% (branches, functions, lines, statements)
- Reporters: text, lcov, html
- Exclusions: node_modules, tests, scripts, server.js

---

## Frontend Architecture

### Structure

```
learnovo-frontend/
  src/
    App.jsx              # Main routing (React Router v6)
    main.jsx             # React DOM entry + providers
    index.css            # Tailwind directives
    components/          # 90+ reusable components by feature
      Layout.jsx, Sidebar.jsx, Header.jsx, BottomNav.jsx
      /fees, /expenses, /payroll, /homework, /transport, /timetable
      ErrorBoundary.jsx, ProtectedRoute.jsx, PlanGate.jsx
    pages/               # 40+ page components
      Dashboard, Login, Students, Employees, Fees, Exams, Settings...
      /student/          # Student portal pages
      /superadmin/       # Super admin pages
    services/            # 30+ Axios API service modules
    contexts/            # React Context providers
      AuthContext.jsx    # Login/logout, token in localStorage
      TenantContext.jsx  # Subdomain detection, tenant header
      SettingsContext.jsx
      NotificationContext.jsx
      ThemeContext.jsx
      SuperAdminContext.jsx
    hooks/               # useMediaQuery, useClickOutside, usePlan, useUserDisplay
    utils/               # cn.js, formatDate, formatCurrency, export helpers
    constants/           # App constants
```

### Key Patterns

- **State**: React Context (auth, tenant, settings, theme) + TanStack React Query (server state/caching)
- **Forms**: React Hook Form
- **Styling**: Tailwind CSS (utility-first, dark mode, Apple-inspired design)
- **API**: Each service creates Axios instance; request interceptor adds `Authorization: Bearer {token}` + `X-Tenant-Subdomain: {subdomain}`
- **Auth**: Token stored in `localStorage`; 401 responses trigger logout
- **Routing**: React Router v6 with ProtectedRoute wrapper, lazy-loaded pages

---

## File Tree (Backend)

```
learnovo-backend/
  server.js                    # Entry point, middleware chain, route mounting
  config.env                   # Environment variables (gitignored)
  config.env.example           # Template for developers
  package.json                 # Dependencies and scripts
  jest.config.js               # Test configuration
  .eslintrc.js                 # Lint rules
  middleware/
    auth.js                    # JWT protect, authorize, token generation
    errorHandler.js            # Error formatting, logging, requestId
    tenant.js                  # Tenant resolution and access validation
    planGate.js                # Subscription feature gating
    superAdminAuth.js          # Super admin JWT verification
    validation.js              # Express-validator rules
    timetableValidation.js     # Timetable-specific validators
    fileUpload.js              # Multer for CSV/Excel (10MB)
    upload.js                  # Multer for images+files (20MB)
  models/                      # 76 Mongoose schemas (see Database Schema Reference)
  routes/                      # 55 Express route files
  services/                    # 30 business logic services
  utils/                       # 14 utility modules
  scripts/                     # 32 migration, seed, debug scripts
  tests/
    setup.js                   # Jest environment init
    testHelpers.js             # Factories, auth helpers
    unit/                      # Unit tests (mocked)
    integration/               # Integration tests (real DB)
  jobs/
    reconciliationJob.js       # Background payment reconciliation
    backupJob.js               # Scheduled Google Drive backups
  controllers/
    feePayment.controller.js   # Fee payment gateway logic
  .github/workflows/
    ci-cd.yml                  # Test → Build → Security → Deploy pipeline
```

---

## Code Conventions

### Adding a New Feature

1. **Model**: Create in `models/` with tenantId, timestamps, proper indexes
2. **Route**: Create in `routes/` — mount in `server.js`
3. **Service**: Business logic goes in `services/` — routes only validate, call service, respond
4. **Validation**: Use express-validator in route or `middleware/validation.js`
5. **Auth**: Use `protect` + `authorize('admin')` middleware chain
6. **Plan gate**: Add `planGate.requireFeature('featureName')` if feature is gated

### Naming

- Files: camelCase (`feeStructures.js`)
- Models: PascalCase singular (`FeeStructure`)
- Routes: camelCase (`feeStructures.js`)
- Collection names: lowercase plural (auto from model name)
- REST conventions: plural nouns (`/api/students`, not `/api/student`)

### Validation

- Use express-validator for request validation
- Use Joi schemas for CSV/import row validation
- Use Mongoose schema validation for data integrity
- Always call `handleValidationErrors` middleware after validators

### Error Format

```javascript
// In route handlers, pass errors to next():
next(err);

// For validation errors:
return res.status(400).json({ success: false, errors: [...], requestId: req.requestId });

// For not found:
return res.status(404).json({ success: false, message: 'Resource not found', requestId: req.requestId });
```

### Logging

Use the structured logger from `middleware/errorHandler.js`:
```javascript
logger.info('Action description', { requestId, tenantId, userId, ...context });
logger.error('Error description', { requestId, error: err.message, stack: err.stack });
```

---

## Common Pitfalls

1. **Forgetting tenantId scope** — Every DB query must filter by `tenantId`. Missing this leaks data across schools. The `addTenantFilter` middleware sets `req.tenantFilter` for convenience.

2. **Schema changes without migration** — All model changes need a migration script in `scripts/`. Run `npm run migrate` after changes.

3. **Business logic in routes** — Keep route handlers thin (validate → service → respond). Complex logic belongs in `services/`.

4. **Swallowing errors** — Always `next(err)`, never catch-and-ignore. The errorHandler formats and logs everything.

5. **Using console.log** — Use the structured logger. It includes requestId, tenantId, and writes JSON in production.

6. **Email queue overflow** — Queue caps at 100. For bulk operations (announcements to all users), batch through `notificationService.createBulkNotifications()` which handles this.

7. **Payment data in plaintext** — Payment models auto-encrypt sensitive fields (transactionDetails, gatewayResponse). Use `encrypt()`/`decrypt()` from `utils/encryption.js` for any new sensitive data. Requires `ENCRYPTION_KEY` env var.

8. **Timetable conflicts** — Always run `timetableService.checkConflicts()` before creating/updating timetable entries. The auto-generator has a 30s timeout and 50K backtrack limit.

9. **Counter sequences** — Use `Counter.getNextSequence()` for admission numbers, receipt numbers, invoice numbers. It's atomic. Use `rollbackSequence()` if the operation fails after getting a number.

10. **Finance sync** — Fee payments and payroll auto-sync to Income/Expense via `financeAutoSyncService`. Don't manually create duplicate income/expense records for these.

11. **Plan limits** — New features that count resources (students, teachers) must use `planGate.limitGate()`. Check `utils/planConfig.js` for plan definitions.

12. **File uploads** — Use Cloudinary for images/photos (tenant-scoped folders: `learnovo/{tenantId}/{type}/`). Use S3 for documents/PDFs. Never store files on the VPS filesystem.

13. **Roles expanded** — The User model supports 11 roles, not just 3. Beyond admin/teacher/student, there are: parent, accountant, staff, librarian, driver, support_staff, principal, vice_principal. Check `authorize()` calls carefully.

14. **Webhook raw body** — Payment webhook endpoints need raw body for signature verification. This is configured in server.js body parsing — don't change it without understanding the impact on `/api/fee-payments/webhook`.

## Pre-Deployment Security Checklist

Before every deploy, commit, or PR:

1. **Scan for hardcoded secrets**: `grep -rn "mongodb+srv://\|api_key\|secret_key\|sk-\|pk_\|apikey\|API_KEY\|SECRET" --include="*.js" --include="*.jsx" --include="*.json" --exclude-dir=node_modules .`
2. **Verify .env files are gitignored** — `.env`, `config.env`, `.env.local` must never be tracked
3. **No credentials in frontend** — `learnovo-frontend/src/` must contain zero API keys, database URIs, or secrets
4. **All secrets via env vars** — every external service reads from `process.env`, never hardcoded
5. **Run lint**: `npm run lint`
6. **Run tests**: `npm run test:ci`
