import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function SpPrivacy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link to="/login" className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">SP International School — Sardar Patel Educational Society</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-600">

          <p><strong className="text-gray-900">SP International School</strong>, operated by <strong className="text-gray-900">Sardar Patel Educational Society</strong>, is committed to protecting your privacy.</p>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
            <p className="mb-2">We may collect:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Student details (name, class, admission info)</li>
              <li>Parent/guardian contact details</li>
              <li>Payment-related information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Use of Information</h2>
            <p className="mb-2">The information is used for:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Managing student records</li>
              <li>Processing school and admission fees</li>
              <li>Communication with parents/guardians</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Data Storage</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Student and user data is securely stored in our system.</li>
              <li>We take reasonable measures to protect data from unauthorized access.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Payment Security</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Payments are processed via secure third-party gateways.</li>
              <li>We do not store sensitive banking or card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Sharing of Information</h2>
            <p className="mb-2">We do not sell or share personal data except:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>With payment gateway providers for transaction processing</li>
              <li>When required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Cookies</h2>
            <p>The website may use cookies to improve user experience.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Consent</h2>
            <p>By using our website and services, you agree to this Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Updates</h2>
            <p>This policy may be updated periodically without prior notice.</p>
          </section>

        </div>
      </main>

      <footer className="border-t py-8 border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SP International School. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/spis/contact-us" className="text-gray-500 hover:text-gray-900 hover:underline">Contact Us</Link>
            <Link to="/spis/terms-and-conditions" className="text-gray-500 hover:text-gray-900 hover:underline">Terms &amp; Conditions</Link>
            <Link to="/spis/refund-policy" className="text-gray-500 hover:text-gray-900 hover:underline">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
