import { Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { ArrowLeft, Sun, Moon } from 'lucide-react'

export default function PrivacyPolicy() {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className={`min-h-screen ${isDark ? 'bg-black text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl ${isDark ? 'bg-black/80 border-[#1a1a1a]' : 'bg-white/80 border-gray-200'} border-b`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-icon.png" alt="Learnovo" className="h-7 w-7 object-contain" />
              <span className="text-lg font-bold">Learnovo</span>
            </Link>
            <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#1a1a1a]' : 'hover:bg-gray-100'}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className={`text-sm mb-10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Last updated: March 25, 2026</p>

        <div className={`space-y-8 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>1. Introduction</h2>
            <p>EvoTech Innovation ("we", "us", or "our") operates Learnovo, a school management platform. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our Platform. We are committed to safeguarding the privacy of our users, including students, parents, teachers, and institutional administrators.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>2. Information We Collect</h2>
            <h3 className={`font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>2.1 Information You Provide</h3>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li><strong>Account Information:</strong> Name, email address, phone number, role, and login credentials.</li>
              <li><strong>Institutional Data:</strong> School name, address, board affiliation, and administrative details.</li>
              <li><strong>Student Records:</strong> Student names, admission numbers, class details, attendance records, academic results, and guardian information.</li>
              <li><strong>Employee Data:</strong> Employee names, contact details, qualifications, department, and payroll information.</li>
              <li><strong>Financial Data:</strong> Fee structures, payment records, expense details, and income records.</li>
              <li><strong>Communication Data:</strong> Messages, announcements, and notifications sent through the Platform.</li>
            </ul>
            <h3 className={`font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the Platform, and interaction patterns.</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device type, and screen resolution.</li>
              <li><strong>Log Data:</strong> IP addresses, access timestamps, and error logs for security and troubleshooting.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>3. How We Use Your Information</h2>
            <p className="mb-3">We use the collected information to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide, operate, and maintain the Platform and its features.</li>
              <li>Manage user accounts and authentication.</li>
              <li>Process fee payments and generate financial reports.</li>
              <li>Facilitate communication between institutions, teachers, students, and parents.</li>
              <li>Generate academic reports, certificates, and analytics.</li>
              <li>Send important notifications about the Platform, updates, and security alerts.</li>
              <li>Improve and optimize the Platform based on usage patterns.</li>
              <li>Ensure security and prevent unauthorized access.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>4. Data Sharing and Disclosure</h2>
            <p className="mb-3">We do not sell your personal data. We may share information only in the following cases:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Within the Institution:</strong> Data is shared among authorized users within the same institution based on their role and permissions.</li>
              <li><strong>Service Providers:</strong> We may share data with trusted third-party service providers who help us operate the Platform (e.g., hosting, payment processing), under strict confidentiality agreements.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government regulation.</li>
              <li><strong>With Consent:</strong> We may share data with your explicit consent for purposes not covered by this policy.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>5. Data Security</h2>
            <p>We implement industry-standard security measures to protect your data, including:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Encryption of data in transit (TLS/SSL) and at rest.</li>
              <li>Role-based access controls to limit data access to authorized users.</li>
              <li>Regular security audits and vulnerability assessments.</li>
              <li>Secure authentication with password hashing and session management.</li>
              <li>Multi-tenant data isolation ensuring each institution's data is separate and secure.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>6. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide services. Upon account termination or request for deletion, we will delete your data within 30 days, except where retention is required by applicable law or for legitimate business purposes such as resolving disputes.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>7. Your Rights</h2>
            <p className="mb-3">Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request corrections to inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
              <li><strong>Data Portability:</strong> Request your data in a structured, commonly used format.</li>
              <li><strong>Objection:</strong> Object to certain processing activities where applicable.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, please contact us at the details provided below.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>8. Children's Privacy</h2>
            <p>Learnovo is used by educational institutions that manage student data, which may include minors. We process children's data only on behalf of and under the direction of the educational institution. Institutions are responsible for obtaining necessary parental or guardian consent as required by applicable law.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>9. Cookies and Tracking</h2>
            <p>We use essential cookies for authentication and session management. We may also use analytics cookies to understand usage patterns and improve the Platform. You can control cookie settings through your browser preferences.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the Platform or via email. Continued use of the Platform after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>11. Contact Us</h2>
            <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:</p>
            <ul className="mt-3 space-y-1">
              <li><strong className={isDark ? 'text-white' : 'text-gray-900'}>Company:</strong> EvoTech Innovation</li>
              <li><strong className={isDark ? 'text-white' : 'text-gray-900'}>Email:</strong> <a href="mailto:evotechnologiesinnovation@gmail.com" className="text-primary-500 hover:underline">evotechnologiesinnovation@gmail.com</a></li>
              <li><strong className={isDark ? 'text-white' : 'text-gray-900'}>Phone:</strong> <a href="tel:+916283482293" className="text-primary-500 hover:underline">+91 62834 82293</a></li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className={`border-t py-8 ${isDark ? 'border-[#1a1a1a]' : 'border-gray-200'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>&copy; 2026 Learnovo. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Privacy Policy</span>
            <Link to="/terms-and-conditions" className={`text-sm hover:underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Terms & Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
