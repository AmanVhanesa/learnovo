import { Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { ArrowLeft, Sun, Moon } from 'lucide-react'

export default function TermsAndConditions() {
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms and Conditions</h1>
        <p className={`text-sm mb-10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Last updated: March 25, 2026</p>

        <div className={`space-y-8 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>1. Acceptance of Terms</h2>
            <p>By accessing or using Learnovo ("the Platform"), operated by EvoTech Innovation, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the Platform.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>2. Description of Service</h2>
            <p>Learnovo is a comprehensive school management platform that provides tools for managing students, employees, academics, finance, attendance, communication, transport, and other institutional operations. The Platform is offered as a Software-as-a-Service (SaaS) solution for educational institutions.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>3. User Accounts</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must notify us immediately of any unauthorized access to your account.</li>
              <li>Each user account is personal and non-transferable.</li>
              <li>Institutional administrators are responsible for managing user accounts within their organization.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Upload or transmit any harmful, offensive, or inappropriate content.</li>
              <li>Attempt to gain unauthorized access to other accounts, systems, or networks.</li>
              <li>Interfere with or disrupt the Platform's operation or security.</li>
              <li>Use automated tools to scrape or collect data from the Platform without authorization.</li>
              <li>Share or distribute student or employee data outside authorized use cases.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>5. Data Ownership</h2>
            <p>All data entered into the Platform by institutions and their users remains the property of the respective institution. EvoTech Innovation does not claim ownership of your data. We act as a data processor on behalf of the institution (data controller).</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>6. Subscription and Payments</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Access to the Platform is provided on a subscription basis as per the selected plan.</li>
              <li>All fees are quoted in Indian Rupees (INR) unless stated otherwise.</li>
              <li>Payments are non-refundable unless otherwise specified in the applicable plan terms.</li>
              <li>We reserve the right to modify pricing with prior notice to subscribers.</li>
              <li>Failure to pay may result in suspension or termination of access to the Platform.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>7. Intellectual Property</h2>
            <p>The Platform, including its design, code, features, logos, and documentation, is the intellectual property of EvoTech Innovation. You may not copy, modify, distribute, or reverse-engineer any part of the Platform without prior written consent.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>8. Service Availability</h2>
            <p>We strive to maintain high availability of the Platform but do not guarantee uninterrupted access. Scheduled maintenance, updates, or unforeseen technical issues may cause temporary downtime. We will make reasonable efforts to notify users of planned maintenance in advance.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, EvoTech Innovation shall not be liable for any indirect, incidental, special, or consequential damages arising from the use or inability to use the Platform, including but not limited to loss of data, revenue, or business opportunities.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>10. Termination</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We may suspend or terminate your access if you violate these terms.</li>
              <li>You may terminate your account at any time by contacting us.</li>
              <li>Upon termination, your data will be retained for 30 days and then permanently deleted unless otherwise required by law.</li>
            </ul>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>11. Changes to Terms</h2>
            <p>We reserve the right to update these Terms and Conditions at any time. Changes will be communicated through the Platform or via email. Continued use of the Platform after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>12. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the courts in India.</p>
          </section>

          <section>
            <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>13. Contact Us</h2>
            <p>If you have any questions about these Terms and Conditions, please contact us:</p>
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
            <Link to="/privacy-policy" className={`text-sm hover:underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Privacy Policy</Link>
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Terms & Conditions</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
