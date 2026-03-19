import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { SuperAdminProvider } from './contexts/SuperAdminContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './contexts/NotificationContext'
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
const Academics = lazy(() => import('./pages/Academics'))
const Classes = lazy(() => import('./pages/Classes'))
const ClassDetail = lazy(() => import('./pages/ClassDetail'))
const FeesFinance = lazy(() => import('./pages/FeesFinance'))
const Fees = lazy(() => import('./pages/Fees'))
const StudentFeesDashboard = lazy(() => import('./pages/student/StudentFeesDashboard'))
const Attendance = lazy(() => import('./pages/Attendance'))
const StudentAttendanceView = lazy(() => import('./pages/attendance/StudentAttendanceView'))
const Assignments = lazy(() => import('./pages/Assignments'))
const Homework = lazy(() => import('./pages/Homework'))
const Exams = lazy(() => import('./pages/Exams'))
const Admissions = lazy(() => import('./pages/Admissions'))
const Activities = lazy(() => import('./pages/Activities'))
const Reports = lazy(() => import('./pages/Reports'))
const Communication = lazy(() => import('./pages/Communication'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Notifications = lazy(() => import('./pages/Notifications'))
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'))
const Transport = lazy(() => import('./pages/Transport'))
const Payroll = lazy(() => import('./pages/Payroll'))
const Expenses = lazy(() => import('./pages/Expenses'))
const CertificateManager = lazy(() => import('./pages/certificates/CertificateManager'))
const CertificateGeneration = lazy(() => import('./pages/certificates/CertificateGeneration'))
const TemplateSettings = lazy(() => import('./pages/certificates/TemplateSettings'))
const Search = lazy(() => import('./pages/Search'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))

// Timetable Module
const TimetableSchedule = lazy(() => import('./pages/timetable/TimetableSchedule'))
const TimetableBuilder = lazy(() => import('./pages/timetable/TimetableBuilder'))
const Substitutions = lazy(() => import('./pages/timetable/Substitutions'))
const SpecialDays = lazy(() => import('./pages/timetable/SpecialDays'))

// ── Minimal fallback shown while a lazy chunk loads
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="loading-spinner" />
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SuperAdminProvider>
          <SettingsProvider>
            <ThemeProvider>
            <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
              <div className="App">
                <Toaster
                  position="top-right"
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
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/app" element={
                      <ProtectedRoute>
                        <NotificationProvider>
                          <Layout />
                        </NotificationProvider>
                      </ProtectedRoute>
                    }>
                      <Route index element={<Navigate to="/app/dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="students" element={<Students />} />
                      <Route path="students/bulk-promote" element={<BulkPromotion />} />
                      <Route path="students/:id" element={<StudentDetail />} />
                      <Route path="student-lists" element={<StudentLists />} />
                      <Route path="employees" element={<Employees />} />
                      <Route path="employees/:id" element={<EmployeeDetail />} />
                      <Route path="teachers" element={<Teachers />} />

                      {/* Academics Module */}
                      <Route path="academics" element={
                        <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                          <Academics />
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
                      <Route path="fees-finance" element={<FeesFinance />} />
                      <Route path="fees" element={<Fees />} />
                      <Route path="student/fees" element={<StudentFeesDashboard />} />

                      <Route path="attendance" element={<Attendance />} />
                      <Route path="attendance/student/:studentId" element={<StudentAttendanceView />} />
                      <Route path="assignments" element={<Assignments />} />
                      <Route path="homework" element={<Homework />} />
                      <Route path="exams" element={<Exams />} />
                      <Route path="admissions" element={<Admissions />} />
                      <Route path="activities" element={<Activities />} />
                      <Route path="reports" element={<Reports />} />

                      {/* Communication Module */}
                      <Route path="communication" element={<Communication />} />
                      <Route path="announcements" element={<Announcements />} />
                      <Route path="notifications" element={<Notifications />} />
                      <Route path="notification-preferences" element={<NotificationPreferences />} />

                      {/* Transport Module */}
                      <Route path="transport" element={<Transport />} />

                      {/* Payroll Module */}
                      <Route path="payroll" element={<Payroll />} />

                      {/* Expense Management Module */}
                      <Route path="expenses" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                          <Expenses />
                        </ProtectedRoute>
                      } />

                      {/* Certificates Module */}
                      <Route path="certificates" element={<CertificateManager />} />
                      <Route path="certificates/generate" element={<CertificateGeneration />} />
                      <Route path="certificates/templates" element={<TemplateSettings />} />

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
                      <Route path="settings" element={<Settings />} />
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
                    </Route>
                  </Routes>
                </Suspense>
              </div>
            </Router>
          </ThemeProvider>
          </SettingsProvider>
        </SuperAdminProvider>
      </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
