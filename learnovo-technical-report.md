# Learnovo — Complete Technical Report

> **Generated:** 2026-03-21
> **Purpose:** Mobile app architecture planning
> **Scope:** Full codebase analysis — frontend, backend, database, APIs, auth, routing, features

---

## Table of Contents

1. [Frontend Tech Stack](#1-frontend-tech-stack)
2. [Backend Tech Stack](#2-backend-tech-stack)
3. [Database Schema Summary](#3-database-schema-summary)
4. [API Structure](#4-api-structure)
5. [Authentication Flow](#5-authentication-flow)
6. [Frontend Routing Structure](#6-frontend-routing-structure)
7. [Feature List by Section](#7-feature-list-by-section)
8. [File/Folder Structure](#8-filefolder-structure)
9. [Environment Variables](#9-environment-variables-names-only)
10. [Current Deployment](#10-current-deployment)
11. [Real-Time Features](#11-real-time-features)
12. [Offline/PWA Features](#12-offlinepwa-features)
13. [Media/File Handling](#13-mediafile-handling)
14. [Third Party Integrations](#14-third-party-integrations)
15. [Performance & Optimization](#15-performance--optimization)

---

## 1. Frontend Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **UI Library** | React | ^18.2.0 |
| **React DOM** | react-dom | ^18.2.0 |
| **Build Tool** | Vite | ^4.4.9 |
| **Vite React Plugin** | @vitejs/plugin-react | ^4.0.3 |
| **Router** | react-router-dom | ^6.15.0 |
| **State Management** | React Context API + useReducer | (built-in) |
| **Server State** | @tanstack/react-query | ^5.90.21 |
| **HTTP Client** | axios | ^1.5.0 |
| **CSS Framework** | Tailwind CSS | ^3.3.3 |
| **CSS Utilities** | tailwind-merge | ^1.14.0 |
| **CSS Utilities** | clsx | ^2.0.0 |
| **PostCSS** | postcss | ^8.4.29 |
| **Autoprefixer** | autoprefixer | ^10.4.15 |
| **Form Library** | react-hook-form | ^7.45.4 |
| **Charts** | chart.js + react-chartjs-2 | ^4.4.0 / ^5.2.0 |
| **Animation** | framer-motion | ^12.38.0 |
| **Toast Notifications** | react-hot-toast | ^2.4.1 |
| **Icons** | react-icons | ^4.11.0 |
| **Icons** | lucide-react | ^0.544.0 |
| **UI Primitives** | @headlessui/react | ^2.2.9 |
| **Shader Effects** | @paper-design/shaders-react | ^0.0.72 |
| **Date Library** | date-fns | ^2.30.0 |
| **PDF Generation** | jspdf + jspdf-autotable | ^4.2.0 / ^5.0.7 |
| **Screenshot** | html2canvas | ^1.4.1 |
| **Excel Export** | xlsx | ^0.18.5 |
| **Type Checking** | prop-types | ^15.8.1 |
| **TypeScript Types** | @types/react, @types/react-dom | ^18.2.22, ^18.2.7 |

**CSS Approach:**
- Tailwind CSS v3 with class-based dark mode
- Custom design system with glass-morphism effects
- CSS custom properties for dynamic theming (primary: #3EC4B1, secondary: #2355A6)
- Inter font family with system fallbacks
- Custom component classes: `.card-glass`, `.btn-*`, `.stat-card-glass`, `.status-*`
- Mobile-first responsive design with iOS safe area support
- Print styles for certificate/receipt printing

**UI Component Library:** Custom-built (no MUI/Ant Design/shadcn) with Headless UI for accessible primitives

---

## 2. Backend Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Runtime** | Node.js | 20.x (CI/CD target) |
| **Framework** | Express | ^4.18.2 |
| **Database ODM** | Mongoose | ^7.5.0 |
| **Authentication** | jsonwebtoken (JWT) | ^9.0.2 |
| **Password Hashing** | bcryptjs | ^2.4.3 |
| **Validation** | express-validator | ^7.0.1 |
| **Schema Validation** | joi | ^17.13.3 |
| **File Upload** | multer | ^1.4.5-lts.1 |
| **CORS** | cors | ^2.8.5 |
| **Security Headers** | helmet | ^7.0.0 |
| **Rate Limiting** | express-rate-limit | ^6.10.0 |
| **Email** | nodemailer | ^6.9.4 |
| **Image Storage** | cloudinary | ^1.41.3 |
| **AWS S3** | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner | ^3.1008.0 |
| **Payment Gateway** | razorpay | ^2.9.6 |
| **PDF Generation** | pdfkit | ^0.13.0 |
| **PDF (HTML→PDF)** | puppeteer | ^24.39.1 |
| **Excel Processing** | exceljs | ^4.4.0 |
| **Spreadsheets** | xlsx | ^0.18.5 |
| **CSV Parsing** | csv-parser, fast-csv | ^3.0.0, ^5.0.5 |
| **Caching** | node-cache | ^5.1.2 |
| **Cron Jobs** | cron | ^2.3.0 |
| **Compression** | compression | ^1.8.1 |
| **HTTP Client** | axios | ^1.13.6 |
| **Google APIs** | googleapis | ^171.4.0 |
| **UUID** | uuid | ^9.0.1 |
| **Environment** | dotenv | ^16.3.1 |

**Dev Dependencies:**

| Category | Technology | Version |
|----------|-----------|---------|
| **Testing** | jest | ^29.7.0 |
| **API Testing** | supertest | ^6.3.3 |
| **Dev Server** | nodemon | ^3.0.1 |
| **Linting** | eslint | ^8.54.0 |
| **Git Hooks** | husky | ^8.0.3 |
| **Staged Linting** | lint-staged | ^15.1.0 |

**JWT Details:**
- Algorithm: HS256 (HMAC SHA-256)
- Default expiry: 7 days (configurable via `JWT_EXPIRE`)
- Cookie expiry: 7 days (configurable via `JWT_COOKIE_EXPIRE`)
- Super Admin JWT: separate secret, 24h expiry

**Password Hashing:**
- Library: bcryptjs
- Rounds: 12 (hardcoded in User model pre-save hook)

**File Storage:**
- Primary photos/images: Cloudinary (tenant-isolated folders)
- Documents: AWS S3 with pre-signed URLs (1-hour expiry, cached 50 min)
- Upload processing: Multer memory storage (no disk writes)

**Email Service:**
- Nodemailer with SMTP transport
- Default: Gmail SMTP (smtp.gmail.com:587)
- In-memory queue with retry logic (3 attempts, exponential backoff)
- Templates: Onboarding, password reset, user invitation

**SMS Service:** Not implemented

**CORS Configuration:**
- Allowed origins: `https://learnovoapp.vercel.app`, localhost:3000/3001/5173
- Dynamic origins via `FRONTEND_ORIGIN` env var
- Credentials: enabled
- Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Preflight cache: 24 hours

**Rate Limiting:**
- Super Admin login: 5 attempts per 15 minutes per IP
- General: configurable via env vars (default 1000 requests / 15 min)

---

## 3. Database Schema Summary

**Total Models: 71** | **Multi-tenant (with tenantId): 65** | **Database: MongoDB with Mongoose 7.5**

### Core Models

#### User
- **Fields:** tenantId (ref: Tenant), name, fullName, firstName, middleName, lastName, email (unique sparse), password (hashed), role (enum: admin/teacher/student/parent/accountant/staff/librarian/driver/support_staff/principal/vice_principal), phone, avatar, photo, isActive, lastLogin
- **Employee fields:** employeeId, loginEnabled, forcePasswordChange, designation, department, salary, leaveDeductionPerDay, dateOfJoining, fatherOrHusbandName, dateOfBirth, nationalId, education, experience, homeAddress, bankName, accountNumber, ifscCode, emergencyContact{}, leaveBalance{casual, sick, earned}, joiningLetter
- **Teacher fields:** subjects[], qualifications, assignedClasses[], classTeacher
- **Parent fields:** children[] (ref: User)
- **Student fields:** studentId, admissionNumber, rollNumber, class, section, classId, sectionId, academicYear, gender, bloodGroup, category, religion, penNumber, udiseCode, subDepartment, driverId, transportMode, admissionDate, guardians[], guardianName, guardianPhone, address, previousSchool, previousBoard, previousRollNumber, transferNotes, identificationMark, isOrphan, nationality, medicalConditions, allergies, doctorName, doctorPhone, notes, removalDate, removalReason, removalNotes
- **Indexes:** email+tenantId (unique sparse), role+tenantId, tenantId+admissionNumber, tenantId+role+class+section, tenantId+rollNumber, tenantId+penNumber (sparse), tenantId+classId, tenantId+driverId (sparse), tenantId+employeeId (sparse), tenantId+isActive
- **Hooks:** Pre-save password hashing (bcrypt 12 rounds)
- **Methods:** comparePassword(), toJSON()

#### Tenant
- **Fields:** schoolName, schoolCode (unique, lowercase), subdomain (unique sparse), email (unique), phone, address{street, city, state, country, zipCode}, logo, primaryColor, secondaryColor
- **Subscription:** plan (enum: free/basic/pro/enterprise), status (enum: active/trial/suspended/cancelled), trialEndsAt, billingCycle, startDate, endDate, maxStudents, maxTeachers, price, paymentId
- **Settings:** timezone, dateFormat, currency, academicYear, features{attendance, assignments, grades, reports, notifications, parentPortal, mobileApp}
- **Indexes:** schoolCode, subdomain, email, subscription.status

#### SuperAdmin
- **Fields:** name, email (unique), password (hashed), isSuperAdmin, isActive, lastLogin
- **Hooks:** Pre-save password hashing (bcrypt 12 rounds)

### Academic Models

#### AcademicSession
- **Fields:** tenantId (ref: Tenant), name, startDate, endDate, isActive, isLocked, description, createdBy (ref: User)
- **Indexes:** tenantId+name (unique), tenantId+isActive
- **Validation:** Only one active session per tenant

#### Class
- **Fields:** tenantId, name, grade, academicYear, classTeacher (ref: User), subjects[]{subject (ref: Subject), teacher (ref: User)}, isActive
- **Indexes:** tenantId+academicYear+grade, tenantId+classTeacher

#### Section
- **Fields:** tenantId, classId (ref: Class), name (uppercase), capacity, currentStrength, sectionTeacher (ref: User), description, isActive
- **Indexes:** tenantId+classId+name (unique)
- **Validation:** currentStrength cannot exceed capacity

#### Subject
- **Fields:** tenantId, name, subjectCode (uppercase), type (enum: Theory/Practical/Both), maxMarks, passingMarks, description, isActive
- **Indexes:** tenantId+subjectCode (unique)

#### ClassSubject
- **Fields:** tenantId, classId (ref: Class), subjectId (ref: Subject), academicSessionId (ref: AcademicSession), maxMarks, passingMarks, isCompulsory, isActive, createdBy
- **Indexes:** tenantId+classId+subjectId+academicSessionId (unique)

#### TeacherSubjectAssignment
- **Fields:** tenantId, teacherId (ref: User), subjectId (ref: Subject), classId (ref: Class), sectionId (ref: Section), academicSessionId (ref: AcademicSession), isPrimary, isActive, createdBy
- **Indexes:** tenantId+teacherId+subjectId+classId+sectionId+academicSessionId (unique)

### Attendance Models

#### Attendance (Student)
- **Fields:** tenantId, classId (ref: Class), teacherId (ref: User), subject, date, academicYear, attendanceRecords[]{studentId, admissionNumber, status (enum: present/absent/late/half_day/excused), remarks, markedAt}, totalPresent, totalAbsent, totalLate, totalHalfDay, totalExcused
- **Indexes:** tenantId+classId+date+subject (unique)

#### EmployeeAttendance
- **Fields:** tenantId, employeeId (ref: User), date, status (enum: present/absent/late/half_day/on_leave/excused), checkInTime, checkOutTime, remarks, markedBy (ref: User)
- **Indexes:** tenantId+employeeId+date (unique)

#### AttendanceSettings
- **Fields:** tenantId (unique), workingDays[], schoolStartTime, lateThresholdTime, halfDayThreshold, autoAbsentTime, allowPastEditing, pastEditDays, smsNotifyAbsent, notifyParents, dailySummaryToAdmin

#### Holiday
- **Fields:** tenantId, title, date, startDate, endDate, type (enum: public_holiday/school_holiday/exam_break/vacation), appliesTo (enum: all/students/employees)

### Academic Content Models

#### Assignment
- **Fields:** tenantId, title, description, subject, class, classId (ref: Class), teacher (ref: User), assignedTo[] (ref: User), dueDate, status (enum: active/completed/cancelled), attachments[]{fileName, fileUrl, fileSize, uploadedAt}, totalMarks, instructions, isVisible
- **Indexes:** tenantId+class, tenantId+teacher, tenantId+status

#### Homework
- **Fields:** tenantId, title, description, subject (ref: Subject), class (ref: Class), section (ref: Section), assignedBy (ref: User), assignedDate, dueDate, attachments[]{fileName, fileUrl, fileType, fileSize}, isActive
- **Indexes:** tenantId+class, tenantId+assignedBy, tenantId+subject, tenantId+dueDate

#### HomeworkSubmission
- **Fields:** tenantId, homeworkId (ref: Homework), studentId (ref: User), submissionText, attachments[], status (enum: pending/submitted/reviewed), submittedAt, teacherFeedback, grade, reviewedAt, reviewedBy (ref: User)
- **Indexes:** homeworkId+studentId (unique)

#### Exam
- **Fields:** tenantId, name, examSeries (enum: Unit Test/Midterm/Final/Custom), class, classId (ref: Class), section, subject, date, startTime, endTime, totalMarks, passingMarks, examType (enum: Written/Practical/Oral/Quiz/Assignment/Other), examMode (enum: Offline/Online), supervisor (ref: User), examRoom, description, status (enum: Scheduled/Ongoing/Completed/Cancelled)
- **Indexes:** tenantId+class+subject, tenantId+class+section+date

#### Result
- **Fields:** tenantId, exam (ref: Exam), student (ref: User), marksObtained, percentage, grade, isPassed, remarks, isPublished, publishedAt, updatedBy (ref: User)
- **Indexes:** exam+student (unique)

### Finance Models

#### FeeStructure
- **Fields:** tenantId, classId (ref: Class), sectionId (ref: Section), academicSessionId (ref: AcademicSession), feeHeads[]{name, amount, frequency (monthly/quarterly/half-yearly/yearly/one-time), description, isOptional}, lateFeeConfig{enabled, type (fixed/percentage), amount, gracePeriodDays}, isActive, createdBy
- **Virtuals:** totalAmount (sum of feeHeads)

#### FeeInvoice
- **Fields:** tenantId, invoiceNumber (unique), studentId (ref: User), classId (ref: Class), sectionId (ref: Section), academicSessionId (ref: AcademicSession), feeStructureId (ref: FeeStructure), items[]{feeHeadName, amount, frequency}, totalAmount, paidAmount, balanceAmount, status (enum: Pending/Partial/Paid/Overdue/Cancelled), dueDate, issuedDate, lateFeeApplied, billingPeriod{}, remarks, generatedBy (ref: User)
- **Indexes:** tenantId+invoiceNumber (unique), tenantId+studentId+status

#### Fee
- **Fields:** tenantId, student (ref: User), admissionNumber, feeStructureId, amount, currency (INR), description, dueDate, status (enum: pending/paid/partially_paid/overdue/cancelled), paidDate, paymentMethod, transactionId, receiptNumber, paidAmount, balance, notes, feeType (enum: tuition/transport/library/sports/exam/other), academicYear, term, remindersSent[], lateFeeAmount, lateFeeApplied
- **Virtuals:** totalAmount

#### Payment
- **Fields:** tenantId, receiptNumber (unique), studentId (ref: User), invoiceId (ref: FeeInvoice), amount, paymentMethod (enum: Cash/Bank Transfer/UPI/Cheque/Card/Online), transactionDetails{transactionId, bankName, chequeNumber, chequeDate, upiId, referenceNumber}, paymentDate, allocation[]{feeHeadName, amount}, remarks, isConfirmed, isReversed, reversalReason, collectedBy (ref: User)

#### PaymentAttempt
- **Fields:** tenantId, idempotencyKey (unique), studentId, invoiceId, amount, gatewayRefId, status (enum: INITIATED/PROCESSING/SUCCESS/FAILED/PENDING/DISPUTED/UNDER_REVIEW/VERIFIED), triggerSource (enum: STUDENT_PORTAL/BACKGROUND_JOB/ADMIN_MANUAL/API_RETRY), gatewayResponse, paymentMode, transactionRefId, proofScreenshotUrl, verifiedBy, verifiedAt

#### PaymentDispute
- **Fields:** tenantId, studentId, invoiceId, paymentAttemptId, transactionId, bankReferenceNumber, amount, screenshotPath, studentNote, status (enum: RAISED/UNDER_REVIEW/RESOLVED/REJECTED), adminNote, resolvedAt, resolvedBy

#### PaymentAuditLog
- **Fields:** tenantId, paymentAttemptId (ref: PaymentAttempt), previousStatus, newStatus, triggerSource, note, createdAt (immutable)

#### FeeAuditLog
- **Fields:** tenantId, action, entityType (enum: FeeStructure/FeeInvoice/Payment/StudentBalance), entityId, userId (ref: User), userName, userRole, details (Mixed), ipAddress, userAgent, timestamp

#### StudentBalance
- **Fields:** tenantId, studentId (ref: User), academicSessionId (ref: AcademicSession), totalInvoiced, totalPaid, totalBalance, lastPaymentDate, lastPaymentAmount, carryForwardBalance, carryForwardDate
- **Indexes:** tenantId+studentId+academicSessionId (unique)

#### Receipt
- **Fields:** tenantId, paymentAttemptId (ref: PaymentAttempt, unique), studentId, invoiceId, receiptNumber (unique), pdfPath, initiatedBy (student/admin), verifiedByUserId, amount, paymentMode, transactionRefId, paymentDate, issuedAt

### Expense & Payroll Models

#### Expense
- **Fields:** tenantId, category (ref: ExpenseCategory), title, description, amount, expenseDate, paymentMethod (enum: Cash/Bank Transfer/UPI/Cheque/Card), paymentReference, receiptUrl, addedBy (ref: User), approvedBy, status (enum: Pending/Approved/Rejected), rejectionReason, academicYear, isDeleted

#### ExpenseCategory
- **Fields:** tenantId, name, icon (default 'Receipt'), color (default '#3EC4B1'), isActive
- **Indexes:** tenantId+name (unique)

#### ExpenseBudget
- **Fields:** tenantId, category (ref: ExpenseCategory), month, year, budgetAmount
- **Indexes:** tenantId+category+month+year (unique)

#### Payroll
- **Fields:** tenantId, employeeId (ref: User), month, year, baseSalary, bonuses, otherDeductions, advanceDeductions[]{advanceId, amount, deductedAt}, totalAdvanceDeduction, leaveDays, leaveDeduction, netSalary, paymentStatus (enum: pending/paid/cancelled), paymentDate, paymentMethod, paymentReference, notes, generatedBy (ref: User), isDeleted
- **Indexes:** employeeId+month+year+tenantId (unique)
- **Hooks:** Pre-save calculates netSalary

#### AdvanceSalary
- **Fields:** tenantId, employeeId (ref: User), amount, requestDate, reason, status (enum: pending/approved/rejected), approvedBy, deductionStatus (enum: pending/partial/deducted), amountDeducted, remainingAmount, deductions[], notes, createdBy

### Transport Models

#### Route
- **Fields:** tenantId, routeId, routeName, routeCode (uppercase), stops[]{stopName, stopOrder, pickupTime, dropTime, landmark, latitude, longitude}, assignedVehicle (ref: Vehicle), assignedDriver (ref: Driver), distance, estimatedDuration, monthlyFee, isActive, notes
- **Indexes:** tenantId+routeId (unique), tenantId+routeName (unique)
- **Validation:** Minimum 2 stops, unique stop orders

#### Vehicle
- **Fields:** tenantId, vehicleId, vehicleNumber (uppercase), vehicleType (enum: Bus/Van/Car/Auto/Tempo/Other), model, manufacturingYear, color, capacity, fuelType (enum: Petrol/Diesel/CNG/Electric/Hybrid/Other), insuranceNumber, insuranceExpiry, fitnessExpiry, pollutionExpiry, assignedDriver (ref: Driver), photo, documents[], lastMaintenanceDate, nextMaintenanceDate, isActive, notes
- **Indexes:** tenantId+vehicleId (unique), tenantId+vehicleNumber (unique)

#### Driver
- **Fields:** tenantId, driverId, name, phone, email, licenseNumber (uppercase), licenseExpiry, licenseType (enum: LMV/HMV/MCWG/MCWOG/Other), dateOfBirth, gender, bloodGroup, address, nationalId, dateOfJoining, salary, experience, emergencyContact{}, photo, documents[], isActive, notes
- **Indexes:** tenantId+driverId (unique), tenantId+phone (unique), tenantId+licenseNumber (unique)

#### StudentTransportAssignment
- **Fields:** tenantId, student (ref: User), route (ref: Route), stop, transportType (enum: Both/Pickup Only/Drop Only), academicYear, monthlyFee, startDate, endDate, isActive, notes
- **Indexes:** tenantId+student+academicYear+isActive (unique partial)

### Communication & Notification Models

#### Announcement
- **Fields:** tenantId, createdBy (ref: User), title, message, targetAudience[] (enum: student/teacher/parent/admin/all), targetClasses[] (ref: Class), priority (enum: low/medium/high), expiresAt, isActive, notificationsSent, sentAt

#### Notification
- **Fields:** tenantId, userId (ref: User), title, message, type (enum: info/success/warning/error), category (enum: fee_collection/assignment_submitted/exam_result/etc.), visibility[] (admin/teacher/student/parent), isRead, readAt, isDeleted, deletedAt, actionUrl, actionLabel, metadata, channels{inApp, email, whatsapp}
- **Statics:** getUnreadCount(), getRecentNotifications(), markAllAsRead()

#### NotificationPreference
- **Fields:** tenantId, userId (ref: User), preferences{admission, fee, academic, attendance, employee, exam, announcement, system — each with inApp, email, whatsapp booleans}
- **Indexes:** userId+tenantId (unique)

#### PlatformAnnouncement
- **Fields:** title, body (HTML), targetType (enum: all/selected/plan_based), targetTenants[], targetPlans[], channels{inApp, email, sms}, attachments[], scheduledAt, sentAt, status (enum: draft/scheduled/sent/cancelled), createdBy (ref: SuperAdmin), deliveryStats

### Certificate Models

#### CertificateTemplate
- **Fields:** tenantId, type (enum: TC/BONAFIDE), name, headerText, declarationText, footerText, logoPosition (enum: LEFT/CENTER/RIGHT/NONE), isActive

#### GeneratedCertificate
- **Fields:** tenantId, student (ref: User), type (enum: TC/BONAFIDE), certificateNumber, academicYear, issueDate, issuedBy (ref: User), status (enum: ACTIVE/CANCELLED), contentSnapshot, remarks
- **Indexes:** tenantId+certificateNumber (unique)

### Timetable Models

#### TimetableTemplate
- **Fields:** tenantId, name, description, academicSessionId, status (enum: draft/published/archived), effectiveFrom, effectiveTo, workingDays[], createdBy, publishedAt, publishedBy, version, duplicatedFrom

#### TimetableEntry
- **Fields:** tenantId, templateId (ref: TimetableTemplate), dayOfWeek (enum: monday-sunday), timingSlotId (ref: SchoolTiming), classId (ref: Class), sectionId (ref: Section), subjectId (ref: Subject), teacherId (ref: User), roomId (ref: Room), isManual, lockedByUser
- **Indexes:** tenantId+templateId+dayOfWeek+timingSlotId+classId+sectionId (unique), tenantId+templateId+dayOfWeek+timingSlotId+teacherId (unique)

#### SchoolTiming
- **Fields:** tenantId, templateId (ref: TimetableTemplate), slotNumber, label, startTime, endTime, type (enum: period/break/lunch/assembly/activity), isActive
- **Indexes:** tenantId+templateId+slotNumber (unique)

#### Substitution
- **Fields:** tenantId, date, originalEntryId (ref: TimetableEntry), absentTeacherId (ref: User), substituteTeacherId, substituteSubjectId, reason (enum: sick/personal/official/training/other), reasonNote, status (enum: pending/assigned/completed/cancelled), notifiedAt, createdBy

#### TimetableOverride
- **Fields:** tenantId, templateId, date, type (enum: holiday/half_day/exam_day/special_schedule/cancelled), title, description, activeSlots[], overrideEntries[], appliesTo (enum: all/specific_classes), specificClasses[]

#### Room
- **Fields:** tenantId, name, code (uppercase), type (enum: classroom/lab/auditorium/library/sports/other), building, floor, capacity, facilities[], isActive

#### SubjectAllocation
- **Fields:** tenantId, templateId, classId, sectionId, subjectId, teacherId, periodsPerWeek, preferConsecutive, consecutiveCount, preferredRoomType, isActive

#### TeacherConstraint
- **Fields:** tenantId, templateId, teacherId, type (enum: unavailable/preferred/maxPeriodsPerDay/maxConsecutive/noFirstPeriod/noLastPeriod), dayOfWeek, timingSlotId, value, reason, priority

### Admission Model

#### Admission
- **Fields:** applicationNumber (unique, auto-generated), student (ref: User), personalInfo{firstName, lastName, dateOfBirth, gender, bloodGroup, nationality}, contactInfo{email, phone, address{}}, guardianInfo{fatherName, fatherOccupation, fatherPhone, motherName, motherOccupation, motherPhone, guardianRelation, emergencyContact{}}, academicInfo{classApplied, previousSchool, previousClass, previousMarks, previousBoard, subjects[], extraCurricular[]}, documents{photo, birthCertificate, previousMarksheet, transferCertificate, aadharCard, otherDocuments[]}, status (enum: pending/under_review/approved/rejected/waitlisted), reviewInfo{}, admissionInfo{}, additionalInfo{medicalConditions, allergies, transportRequired, hostelRequired, specialNeeds}, timeline[]

### Platform & Super Admin Models

#### Settings (per-tenant)
- **Fields:** tenantId (unique), institution{name, tagline, udiseCode, board, affiliationNumber, schoolCode, address, contact, logo, principalSignature, establishedYear}, grading{rules[]}, bankAccounts[], rulesAndRegulations{}, account{timezone, dateFormat, timeFormat}, currency{}, academic{currentYear, terms[], classes[], subjects[]}, fees{lateFeePercentage, gracePeriod, autoGenerate, feeStructure[]}, notifications{email, sms, dashboard}, system{maintenanceMode, maxFileSize, allowedFileTypes, sessionTimeout, passwordPolicy}, theme{}, backup{}

#### PlatformSettings (singleton)
- **Fields:** general{platformName, tagline, logo, favicon, primaryDomain, supportEmail, supportPhone, socialLinks}, branding{}, academics{}, email{provider, host, port, secure, username, password (hidden)}, sms{}, payment{gateway (razorpay/stripe/payu/instamojo/none)}, storage{provider (cloudinary/aws_s3/gcs/local)}, localization{}, maintenance{}, legal{}

#### SubscriptionPlan
- **Fields:** name, slug (unique), description, price{monthly, yearly, custom}, billingCycle, limits{students, teachers, admins, storage, smsCredits, emailCredits}, modules[], features{customBranding, prioritySupport, apiAccess, whiteLabel, advancedAnalytics, csvImport, customReports}, isPopular, sortOrder, isActive, subscriberCount

#### PlatformInvoice
- **Fields:** invoiceNumber (unique), tenantId, planId, amount, tax, discount, totalAmount, currency (INR), billingPeriod{start, end}, status (enum: draft/sent/paid/overdue/cancelled/refunded/partially_refunded), dueDate, paidAt, paymentMethod, transactionId, razorpayOrderId, razorpayPaymentId, refundAmount, refundReason

#### SuperAdminAuditLog
- **Fields:** superAdminId, action, targetType (enum: Tenant/User/SuperAdmin), targetId, changes, ip, timestamp
- **TTL Index:** 2 years auto-expiry

#### SupportTicket
- **Fields:** ticketNumber (unique, auto-generated), tenantId, createdBy (ref: User), subject, description, category (enum: billing/technical/feature_request/general/data_request/account), priority (enum: low/medium/high/critical), status (enum: open/in_progress/waiting_on_customer/resolved/closed), assignedTo (ref: SuperAdmin), messages[]{sender, senderName, message, attachments, isInternal}, firstResponseAt, resolvedAt, closedAt, tags[]

### Other Models

#### Family
- **Fields:** tenantId, familyCode (auto-generated), primaryGuardian{name, phone, email, relation, occupation, income}, secondaryGuardian{}, address{}, students[] (ref: User), totalSiblings, isActive

#### Counter
- **Fields:** name, year, sequence, tenantId
- **Methods:** getNextSequence(), formatAdmissionNumber(), formatReceiptNumber()

#### Coupon
- **Fields:** code (unique, uppercase), description, discountType (percentage/flat), discountValue, validFrom, validUntil, maxUsageCount, currentUsageCount, applicablePlans[], specificTenants[], isActive, createdBy (ref: SuperAdmin)

#### EmailTemplate
- **Fields:** name, slug (unique), subject, body (HTML with {{variable}} placeholders), type (enum: welcome/trial_expiry/payment_receipt/payment_overdue/password_reset/account_suspended/account_activated/maintenance/feature_update/newsletter/custom), variables[], isActive, lastEditedBy

#### KnowledgeBaseArticle
- **Fields:** title, slug (unique), body (HTML), category (enum: getting_started/billing/features/troubleshooting/faq/api/integrations), tags[], videoUrl, isPublished, sortOrder, viewCount, createdBy (ref: SuperAdmin)

#### BackupLog
- **Fields:** tenantId, performedBy (ref: User), filename, sizeBytes, collectionsCount, documentsCount, status (success/failed), errorMessage, type (manual/scheduled), driveFileId, storageLocation (local/google_drive)

#### StudentClassHistory
- **Fields:** tenantId, studentId (ref: User), fromClass, fromSection, toClass, toSection, academicYear, actionType (enum: promoted/demoted/admitted/transferred), performedBy (ref: User), remarks

#### StudentList
- **Fields:** name, description, students[] (ref: User), tenantId, createdBy (ref: User)

#### SubDepartment
- **Fields:** tenantId, name (uppercase), description, isActive

---

## 4. API Structure

### Auth Routes (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user within tenant (admin only) |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current authenticated user |
| PUT | `/api/auth/profile` | Update user profile |
| PUT | `/api/auth/password` | Change password |
| POST | `/api/auth/upload-photo` | Upload profile photo |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/forgot-password` | Initiate password reset |
| PUT | `/api/auth/reset-password` | Reset password with token |

### Super Admin Auth (`/api/super-admin/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/super-admin/auth/login` | Super admin login (rate limited: 5/15min) |

### Student Routes (`/api/students`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | Get all students (paginated, filtered) |
| POST | `/api/students` | Create new student (admin) |
| GET | `/api/students/:id` | Get single student |
| PUT | `/api/students/:id` | Update student (admin) |
| DELETE | `/api/students/:id` | Delete/deactivate student (admin) |
| GET | `/api/students/import/template` | Download CSV template (admin) |
| POST | `/api/students/import/preview` | Preview CSV import (admin) |
| POST | `/api/students/import/execute` | Execute bulk import (admin) |
| GET | `/api/students/export` | Export students to CSV (admin) |
| GET | `/api/students/filters` | Get filter options (admin) |

### Teacher Routes (`/api/teachers`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teachers` | Get all teachers (admin) |
| POST | `/api/teachers` | Create teacher (admin) |
| PUT | `/api/teachers/:id` | Update teacher (admin) |
| DELETE | `/api/teachers/:id` | Delete teacher (admin) |
| GET | `/api/teachers/my-classes` | Get teacher's assigned classes (teacher) |

### Employee Routes (`/api/employees`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | Get all employees (admin, teacher) |
| GET | `/api/employees/filters` | Get filter options (admin) |
| GET | `/api/employees/:id` | Get single employee |
| POST | `/api/employees` | Create employee (admin) |
| PUT | `/api/employees/:id` | Update employee (admin) |
| DELETE | `/api/employees/:id` | Soft delete employee (admin) |
| PUT | `/api/employees/:id/toggle-status` | Toggle active status (admin) |
| PUT | `/api/employees/:id/reset-password` | Reset password (admin) |
| POST | `/api/employees/:id/create-login` | Create login credentials (admin) |
| PUT | `/api/employees/:id/disable-login` | Disable login (admin) |
| GET | `/api/employees/:id/leave-balance` | Get leave balance |
| PATCH | `/api/employees/:id/leave-balance` | Update leave balance (admin) |
| GET | `/api/employees/import/template` | Download CSV template (admin) |
| POST | `/api/employees/import/preview` | Preview import (admin) |
| POST | `/api/employees/import/execute` | Execute import (admin) |
| GET | `/api/employees/export` | Export to CSV (admin) |
| POST | `/api/employees/:id/upload-photo` | Upload photo (admin) |

### Academic Routes

#### Classes (`/api/classes`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/classes` | Get all classes with sections & counts |
| GET | `/api/classes/:id` | Get single class with sections |

#### Subjects (`/api/subjects`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subjects` | Get all subjects |
| GET | `/api/subjects/:id` | Get single subject |
| POST | `/api/subjects` | Create subject (admin) |

#### Academic Sessions (`/api/academic-sessions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/academic-sessions` | Get all sessions (admin, teacher) |
| GET | `/api/academic-sessions/active` | Get active session |
| GET | `/api/academic-sessions/:id` | Get single session |
| POST | `/api/academic-sessions` | Create session (admin) |
| PUT | `/api/academic-sessions/:id` | Update session (admin) |
| PUT | `/api/academic-sessions/:id/activate` | Activate session (admin) |
| PUT | `/api/academic-sessions/:id/lock` | Lock/unlock session (admin) |
| DELETE | `/api/academic-sessions/:id` | Delete session (admin) |

### Attendance Routes (`/api/attendance`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance` | Get attendance records (paginated) |
| GET | `/api/attendance/stats` | Get attendance statistics |
| POST | `/api/attendance` | Mark attendance (admin, teacher) |
| PUT | `/api/attendance/:id` | Update attendance (admin, teacher) |
| DELETE | `/api/attendance/:id` | Delete attendance (admin) |
| GET | `/api/attendance/report/:studentId` | Get student attendance report |
| GET | `/api/attendance/settings` | Get attendance settings (admin) |
| PUT | `/api/attendance/settings` | Update attendance settings (admin) |

### Homework Routes (`/api/homework`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/homework` | Create homework (teacher, admin) |
| GET | `/api/homework` | Get homework list (role-filtered) |
| GET | `/api/homework/stats` | Get homework statistics |
| GET | `/api/homework/my-submissions` | Get student submissions (student) |
| GET | `/api/homework/:id` | Get homework by ID |

### Assignment Routes (`/api/assignments`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assignments/stats/overview` | Get assignment statistics |
| GET | `/api/assignments/upcoming/list` | Get upcoming assignments |
| GET | `/api/assignments` | Get all assignments (role-based) |
| GET | `/api/assignments/:id` | Get single assignment |
| POST | `/api/assignments` | Create assignment (admin, teacher) |
| PUT | `/api/assignments/:id` | Update assignment (admin, teacher) |
| DELETE | `/api/assignments/:id` | Delete assignment (admin, teacher) |

### Exam Routes (`/api/exams`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/exams` | Get all exams (role-based) |
| POST | `/api/exams` | Create exam (admin, teacher) |
| GET | `/api/exams/:id` | Get single exam |
| PUT | `/api/exams/:id` | Update exam (admin, teacher) |
| DELETE | `/api/exams/:id` | Delete exam (admin, teacher) |

### Fee Routes (`/api/fees`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fees` | Get all fees (paginated, filtered) |
| GET | `/api/fees/statistics` | Get fee statistics |
| GET | `/api/fees/overdue` | Get overdue fees |
| GET | `/api/fees/:id` | Get single fee |
| POST | `/api/fees` | Create fee (admin, teacher) |
| PUT | `/api/fees/:id` | Update fee (admin, teacher) |
| PUT | `/api/fees/:id/pay` | Mark fee as paid (admin, teacher) |
| POST | `/api/fees/:id/remind` | Send fee reminder (admin, teacher) |
| DELETE | `/api/fees/:id` | Delete fee (admin) |

### Payment Routes (`/api/payments`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/plans` | Get subscription plans (public) |
| POST | `/api/payments/create-order` | Create Razorpay order (admin) |

### Payroll Routes (`/api/payroll`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payroll` | Get payroll records (admin) |
| GET | `/api/payroll/:id` | Get single payroll record (admin) |
| POST | `/api/payroll/generate` | Generate monthly payroll (admin) |

### Expense Routes (`/api/expenses`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | Get expenses (admin) |
| POST | `/api/expenses` | Create expense (admin) |
| PUT | `/api/expenses/:id` | Update expense (admin) |
| DELETE | `/api/expenses/:id` | Delete expense (admin) |

### Transport Routes

#### Routes (`/api/transport/routes`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transport/routes` | Get all routes (admin) |
| POST | `/api/transport/routes` | Create route (admin) |
| GET | `/api/transport/routes/:id` | Get single route (admin) |
| PUT | `/api/transport/routes/:id` | Update route (admin) |
| DELETE | `/api/transport/routes/:id` | Delete route (admin) |
| GET | `/api/transport/routes/export` | Export routes to CSV (admin) |

#### Vehicles (`/api/vehicles`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vehicles` | Get all vehicles (admin) |
| POST | `/api/vehicles` | Create vehicle (admin) |
| GET | `/api/vehicles/:id` | Get single vehicle (admin) |
| PUT | `/api/vehicles/:id` | Update vehicle (admin) |
| DELETE | `/api/vehicles/:id` | Delete vehicle (admin) |
| GET | `/api/vehicles/export` | Export vehicles to CSV (admin) |

#### Drivers (`/api/drivers`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drivers` | Get all drivers (admin) |
| POST | `/api/drivers` | Create driver (admin) |
| GET | `/api/drivers/:id` | Get single driver (admin) |
| PUT | `/api/drivers/:id` | Update driver (admin) |
| DELETE | `/api/drivers/:id` | Delete driver (admin) |
| GET | `/api/drivers/expiring/licenses` | Get drivers with expiring licenses (admin) |
| GET | `/api/drivers/export` | Export drivers to CSV (admin) |

#### Student Transport (`/api/student-transport`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student-transport` | Get assignments (admin) |
| POST | `/api/student-transport` | Create assignment (admin) |
| GET | `/api/student-transport/:id` | Get single assignment (admin) |
| PUT | `/api/student-transport/:id` | Update assignment (admin) |
| DELETE | `/api/student-transport/:id` | Delete assignment (admin) |
| GET | `/api/student-transport/export` | Export assignments to CSV (admin) |

### Notification Routes (`/api/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications (paginated) |
| GET | `/api/notifications/unread-count` | Get unread count |
| PATCH | `/api/notifications/mark-all-read` | Mark all as read |

### Timetable Routes (`/api/timetable`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/timetable/templates` | Get all templates |
| POST | `/api/timetable/templates` | Create template |
| GET | `/api/timetable/templates/:id` | Get template |
| PUT | `/api/timetable/templates/:id` | Update template |
| DELETE | `/api/timetable/templates/:id` | Delete template |
| — | `/api/timetable/rooms` | Room management sub-router |
| — | `/api/timetable/substitutions` | Substitution sub-router |
| — | `/api/timetable/overrides` | Override sub-router |
| — | `/api/timetable/view` | View sub-router |

### Certificate Routes (`/api/certificates`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| — | Routes for generating, managing, and downloading certificates | (admin, teacher) |

### Report Routes (`/api/reports`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/dashboard` | Get dashboard statistics |

### Tenant/School Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tenants/register` | Register new school/tenant (public) |
| POST | `/api/schools/register` | Register school (public) |

### File Routes (`/api/files`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/signed-url` | Get signed URL for private files |
| POST | `/api/files/upload` | Upload file (generic) |

### Health & Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API info & status |
| GET | `/health` | Extended health check (DB, email) |
| GET | `/healthz` | Simple 200 OK health check |

---

## 5. Authentication Flow

### Login Flow (Step by Step)
1. User submits email + password + school code to `POST /api/auth/login`
2. Backend resolves tenant from school code (via `getTenantFromRequest` middleware)
3. Backend finds user by email within the tenant (`tenantId` filter)
4. Backend compares password hash using `bcryptjs.compare()` (12 salt rounds)
5. If valid, JWT token is generated with payload: `{ id: user._id }` using HS256
6. Token is sent in:
   - HTTP response body (`{ token, user }`)
   - HTTP-only cookie (name: `token`, httpOnly: true, secure in production)
7. Frontend stores token in `localStorage` (key: `token`) and user data (key: `user`)
8. AuthContext updates state: `isAuthenticated = true`, `user = {...}`, `token = "..."`

### Token Storage & Transmission
- **Storage:** `localStorage` (token + user object)
- **Header:** `Authorization: Bearer <token>`
- **Fallback:** `?token=<token>` query parameter (for file downloads/exports)
- **Cookie:** HTTP-only cookie named `token` (backup)

### Role-Based Access Control
- JWT `protect` middleware verifies token and attaches `req.user`
- `authorize('admin', 'teacher')` middleware checks `req.user.role` against allowed roles
- Frontend `ProtectedRoute` component checks `allowedRoles` prop against user role
- If role not permitted: backend returns 403, frontend redirects to `/app/dashboard`

### Roles
| Role | Description |
|------|-------------|
| `admin` | School administrator — full access |
| `teacher` | Teacher — class/subject-scoped access |
| `student` | Student — own data access |
| `parent` | Parent — children's data access |
| `accountant` | Financial access |
| `staff` | General staff |
| `librarian` | Library access |
| `driver` | Transport driver |
| `support_staff` | Support role |
| `principal` | School principal |
| `vice_principal` | Vice principal |
| `superadmin` | Platform super admin (separate auth system) |

### Multi-Tenant Strategy
1. **Tenant resolution** (priority order):
   - Subdomain extraction (e.g., `schoolname.mysms.com`)
   - School code from request body/query
   - Tenant ID from JWT token
2. **Tenant caching:** 10-minute TTL in node-cache
3. **Subscription validation:** Checks active/trial/suspended status
4. **Query filtering:** `addTenantFilter()` middleware auto-adds `tenantId` to all queries
5. **User isolation:** Users belong to exactly one tenant (except superadmin)

### Logout Flow
1. Frontend calls `POST /api/auth/logout`
2. Backend clears the `token` cookie
3. Frontend removes `token` and `user` from localStorage
4. AuthContext resets: `isAuthenticated = false`, `user = null`, `token = null`
5. Router redirects to `/login`

### Token Refresh
- **No token refresh mechanism implemented**
- Token has 7-day expiry (configurable)
- On expiry, user must re-login
- Frontend checks auth on app load via `GET /api/auth/me`

### Super Admin Auth (Separate System)
- Uses separate JWT secret (`SUPER_ADMIN_JWT_SECRET`)
- Token payload includes `{ id, role: 'superadmin', email }`
- 24-hour expiry (hardcoded)
- Stored in separate localStorage keys (`superAdminToken`, `superAdmin`)
- Managed by `SuperAdminContext` (independent from `AuthContext`)

---

## 6. Frontend Routing Structure

### Public Routes (No Authentication)
| Path | Component | Description |
|------|-----------|-------------|
| `/` | Landing | Public landing page |
| `/login` | Login | User login |
| `/register` | Register | School registration |
| `/forgot-password` | ForgotPassword | Password recovery |
| `/reset-password` | ResetPassword | Password reset with token |
| `/super-admin-login` | SuperAdminLogin | Super admin login |

### Admin Routes (role: admin)
| Path | Component | Description |
|------|-----------|-------------|
| `/app/dashboard` | Dashboard | Admin dashboard with KPIs |
| `/app/students` | Students | Student directory |
| `/app/students/bulk-promote` | BulkPromotion | Bulk student promotion |
| `/app/students/:id` | StudentDetail | Student profile |
| `/app/student-lists` | StudentLists | Custom student groups |
| `/app/employees` | Employees | Employee management |
| `/app/employees/:id` | EmployeeDetail | Employee profile |
| `/app/teachers` | Teachers | Teacher management |
| `/app/academics` | Academics | Academic management |
| `/app/classes` | Classes | Class management |
| `/app/classes/:id` | ClassDetail | Class details |
| `/app/attendance` | Attendance | Attendance management |
| `/app/homework` | Homework | Homework tracking |
| `/app/assignments` | Assignments | Assignment management |
| `/app/exams` | Exams | Exam management |
| `/app/timetable` | TimetableSchedule | View timetable |
| `/app/timetable/builder` | TimetableBuilder | Build timetable (admin only) |
| `/app/timetable/substitutions` | Substitutions | Manage substitutions |
| `/app/timetable/special-days` | SpecialDays | Special day overrides (admin only) |
| `/app/fees-finance` | FeesFinance | Finance dashboard |
| `/app/fees` | Fees | Fee management |
| `/app/expenses` | Expenses | Expense tracking (admin only) |
| `/app/payroll` | Payroll | Payroll management (admin only) |
| `/app/transport` | Transport | Transport management (admin only) |
| `/app/certificates` | CertificateManager | Certificate management |
| `/app/certificates/generate` | CertificateGeneration | Generate certificates |
| `/app/certificates/templates` | TemplateSettings | Certificate templates (admin only) |
| `/app/communication` | Communication | Communication hub |
| `/app/reports` | Reports | Reports & analytics |
| `/app/admissions` | Admissions | Admission management (admin only) |
| `/app/activities` | Activities | Activity logs |
| `/app/settings` | Settings | School settings (admin only) |
| `/app/announcements` | Announcements | Announcements |
| `/app/notifications` | Notifications | Notification center |
| `/app/notification-preferences` | NotificationPreferences | Notification settings |
| `/app/search` | Search | Global search |
| `/app/profile` | Profile | User profile |

### Teacher Routes (role: teacher)
| Path | Component | Description |
|------|-----------|-------------|
| `/app/dashboard` | Dashboard | Teacher dashboard |
| `/app/students` | Students | View students |
| `/app/student-lists` | StudentLists | View student lists |
| `/app/students/:id` | StudentDetail | View student profile |
| `/app/academics` | TeacherAcademics | Teacher academic view |
| `/app/classes` | Classes | View assigned classes |
| `/app/classes/:id` | ClassDetail | View class |
| `/app/attendance` | Attendance | Mark/view attendance |
| `/app/homework` | Homework | Create/manage homework |
| `/app/assignments` | Assignments | Create/manage assignments |
| `/app/exams` | TeacherExams | Manage exams |
| `/app/timetable` | TimetableSchedule | View timetable |
| `/app/timetable/substitutions` | Substitutions | Manage substitutions |
| `/app/certificates` | TeacherCertificates | Generate certificates |
| `/app/certificates/generate` | CertificateGeneration | Certificate generation |
| `/app/communication` | TeacherCommunication | Teacher communication |
| `/app/reports` | TeacherReports | Teacher reports |
| `/app/activities` | Activities | Activity logs |
| `/app/announcements` | Announcements | View announcements |
| `/app/notifications` | Notifications | Notifications |
| `/app/profile` | Profile | Profile |

### Student Routes (role: student)
| Path | Component | Description |
|------|-----------|-------------|
| `/app/dashboard` | Dashboard | Student dashboard |
| `/app/attendance` | Attendance | View attendance |
| `/app/attendance/student/:studentId` | StudentAttendanceView | Detailed attendance |
| `/app/homework` | Homework | View/submit homework |
| `/app/assignments` | Assignments | View assignments |
| `/app/exams` | Exams | View exams & results |
| `/app/student/fees` | StudentFeesDashboard | View & pay fees |
| `/app/timetable` | TimetableSchedule | View timetable |
| `/app/announcements` | Announcements | View announcements |
| `/app/notifications` | Notifications | Notifications |
| `/app/notification-preferences` | NotificationPreferences | Notification settings |
| `/app/profile` | Profile | Profile |

### Parent Routes (role: parent)
| Path | Component | Description |
|------|-----------|-------------|
| `/app/dashboard` | Dashboard | Parent dashboard |
| `/app/students` | Students | View children |
| `/app/students/:id` | StudentDetail | View child details |
| `/app/attendance` | Attendance | View children's attendance |
| `/app/student/fees` | StudentFeesDashboard | View children's fees |
| `/app/announcements` | Announcements | View announcements |
| `/app/notifications` | Notifications | Notifications |
| `/app/profile` | Profile | Profile |

### Super Admin Routes
| Path | Component | Description |
|------|-----------|-------------|
| `/super-admin/dashboard` | SuperAdminDashboard | Platform metrics |
| `/super-admin/schools` | SuperAdminTenants | Tenant management |
| `/super-admin/users` | SuperAdminUsers | Global user management |
| `/super-admin/plans` | SuperAdminPlans | Subscription plans |
| `/super-admin/billing` | SuperAdminBilling | Billing & payments |
| `/super-admin/modules` | SuperAdminModules | Feature modules |
| `/super-admin/communication` | SuperAdminCommunication | Platform messaging |
| `/super-admin/support` | SuperAdminSupport | Support tickets |
| `/super-admin/reports` | SuperAdminReports | Platform analytics |
| `/super-admin/audit-log` | SuperAdminAuditLog | System audit trail |
| `/super-admin/settings` | SuperAdminSettings | Platform settings |
| `/super-admin/system` | SuperAdminSystem | System configuration |

---

## 7. Feature List by Section

### Admin Panel

**Dashboard:**
- KPI cards (total students, teachers, fee collection, pending fees)
- Enrollment trends chart
- Recent activities feed
- Quick action buttons
- Auto-refresh on tab visibility change

**Students:**
- Student directory with search, filter (class, section, status)
- Add/edit/deactivate students
- Student detail profile with academic history
- Bulk CSV import (template download, preview, execute)
- CSV export with column selection
- Student lists (custom groupings)
- Bulk promotion between classes
- Guardian information management
- Medical records, transport mode

**Employees:**
- Employee directory with search, filter (department, role, status)
- Add/edit/soft-delete employees
- Employee detail with all fields
- Login creation/disable for employees
- Password reset
- Leave balance management
- Photo upload (Cloudinary)
- Bulk CSV import/export
- Status toggle (active/inactive)

**Teachers:**
- Teacher list with class assignments
- Assign subjects & classes
- Qualification tracking

**Academics:**
- Academic session management (create, activate, lock)
- Class management with sections
- Subject management (code, type, marks)
- Class-subject allocation
- Teacher-subject assignments
- Class detail with student roster

**Attendance:**
- Bulk student attendance marking per class
- Employee attendance marking
- Attendance analytics & statistics
- Monthly attendance reports
- Student-specific attendance view
- Holiday management (public, school, exam, vacation)
- Attendance settings (working days, thresholds, auto-absent)
- Absentee tracking
- Past attendance editing (configurable days)

**Homework:**
- Create homework with attachments
- Assign to class/section
- Due date tracking
- View student submissions
- Statistics overview

**Assignments:**
- Create assignments with marks, instructions, attachments
- Assign to class or specific students
- Track submissions
- Statistics dashboard
- Upcoming assignments list

**Exams & Results:**
- Create exams (name, series, type, mode, room, supervisor)
- Schedule management
- Result entry per student
- Grade calculation
- Publish/unpublish results
- Performance analytics

**Timetable:**
- Template-based timetable system
- Visual timetable builder (drag & drop)
- Room management
- School timing slots (periods, breaks, lunch)
- Subject allocation with teacher constraints
- Substitution management
- Special day overrides (holidays, half-days, exam days)
- Auto-generation with constraint solving
- Export to PDF/Excel

**Fees & Finance:**
- Fee structure management (per class, per session)
- Fee heads with frequency (monthly, quarterly, annual, one-time)
- Invoice generation (individual & bulk)
- Billing period selection
- Payment recording (cash, bank, UPI, cheque, card, online)
- Payment confirmation & reversal
- Late fee configuration (fixed/percentage with grace period)
- Overdue fee tracking
- Fee reminders (email)
- Student balance tracking
- Fee statistics & analytics
- Receipt generation (PDF)
- Discount management
- Fee audit log

**Expenses:**
- Expense categories with icons & colors
- Add/edit/delete expenses
- Expense approval workflow (pending → approved/rejected)
- Monthly budget management per category
- Payment method tracking
- Receipt upload
- Academic year filtering

**Payroll:**
- Monthly payroll generation
- Base salary, bonuses, deductions calculation
- Leave deduction (based on attendance)
- Advance salary management (request, approve, deduct)
- Payment status tracking
- Payment method & reference
- Payroll PDF generation
- Payroll detail modal
- Edit payroll entries

**Transport:**
- Route management (stops with pickup/drop times, GPS coordinates)
- Vehicle management (registration, insurance, fitness, pollution expiry tracking)
- Driver management (license tracking, expiry alerts)
- Student-route assignments
- Monthly fee per route
- CSV export for all transport entities
- Active/inactive management
- Document upload

**Certificates:**
- Certificate template management (TC, Bonafide)
- Certificate generation with student data snapshot
- Certificate number tracking
- Issue date & issued-by tracking
- Cancel/reissue certificates
- Template customization (header, declaration, footer, logo position)

**Communication:**
- Create announcements targeting specific audiences (students, teachers, parents, admin, all)
- Target specific classes
- Priority levels (low, medium, high)
- Expiry dates
- Notification delivery tracking

**Reports:**
- Dashboard statistics
- Fee collection reports
- Attendance reports
- Class-wise analytics

**Settings:**
- Institute profile (name, UDISE, board, affiliation, logo, signature)
- Currency configuration
- Grading rules (grade name, percentage range, pass/fail)
- Bank accounts management
- Rules & regulations editor
- Theme & language settings
- Account settings (timezone, date/time format)
- Sub-department management
- Password policy configuration
- Backup & restore (manual + scheduled to Google Drive)
- Maintenance mode toggle

**Admissions:**
- Application form with multi-step data collection
- Application status workflow (pending → under_review → approved/rejected/waitlisted)
- Document upload (photo, birth cert, marksheet, transfer cert, Aadhar)
- Timeline tracking
- Statistics dashboard

### Teacher Panel

**Dashboard:**
- My students count
- Today's attendance status
- Active assignments count
- Pending submissions count

**Academics:**
- View assigned classes & subjects
- Class details with student roster
- Subject-wise view

**Attendance:**
- Mark daily attendance for assigned classes
- View attendance history
- Student attendance reports

**Homework:**
- Create homework with attachments
- View submissions per homework
- Homework statistics

**Assignments:**
- Create/edit/delete assignments
- Track student submissions
- View statistics

**Exams:**
- Create/manage exams for assigned classes
- Enter results
- View student performance

**Certificates:**
- Generate Bonafide/Character/Conduct certificates
- Search students from assigned classes
- Download/print certificates
- View certificate history

**Communication:**
- Create announcements for classes or all-school
- Set priority levels
- View sent announcements

**Reports:**
- Class-specific performance reports
- Attendance reports
- Assignment completion reports

**Timetable:**
- View class timetables
- Manage substitutions for assigned classes

### Student Panel

**Dashboard:**
- Profile completion status
- Pending fees summary
- Active assignments
- Notification count
- Upcoming exams

**Academics:**
- View class timetable
- View homework & submit
- View assignments
- View exam schedule
- View exam results & grades

**Fees:**
- View invoices
- Payment history
- Download receipts
- Raise payment disputes (screenshot, notes)

**Announcements & Notifications:**
- View school announcements
- Notification center
- Notification preferences (per-category)

### Parent Panel

**Dashboard:**
- Children overview
- Pending fees for all children

**Students:**
- View children's profiles
- View per-child academic info

**Academics:**
- Children's attendance
- Children's homework
- Children's assignments
- Children's exam results

**Fees:**
- View invoices for all children
- Payment history
- Download receipts

**Announcements & Notifications:**
- View announcements
- Notification settings

### Super Admin Panel

**Dashboard:**
- Platform-wide metrics (total tenants, users, revenue)
- System health monitoring
- Revenue charts

**Tenant Management:**
- Create/edit school profiles
- Assign subscription plans
- Enable/disable feature modules per tenant
- Tenant billing management
- Tenant settings override

**User Management:**
- Global user directory
- Admin account management
- Account activation/deactivation

**Plans & Billing:**
- Subscription plan CRUD
- Pricing management (monthly/yearly)
- Feature & limit allocation
- Invoice management
- Payment tracking

**Module Management:**
- Enable/disable feature modules globally
- Feature access control per plan

**Communication:**
- Platform-wide announcements
- Target by tenant, plan, or all
- Multi-channel delivery (in-app, email, SMS)
- Scheduled announcements

**Support:**
- Support ticket management
- Ticket routing & assignment
- Internal notes
- Status tracking

**Reports & Audit:**
- Platform analytics
- System audit trail (2-year retention with TTL)
- Revenue reports

**System:**
- Global configuration
- Email template management
- Knowledge base management
- Coupon management
- Maintenance mode
- Legal document management (ToS, privacy, refund policy)

---

## 8. File/Folder Structure

### Backend (`learnovo-backend/`)
```
learnovo-backend/
├── server.js                          # Main entry point (Express app)
├── package.json                       # Dependencies
├── render.yaml                        # Render.com deployment config
├── jest.config.js                     # Test configuration
├── .eslintrc.js                       # ESLint config
├── .lintstagedrc.json                 # Lint-staged config
│
├── middleware/                         # 9 middleware files
│   ├── auth.js                        # JWT & role-based auth
│   ├── errorHandler.js                # Error handling & logging
│   ├── tenant.js                      # Multi-tenant middleware
│   ├── upload.js                      # File upload (5MB)
│   ├── fileUpload.js                  # Import file upload (10MB)
│   ├── validation.js                  # Input validation rules
│   ├── planGate.js                    # Subscription plan gating
│   ├── superAdminAuth.js              # Super admin auth
│   └── timetableValidation.js         # Timetable validation
│
├── models/                            # 71 Mongoose models
│   ├── User.js, Tenant.js, SuperAdmin.js
│   ├── AcademicSession.js, Class.js, Section.js, Subject.js
│   ├── ClassSubject.js, SubjectAllocation.js, TeacherSubjectAssignment.js
│   ├── Attendance.js, EmployeeAttendance.js, AttendanceSettings.js, Holiday.js
│   ├── Assignment.js, Homework.js, HomeworkSubmission.js
│   ├── Exam.js, Result.js
│   ├── Fee.js, FeeStructure.js, FeeInvoice.js, FeeAuditLog.js
│   ├── Payment.js, PaymentAttempt.js, PaymentAuditLog.js, PaymentDispute.js
│   ├── StudentBalance.js, Receipt.js
│   ├── Expense.js, ExpenseCategory.js, ExpenseBudget.js
│   ├── Payroll.js, AdvanceSalary.js
│   ├── Route.js, Vehicle.js, Driver.js, StudentTransportAssignment.js
│   ├── CertificateTemplate.js, GeneratedCertificate.js
│   ├── Announcement.js, Notification.js, NotificationPreference.js
│   ├── TimetableTemplate.js, TimetableEntry.js, TimetableOverride.js
│   ├── SchoolTiming.js, Substitution.js, Room.js, TeacherConstraint.js
│   ├── Admission.js, Family.js, StudentClassHistory.js, StudentList.js
│   ├── Settings.js, PlatformSettings.js, SubDepartment.js
│   ├── SubscriptionPlan.js, PlatformInvoice.js, PlatformAnnouncement.js
│   ├── SuperAdminAuditLog.js, SupportTicket.js
│   ├── EmailTemplate.js, KnowledgeBaseArticle.js
│   ├── Coupon.js, Counter.js, BackupLog.js
│   └── ... (71 total)
│
├── routes/                            # 45+ Express route files
│   ├── auth.js, superAdminAuth.js
│   ├── students.js, teachers.js, employees.js
│   ├── classes.js, subjects.js, classSubjects.js, academicSessions.js
│   ├── attendance.js, homework.js, assignments.js, exams.js
│   ├── fees.js, feeStructures.js, invoices.js, studentFees.js, feesReports.js
│   ├── payments.js, payroll.js, expenses.js
│   ├── transportRoutes.js, vehicles.js, drivers.js, studentTransport.js
│   ├── certificates.js, announcements.js, notifications.js
│   ├── timetable.js, timetableEntries.js, timetableTemplates.js
│   ├── timetableRooms.js, timetableSubstitutions.js, timetableOverrides.js, timetableViews.js
│   ├── admissions.js, settings.js, reports.js, files.js
│   ├── tenants.js, schools.js, superAdmin.js
│   ├── studentLists.js, subDepartments.js, teacherAssignments.js
│   ├── login-creation-routes.js, backup.js, adminDisputes.js, test.js
│   └── ... (45+ total)
│
├── controllers/                       # 1 controller file
│   └── certificateController.js
│
├── services/                          # 22+ service files
│   ├── emailService.js, cloudinaryService.js, googleDriveService.js
│   ├── notificationService.js, announcementService.js
│   ├── homeworkService.js, examService.js, timetableService.js
│   ├── timetableViewService.js, timetableGeneratorService.js, timetableExportService.js
│   ├── paymentService.js, payrollService.js, payrollPdfService.js
│   ├── pdfService.js, receiptPdfService.js
│   ├── studentImportService.js, employeeImportService.js
│   ├── csvImportService.js, importExportService.js, backupService.js
│   └── payment/ (PaymentGateway.js, MockPaymentGateway.js)
│
├── utils/                             # 15 utility files
│   ├── cache.js, pagination.js, currency.js, money.js
│   ├── s3.js, s3Upload.js, s3PresignedUrl.js
│   ├── csvHandler.js, email.js, admissionUtils.js
│   ├── indexes.js, migrationManager.js, planConfig.js
│   └── ...
│
├── jobs/                              # Background jobs
│   ├── reconciliationJob.js           # Payment reconciliation
│   └── backupJob.js                   # Daily backup (2 AM IST)
│
├── scripts/                           # 23 maintenance scripts
│   ├── seedData.js, seedDemoData.js, seedSuperAdmin.js
│   ├── seedAttendanceData.js, seedTimetableData.js
│   ├── migrate.js, checkIndexes.js
│   └── ... (debugging, cleanup, migration scripts)
│
├── templates/                         # Document templates
│   ├── certificates/
│   └── report-cards/
│
├── tests/                             # Test suite
│   ├── unit/ (4 test files)
│   └── integration/ (1 test file)
│
├── uploads/imports/                   # Temp upload directory
├── migrations/                        # Schema migrations
└── .github/workflows/ci-cd.yml       # GitHub Actions CI/CD
```

### Frontend (`learnovo-frontend/`)
```
learnovo-frontend/
├── src/
│   ├── App.jsx                        # Root routing (50+ lazy-loaded routes)
│   ├── main.jsx                       # React entry point
│   ├── index.css                      # Global Tailwind + custom styles
│   │
│   ├── contexts/                      # 5 React Context providers
│   │   ├── AuthContext.jsx            # Auth state & actions
│   │   ├── SuperAdminContext.jsx      # Super admin auth
│   │   ├── SettingsContext.jsx        # School settings
│   │   ├── ThemeContext.jsx           # Light/dark theme
│   │   └── NotificationContext.jsx    # Notifications (polls every 10s)
│   │
│   ├── pages/                         # 83 page components
│   │   ├── Landing.jsx, Login.jsx, Register.jsx
│   │   ├── ForgotPassword.jsx, ResetPassword.jsx
│   │   ├── Dashboard.jsx, Profile.jsx, Search.jsx
│   │   ├── Students.jsx, StudentDetail.jsx, StudentLists.jsx, BulkPromotion.jsx
│   │   ├── Employees.jsx, EmployeeDetail.jsx, Teachers.jsx
│   │   ├── Academics.jsx, Classes.jsx, ClassDetail.jsx
│   │   ├── Attendance.jsx, Homework.jsx, Assignments.jsx, Exams.jsx
│   │   ├── FeesFinance.jsx, Fees.jsx, Expenses.jsx, Payroll.jsx
│   │   ├── Transport.jsx, Communication.jsx, Reports.jsx
│   │   ├── Settings.jsx, Admissions.jsx, Activities.jsx
│   │   ├── Announcements.jsx, Notifications.jsx, NotificationPreferences.jsx
│   │   ├── attendance/ (9 files: Dashboard, Mark, Analytics, Holidays, etc.)
│   │   ├── certificates/ (3 files: Manager, Generation, Templates)
│   │   ├── timetable/ (4 files: Builder, Schedule, Substitutions, SpecialDays)
│   │   ├── teacher/ (5 files: Academics, Exams, Certificates, Communication, Reports)
│   │   ├── student/ (1 file: StudentFeesDashboard)
│   │   ├── admin/ (1 file: AdminPaymentDisputes)
│   │   └── superadmin/ (12 files: Dashboard, Tenants, Users, Plans, etc.)
│   │
│   ├── components/                    # 106 component files
│   │   ├── Layout.jsx, Header.jsx, MobileHeader.jsx, BottomNav.jsx
│   │   ├── ProtectedRoute.jsx, ErrorBoundary.jsx, PageErrorBoundary.jsx
│   │   ├── LoadingSkeleton.jsx, LoadingSpinner.jsx, Button.jsx
│   │   ├── NotificationBell.jsx, NotificationDropdown.jsx, UserAvatar.jsx
│   │   ├── KpiCard.jsx, ChartCard.jsx, SummaryCard.jsx, StatusBadge.jsx
│   │   ├── ClassSelector.jsx, EmptyState.jsx, ModalWrapper.jsx
│   │   ├── ImportModal.jsx, BulkImportModal.jsx, ExportButton.jsx
│   │   ├── ui/ (7: DatePicker, TimePicker, Select, PlaceholderImage, etc.)
│   │   ├── students/ (6: StudentForm, SearchDropdown, ClassAction, etc.)
│   │   ├── employees/ (1: EmployeeForm)
│   │   ├── fees/ (10: FeeStructure, Invoice, Payment, Discount, etc.)
│   │   ├── expenses/ (4: ExpenseForm, BudgetForm, CategoryForm, Detail)
│   │   ├── payroll/ (4: Generate, Edit, Details, AdvanceSalary modals)
│   │   ├── homework/ (3: Form, Details, Submission)
│   │   ├── settings/ (8: Institute, Theme, Account, Bank, Grading, etc.)
│   │   ├── timetable/ (6: Grid, TimeslotCard, TemplateSelector, etc.)
│   │   ├── transport/ (4: RoutesTab, VehiclesTab, DriversTab, AssignmentsTab)
│   │   └── superadmin/ (5: Layout, Header, Sidebar, Route, TenantSlideOver)
│   │
│   ├── services/                      # 23+ API service files
│   │   ├── authService.js, studentsService.js, employeesService.js
│   │   ├── teachersService.js, classesService.js, subjectsService.js
│   │   ├── academicsService.js, attendanceService.js
│   │   ├── homeworkService.js, assignmentsService.js, examsService.js
│   │   ├── feesService.js, studentFeesService.js, expensesService.js
│   │   ├── payrollService.js, transportService.js
│   │   ├── certificateService.js, announcementsService.js
│   │   ├── notificationsService.js, reportsService.js
│   │   ├── settingsService.js, backupService.js
│   │   ├── admissionsService.js, studentListService.js
│   │   ├── timetableService.js, superAdminService.js
│   │   ├── tenantService.js, adminDisputesService.js
│   │   └── ...
│   │
│   ├── hooks/                         # 3 custom hooks
│   │   ├── useClickOutside.js
│   │   ├── useMediaQuery.js
│   │   └── useUserDisplay.js
│   │
│   ├── utils/                         # 6 utility files
│   │   ├── billingPeriod.js, cn.js, exportHelpers.js
│   │   ├── formatCurrency.js, receiptHelpers.js, searchRelevance.js
│   │   └── ...
│   │
│   ├── constants/                     # App constants
│   │   ├── classes.js
│   │   └── config.js
│   │
│   └── lib/
│       └── utils.js
│
├── dist/                              # Production build output
├── public/images/                     # Static images (logos, testimonials)
├── index.html                         # HTML entry point
├── vite.config.js                     # Vite config (port 3000, API proxy)
├── tailwind.config.js                 # Tailwind config (dark mode, custom theme)
├── postcss.config.js                  # PostCSS config
├── vercel.json                        # Vercel deployment config
├── package.json                       # Frontend dependencies
└── .env                               # Environment variables
```

---

## 9. Environment Variables (Names Only)

### Frontend (.env)
| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend API base URL (default: `/api` via Vite proxy) |

### Backend (config.env)

**Server:**
| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | Environment (development/production) |
| `PORT` | Server port (default: 5000) |

**Database:**
| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_TEST_URI` | Test database connection string |

**JWT & Security:**
| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRE` | JWT expiry time (default: 7d) |
| `JWT_COOKIE_EXPIRE` | Cookie expiry in days (default: 7) |
| `SUPER_ADMIN_JWT_SECRET` | Super admin JWT secret |
| `BCRYPT_ROUNDS` | Bcrypt salt rounds |
| `SESSION_SECRET` | Session secret |

**Email:**
| Variable | Purpose |
|----------|---------|
| `EMAIL_HOST` / `SMTP_HOST` | SMTP server hostname |
| `EMAIL_PORT` / `SMTP_PORT` | SMTP server port |
| `EMAIL_SECURE` / `SMTP_SECURE` | Use TLS/SSL |
| `EMAIL_USER` / `SMTP_USER` | SMTP username |
| `EMAIL_PASS` / `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` / `SMTP_FROM` | Sender email address |

**Frontend & CORS:**
| Variable | Purpose |
|----------|---------|
| `FRONTEND_ORIGIN` | Comma-separated allowed origins |
| `FRONTEND_URL` | Frontend URL for email links |

**File Upload:**
| Variable | Purpose |
|----------|---------|
| `MAX_FILE_SIZE` | Maximum upload file size |
| `ALLOWED_FILE_TYPES` | Allowed file extensions |

**Rate Limiting:**
| Variable | Purpose |
|----------|---------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (default: 900000 = 15min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: 1000) |

**Logging:**
| Variable | Purpose |
|----------|---------|
| `LOG_LEVEL` | Logging verbosity |
| `LOG_FORMAT` | Log output format |
| `ENABLE_METRICS` | Enable metrics collection |
| `METRICS_PORT` | Metrics server port |

**Payment Gateways:**
| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `CCAVENUE_MERCHANT_ID` | CCAvenue merchant ID |
| `CCAVENUE_ACCESS_CODE` | CCAvenue access code |
| `CCAVENUE_WORKING_KEY` | CCAvenue working key |

**File Storage:**
| Variable | Purpose |
|----------|---------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `AWS_REGION` | AWS region (default: ap-south-1) |
| `AWS_BUCKET_NAME` | S3 bucket name (default: learnovo-files) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |

**Google Drive Backup:**
| Variable | Purpose |
|----------|---------|
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | OAuth refresh token |
| `GOOGLE_DRIVE_FOLDER_ID` | Backup folder ID |

**Development:**
| Variable | Purpose |
|----------|---------|
| `ENABLE_DEBUG` | Enable debug mode |
| `ENABLE_SWAGGER` | Enable Swagger docs |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `BACKUP_CRON_ENABLED` | Enable daily backup job |

---

## 10. Current Deployment

| Component | Platform | Details |
|-----------|----------|---------|
| **Frontend** | Vercel | URL: `https://learnovoapp.vercel.app` |
| **Backend** | Render.com | Region: Singapore, Plan: free tier |
| **Database** | MongoDB Atlas | Cloud-hosted (connection via `MONGODB_URI`) |
| **Image Storage** | Cloudinary | Tenant-isolated folders |
| **Document Storage** | AWS S3 | Region: ap-south-1, Bucket: learnovo-files |
| **Backup** | Google Drive | Daily at 2 AM IST (optional) |
| **CI/CD** | GitHub Actions | Lint → Audit → Test → Build → Deploy |
| **CDN** | Vercel Edge (built-in) | Static assets cached 1 year (`immutable`) |

**Frontend Deployment Config (vercel.json):**
- SPA rewrite: all routes → `/index.html`
- Asset caching: `Cache-Control: public, max-age=31536000, immutable`
- Framework: Vite

**Backend Deployment Config (render.yaml):**
- Build: `cd learnovo-backend && npm install`
- Start: `cd learnovo-backend && node server.js`
- Auto-deploy on push

---

## 11. Real-Time Features

| Feature | Status |
|---------|--------|
| Socket.io | **Not implemented** |
| WebSockets | **Not implemented** |
| Real-time notifications | **Polling-based** (every 10 seconds via NotificationContext) |
| Live updates | **Not implemented** (uses React Query refetch on window focus) |

**Current approach:** REST API with polling. Notifications poll unread count every 10 seconds when user is authenticated and tab is visible.

---

## 12. Offline/PWA Features

| Feature | Status |
|---------|--------|
| Progressive Web App | **Not configured** |
| Service Worker | **Not present** |
| Web Manifest | **Not present** |
| Offline capability | **None** |
| Push notifications | **Not implemented** |
| Install prompt | **Not available** |

The application is a standard SPA with no offline capabilities.

---

## 13. Media/File Handling

### Photo/Image Upload
- **Method:** Multipart form data via `multer.memoryStorage()` (buffer-based, no disk writes)
- **Processing:** Uploaded to Cloudinary via `cloudinaryService.js`
- **Folder structure:** `learnovo/{tenantId}/{type}/{subPath}`
- **Accepted types:** JPEG, PNG, GIF
- **Max size:** 5 MB

### Document Upload
- **Method:** Multipart form data via multer memory storage
- **Storage:** AWS S3 with pre-signed URLs
- **Key structure:** `documents/{docType}/{schoolId}/{filename}_{timestamp}_{random}`
- **Pre-signed URL expiry:** 1 hour (cached for 50 minutes)
- **Accepted types:** CSV, XLSX, XLS, PDF
- **Max size:** 5-10 MB (depending on endpoint)

### PDF Generation
- **Backend:** PDFKit for programmatic PDFs (receipts, payroll slips)
- **Backend:** Puppeteer for HTML→PDF (certificates, report cards)
- **Frontend:** jsPDF + jspdf-autotable for client-side PDF export
- **Frontend:** html2canvas for screenshot-to-PDF

### Excel/CSV
- **Backend:** ExcelJS and xlsx for reading/writing spreadsheets
- **Backend:** csv-parser and fast-csv for CSV processing
- **Frontend:** xlsx for client-side Excel export

---

## 14. Third Party Integrations

| Service | Provider | Purpose |
|---------|----------|---------|
| **Payment Gateway** | Razorpay | Subscription payments, fee collection |
| **Payment Gateway** | Stripe | Alternative payment (env vars present) |
| **Payment Gateway** | CCAvenue | SP International tenant only |
| **Image Storage** | Cloudinary | Photo/avatar uploads |
| **Object Storage** | AWS S3 | Document storage |
| **Email** | Nodemailer (SMTP) | Transactional emails (Gmail SMTP default) |
| **Backup** | Google Drive API | Daily database backups |
| **Headless Browser** | Puppeteer | HTML→PDF certificate generation |
| **SMS** | **Not integrated** | No SMS provider configured |
| **Maps** | **Not integrated** | GPS coordinates stored but no map rendering |
| **Analytics** | **Not integrated** | No Google Analytics or similar |
| **Error Tracking** | Sentry (optional) | Error monitoring (env var present) |

---

## 15. Performance & Optimization

### Code Splitting
- **Extensive use of `React.lazy()`** for all authenticated routes (80+ pages)
- **Eagerly loaded:** Only 5 public pages (Landing, Login, Register, ForgotPassword, ResetPassword)
- **Role-based dynamic imports:** Teacher/Admin views loaded based on user role at runtime
- **Suspense fallback:** `<PageLoader>` component during chunk loading

### Caching Strategy
- **Frontend:** React Query with 30-second stale time, refetch on window focus, 1 retry
- **Backend:** node-cache with configurable TTL:
  - Tenant lookups: 10-minute cache
  - S3 pre-signed URLs: 50-minute cache
  - General data: 5-minute default TTL
- **CDN:** Vercel edge caching with 1-year immutable headers for static assets

### Pagination
- **Approach:** Page/limit based (not cursor-based)
- **Default:** page=1, limit=10-50 (varies by endpoint)
- **Pattern:** `skip = (page - 1) * limit` with total count for frontend pagination

### Image Optimization
- **Cloudinary transformations:** Available but not extensively configured
- **No explicit lazy loading** for images in frontend code
- **PlaceholderImage component** for missing images

### Other Optimizations
- **Vite production build:** Source maps disabled, dependency pre-bundling (react, react-dom)
- **Compression:** `compression` middleware enabled on backend
- **Helmet:** Security headers via helmet middleware
- **Database:** Connection pooling (max 10), auto-indexing disabled in production (manual index management)
- **Request timeout:** 15 seconds default (3 minutes for bulk invoice generation)
- **CORS preflight cache:** 24 hours
- **Notification polling:** Prevents duplicate API calls with inflightRef, only polls when tab is visible

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Frontend Dependencies** | 22 production + 7 dev |
| **Backend Dependencies** | 29 production + 6 dev |
| **MongoDB Models** | 71 |
| **Multi-tenant Models** | 65 |
| **API Route Files** | 45+ |
| **API Endpoints** | 150+ |
| **Frontend Pages** | 83 |
| **Frontend Components** | 106 |
| **Frontend Services** | 23+ |
| **Backend Services** | 22+ |
| **Backend Utilities** | 15 |
| **React Contexts** | 5 |
| **Custom Hooks** | 3 |
| **User Roles** | 12 (including superadmin) |
| **Background Jobs** | 2 (reconciliation + backup) |
| **Test Files** | 5 (4 unit + 1 integration) |
| **Maintenance Scripts** | 23 |

---

*This report was generated by analyzing the actual codebase. No secret keys, passwords, or API credentials are included.*
