import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { SuperAdminProvider } from './contexts/SuperAdminContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { TenantProvider, useTenant } from './contexts/TenantContext'
import ProtectedRoute from './components/ProtectedRoute'
import SuperAdminRoute from './components/superadmin/SuperAdminRoute'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

// ── Public / auth pages — kept eager (tiny, shown before auth)
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import TermsAndConditions from './pages/TermsAndConditions'
import PrivacyPolicy from './pages/PrivacyPolicy'

// ── Super admin pages
const SuperAdminLogin = lazy(() => import('./pages/superadmin/Login'))
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/Dashboard'))
const SuperAdminTenants = lazy(() => import('./pages/superadmin/Tenants'))
const SuperAdminUsers = lazy(() => import('./pages/superadmin/Users'))
const SuperAdminPlans = lazy(() => import('./pages/superadmin/Plans'))
const SuperAdminAuditLog = lazy(() => import('./pages/superadmin/AuditLog'))
const SuperAdminBilling = lazy(() => import('./pages/superadmin/Billing'))
const SuperAdminModules = lazy(() => import('./pages/superadmin/Modules'))
const SuperAdminCommunication = lazy(() => import('./pages/superadmin/Communication'))
const SuperAdminSupport = lazy(() => import('./pages/superadmin/Support'))
const SuperAdminReports = lazy(() => import('./pages/superadmin/Reports'))
const SuperAdminSettings = lazy(() => import('./pages/superadmin/Settings'))
const SuperAdminSystem = lazy(() => import('./pages/superadmin/System'))
const SuperAdminProfile = lazy(() => import('./pages/superadmin/Profile'))
const SuperAdminBackups = lazy(() => import('./pages/superadmin/Backups'))
const SuperAdminLayout = lazy(() => import('./components/superadmin/SuperAdminLayout'))

// ── App pages — all lazy-loaded for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Students = lazy(() => import('./pages/Students'))
const BulkPromotion = lazy(() => import('./pages/BulkPromotion'))
const StudentDetail = lazy(() => import('./pages/StudentDetail'))
const StudentLists = lazy(() => import('./pages/StudentLists'))
const Employees = lazy(() => import('./pages/Employees'))
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'))
const Teachers = lazy(() => import('./pages/Teachers'))
const Classes = lazy(() => import('./pages/Classes'))
const ClassDetail = lazy(() => import('./pages/ClassDetail'))
const FeesFinance = lazy(() => import('./pages/FeesFinance'))
const Fees = lazy(() => import('./pages/Fees'))
const StudentFeesDashboard = lazy(() => import('./pages/student/StudentFeesDashboard'))
const Attendance = lazy(() => import('./pages/Attendance'))
const StudentAttendanceView = lazy(() => import('./pages/attendance/StudentAttendanceView'))
const Assignments = lazy(() => import('./pages/Assignments'))
const Homework = lazy(() => import('./pages/Homework'))
const Admissions = lazy(() => import('./pages/Admissions'))
const Activities = lazy(() => import('./pages/Activities'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Notifications = lazy(() => import('./pages/Notifications'))
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'))
const Transport = lazy(() => import('./pages/Transport'))
const Payroll = lazy(() => import('./pages/Payroll'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Income = lazy(() => import('./pages/Income'))
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'))
const CertificateGeneration = lazy(() => import('./pages/certificates/CertificateGeneration'))
const TemplateSettings = lazy(() => import('./pages/certificates/TemplateSettings'))
const PaymentStatus = lazy(() => import('./pages/PaymentStatus'))
const Search = lazy(() => import('./pages/Search'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))

// Timetable Module
const TimetableSchedule = lazy(() => import('./pages/timetable/TimetableSchedule'))
const TimetableBuilder = lazy(() => import('./pages/timetable/TimetableBuilder'))
const Substitutions = lazy(() => import('./pages/timetable/Substitutions'))
const SpecialDays = lazy(() => import('./pages/timetable/SpecialDays'))

// ── Role-based page wrappers ──
const AcademicsPage = lazy(async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'teacher') return import('./pages/teacher/TeacherAcademics')
  return import('./pages/Academics')
})

const ExamsPage = lazy(async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'teacher') return import('./pages/teacher/TeacherExams')
  return import('./pages/Exams')
})

const CertificatesPage = lazy(async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'teacher') return import('./pages/teacher/TeacherCertificates')
  return import('./pages/certificates/CertificateManager')
})

const CommunicationPage = lazy(async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'teacher') return import('./pages/teacher/TeacherCommunication')
  return import('./pages/Communication')
})

const ReportsPage = lazy(async () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.role === 'teacher') return import('./pages/teacher/TeacherReports')
  return import('./pages/Reports')
})

// ── Minimal fallback shown while a lazy chunk loads
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="loading-spinner" />
  </div>
)

// ── On subdomain, redirect "/" to login instead of landing page
function TenantAwareRoot() {
  const { isSubdomainApp } = useTenant()
  if (isSubdomainApp) return <Navigate to="/login" replace />
  return <Landing />
}

// ── Gate that blocks rendering when subdomain is loading or invalid
function SubdomainGate({ children }) {
  const { isSubdomainApp, isLoading, error } = useTenant()

  // No subdomain detected — root domain, render normally
  if (!isSubdomainApp) return children

  // Subdomain detected but still resolving tenant
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-black">
        <div className="loading-spinner mb-4" />
        <p className="text-gray-500 dark:text-gray-400">Loading school portal...</p>
      </div>
    )
  }

  // Subdomain resolved but tenant not found
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-black px-4">
        <div className="max-w-md text-center">
          <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">404</h1>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            School Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            The school portal you are looking for does not exist or is no longer active.
          </p>
          <a
            href={`${window.location.protocol}//learnovoportal.com`}
            className="inline-block px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Go to Learnovo Home
          </a>
        </div>
      </div>
    )
  }

  // Subdomain valid, tenant loaded — render the app
  return children
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <TenantProvider>
      <AuthProvider>
        <SuperAdminProvider>
          <SettingsProvider>
            <ThemeProvider>
            <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
              <SubdomainGate>
              <div className="App">
                <Toaster
                  position="top-right"
                  containerStyle={{ zIndex: 99999 }}
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: 'var(--toast-bg, #fff)',
                      color: 'var(--toast-color, #333)',
                      border: '1px solid var(--toast-border, #e5e7eb)',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    },
                    success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                  }}
                />

                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<TenantAwareRoot />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/payment/status" element={<PaymentStatus />} />
                    <Route path="/app" element={
                      <ProtectedRoute>
                        <NotificationProvider>
                          <Layout />
                        </NotificationProvider>
                      </ProtectedRoute>
                    }>
                      <Route index element={<Navigate to="/app/dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="students" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent']}>
                          <Students />
                        </ProtectedRoute>
                      } />
                      <Route path="students/bulk-promote" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <BulkPromotion />
                        </ProtectedRoute>
                      } />
                      <Route path="students/:id" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher', 'parent']}>
                          <StudentDetail />
                        </ProtectedRoute>
                      } />
                      <Route path="student-lists" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <StudentLists />
                        </ProtectedRoute>
                      } />
                      <Route path="employees" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Employees />
                        </ProtectedRoute>
                      } />
                      <Route path="employees/:id" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <EmployeeDetail />
                        </ProtectedRoute>
                      } />
                      <Route path="teachers" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Teachers />
                        </ProtectedRoute>
                      } />

                      {/* Academics Module */}
                      <Route path="academics" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <AcademicsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="classes" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <Classes />
                        </ProtectedRoute>
                      } />
                      <Route path="classes/:id" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <ClassDetail />
                        </ProtectedRoute>
                      } />

                      {/* Finance Module */}
                      <Route path="fees-finance" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <FeesFinance />
                        </ProtectedRoute>
                      } />
                      <Route path="fees" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Fees />
                        </ProtectedRoute>
                      } />
                      <Route path="student/fees" element={
                        <ProtectedRoute allowedRoles={['student', 'parent']}>
                          <StudentFeesDashboard />
                        </ProtectedRoute>
                      } />

                      <Route path="attendance" element={<Attendance />} />
                      <Route path="attendance/student/:studentId" element={<StudentAttendanceView />} />
                      <Route path="assignments" element={<Assignments />} />
                      <Route path="homework" element={<Homework />} />
                      <Route path="exams" element={<ExamsPage />} />
                      <Route path="admissions" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Admissions />
                        </ProtectedRoute>
                      } />
                      <Route path="activities" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <Activities />
                        </ProtectedRoute>
                      } />
                      <Route path="reports" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <ReportsPage />
                        </ProtectedRoute>
                      } />

                      {/* Communication Module */}
                      <Route path="communication" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <CommunicationPage />
                        </ProtectedRoute>
                      } />
                      <Route path="announcements" element={<Announcements />} />
                      <Route path="notifications" element={<Notifications />} />
                      <Route path="notification-preferences" element={<NotificationPreferences />} />

                      {/* Transport Module */}
                      <Route path="transport" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Transport />
                        </ProtectedRoute>
                      } />

                      {/* Payroll Module */}
                      <Route path="payroll" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Payroll />
                        </ProtectedRoute>
                      } />

                      {/* Expense Management Module */}
                      <Route path="expenses" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Expenses />
                        </ProtectedRoute>
                      } />

                      {/* Income Management Module */}
                      <Route path="income" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Income />
                        </ProtectedRoute>
                      } />

                      {/* Finance Dashboard (combined view) */}
                      <Route path="finance-dashboard" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <FinanceDashboard />
                        </ProtectedRoute>
                      } />

                      {/* Certificates Module */}
                      <Route path="certificates" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <CertificatesPage />
                        </ProtectedRoute>
                      } />
                      <Route path="certificates/generate" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <CertificateGeneration />
                        </ProtectedRoute>
                      } />
                      <Route path="certificates/templates" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <TemplateSettings />
                        </ProtectedRoute>
                      } />

                      {/* Timetable Module */}
                      <Route path="timetable" element={<TimetableSchedule />} />
                      <Route path="timetable/builder" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <TimetableBuilder />
                        </ProtectedRoute>
                      } />
                      <Route path="timetable/substitutions" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <Substitutions />
                        </ProtectedRoute>
                      } />
                      <Route path="timetable/special-days" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <SpecialDays />
                        </ProtectedRoute>
                      } />

                      <Route path="search" element={<Search />} />
                      <Route path="settings" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Settings />
                        </ProtectedRoute>
                      } />
                      <Route path="profile" element={<Profile />} />
                    </Route>

                    {/* Super Admin Routes */}
                    <Route path="/super-admin-login" element={<SuperAdminLogin />} />
                    <Route path="/super-admin" element={
                      <SuperAdminRoute>
                        <SuperAdminLayout />
                      </SuperAdminRoute>
                    }>
                      <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
                      <Route path="dashboard" element={<SuperAdminDashboard />} />
                      <Route path="schools" element={<SuperAdminTenants />} />
                      <Route path="users" element={<SuperAdminUsers />} />
                      <Route path="plans" element={<SuperAdminPlans />} />
                      <Route path="billing" element={<SuperAdminBilling />} />
                      <Route path="modules" element={<SuperAdminModules />} />
                      <Route path="communication" element={<SuperAdminCommunication />} />
                      <Route path="support" element={<SuperAdminSupport />} />
                      <Route path="reports" element={<SuperAdminReports />} />
                      <Route path="audit-log" element={<SuperAdminAuditLog />} />
                      <Route path="settings" element={<SuperAdminSettings />} />
                      <Route path="system" element={<SuperAdminSystem />} />
                      <Route path="profile" element={<SuperAdminProfile />} />
                      <Route path="backups" element={<SuperAdminBackups />} />
                    </Route>
                  </Routes>
                </Suspense>
              </div>
              </SubdomainGate>
            </Router>
          </ThemeProvider>
          </SettingsProvider>
        </SuperAdminProvider>
      </AuthProvider>
      </TenantProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
