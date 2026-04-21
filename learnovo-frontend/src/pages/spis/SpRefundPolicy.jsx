import { Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'

export default function SpRefundPolicy() {
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
      <div className="bg-gradient-to-b from-amber-50 to-white border-b border-amber-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-end gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <RotateCcw className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Refund &amp; Cancellation Policy</h1>
          </div>
          <p className="text-gray-500 text-sm pl-16">SP International School · Sardar Patel Educational Society</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="space-y-10 text-sm leading-relaxed text-gray-600">

          <p className="text-base text-gray-700">
            This policy governs all fee payments made through the{' '}
            <strong className="text-gray-900">SP International School</strong> online payment portal.
            Please read this carefully before making any payment.
          </p>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
            <p className="font-semibold text-amber-800 text-base mb-1">Important Notice</p>
            <p className="text-amber-700">All payments made through the SP International School portal are <strong>final and non-refundable</strong>. Please verify all details before confirming your payment.</p>
          </div>

          <Section number="1" title="General Policy" color="amber">
            <p>All payments made through the SP International School online payment portal — including school fees and admission fees — are <strong className="text-gray-900">final and non-refundable</strong> once processed successfully.</p>
          </Section>

          <Section number="2" title="No Cancellation" color="amber">
            <ul className="list-disc pl-5 space-y-2">
              <li>Payments once initiated and successfully processed <strong className="text-gray-900">cannot be cancelled</strong> under any circumstances.</li>
              <li>It is the responsibility of the payer to ensure accuracy of all details prior to payment confirmation.</li>
            </ul>
          </Section>

          <Section number="3" title="No Refunds" color="amber">
            <p className="mb-3">The school follows a <strong className="text-gray-900">strict no-refund policy</strong> for:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Annual / termly / monthly school fees</li>
              <li>Admission and registration fees</li>
            </ul>
            <p className="mt-3">No refund will be issued once the payment gateway confirms a successful transaction, regardless of the reason.</p>
          </Section>

          <Section number="4" title="Failed Transactions" color="amber">
            <p>If an amount is debited from your account but the transaction is not confirmed, the deducted amount will be <strong className="text-gray-900">automatically reversed by the bank or payment gateway</strong> within <strong className="text-gray-900">5–7 working days</strong> as per their standard reversal timelines.</p>
          </Section>

          <Section number="5" title="Disputes" color="amber">
            <p>If you believe there has been an error in your transaction — such as a duplicate charge or an incorrect amount — please contact us immediately with your transaction reference number. We will investigate and coordinate with the payment gateway on your behalf.</p>
          </Section>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-5">
            <p className="font-semibold text-gray-900 mb-2">Payment-related queries</p>
            <p className="text-gray-600 mb-1">Email:{' '}
              <a href="mailto:spinternationalschool2021@gmail.com" className="text-amber-600 hover:underline font-medium">spinternationalschool2021@gmail.com</a>
            </p>
            <p className="text-gray-600">Phone:{' '}
              <a href="tel:+919888468343" className="text-amber-600 hover:underline font-medium">+91 98884 68343</a>
            </p>
          </div>

        </div>
      </main>

      <SpFooter logo={logo} active="refund" />
    </div>
  )
}

function Section({ number, title, children, color }) {
  const bg = color === 'amber' ? 'bg-amber-500' : color === 'blue' ? 'bg-blue-600' : 'bg-indigo-600'
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
