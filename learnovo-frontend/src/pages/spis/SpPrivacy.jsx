import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'

export default function SpPrivacy() {
  const { tenant } = useTenant()
  const logo = tenant?.logo

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
            {logo && <img src={logo} alt="SP International School" className="h-7 w-7 object-contain rounded-md" />}
            <span className="text-sm font-semibold text-gray-700">SP International School</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-blue-50 to-white border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">SP International School · Sardar Patel Educational Society</p>
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

          <Section number="1" title="Information We Collect" color="blue">
            <p className="mb-3">We may collect the following information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Student details — name, class, and admission information</li>
              <li>Parent/guardian name and contact details</li>
              <li>Payment-related information for fee processing</li>
            </ul>
          </Section>

          <Section number="2" title="Use of Information" color="blue">
            <p className="mb-3">The information collected is used solely for:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Managing and maintaining student academic records</li>
              <li>Processing school fees and admission fees</li>
              <li>Communication between the school and parents/guardians</li>
            </ul>
          </Section>

          <Section number="3" title="Data Storage & Security" color="blue">
            <ul className="list-disc pl-5 space-y-2">
              <li>All student and user data is securely stored in our system with restricted access.</li>
              <li>We take reasonable technical and organisational measures to protect data from unauthorised access, loss, or misuse.</li>
            </ul>
          </Section>

          <Section number="4" title="Payment Security" color="blue">
            <ul className="list-disc pl-5 space-y-2">
              <li>All payments are processed through secure, PCI-compliant third-party payment gateways.</li>
              <li>We do not store, transmit, or have access to sensitive banking details, card numbers, or UPI credentials.</li>
            </ul>
          </Section>

          <Section number="5" title="Sharing of Information" color="blue">
            <p className="mb-3">We do not sell, rent, or trade personal data. Information may be shared only in the following cases:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>With payment gateway providers strictly for the purpose of processing transactions</li>
              <li>When required by applicable law or a competent government authority</li>
            </ul>
          </Section>

          <Section number="6" title="Cookies" color="blue">
            <p>Our website and portal may use cookies to improve user experience, maintain login sessions, and analyse usage. You can manage cookie preferences through your browser settings.</p>
          </Section>

          <Section number="7" title="Consent" color="blue">
            <p>By accessing and using our website, portal, or services, you acknowledge that you have read and agree to this Privacy Policy.</p>
          </Section>

          <Section number="8" title="Updates to This Policy" color="blue">
            <p>This Privacy Policy may be updated from time to time. Continued use of our services after any update constitutes acceptance of the revised policy.</p>
          </Section>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5">
            <p className="font-semibold text-gray-900 mb-2">Questions about this policy?</p>
            <p className="text-gray-600">Contact us at{' '}
              <a href="mailto:spinternationalschool2021@gmail.com" className="text-blue-600 hover:underline font-medium">spinternationalschool2021@gmail.com</a>
              {' '}or call{' '}
              <a href="tel:+919888468343" className="text-blue-600 hover:underline font-medium">+91 98884 68343</a>
            </p>
          </div>

        </div>
      </main>

      <SpFooter logo={logo} active="privacy" />
    </div>
  )
}

function Section({ number, title, children, color }) {
  const bg = color === 'blue' ? 'bg-blue-600' : color === 'indigo' ? 'bg-indigo-600' : 'bg-amber-500'
  return (
    <section>
      <div className="flex items-start gap-3 mb-3">
        <span className={`flex-shrink-0 h-6 w-6 rounded-full ${bg} text-white text-xs font-bold flex items-center justify-center mt-0.5`}>{number}</span>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="pl-9">{children}</div>
    </section>
  )
}

function SpFooter({ logo, active }) {
  const links = [
    { to: '/spis/contact-us', label: 'Contact Us', key: 'contact' },
    { to: '/spis/terms-and-conditions', label: 'Terms & Conditions', key: 'terms' },
    { to: '/spis/privacy-policy', label: 'Privacy Policy', key: 'privacy' },
    { to: '/spis/refund-policy', label: 'Refund Policy', key: 'refund' },
  ]
  return (
    <footer className="border-t border-gray-100 py-8 mt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {logo && <img src={logo} alt="SP International School" className="h-8 w-8 object-contain rounded-lg" />}
          <div>
            <p className="text-sm font-semibold text-gray-700">SP International School</p>
            <p className="text-xs text-gray-400">Sardar Patel Educational Society · Firozepur Cantt, Punjab</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap justify-center gap-x-5 gap-y-1 text-xs">
          {links.map(l => active === l.key
            ? <span key={l.key} className="font-semibold text-gray-800">{l.label}</span>
            : <Link key={l.key} to={l.to} className="text-gray-400 hover:text-gray-700 transition-colors">{l.label}</Link>
          )}
        </div>
      </div>
    </footer>
  )
}
