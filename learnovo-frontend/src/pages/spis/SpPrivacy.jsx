import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'

export default function SpPrivacy() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">SP International School</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-50 to-white border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">Legal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">SP International School · Managed by Sardar Patel Educational Society</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="space-y-10 text-sm leading-relaxed text-gray-600">

          <p className="text-base text-gray-700">
            <strong className="text-gray-900">SP International School</strong>, operated by{' '}
            <strong className="text-gray-900">Sardar Patel Educational Society</strong>, is committed to protecting
            your privacy. This policy explains how we collect, use, and safeguard your personal information.
          </p>

          <Section number="1" title="Information We Collect">
            <p className="mb-3">We may collect the following information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Student details — name, class, and admission information</li>
              <li>Parent/guardian name and contact details</li>
              <li>Payment-related information for fee processing</li>
            </ul>
          </Section>

          <Section number="2" title="Use of Information">
            <p className="mb-3">The information collected is used solely for:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Managing and maintaining student academic records</li>
              <li>Processing school fees and admission fees</li>
              <li>Communication between the school and parents/guardians</li>
            </ul>
          </Section>

          <Section number="3" title="Data Storage & Security">
            <ul className="list-disc pl-5 space-y-2">
              <li>All student and user data is securely stored in our system with restricted access.</li>
              <li>We take reasonable technical and organisational measures to protect data from unauthorised access, loss, or misuse.</li>
            </ul>
          </Section>

          <Section number="4" title="Payment Security">
            <ul className="list-disc pl-5 space-y-2">
              <li>All payments are processed through secure, PCI-compliant third-party payment gateways.</li>
              <li>We do not store, transmit, or have access to sensitive banking details, card numbers, or UPI credentials.</li>
            </ul>
          </Section>

          <Section number="5" title="Sharing of Information">
            <p className="mb-3">We do not sell, rent, or trade personal data. Information may be shared only in the following cases:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>With payment gateway providers strictly for the purpose of processing transactions</li>
              <li>When required by applicable law or a competent government authority</li>
            </ul>
          </Section>

          <Section number="6" title="Cookies">
            <p>
              Our website and portal may use cookies to improve user experience, maintain login sessions, and
              analyse usage. You can manage cookie preferences through your browser settings.
            </p>
          </Section>

          <Section number="7" title="Consent">
            <p>
              By accessing and using our website, portal, or services, you acknowledge that you have read and
              agree to this Privacy Policy.
            </p>
          </Section>

          <Section number="8" title="Updates to This Policy">
            <p>
              This Privacy Policy may be updated from time to time to reflect changes in our practices or
              applicable law. Continued use of our services after any update constitutes acceptance of the
              revised policy.
            </p>
          </Section>

          {/* Contact box */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5">
            <p className="font-semibold text-gray-900 mb-2">Questions about this policy?</p>
            <p className="text-gray-600">Contact us at{' '}
              <a href="mailto:spinternationalschool2021@gmail.com" className="text-blue-600 hover:underline font-medium">
                spinternationalschool2021@gmail.com
              </a>{' '}or call{' '}
              <a href="tel:+919888468343" className="text-blue-600 hover:underline font-medium">
                +91 98884 68343
              </a>
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}

function Section({ number, title, children }) {
  return (
    <section>
      <div className="flex items-start gap-3 mb-3">
        <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
          {number}
        </span>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="pl-9">{children}</div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-8 mt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-700">SP International School</p>
          <p className="text-xs text-gray-400">Sardar Patel Educational Society · Firozepur Cantt, Punjab</p>
        </div>
        <div className="flex items-center flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-gray-400">
          <Link to="/spis/contact-us" className="hover:text-gray-700 transition-colors">Contact Us</Link>
          <Link to="/spis/terms-and-conditions" className="hover:text-gray-700 transition-colors">Terms &amp; Conditions</Link>
          <span className="font-medium text-gray-600">Privacy Policy</span>
          <Link to="/spis/refund-policy" className="hover:text-gray-700 transition-colors">Refund Policy</Link>
        </div>
      </div>
    </footer>
  )
}
