import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import BulkPromotion from './pages/BulkPromotion'
import StudentDetail from './pages/StudentDetail'
import StudentLists from './pages/StudentLists'
import Employees from './pages/Employees'
import EmployeeDetail from './pages/EmployeeDetail'
import Teachers from './pages/Teachers'
import Classes from './pages/Classes'
import ClassDetail from './pages/ClassDetail'
import Fees from './pages/Fees'
import Attendance from './pages/Attendance'
import Assignments from './pages/Assignments'
import Admissions from './pages/Admissions'
import Exams from './pages/Exams'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import NotificationPreferences from './pages/NotificationPreferences'
import Announcements from './pages/Announcements'
import Communication from './pages/Communication'
import Academics from './pages/Academics'
import FeesFinance from './pages/FeesFinance'
import Search from './pages/Search'
import Transport from './pages/Transport'
import CertificateManager from './pages/certificates/CertificateManager'
import CertificateGeneration from './pages/certificates/CertificateGeneration'
import TemplateSettings from './pages/certificates/TemplateSettings'
import Activities from './pages/Activities'
import Payroll from './pages/Payroll'
import Homework from './pages/Homework'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <div className="App">
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#fff',
                    color: '#333',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  },
                  success: {
                    iconTheme: {
                      primary: '#10b981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />

              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/app" element={
                  <ProtectedRoute>
                    <Layout />
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
                  <Route path="academics" element={<Academics />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="classes/:id" element={<ClassDetail />} />

                  {/* Finance Module */}
                  <Route path="fees-finance" element={<FeesFinance />} />
                  <Route path="fees" element={<Fees />} />

                  <Route path="attendance" element={<Attendance />} />
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

                  {/* Certificates Module */}
                  <Route path="certificates" element={<CertificateManager />} />
                  <Route path="certificates/generate" element={<CertificateGeneration />} />
                  <Route path="certificates/templates" element={<TemplateSettings />} />

                  <Route path="search" element={<Search />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Routes>
            </div>
          </Router>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App