import { Link } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'

export default function SpTerms() {
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
      <div className="bg-gradient-to-b from-indigo-50 to-white border-b border-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-end gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Terms &amp; Conditions</h1>
          </div>
          <p className="text-gray-500 text-sm pl-16">SP International School · Sardar Patel Educational Society</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="space-y-10 text-sm leading-relaxed text-gray-600">

          <p className="text-base text-gray-700">
            Welcome to <strong className="text-gray-900">SP International School</strong>, operated by{' '}
            <strong className="text-gray-900">Sardar Patel Educational Society</strong>. By accessing our website
            or portal and using our services, you agree to be bound by the following terms and conditions.
          </p>

          <Section number="1" title="Services" color="indigo">
            <p>The school provides educational services including admissions, academic programmes, and an online fee payment facility through a secure payment portal.</p>
          </Section>

          <Section number="2" title="Payments" color="indigo">
            <ul className="list-disc pl-5 space-y-2">
              <li>All payments are accepted in <strong className="text-gray-900">Indian Rupees (INR)</strong> only.</li>
              <li>Accepted payment types include <strong className="text-gray-900">school fees and admission fees</strong>.</li>
              <li>Payments are processed through secure, PCI-compliant third-party payment gateways.</li>
              <li>The school is not responsible for transaction failures arising from bank outages, network issues, or payment gateway downtime.</li>
            </ul>
          </Section>

          <Section number="3" title="No Cancellation" color="indigo">
            <ul className="list-disc pl-5 space-y-2">
              <li>Once a payment has been successfully processed, it <strong className="text-gray-900">cannot be cancelled</strong> under any circumstances.</li>
              <li>Please verify all details carefully before confirming any payment.</li>
            </ul>
          </Section>

          <Section number="4" title="No Refund Policy" color="indigo">
            <ul className="list-disc pl-5 space-y-2">
              <li>All payments made toward school fees and admission fees are <strong className="text-gray-900">strictly non-refundable</strong>.</li>
              <li>No refund will be issued once the payment has been successfully processed by the gateway.</li>
              <li>In the event of a technical failure resulting in a deduction without confirmation, the amount will be reversed by the bank or payment gateway within 5–7 working days.</li>
            </ul>
          </Section>

          <Section number="5" title="User Responsibility" color="indigo">
            <p>Users are solely responsible for providing accurate information — including student name, admission number, fee head, and payment amount — while making payments. The school assumes no liability for errors arising from incorrect information submitted by the user.</p>
          </Section>

          <Section number="6" title="Transaction Confirmation" color="indigo">
            <ul className="list-disc pl-5 space-y-2">
              <li>A payment receipt will be generated and made available upon successful transaction completion.</li>
              <li>In the case of a failed transaction, the payment gateway will automatically initiate a reversal to the source account as per bank norms.</li>
            </ul>
          </Section>

          <Section number="7" title="Data Usage" color="indigo">
            <p>Personal information collected during transactions will be used exclusively for school administrative purposes and will not be shared with any third party except as required for payment processing or by law.</p>
          </Section>

          <Section number="8" title="Intellectual Property" color="indigo">
            <p>All content on this website and portal — including text, images, logos, and software — is the property of SP International School / Sardar Patel Educational Society and may not be reproduced or reused without prior written permission.</p>
          </Section>

          <Section number="9" title="Governing Law" color="indigo">
            <p>These Terms &amp; Conditions are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Punjab, India.</p>
          </Section>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-5">
            <p className="font-semibold text-gray-900 mb-2">Have questions about these terms?</p>
            <p className="text-gray-600">Reach us at{' '}
              <a href="mailto:spinternationalschool2021@gmail.com" className="text-indigo-600 hover:underline font-medium">spinternationalschool2021@gmail.com</a>
              {' '}or call{' '}
              <a href="tel:+919888468343" className="text-indigo-600 hover:underline font-medium">+91 98884 68343</a>
            </p>
          </div>

        </div>
      </main>

      <SpFooter logo={logo} active="terms" />
    </div>
  )
}

function Section({ number, title, children, color }) {
  const bg = color === 'indigo' ? 'bg-indigo-600' : color === 'amber' ? 'bg-amber-500' : 'bg-blue-600'
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
